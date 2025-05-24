import os
import json
import tempfile
import uuid
from typing import Dict, Any, List, Optional
import asyncio
import requests

class ARMService:
    def __init__(self):
        pass
    
    async def deploy(
        self,
        template_file: str,
        parameters: Dict[str, Any],
        credentials: Dict[str, Any],
        is_dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Deploy ARM template
        """
        try:
            # Read template
            with open(template_file, "r") as f:
                template_content = f.read()
            
            # Parse template
            template = json.loads(template_content)
            
            # Extract credentials
            client_id = credentials.get("client_id")
            client_secret = credentials.get("client_secret")
            tenant_id = credentials.get("tenant_id")
            subscription_id = credentials.get("subscription_id")
            
            if not all([client_id, client_secret, tenant_id, subscription_id]):
                return {
                    "success": False,
                    "error_message": "Missing Azure credentials",
                    "error_details": {"missing_credentials": True},
                    "logs": "Error: Missing Azure credentials"
                }
            
            # Get access token
            token_response = requests.post(
                f"https://login.microsoftonline.com/{tenant_id}/oauth2/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "resource": "https://management.azure.com/"
                }
            )
            
            if token_response.status_code != 200:
                return {
                    "success": False,
                    "error_message": "Failed to get Azure access token",
                    "error_details": {
                        "status_code": token_response.status_code,
                        "response": token_response.text
                    },
                    "logs": f"Error: Failed to get Azure access token. Status code: {token_response.status_code}, Response: {token_response.text}"
                }
            
            token_data = token_response.json()
            access_token = token_data["access_token"]
            
            # Generate deployment name
            deployment_name = f"deployment-{uuid.uuid4().hex[:8]}"
            
            # Get resource group from parameters or use default
            resource_group = parameters.get("resourceGroupName", "default-resource-group")
            
            # Format parameters for ARM template
            arm_parameters = {}
            for key, value in parameters.items():
                if key != "resourceGroupName":
                    arm_parameters[key] = {"value": value}
            
            # Create deployment payload
            deployment_payload = {
                "properties": {
                    "mode": "Incremental",
                    "template": template,
                    "parameters": arm_parameters
                }
            }
            
            # If dry run, use validation API
            if is_dry_run:
                validation_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Resources/deployments/{deployment_name}/validate?api-version=2021-04-01"
                
                validation_response = requests.post(
                    validation_url,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    json=deployment_payload
                )
                
                if validation_response.status_code >= 400:
                    return {
                        "success": False,
                        "error_message": "ARM template validation failed",
                        "error_details": {
                            "status_code": validation_response.status_code,
                            "response": validation_response.text
                        },
                        "logs": f"Error: ARM template validation failed. Status code: {validation_response.status_code}, Response: {validation_response.text}"
                    }
                
                validation_data = validation_response.json()
                
                return {
                    "success": True,
                    "outputs": {},
                    "resources": self._extract_resources_from_template(template),
                    "logs": f"ARM template validation successful: {json.dumps(validation_data, indent=2)}"
                }
            
            # Deploy ARM template
            deployment_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Resources/deployments/{deployment_name}?api-version=2021-04-01"
            
            deployment_response = requests.put(
                deployment_url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=deployment_payload
            )
            
            if deployment_response.status_code >= 400:
                return {
                    "success": False,
                    "error_message": "ARM template deployment failed",
                    "error_details": {
                        "status_code": deployment_response.status_code,
                        "response": deployment_response.text
                    },
                    "logs": f"Error: ARM template deployment failed. Status code: {deployment_response.status_code}, Response: {deployment_response.text}"
                }
            
            deployment_data = deployment_response.json()
            
            # Check deployment status
            status_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/Microsoft.Resources/deployments/{deployment_name}?api-version=2021-04-01"
            
            # Poll for deployment completion
            max_retries = 60
            retry_count = 0
            deployment_status = "Running"
            deployment_logs = []
            
            while deployment_status in ["Running", "Accepted"] and retry_count < max_retries:
                await asyncio.sleep(10)
                
                status_response = requests.get(
                    status_url,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if status_response.status_code >= 400:
                    deployment_logs.append(f"Error checking deployment status. Status code: {status_response.status_code}, Response: {status_response.text}")
                    break
                
                status_data = status_response.json()
                deployment_status = status_data["properties"]["provisioningState"]
                deployment_logs.append(f"Deployment status: {deployment_status}")
                
                retry_count += 1
            
            # Get deployment outputs
            outputs = {}
            resources = []
            
            if deployment_status == "Succeeded":
                # Get outputs
                if "outputs" in status_data["properties"]:
                    for key, value in status_data["properties"]["outputs"].items():
                        outputs[key] = value["value"]
                
                # Get resources
                resources_url = f"https://management.azure.com/subscriptions/{subscription_id}/resourceGroups/{resource_group}/resources?api-version=2021-04-01"
                
                resources_response = requests.get(
                    resources_url,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if resources_response.status_code == 200:
                    resources_data = resources_response.json()
                    resources = [resource["id"] for resource in resources_data["value"]]
                
                return {
                    "success": True,
                    "outputs": outputs,
                    "resources": resources,
                    "logs": "\n".join(deployment_logs)
                }
            else:
                return {
                    "success": False,
                    "error_message": f"ARM template deployment failed with status: {deployment_status}",
                    "error_details": {
                        "status": deployment_status,
                        "deployment_data": status_data
                    },
                    "logs": "\n".join(deployment_logs)
                }
        
        except Exception as e:
            return {
                "success": False,
                "error_message": str(e),
                "error_details": {"exception": str(e)},
                "logs": f"Exception: {str(e)}"
            }
    
    def _extract_resources_from_template(self, template: Dict[str, Any]) -> List[str]:
        """
        Extract resources from ARM template
        """
        resources = []
        
        if "resources" in template:
            for resource in template["resources"]:
                if "type" in resource and "name" in resource:
                    resources.append(f"{resource['type']}/{resource['name']}")
                    
                    # Check for nested resources
                    if "resources" in resource:
                        for nested_resource in resource["resources"]:
                            if "type" in nested_resource and "name" in nested_resource:
                                resources.append(f"{resource['type']}/{resource['name']}/{nested_resource['type']}/{nested_resource['name']}")
        
        return resources

