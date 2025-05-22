from google.cloud import deployment_manager
from google.cloud import storage
from google.oauth2 import service_account
import json
import uuid
import time

class GCPDeployer:
    def __init__(self):
        # Initialize GCP clients
        self.dm_client = deployment_manager.DeploymentManagerClient()
        self.storage_client = storage.Client()
        
    def deploy(self, environment, template_data, parameters=None, deployment_id=None, project_id=None):
        """
        Deploy a Deployment Manager template to GCP
        
        Args:
            environment (str): The environment name (used for deployment naming)
            template_data (dict): The template data, either URL or template content
            parameters (dict, optional): Parameters for the template
            deployment_id (str, optional): Unique ID for the deployment
            project_id (str): GCP project ID
            
        Returns:
            dict: Deployment result with status and details
        """
        if not deployment_id:
            deployment_id = str(uuid.uuid4())
            
        if not project_id:
            raise ValueError("GCP project ID is required")
            
        deployment_name = f"{environment}-{deployment_id[:8]}"
        
        try:
            # Prepare the deployment configuration
            config = {
                "name": deployment_name,
                "target": {
                    "config": {
                        "content": ""
                    }
                }
            }
            
            # Check if template is a URL or direct template content
            if 'template_url' in template_data:
                config["target"]["config"]["content"] = self._fetch_template_from_url(template_data['template_url'])
            else:
                config["target"]["config"]["content"] = template_data['template_content']
            
            # Add parameters if provided
            if parameters:
                config["target"]["config"]["content"] = self._inject_parameters(
                    config["target"]["config"]["content"], 
                    parameters
                )
            
            # Create the deployment
            parent = f"projects/{project_id}/global/deployments"
            operation = self.dm_client.insert_deployment(
                parent=parent,
                deployment=config
            )
            
            # Wait for the operation to complete
            operation_name = operation.name
            
            return {
                "status": "in_progress",
                "provider": "gcp",
                "deployment_type": "deployment_manager",
                "cloud_deployment_id": deployment_name,
                "cloud_operation_id": operation_name,
                "deployment_id": deployment_id,
                "environment": environment,
                "project_id": project_id
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "provider": "gcp",
                "deployment_id": deployment_id,
                "environment": environment,
                "error_details": str(e)
            }
    
    def get_deployment_status(self, deployment_name, project_id):
        """
        Get the status of a GCP Deployment Manager deployment
        
        Args:
            deployment_name (str): The deployment name
            project_id (str): GCP project ID
            
        Returns:
            dict: Status and details of the deployment
        """
        try:
            name = f"projects/{project_id}/global/deployments/{deployment_name}"
            deployment = self.dm_client.get_deployment(name=name)
            
            # Get resources
            resources = []
            for manifest in deployment.manifests:
                manifest_obj = self.dm_client.get_manifest(name=manifest.name)
                resources.extend(self._parse_resources(manifest_obj.config.content))
            
            return {
                "status": self._map_status(deployment.operation.status),
                "cloud_status": deployment.operation.status,
                "cloud_resources": resources,
                "outputs": self._extract_outputs(deployment),
                "created_at": deployment.insert_time.isoformat() if deployment.insert_time else None,
                "updated_at": deployment.update_time.isoformat() if deployment.update_time else None
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def update_deployment(self, deployment_name, project_id, template_data, parameters=None):
        """
        Update an existing GCP Deployment Manager deployment
        
        Args:
            deployment_name (str): The deployment name
            project_id (str): GCP project ID
            template_data (dict): The template data, either URL or template content
            parameters (dict, optional): Parameters for the template
            
        Returns:
            dict: Update result with status and details
        """
        try:
            # Prepare the deployment configuration
            config = {
                "name": deployment_name,
                "target": {
                    "config": {
                        "content": ""
                    }
                }
            }
            
            # Check if template is a URL or direct template content
            if 'template_url' in template_data:
                config["target"]["config"]["content"] = self._fetch_template_from_url(template_data['template_url'])
            else:
                config["target"]["config"]["content"] = template_data['template_content']
            
            # Add parameters if provided
            if parameters:
                config["target"]["config"]["content"] = self._inject_parameters(
                    config["target"]["config"]["content"], 
                    parameters
                )
            
            # Update the deployment
            name = f"projects/{project_id}/global/deployments/{deployment_name}"
            operation = self.dm_client.update_deployment(
                name=name,
                deployment=config
            )
            
            # Wait for the operation to complete
            operation_name = operation.name
            
            return {
                "status": "in_progress",
                "cloud_operation_id": operation_name
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def delete_deployment(self, deployment_name, project_id):
        """
        Delete a GCP Deployment Manager deployment
        
        Args:
            deployment_name (str): The deployment name
            project_id (str): GCP project ID
            
        Returns:
            dict: Deletion result with status
        """
        try:
            name = f"projects/{project_id}/global/deployments/{deployment_name}"
            operation = self.dm_client.delete_deployment(name=name)
            
            return {
                "status": "in_progress",
                "message": "Deletion initiated",
                "cloud_operation_id": operation.name
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def _fetch_template_from_url(self, url):
        """Fetch template content from a URL"""
        # Implement logic to fetch template from URL
        # This could be a GCS URL or an HTTP URL
        if url.startswith('gs://'):
            # Parse GCS URL
            bucket_name = url.split('/')[2]
            blob_name = '/'.join(url.split('/')[3:])
            
            # Get the blob
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            
            # Download as string
            return blob.download_as_text()
        else:
            # For HTTP URLs, use requests
            import requests
            response = requests.get(url)
            response.raise_for_status()
            return response.text
    
    def _inject_parameters(self, template_content, parameters):
        """Inject parameters into the template content"""
        # This is a simplified implementation
        # In a real scenario, you might need to handle different template formats
        try:
            template = json.loads(template_content)
            
            # Add or update parameters
            if 'imports' not in template:
                template['imports'] = []
                
            if 'resources' not in template:
                template['resources'] = []
                
            # Add parameters as properties
            for key, value in parameters.items():
                # Find or create properties section
                for resource in template['resources']:
                    if 'properties' not in resource:
                        resource['properties'] = {}
                    resource['properties'][key] = value
            
            return json.dumps(template)
        except json.JSONDecodeError:
            # If not JSON, assume it's YAML or another format
            # For simplicity, just return the original content
            # In a real implementation, you'd need to handle YAML parsing
            return template_content
    
    def _parse_resources(self, manifest_content):
        """Parse resources from manifest content"""
        try:
            manifest = json.loads(manifest_content)
            resources = []
            
            for resource in manifest.get('resources', []):
                resources.append({
                    "name": resource.get('name', ''),
                    "type": resource.get('type', ''),
                    "properties": resource.get('properties', {})
                })
                
            return resources
        except json.JSONDecodeError:
            return []
    
    def _extract_outputs(self, deployment):
        """Extract outputs from deployment"""
        # This is a simplified implementation
        # In a real scenario, you'd extract outputs from the deployment's manifest
        return {}
    
    def _map_status(self, cloud_status):
        """Map GCP Deployment Manager status to our standard status"""
        status_map = {
            'PENDING': 'in_progress',
            'RUNNING': 'in_progress',
            'DONE': 'completed',
            'FAILURE': 'failed',
            'CANCELLED': 'failed'
        }
        return status_map.get(cloud_status, 'unknown')

