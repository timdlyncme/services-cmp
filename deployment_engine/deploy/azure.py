from azure.identity import ClientSecretCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.resource.resources.models import DeploymentMode
import json
import requests
import os
import tempfile
import subprocess

class AzureDeployer:
    def __init__(self):
        # Initialize with empty credentials
        self.client_id = None
        self.client_secret = None
        self.tenant_id = None
        self.subscription_id = None
        self.credential = None
        self.resource_client = None
        
    def set_credentials(self, client_id, client_secret, tenant_id, subscription_id):
        """
        Set Azure credentials for deployments
        
        Args:
            client_id (str): Azure AD Application (client) ID
            client_secret (str): Azure AD Application secret
            tenant_id (str): Azure AD Tenant ID
            subscription_id (str): Azure Subscription ID
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.tenant_id = tenant_id
        self.subscription_id = subscription_id
        
        # Create credential and client
        self.credential = ClientSecretCredential(
            tenant_id=self.tenant_id,
            client_id=self.client_id,
            client_secret=self.client_secret
        )
        
        self.resource_client = ResourceManagementClient(
            credential=self.credential,
            subscription_id=self.subscription_id
        )
        
        # Test the credentials
        self._test_credentials()
        
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
            # Test the credentials
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
                "subscription_id": self.subscription_id,
                "valid": False,
                "message": f"Azure credentials are invalid: {str(e)}"
            }
    
    def _test_credentials(self):
        """Test Azure credentials by listing resource groups"""
        if not self.resource_client:
            raise ValueError("Azure credentials not configured")
        
        # Try to list resource groups
        self.resource_client.resource_groups.list()
    
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
        if not self.resource_client:
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
        
        # Prepare parameters
        params = {}
        if parameters:
            for key, value in parameters.items():
                params[key] = {
                    "value": value
                }
        
        # Create deployment
        try:
            deployment_properties = {
                "mode": DeploymentMode.incremental,
                "template": json.loads(template_content) if isinstance(template_content, str) else template_content,
                "parameters": params
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
        # Prepare parameters
        params = {}
        if parameters:
            for key, value in parameters.items():
                params[key] = {
                    "value": value
                }
        
        # Create deployment
        try:
            deployment_properties = {
                "mode": DeploymentMode.incremental,
                "template_link": {
                    "uri": template_uri
                },
                "parameters": params
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
        if not self.resource_client:
            raise ValueError("Azure credentials not configured")
        
        try:
            # Get deployment
            deployment = self.resource_client.deployments.get(
                resource_group_name=resource_group,
                deployment_name=deployment_name
            )
            
            # Get deployment operations
            operations = list(self.resource_client.deployment_operations.list(
                resource_group_name=resource_group,
                deployment_name=deployment_name
            ))
            
            # Extract resources
            resources = []
            for operation in operations:
                if operation.properties.target_resource:
                    resources.append({
                        "id": operation.properties.target_resource.id,
                        "name": operation.properties.target_resource.resource_name,
                        "type": operation.properties.target_resource.resource_type,
                        "status": operation.properties.provisioning_state
                    })
            
            # Extract outputs
            outputs = {}
            if deployment.properties.outputs:
                outputs = {k: v.get("value") for k, v in deployment.properties.outputs.items()}
            
            # Map status
            status = self._map_status(deployment.properties.provisioning_state)
            
            return {
                "status": status,
                "azure_status": deployment.properties.provisioning_state,
                "resources": resources,
                "outputs": outputs
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
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
            raise ValueError("Azure credentials not configured")
        
        try:
            # Get existing deployment
            deployment = self.resource_client.deployments.get(
                resource_group_name=resource_group,
                deployment_name=deployment_name
            )
            
            # Prepare deployment properties
            deployment_properties = {
                "mode": DeploymentMode.incremental
            }
            
            # Update template if provided
            if template_data:
                if "template_url" in template_data:
                    deployment_properties["template_link"] = {
                        "uri": template_data["template_url"]
                    }
                elif "template_body" in template_data:
                    template_content = template_data["template_body"]
                    deployment_properties["template"] = json.loads(template_content) if isinstance(template_content, str) else template_content
            else:
                # Use existing template
                if hasattr(deployment.properties, "template_link") and deployment.properties.template_link:
                    deployment_properties["template_link"] = {
                        "uri": deployment.properties.template_link.uri
                    }
                else:
                    # Get the template from the deployment
                    template = self.resource_client.deployments.export_template(
                        resource_group_name=resource_group,
                        deployment_name=deployment_name
                    ).template
                    deployment_properties["template"] = template
            
            # Update parameters if provided
            if parameters:
                params = {}
                for key, value in parameters.items():
                    params[key] = {
                        "value": value
                    }
                deployment_properties["parameters"] = params
            
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
            raise ValueError("Azure credentials not configured")
        
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

