import logging
import re
from typing import Dict, Any, List, Optional
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.storage import StorageManagementClient
from azure.mgmt.sql import SqlManagementClient

logger = logging.getLogger(__name__)

class AzureResourceManager:
    """
    Class to manage Azure resources
    """
    def __init__(self, credential, subscription_id):
        """
        Initialize the Azure Resource Manager
        
        Args:
            credential: Azure credential object
            subscription_id: Azure subscription ID
        """
        self.credential = credential
        self.subscription_id = subscription_id
        self.compute_client = None
        self.network_client = None
        self.storage_client = None
        self.sql_client = None
    
    def get_resource_details(self, resource_id: str) -> Dict[str, Any]:
        """
        Get details for a specific Azure resource
        
        Args:
            resource_id: The Azure resource ID
            
        Returns:
            dict: Resource details
        """
        # Parse the resource ID
        resource_type, resource_name, resource_group = self._parse_resource_id(resource_id)
        
        if not resource_type or not resource_name or not resource_group:
            raise ValueError(f"Invalid resource ID format: {resource_id}")
        
        # Get resource details based on type
        if "virtualMachines" in resource_type:
            return self._get_vm_details(resource_group, resource_name)
        elif "storageAccounts" in resource_type:
            return self._get_storage_details(resource_group, resource_name)
        elif "networkInterfaces" in resource_type:
            return self._get_nic_details(resource_group, resource_name)
        elif "virtualNetworks" in resource_type:
            return self._get_vnet_details(resource_group, resource_name)
        elif "publicIPAddresses" in resource_type:
            return self._get_public_ip_details(resource_group, resource_name)
        elif "networkSecurityGroups" in resource_type:
            return self._get_nsg_details(resource_group, resource_name)
        elif "servers" in resource_type and "databases" in resource_type:
            # SQL database
            server_name = resource_id.split("/servers/")[1].split("/")[0]
            db_name = resource_name
            return self._get_sql_db_details(resource_group, server_name, db_name)
        else:
            # Generic resource details
            return {
                "id": resource_id,
                "name": resource_name,
                "type": resource_type,
                "resourceGroup": resource_group,
                "properties": {
                    "provisioningState": "Unknown",
                    "resourceType": resource_type
                }
            }
    
    def _parse_resource_id(self, resource_id: str) -> tuple:
        """
        Parse an Azure resource ID into its components
        
        Args:
            resource_id: The Azure resource ID
            
        Returns:
            tuple: (resource_type, resource_name, resource_group)
        """
        # Handle both short and long resource IDs
        if resource_id.startswith("/subscriptions/"):
            # Long format: /subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.{Provider}/{resourceType}/{name}
            match = re.search(r'/resourceGroups/([^/]+)/providers/([^/]+\.[^/]+)/([^/]+)/([^/]+)(?:/|$)', resource_id)
            if match:
                resource_group = match.group(1)
                provider = match.group(2)
                resource_type = match.group(3)
                resource_name = match.group(4)
                return f"{provider}/{resource_type}", resource_name, resource_group
        else:
            # Short format: {resourceType}/{name}
            parts = resource_id.split('/')
            if len(parts) >= 2:
                resource_type = '/'.join(parts[:-1])
                resource_name = parts[-1]
                # For short format, we need to guess the resource group
                resource_group = f"rg-{resource_name.lower()}"
                return resource_type, resource_name, resource_group
        
        return None, None, None
    
    def _get_vm_details(self, resource_group: str, vm_name: str) -> Dict[str, Any]:
        """Get details for a virtual machine"""
        if not self.compute_client:
            self.compute_client = ComputeManagementClient(self.credential, self.subscription_id)
        
        try:
            vm = self.compute_client.virtual_machines.get(resource_group, vm_name)
            return {
                "id": vm.id,
                "name": vm.name,
                "type": "Microsoft.Compute/virtualMachines",
                "location": vm.location,
                "resourceGroup": resource_group,
                "properties": {
                    "vmSize": vm.hardware_profile.vm_size,
                    "osType": vm.storage_profile.os_disk.os_type,
                    "provisioningState": vm.provisioning_state,
                    "computerName": vm.os_profile.computer_name if vm.os_profile else None,
                    "adminUsername": vm.os_profile.admin_username if vm.os_profile else None,
                    "networkInterfaces": [nic.id for nic in vm.network_profile.network_interfaces] if vm.network_profile else []
                }
            }
        except Exception as e:
            logger.error(f"Error getting VM details: {str(e)}")
            return {
                "id": f"/subscriptions/{self.subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Compute/virtualMachines/{vm_name}",
                "name": vm_name,
                "type": "Microsoft.Compute/virtualMachines",
                "resourceGroup": resource_group,
                "error": str(e)
            }
    
    def _get_storage_details(self, resource_group: str, storage_name: str) -> Dict[str, Any]:
        """Get details for a storage account"""
        if not self.storage_client:
            self.storage_client = StorageManagementClient(self.credential, self.subscription_id)
        
        try:
            storage = self.storage_client.storage_accounts.get_properties(resource_group, storage_name)
            return {
                "id": storage.id,
                "name": storage.name,
                "type": "Microsoft.Storage/storageAccounts",
                "location": storage.location,
                "resourceGroup": resource_group,
                "properties": {
                    "provisioningState": storage.provisioning_state,
                    "primaryEndpoints": storage.primary_endpoints._asdict() if storage.primary_endpoints else {},
                    "accessTier": storage.access_tier,
                    "supportsHttpsTrafficOnly": storage.enable_https_traffic_only,
                    "encryption": {
                        "services": storage.encryption.services._asdict() if storage.encryption and storage.encryption.services else {},
                        "keySource": storage.encryption.key_source if storage.encryption else None
                    }
                }
            }
        except Exception as e:
            logger.error(f"Error getting storage details: {str(e)}")
            return {
                "id": f"/subscriptions/{self.subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Storage/storageAccounts/{storage_name}",
                "name": storage_name,
                "type": "Microsoft.Storage/storageAccounts",
                "resourceGroup": resource_group,
                "error": str(e)
            }
    
    def _get_nic_details(self, resource_group: str, nic_name: str) -> Dict[str, Any]:
        """Get details for a network interface"""
        if not self.network_client:
            self.network_client = NetworkManagementClient(self.credential, self.subscription_id)
        
        try:
            nic = self.network_client.network_interfaces.get(resource_group, nic_name)
            return {
                "id": nic.id,
                "name": nic.name,
                "type": "Microsoft.Network/networkInterfaces",
                "location": nic.location,
                "resourceGroup": resource_group,
                "properties": {
                    "provisioningState": nic.provisioning_state,
                    "ipConfigurations": [
                        {
                            "name": ip_config.name,
                            "privateIPAddress": ip_config.private_ip_address,
                            "privateIPAllocationMethod": ip_config.private_ip_allocation_method,
                            "publicIPAddress": ip_config.public_ip_address.id if ip_config.public_ip_address else None,
                            "subnet": ip_config.subnet.id if ip_config.subnet else None
                        }
                        for ip_config in nic.ip_configurations
                    ] if nic.ip_configurations else [],
                    "networkSecurityGroup": nic.network_security_group.id if nic.network_security_group else None,
                    "virtualMachine": nic.virtual_machine.id if nic.virtual_machine else None
                }
            }
        except Exception as e:
            logger.error(f"Error getting NIC details: {str(e)}")
            return {
                "id": f"/subscriptions/{self.subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Network/networkInterfaces/{nic_name}",
                "name": nic_name,
                "type": "Microsoft.Network/networkInterfaces",
                "resourceGroup": resource_group,
                "error": str(e)
            }
    
    def _get_vnet_details(self, resource_group: str, vnet_name: str) -> Dict[str, Any]:
        """Get details for a virtual network"""
        if not self.network_client:
            self.network_client = NetworkManagementClient(self.credential, self.subscription_id)
        
        try:
            vnet = self.network_client.virtual_networks.get(resource_group, vnet_name)
            return {
                "id": vnet.id,
                "name": vnet.name,
                "type": "Microsoft.Network/virtualNetworks",
                "location": vnet.location,
                "resourceGroup": resource_group,
                "properties": {
                    "provisioningState": vnet.provisioning_state,
                    "addressSpace": {
                        "addressPrefixes": vnet.address_space.address_prefixes if vnet.address_space else []
                    },
                    "subnets": [
                        {
                            "name": subnet.name,
                            "id": subnet.id,
                            "addressPrefix": subnet.address_prefix
                        }
                        for subnet in vnet.subnets
                    ] if vnet.subnets else []
                }
            }
        except Exception as e:
            logger.error(f"Error getting VNet details: {str(e)}")
            return {
                "id": f"/subscriptions/{self.subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Network/virtualNetworks/{vnet_name}",
                "name": vnet_name,
                "type": "Microsoft.Network/virtualNetworks",
                "resourceGroup": resource_group,
                "error": str(e)
            }
    
    def _get_public_ip_details(self, resource_group: str, ip_name: str) -> Dict[str, Any]:
        """Get details for a public IP address"""
        if not self.network_client:
            self.network_client = NetworkManagementClient(self.credential, self.subscription_id)
        
        try:
            ip = self.network_client.public_ip_addresses.get(resource_group, ip_name)
            return {
                "id": ip.id,
                "name": ip.name,
                "type": "Microsoft.Network/publicIPAddresses",
                "location": ip.location,
                "resourceGroup": resource_group,
                "properties": {
                    "provisioningState": ip.provisioning_state,
                    "ipAddress": ip.ip_address,
                    "publicIPAllocationMethod": ip.public_ip_allocation_method,
                    "dnsSettings": {
                        "fqdn": ip.dns_settings.fqdn if ip.dns_settings else None,
                        "domainNameLabel": ip.dns_settings.domain_name_label if ip.dns_settings else None
                    } if ip.dns_settings else {}
                }
            }
        except Exception as e:
            logger.error(f"Error getting Public IP details: {str(e)}")
            return {
                "id": f"/subscriptions/{self.subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Network/publicIPAddresses/{ip_name}",
                "name": ip_name,
                "type": "Microsoft.Network/publicIPAddresses",
                "resourceGroup": resource_group,
                "error": str(e)
            }
    
    def _get_nsg_details(self, resource_group: str, nsg_name: str) -> Dict[str, Any]:
        """Get details for a network security group"""
        if not self.network_client:
            self.network_client = NetworkManagementClient(self.credential, self.subscription_id)
        
        try:
            nsg = self.network_client.network_security_groups.get(resource_group, nsg_name)
            return {
                "id": nsg.id,
                "name": nsg.name,
                "type": "Microsoft.Network/networkSecurityGroups",
                "location": nsg.location,
                "resourceGroup": resource_group,
                "properties": {
                    "provisioningState": nsg.provisioning_state,
                    "securityRules": [
                        {
                            "name": rule.name,
                            "protocol": rule.protocol,
                            "sourcePortRange": rule.source_port_range,
                            "destinationPortRange": rule.destination_port_range,
                            "sourceAddressPrefix": rule.source_address_prefix,
                            "destinationAddressPrefix": rule.destination_address_prefix,
                            "access": rule.access,
                            "priority": rule.priority,
                            "direction": rule.direction
                        }
                        for rule in nsg.security_rules
                    ] if nsg.security_rules else []
                }
            }
        except Exception as e:
            logger.error(f"Error getting NSG details: {str(e)}")
            return {
                "id": f"/subscriptions/{self.subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Network/networkSecurityGroups/{nsg_name}",
                "name": nsg_name,
                "type": "Microsoft.Network/networkSecurityGroups",
                "resourceGroup": resource_group,
                "error": str(e)
            }
    
    def _get_sql_db_details(self, resource_group: str, server_name: str, db_name: str) -> Dict[str, Any]:
        """Get details for a SQL database"""
        if not self.sql_client:
            self.sql_client = SqlManagementClient(self.credential, self.subscription_id)
        
        try:
            db = self.sql_client.databases.get(resource_group, server_name, db_name)
            return {
                "id": db.id,
                "name": db.name,
                "type": "Microsoft.Sql/servers/databases",
                "location": db.location,
                "resourceGroup": resource_group,
                "properties": {
                    "provisioningState": "Succeeded",  # SQL API doesn't expose provisioning state directly
                    "status": db.status,
                    "collation": db.collation,
                    "maxSizeBytes": db.max_size_bytes,
                    "edition": db.edition,
                    "elasticPoolName": db.elastic_pool_id.split('/')[-1] if db.elastic_pool_id else None,
                    "serverName": server_name
                }
            }
        except Exception as e:
            logger.error(f"Error getting SQL DB details: {str(e)}")
            return {
                "id": f"/subscriptions/{self.subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Sql/servers/{server_name}/databases/{db_name}",
                "name": db_name,
                "type": "Microsoft.Sql/servers/databases",
                "resourceGroup": resource_group,
                "error": str(e)
            }

