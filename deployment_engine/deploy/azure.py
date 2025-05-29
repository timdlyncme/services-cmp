from azure.identity import ClientSecretCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.resource.resources.models import DeploymentMode
import json
import requests
import os
import tempfile
import subprocess
import logging
from datetime import datetime

class AzureDeployer:
    def __init__(self):
        # Initialize with empty credentials
        self.client_id = None
        self.client_secret = None
        self.tenant_id = None
        self.subscription_id = None
        self.credential = None
        self.resource_client = None
        
    def set_credentials(self, client_id, client_secret, tenant_id, subscription_id=None):
        """
        Set Azure credentials for deployments
        
        Args:
            client_id (str): Azure AD Application (client) ID
            client_secret (str): Azure AD Application secret
            tenant_id (str): Azure AD Tenant ID
            subscription_id (str, optional): Azure Subscription ID
        """
        # Log credential information (without exposing secrets)
        logging.info(f"Setting Azure credentials: client_id={bool(client_id)}, client_secret={bool(client_secret)}, tenant_id={bool(tenant_id)}, subscription_id={bool(subscription_id)}")
        
        self.client_id = client_id
        self.client_secret = client_secret
        self.tenant_id = tenant_id
        self.subscription_id = subscription_id
        
        # Create credential
        try:
            self.credential = ClientSecretCredential(
                tenant_id=self.tenant_id,
                client_id=self.client_id,
                client_secret=self.client_secret
            )
            logging.info("Successfully created ClientSecretCredential")
        except Exception as e:
            logging.error(f"Error creating ClientSecretCredential: {str(e)}")
            raise
        
        # Create resource client if subscription_id is provided
        if subscription_id:
            try:
                self.resource_client = ResourceManagementClient(
                    credential=self.credential,
                    subscription_id=self.subscription_id
                )
                logging.info("Successfully created ResourceManagementClient")
                
                # Test the credentials
                self._test_credentials()
            except Exception as e:
                logging.error(f"Error creating ResourceManagementClient: {str(e)}")
                raise

    def get_credential_status(self):
        """
        Get the status of Azure credentials
        
        Returns:
            dict: Status of Azure credentials
        """
        if not self.client_id:
            return {
                "configured": False,
                "message": "Azure credentials not configured"
            }
        
        try:
            # If no subscription_id, just check if we can get a token
            if not self.subscription_id:
                # Just check if the credential is valid
                token = self.credential.get_token("https://management.azure.com/.default")
                return {
                    "configured": True,
                    "client_id": self.client_id,
                    "tenant_id": self.tenant_id,
                    "message": "Azure credentials are valid"
                }
            
            # If subscription_id is provided, test the resource client
            self._test_credentials()
            
            return {
                "configured": True,
                "client_id": self.client_id,
                "tenant_id": self.tenant_id,
                "subscription_id": self.subscription_id,
                "message": "Azure credentials are valid"
            }
        except Exception as e:
            return {
                "configured": True,
                "client_id": self.client_id,
                "tenant_id": self.tenant_id,
                "subscription_id": self.subscription_id if self.subscription_id else None,
                "valid": False,
                "message": f"Azure credentials are invalid: {str(e)}"
            }
    
    def _test_credentials(self):
        """Test Azure credentials by listing resource groups"""
        if not self.resource_client:
            raise ValueError("Azure credentials not configured with subscription_id")
        
        # Try to list resource groups
        self.resource_client.resource_groups.list()
    
    def set_subscription(self, subscription_id):
        """
        Set the Azure subscription ID
        
        Args:
            subscription_id (str): Azure Subscription ID
        """
        if not self.credential:
            raise ValueError("Azure credentials not configured")
        
        self.subscription_id = subscription_id
        self.resource_client = ResourceManagementClient(
            credential=self.credential,
            subscription_id=self.subscription_id
        )
        
        # Test the credentials
        self._test_credentials()
        
        return {
            "message": "Subscription set successfully",
            "subscription_id": subscription_id
        }
    
    def list_subscriptions(self):
        """
        List available Azure subscriptions
        
        Returns:
            list: List of available subscriptions
        """
        if not self.credential:
            raise ValueError("Azure credentials not configured")
        
        from azure.mgmt.subscription import SubscriptionClient
        
        # Create subscription client
        subscription_client = SubscriptionClient(self.credential)
        
        # List subscriptions
        subscriptions = list(subscription_client.subscriptions.list())
        
        # Format response
        result = []
        for sub in subscriptions:
            result.append({
                "id": sub.subscription_id,
                "name": sub.display_name,
                "state": sub.state,
                "tenant_id": self.tenant_id  # Use the tenant_id from credentials
            })
        
        return result

    def deploy(self, resource_group, deployment_name, location, template_data, parameters=None, deployment_type="arm"):
        """
        Deploy an Azure ARM or Bicep template
        
        Args:
            resource_group (str): The resource group name
            deployment_name (str): The deployment name
            location (str): The Azure region
            template_data (dict): The template data, either URL or template body
            parameters (dict, optional): Parameters for the template
            deployment_type (str): 'arm' or 'bicep'
            
        Returns:
            dict: Deployment result with status and details
        """
        # Check if credentials are properly configured
        if not self.credential:
            logging.error(f"Azure credentials not configured. client_id={bool(self.client_id)}, client_secret={bool(self.client_secret)}, tenant_id={bool(self.tenant_id)}")
            raise ValueError("Azure credentials not configured")
        
        # If no resource_client exists (no subscription_id), try to get the first available subscription
        if not self.resource_client:
            self._ensure_resource_client()
        
        # Final check - ensure we have a resource client
        if not self.resource_client:
            logging.error(f"Azure credentials not configured. client_id={bool(self.client_id)}, client_secret={bool(self.client_secret)}, tenant_id={bool(self.tenant_id)}, subscription_id={bool(self.subscription_id)}, credential={self.credential is not None}")
            raise ValueError("Azure credentials not configured")
        
        # Ensure resource group exists
        self._ensure_resource_group(resource_group, location)
        
        # Prepare template
        if deployment_type == "bicep" and "template_body" in template_data:
            # Convert Bicep to ARM template
            template_content = self._convert_bicep_to_arm(template_data["template_body"])
        elif "template_url" in template_data:
            # Use template URL directly for ARM templates
            template_uri = template_data["template_url"]
            return self._deploy_from_template_uri(resource_group, deployment_name, template_uri, parameters)
        elif "template_body" in template_data:
            # Use template body directly for ARM templates
            template_content = template_data["template_body"]
        else:
            raise ValueError("Invalid template data. Must provide either template_url or template_body")
        
        # Prepare parameters - extract just the value from complex parameter objects
        params = {}
        if parameters:
            print(f"Original parameters: {parameters}")
            for key, value in parameters.items():
                # Check if the parameter is a complex object with a 'value' field
                if isinstance(value, dict) and 'value' in value:
                    # Extract just the value for Azure
                    params[key] = {
                        "value": value['value']
                    }
                    print(f"Parameter {key}: Extracted value '{value['value']}' from complex object")
                else:
                    # Use the parameter value directly
                    params[key] = {
                        "value": value
                    }
                    print(f"Parameter {key}: Using direct value '{value}'")
            print(f"Processed parameters for Azure: {params}")
        
        # Create deployment
        try:
            # Ensure template is a valid JSON object
            if isinstance(template_content, str):
                try:
                    template_json = json.loads(template_content)
                except json.JSONDecodeError:
                    raise ValueError("Template content is not valid JSON")
            else:
                template_json = template_content
            
            # Create deployment properties with the required 'properties' field
            deployment_properties = {
                "properties": {
                    "mode": DeploymentMode.incremental,
                    "template": template_json,
                    "parameters": params
                }
            }
            
            # Start deployment
            deployment_async_operation = self.resource_client.deployments.begin_create_or_update(
                resource_group_name=resource_group,
                deployment_name=deployment_name,
                parameters=deployment_properties
            )
            
            # Return initial status
            return {
                "status": "in_progress",
                "azure_deployment_id": deployment_name,
                "resource_group": resource_group
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def _deploy_from_template_uri(self, resource_group, deployment_name, template_uri, parameters=None):
        """Deploy using a template URI"""
        # Prepare parameters - extract just the value from complex parameter objects
        params = {}
        if parameters:
            print(f"Original parameters: {parameters}")
            for key, value in parameters.items():
                # Check if the parameter is a complex object with a 'value' field
                if isinstance(value, dict) and 'value' in value:
                    # Extract just the value for Azure
                    params[key] = {
                        "value": value['value']
                    }
                    print(f"Parameter {key}: Extracted value '{value['value']}' from complex object")
                else:
                    # Use the parameter value directly
                    params[key] = {
                        "value": value
                    }
                    print(f"Parameter {key}: Using direct value '{value}'")
            print(f"Processed parameters for Azure: {params}")
        
        # Create deployment
        try:
            # Create deployment properties with the required 'properties' field
            deployment_properties = {
                "properties": {
                    "mode": DeploymentMode.incremental,
                    "templateLink": {
                        "uri": template_uri
                    },
                    "parameters": params
                }
            }
            
            # Start deployment
            deployment_async_operation = self.resource_client.deployments.begin_create_or_update(
                resource_group_name=resource_group,
                deployment_name=deployment_name,
                parameters=deployment_properties
            )
            
            # Return initial status
            return {
                "status": "in_progress",
                "azure_deployment_id": deployment_name,
                "resource_group": resource_group
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def _ensure_resource_group(self, resource_group, location):
        """Ensure resource group exists, create if it doesn't"""
        if not self.resource_client.resource_groups.check_existence(resource_group):
            self.resource_client.resource_groups.create_or_update(
                resource_group_name=resource_group,
                parameters={"location": location}
            )
    
    def _ensure_resource_client(self):
        """
        Ensure resource_client is available, auto-selecting subscription if needed
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # Check if credentials are properly configured
        if not self.credential:
            logger.error(f"Azure credentials not configured. client_id={bool(self.client_id)}, client_secret={bool(self.client_secret)}, tenant_id={bool(self.tenant_id)}")
            raise ValueError("Azure credentials not configured")
        
        # If no resource_client exists (no subscription_id), try to get the first available subscription
        if not self.resource_client:
            logger.info("No subscription_id provided, attempting to get first available subscription")
            try:
                subscriptions = self.list_subscriptions()
                if not subscriptions:
                    logger.error("No Azure subscriptions found or accessible")
                    raise ValueError("No Azure subscriptions found or accessible")
                
                # Use the first available subscription
                first_subscription = subscriptions[0]
                self.subscription_id = first_subscription["id"]
                logger.info(f"Using first available subscription: {self.subscription_id}")
                
                # Create resource client with the subscription
                self.resource_client = ResourceManagementClient(
                    credential=self.credential,
                    subscription_id=self.subscription_id
                )
                logger.info("Successfully created ResourceManagementClient")
                
            except Exception as e:
                logger.error(f"Failed to auto-select subscription: {str(e)}")
                raise ValueError(f"Azure credentials not configured properly: {str(e)}")
        
        # Final check - ensure we have a resource client
        if not self.resource_client:
            logger.error("Azure credentials not configured")
            raise ValueError("Azure credentials not configured")

    def _convert_bicep_to_arm(self, bicep_content):
        """
        Convert Bicep template to ARM template
        
        Args:
            bicep_content (str): Bicep template content
            
        Returns:
            str: ARM template content
        """
        # Create a temporary file for the Bicep content
        with tempfile.NamedTemporaryFile(suffix=".bicep", delete=False) as temp_bicep:
            temp_bicep.write(bicep_content.encode())
            temp_bicep_path = temp_bicep.name
        
        try:
            # Create a temporary file for the ARM output
            temp_arm_path = temp_bicep_path.replace(".bicep", ".json")
            
            # Run the Bicep CLI to convert to ARM
            result = subprocess.run(
                ["az", "bicep", "build", "--file", temp_bicep_path, "--outfile", temp_arm_path],
                capture_output=True,
                text=True,
                check=True
            )
            
            # Read the ARM template
            with open(temp_arm_path, "r") as arm_file:
                arm_content = arm_file.read()
            
            return arm_content
            
        except subprocess.CalledProcessError as e:
            raise ValueError(f"Error converting Bicep to ARM: {e.stderr}")
        finally:
            # Clean up temporary files
            if os.path.exists(temp_bicep_path):
                os.unlink(temp_bicep_path)
            if os.path.exists(temp_arm_path):
                os.unlink(temp_arm_path)
    
    def get_deployment_status(self, resource_group, deployment_name):
        """
        Get the status of an Azure deployment
        
        Args:
            resource_group (str): The resource group name
            deployment_name (str): The deployment name
            
        Returns:
            dict: Status and details of the deployment
        """
        import logging
        logger = logging.getLogger(__name__)
        # Ensure resource client is available
        self._ensure_resource_client()

        try:
            logger.info(f"Getting deployment status for {deployment_name} in resource group {resource_group}")
            
            # Get deployment
            try:
                deployment = self.resource_client.deployments.get(
                    resource_group_name=resource_group,
                    deployment_name=deployment_name
                )
                logger.info(f"Deployment state: {deployment.properties.provisioning_state}")
            except Exception as e:
                logger.error(f"Error getting deployment: {str(e)}", exc_info=True)
                return {
                    "status": "failed",
                    "resources": [],
                    "outputs": {},
                    "logs": [{
                        "timestamp": datetime.utcnow().isoformat(),
                        "resource_name": None,
                        "resource_type": None,
                        "message": f"Error retrieving deployment: {str(e)}"
                    }]
                }
            
            # Get deployment operations
            try:
                operations = list(self.resource_client.deployment_operations.list(
                    resource_group_name=resource_group,
                    deployment_name=deployment_name
                ))
                logger.info(f"Found {len(operations)} deployment operations")
            except Exception as e:
                logger.error(f"Error getting deployment operations: {str(e)}", exc_info=True)
                operations = []
            
            # Extract resources
            resources = []
            for operation in operations:
                if operation.properties.target_resource:
                    resource_info = {
                        "id": operation.properties.target_resource.id,
                        "name": operation.properties.target_resource.resource_name,
                        "type": operation.properties.target_resource.resource_type,
                        "status": operation.properties.provisioning_state
                    }
                    resources.append(resource_info)
                    logger.debug(f"Resource: {resource_info['name']} ({resource_info['type']}) - Status: {resource_info['status']}")
            
            # Extract outputs
            outputs = {}
            if deployment.properties.outputs:
                try:
                    outputs = {k: v.get("value") for k, v in deployment.properties.outputs.items()}
                    logger.debug(f"Outputs: {list(outputs.keys())}")
                except Exception as e:
                    logger.error(f"Error extracting outputs: {str(e)}", exc_info=True)
            
            # Extract logs
            logs = []
            for operation in operations:
                if operation.properties.status_message:
                    log_entry = {
                        "timestamp": operation.properties.timestamp.isoformat() if operation.properties.timestamp else datetime.utcnow().isoformat(),
                        "resource_name": operation.properties.target_resource.resource_name if operation.properties.target_resource else None,
                        "resource_type": operation.properties.target_resource.resource_type if operation.properties.target_resource else None,
                        "message": str(operation.properties.status_message)
                    }
                    logs.append(log_entry)
                    logger.debug(f"Log: {log_entry['timestamp']} - {log_entry['resource_name']} - {log_entry['message'][:100]}...")
            
            # Map Azure provisioning state to our status
            status_map = {
                "Succeeded": "succeeded",
                "Failed": "failed",
                "Canceled": "canceled",
                "Running": "in_progress",
                "Accepted": "in_progress",
                "Creating": "in_progress",
                "Created": "in_progress",
                "Deleting": "in_progress",
                "Deleted": "succeeded"
            }
            
            status = status_map.get(deployment.properties.provisioning_state, "in_progress")
            logger.info(f"Mapped Azure status '{deployment.properties.provisioning_state}' to '{status}'")
            
            return {
                "status": status,
                "resources": resources,
                "outputs": outputs,
                "logs": logs
            }
        except Exception as e:
            logger.error(f"Error getting deployment status: {str(e)}", exc_info=True)
            return {
                "status": "failed",
                "resources": [],
                "outputs": {},
                "logs": [{
                    "timestamp": datetime.utcnow().isoformat(),
                    "resource_name": None,
                    "resource_type": None,
                    "message": f"Error retrieving deployment status: {str(e)}"
                }]
            }
    
    def update_deployment(self, resource_group, deployment_name, template_data=None, parameters=None):
        """
        Update an existing Azure deployment
        
        Args:
            resource_group (str): The resource group name
            deployment_name (str): The deployment name
            template_data (dict, optional): New template data
            parameters (dict, optional): New parameters
            
        Returns:
            dict: Update result with status and details
        """
        if not self.resource_client:
            self._ensure_resource_client()
        
        try:
            # Get existing deployment
            deployment = self.resource_client.deployments.get(
                resource_group_name=resource_group,
                deployment_name=deployment_name
            )
            
            # Prepare deployment properties with the required 'properties' field
            deployment_properties = {
                "properties": {
                    "mode": DeploymentMode.incremental
                }
            }
            
            # Update template if provided
            if template_data:
                if "template_url" in template_data:
                    deployment_properties["properties"]["templateLink"] = {
                        "uri": template_data["template_url"]
                    }
                elif "template_body" in template_data:
                    template_content = template_data["template_body"]
                    if isinstance(template_content, str):
                        try:
                            template_json = json.loads(template_content)
                        except json.JSONDecodeError:
                            raise ValueError("Template content is not valid JSON")
                    else:
                        template_json = template_content
                    deployment_properties["properties"]["template"] = template_json
            else:
                # Use existing template
                if hasattr(deployment.properties, "templateLink") and deployment.properties.templateLink:
                    deployment_properties["properties"]["templateLink"] = {
                        "uri": deployment.properties.templateLink.uri
                    }
                else:
                    # Get the template from the deployment
                    template = self.resource_client.deployments.export_template(
                        resource_group_name=resource_group,
                        deployment_name=deployment_name
                    ).template
                    deployment_properties["properties"]["template"] = template
            
            # Update parameters if provided
            if parameters:
                params = {}
                for key, value in parameters.items():
                    # Check if the parameter is a complex object with a 'value' field
                    if isinstance(value, dict) and 'value' in value:
                        # Extract just the value for Azure
                        params[key] = {
                            "value": value['value']
                        }
                    else:
                        # Use the parameter value directly
                        params[key] = {
                            "value": value
                        }
                deployment_properties["properties"]["parameters"] = params
            
            # Start deployment update
            deployment_async_operation = self.resource_client.deployments.begin_create_or_update(
                resource_group_name=resource_group,
                deployment_name=deployment_name,
                parameters=deployment_properties
            )
            
            # Return initial status
            return {
                "status": "in_progress",
                "message": "Deployment update initiated"
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def delete_deployment(self, resource_group, deployment_name):
        """
        Delete an Azure deployment
        
        Args:
            resource_group (str): The resource group name
            deployment_name (str): The deployment name
            
        Returns:
            dict: Deletion result with status
        """
        if not self.resource_client:
            self._ensure_resource_client()
        
        try:
            # Delete deployment
            self.resource_client.deployments.begin_delete(
                resource_group_name=resource_group,
                deployment_name=deployment_name
            )
            
            return {
                "status": "in_progress",
                "message": "Deployment deletion initiated"
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def _map_status(self, azure_status):
        """Map Azure deployment status to our standard status"""
        if azure_status == "Running":
            return "in_progress"
        elif azure_status == "Succeeded":
            return "completed"
        elif azure_status in ["Failed", "Canceled"]:
            return "failed"
        else:
            return "unknown"
