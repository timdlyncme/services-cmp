from azure.identity import ClientSecretCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.storage import StorageManagementClient
from azure.mgmt.sql import SqlManagementClient
import re
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class AzureResourceManager:
    def __init__(self, credential=None, subscription_id=None):
        self.credential = credential
        self.subscription_id = subscription_id
        self.resource_client = None
        self.compute_client = None
        self.network_client = None
        self.storage_client = None
        self.sql_client = None
        
        if credential and subscription_id:
            self.initialize_clients()
    
    def set_credentials(self, credential, subscription_id):
        """Set Azure credentials and initialize clients"""
        self.credential = credential
        self.subscription_id = subscription_id
        self.initialize_clients()
    
    def initialize_clients(self):
        """Initialize Azure management clients"""
        if not self.credential or not self.subscription_id:
            raise ValueError("Credential and subscription_id must be set")
        
        self.resource_client = ResourceManagementClient(self.credential, self.subscription_id)
        self.compute_client = ComputeManagementClient(self.credential, self.subscription_id)
        self.network_client = NetworkManagementClient(self.credential, self.subscription_id)
        self.storage_client = StorageManagementClient(self.credential, self.subscription_id)
        self.sql_client = SqlManagementClient(self.credential, self.subscription_id)
    
    def parse_resource_id(self, resource_id: str) -> Dict[str, str]:
        """
        Parse an Azure resource ID into its components
        
        Args:
            resource_id: The Azure resource ID
            
        Returns:
            Dict with resource components (subscription_id, resource_group, provider, resource_type, resource_name)
        """
        # Handle both full resource IDs and short resource names
        if not resource_id.startswith('/'):
            # This is just a resource name, not a full ID
            return {
                "resource_name": resource_id
            }
        
        # Parse full Azure resource ID
        # Format: /subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/{provider}/{resource_type}/{resource_name}
        pattern = r"/subscriptions/([^/]+)/resourceGroups/([^/]+)/providers/([^/]+)/([^/]+)/([^/]+)(?:/([^/]+))?"
        match = re.match(pattern, resource_id)
        
        if not match:
            raise ValueError(f"Invalid Azure resource ID format: {resource_id}")
        
        groups = match.groups()
        result = {
            "subscription_id": groups[0],
            "resource_group": groups[1],
            "provider": groups[2],
            "resource_type": groups[3],
            "resource_name": groups[4]
        }
        
        # Some resources have a sub-resource (e.g., SQL databases)
        if len(groups) > 5 and groups[5]:
            result["sub_resource_name"] = groups[5]
        
        return result
    
    def get_resource_details(self, resource_id: str) -> Dict[str, Any]:
        """
        Get details for a specific Azure resource
        
        Args:
            resource_id: The Azure resource ID or resource name
            
        Returns:
            Dict with resource details
        """
        try:
            # Parse the resource ID
            resource_info = self.parse_resource_id(resource_id)
            
            # If we only have a resource name, try to find it across resource groups
            if "resource_name" in resource_info and "resource_group" not in resource_info:
                return self._find_resource_by_name(resource_info["resource_name"])
            
            # Get the resource based on its type
            provider = resource_info.get("provider", "").lower()
            resource_type = resource_info.get("resource_type", "").lower()
            
            if "Microsoft.Compute".lower() in provider:
                if "virtualMachines".lower() in resource_type:
                    return self._get_virtual_machine_details(resource_info)
            elif "Microsoft.Storage".lower() in provider:
                if "storageAccounts".lower() in resource_type:
                    return self._get_storage_account_details(resource_info)
            elif "Microsoft.Network".lower() in provider:
                if "virtualNetworks".lower() in resource_type:
                    return self._get_virtual_network_details(resource_info)
                elif "networkSecurityGroups".lower() in resource_type:
                    return self._get_nsg_details(resource_info)
            elif "Microsoft.Sql".lower() in provider:
                if "servers".lower() in resource_type:
                    if "sub_resource_name" in resource_info:
                        return self._get_sql_database_details(resource_info)
                    else:
                        return self._get_sql_server_details(resource_info)
            
            # Default to generic resource details
            return self._get_generic_resource_details(resource_info)
        
        except Exception as e:
            logger.error(f"Error getting resource details: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "resource_id": resource_id
            }
    
    def _find_resource_by_name(self, resource_name: str) -> Dict[str, Any]:
        """Find a resource by name across all resource groups"""
        try:
            # List all resources
            resources = list(self.resource_client.resources.list())
            
            # Find resources matching the name
            matching_resources = [r for r in resources if r.name.lower() == resource_name.lower()]
            
            if not matching_resources:
                raise ValueError(f"Resource with name '{resource_name}' not found")
            
            # Use the first matching resource
            resource = matching_resources[0]
            
            # Parse the resource ID to get components
            resource_info = self.parse_resource_id(resource.id)
            
            # Get detailed information based on resource type
            return self.get_resource_details(resource.id)
        
        except Exception as e:
            logger.error(f"Error finding resource by name: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "resource_name": resource_name
            }
    
    def _get_generic_resource_details(self, resource_info: Dict[str, str]) -> Dict[str, Any]:
        """Get generic details for any resource type"""
        try:
            # Get the resource
            resource = self.resource_client.resources.get(
                resource_group_name=resource_info["resource_group"],
                resource_provider_namespace=resource_info["provider"],
                parent_resource_path="",
                resource_type=resource_info["resource_type"],
                resource_name=resource_info["resource_name"],
                api_version="2021-04-01"  # Use a recent API version
            )
            
            # Format the response
            return {
                "id": resource.id,
                "name": resource.name,
                "type": resource.type,
                "location": resource.location,
                "tags": resource.tags,
                "properties": resource.properties,
                "sku": resource.sku.as_dict() if resource.sku else None,
                "kind": resource.kind,
                "managed_by": resource.managed_by,
                "identity": resource.identity.as_dict() if resource.identity else None
            }
        except Exception as e:
            logger.error(f"Error getting generic resource details: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "resource_info": resource_info
            }
    
    def _get_virtual_machine_details(self, resource_info: Dict[str, str]) -> Dict[str, Any]:
        """Get details for a virtual machine"""
        try:
            # Get the VM
            vm = self.compute_client.virtual_machines.get(
                resource_group_name=resource_info["resource_group"],
                vm_name=resource_info["resource_name"],
                expand="instanceView"
            )
            
            # Get VM status
            status = "Unknown"
            if vm.instance_view and vm.instance_view.statuses:
                for s in vm.instance_view.statuses:
                    if s.code.startswith("PowerState/"):
                        status = s.code.split("/")[1]
                        break
            
            # Format the response
            result = {
                "id": vm.id,
                "name": vm.name,
                "type": vm.type,
                "location": vm.location,
                "status": status,
                "properties": {
                    "vmSize": vm.hardware_profile.vm_size,
                    "osType": vm.storage_profile.os_disk.os_type,
                    "adminUsername": vm.os_profile.admin_username if vm.os_profile else None,
                    "computerName": vm.os_profile.computer_name if vm.os_profile else None,
                    "provisioningState": vm.provisioning_state,
                    "vmId": vm.vm_id,
                    "networkProfile": {
                        "networkInterfaces": [
                            {"id": nic.id} for nic in vm.network_profile.network_interfaces
                        ]
                    },
                    "storageProfile": {
                        "imageReference": vm.storage_profile.image_reference.as_dict() if vm.storage_profile.image_reference else None,
                        "osDisk": {
                            "name": vm.storage_profile.os_disk.name,
                            "createOption": vm.storage_profile.os_disk.create_option,
                            "diskSizeGB": vm.storage_profile.os_disk.disk_size_gb,
                            "managedDisk": vm.storage_profile.os_disk.managed_disk.as_dict() if vm.storage_profile.os_disk.managed_disk else None
                        },
                        "dataDisks": [
                            {
                                "name": disk.name,
                                "diskSizeGB": disk.disk_size_gb,
                                "lun": disk.lun,
                                "createOption": disk.create_option,
                                "managedDisk": disk.managed_disk.as_dict() if disk.managed_disk else None
                            } for disk in vm.storage_profile.data_disks
                        ]
                    }
                },
                "tags": vm.tags,
                "zones": vm.zones
            }
            
            return result
        except Exception as e:
            logger.error(f"Error getting VM details: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "resource_info": resource_info
            }
    
    def _get_storage_account_details(self, resource_info: Dict[str, str]) -> Dict[str, Any]:
        """Get details for a storage account"""
        try:
            # Get the storage account
            storage = self.storage_client.storage_accounts.get_properties(
                resource_group_name=resource_info["resource_group"],
                account_name=resource_info["resource_name"]
            )
            
            # Format the response
            result = {
                "id": storage.id,
                "name": storage.name,
                "type": storage.type,
                "location": storage.location,
                "status": storage.provisioning_state,
                "properties": {
                    "provisioningState": storage.provisioning_state,
                    "primaryEndpoints": storage.primary_endpoints.as_dict() if storage.primary_endpoints else None,
                    "primaryLocation": storage.primary_location,
                    "statusOfPrimary": storage.status_of_primary,
                    "creationTime": storage.creation_time.isoformat() if storage.creation_time else None,
                    "accessTier": storage.access_tier,
                    "supportsHttpsTrafficOnly": storage.enable_https_traffic_only,
                    "encryption": storage.encryption.as_dict() if storage.encryption else None,
                    "networkRuleSet": storage.network_rule_set.as_dict() if storage.network_rule_set else None
                },
                "sku": storage.sku.as_dict() if storage.sku else None,
                "kind": storage.kind,
                "tags": storage.tags
            }
            
            return result
        except Exception as e:
            logger.error(f"Error getting storage account details: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "resource_info": resource_info
            }
    
    def _get_virtual_network_details(self, resource_info: Dict[str, str]) -> Dict[str, Any]:
        """Get details for a virtual network"""
        try:
            # Get the virtual network
            vnet = self.network_client.virtual_networks.get(
                resource_group_name=resource_info["resource_group"],
                virtual_network_name=resource_info["resource_name"]
            )
            
            # Format the response
            result = {
                "id": vnet.id,
                "name": vnet.name,
                "type": vnet.type,
                "location": vnet.location,
                "status": vnet.provisioning_state,
                "properties": {
                    "provisioningState": vnet.provisioning_state,
                    "addressSpace": {
                        "addressPrefixes": vnet.address_space.address_prefixes if vnet.address_space else []
                    },
                    "subnets": [
                        {
                            "id": subnet.id,
                            "name": subnet.name,
                            "addressPrefix": subnet.address_prefix,
                            "networkSecurityGroup": subnet.network_security_group.id if subnet.network_security_group else None,
                            "routeTable": subnet.route_table.id if subnet.route_table else None,
                            "serviceEndpoints": [se.as_dict() for se in subnet.service_endpoints] if subnet.service_endpoints else []
                        } for subnet in vnet.subnets
                    ] if vnet.subnets else [],
                    "virtualNetworkPeerings": [
                        {
                            "id": peering.id,
                            "name": peering.name,
                            "remoteVirtualNetwork": peering.remote_virtual_network.id if peering.remote_virtual_network else None,
                            "peeringState": peering.peering_state,
                            "allowVirtualNetworkAccess": peering.allow_virtual_network_access,
                            "allowForwardedTraffic": peering.allow_forwarded_traffic,
                            "allowGatewayTransit": peering.allow_gateway_transit,
                            "useRemoteGateways": peering.use_remote_gateways
                        } for peering in vnet.virtual_network_peerings
                    ] if vnet.virtual_network_peerings else []
                },
                "tags": vnet.tags
            }
            
            return result
        except Exception as e:
            logger.error(f"Error getting virtual network details: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "resource_info": resource_info
            }
    
    def _get_nsg_details(self, resource_info: Dict[str, str]) -> Dict[str, Any]:
        """Get details for a network security group"""
        try:
            # Get the NSG
            nsg = self.network_client.network_security_groups.get(
                resource_group_name=resource_info["resource_group"],
                network_security_group_name=resource_info["resource_name"]
            )
            
            # Format the response
            result = {
                "id": nsg.id,
                "name": nsg.name,
                "type": nsg.type,
                "location": nsg.location,
                "status": nsg.provisioning_state,
                "properties": {
                    "provisioningState": nsg.provisioning_state,
                    "securityRules": [
                        {
                            "id": rule.id,
                            "name": rule.name,
                            "protocol": rule.protocol,
                            "sourcePortRange": rule.source_port_range,
                            "destinationPortRange": rule.destination_port_range,
                            "sourceAddressPrefix": rule.source_address_prefix,
                            "destinationAddressPrefix": rule.destination_address_prefix,
                            "access": rule.access,
                            "priority": rule.priority,
                            "direction": rule.direction,
                            "description": rule.description
                        } for rule in nsg.security_rules
                    ] if nsg.security_rules else [],
                    "defaultSecurityRules": [
                        {
                            "id": rule.id,
                            "name": rule.name,
                            "protocol": rule.protocol,
                            "sourcePortRange": rule.source_port_range,
                            "destinationPortRange": rule.destination_port_range,
                            "sourceAddressPrefix": rule.source_address_prefix,
                            "destinationAddressPrefix": rule.destination_address_prefix,
                            "access": rule.access,
                            "priority": rule.priority,
                            "direction": rule.direction,
                            "description": rule.description
                        } for rule in nsg.default_security_rules
                    ] if nsg.default_security_rules else []
                },
                "tags": nsg.tags
            }
            
            return result
        except Exception as e:
            logger.error(f"Error getting NSG details: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "resource_info": resource_info
            }
    
    def _get_sql_server_details(self, resource_info: Dict[str, str]) -> Dict[str, Any]:
        """Get details for a SQL server"""
        try:
            # Get the SQL server
            sql_server = self.sql_client.servers.get(
                resource_group_name=resource_info["resource_group"],
                server_name=resource_info["resource_name"]
            )
            
            # Format the response
            result = {
                "id": sql_server.id,
                "name": sql_server.name,
                "type": sql_server.type,
                "location": sql_server.location,
                "status": "Available",  # SQL servers don't have a status field
                "properties": {
                    "fullyQualifiedDomainName": sql_server.fully_qualified_domain_name,
                    "version": sql_server.version,
                    "administratorLogin": sql_server.administrator_login,
                    "state": sql_server.state,
                    "publicNetworkAccess": sql_server.public_network_access
                },
                "tags": sql_server.tags
            }
            
            return result
        except Exception as e:
            logger.error(f"Error getting SQL server details: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "resource_info": resource_info
            }
    
    def _get_sql_database_details(self, resource_info: Dict[str, str]) -> Dict[str, Any]:
        """Get details for a SQL database"""
        try:
            # Get the SQL database
            sql_db = self.sql_client.databases.get(
                resource_group_name=resource_info["resource_group"],
                server_name=resource_info["resource_name"],
                database_name=resource_info["sub_resource_name"]
            )
            
            # Format the response
            result = {
                "id": sql_db.id,
                "name": sql_db.name,
                "type": sql_db.type,
                "location": sql_db.location,
                "status": sql_db.status,
                "properties": {
                    "collation": sql_db.collation,
                    "creationDate": sql_db.creation_date.isoformat() if sql_db.creation_date else None,
                    "databaseId": sql_db.database_id,
                    "earliestRestoreDate": sql_db.earliest_restore_date.isoformat() if sql_db.earliest_restore_date else None,
                    "edition": sql_db.edition,
                    "maxSizeBytes": sql_db.max_size_bytes,
                    "requestedServiceObjectiveName": sql_db.requested_service_objective_name,
                    "serviceLevelObjective": sql_db.service_level_objective,
                    "status": sql_db.status,
                    "elasticPoolName": sql_db.elastic_pool_name
                },
                "sku": sql_db.sku.as_dict() if sql_db.sku else None,
                "tags": sql_db.tags
            }
            
            return result
        except Exception as e:
            logger.error(f"Error getting SQL database details: {str(e)}", exc_info=True)
            return {
                "error": str(e),
                "resource_info": resource_info
            }

