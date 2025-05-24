import requests
import json
import os
import uuid
import asyncio
import tempfile
import shutil
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.core.config import settings
from app.schemas.deployment import (
    DeploymentCreate,
    DeploymentResponse,
    DeploymentUpdate,
    DeploymentStatus,
    CloudProvider,
    TemplateType,
    CloudAccountInfo,
    EnvironmentInfo
)
from app.services.terraform_service import TerraformService
from app.services.arm_service import ARMService
from app.services.cloudformation_service import CloudFormationService

class DeploymentService:
    def __init__(self):
        self.terraform_service = TerraformService()
        self.arm_service = ARMService()
        self.cloudformation_service = CloudFormationService()
        
        # In-memory storage for deployments (replace with database in production)
        self.deployments: Dict[str, Dict[str, Any]] = {}
    
    async def create_deployment(
        self,
        deployment_in: DeploymentCreate,
        user_id: str,
        tenant_id: str
    ) -> DeploymentResponse:
        """
        Create a new deployment
        """
        # Generate deployment ID
        deployment_id = str(uuid.uuid4())
        
        # Get cloud account details
        cloud_account = await self._get_cloud_account(
            cloud_account_id=deployment_in.cloud_account_id,
            tenant_id=tenant_id
        )
        
        # Get environment details
        environment = await self._get_environment(
            environment_id=deployment_in.environment_id,
            tenant_id=tenant_id
        )
        
        # Create deployment record
        deployment = {
            "id": deployment_id,
            "name": deployment_in.name,
            "description": deployment_in.description,
            "status": DeploymentStatus.PENDING,
            "provider": deployment_in.provider,
            "cloud_account": cloud_account,
            "environment": environment,
            "template_type": deployment_in.template_type,
            "template_id": deployment_in.template_id,
            "template_url": deployment_in.template_url,
            "template_code": deployment_in.template_code,
            "parameters": deployment_in.parameters or {},
            "variables": deployment_in.variables or {},
            "outputs": {},
            "resources": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "started_at": None,
            "completed_at": None,
            "is_dry_run": deployment_in.is_dry_run,
            "auto_approve": deployment_in.auto_approve,
            "error_message": None,
            "tenant_id": tenant_id,
            "user_id": user_id
        }
        
        # Store deployment
        self.deployments[deployment_id] = deployment
        
        # Start deployment process in background
        asyncio.create_task(self._process_deployment(deployment_id))
        
        # Return deployment response
        return self._format_deployment_response(deployment)
    
    async def get_deployment(
        self,
        deployment_id: str,
        tenant_id: str
    ) -> Optional[DeploymentResponse]:
        """
        Get deployment by ID
        """
        # Get deployment
        deployment = self.deployments.get(deployment_id)
        
        # Check if deployment exists and belongs to tenant
        if not deployment or deployment["tenant_id"] != tenant_id:
            return None
        
        # Return deployment response
        return self._format_deployment_response(deployment)
    
    async def get_deployments(
        self,
        tenant_id: str,
        environment_id: Optional[str] = None,
        cloud_account_id: Optional[str] = None,
        status: Optional[DeploymentStatus] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[DeploymentResponse]:
        """
        Get all deployments with optional filtering
        """
        # Filter deployments
        filtered_deployments = []
        for deployment in self.deployments.values():
            # Check tenant
            if deployment["tenant_id"] != tenant_id:
                continue
            
            # Check environment
            if environment_id and deployment["environment"]["id"] != environment_id:
                continue
            
            # Check cloud account
            if cloud_account_id and deployment["cloud_account"]["id"] != cloud_account_id:
                continue
            
            # Check status
            if status and deployment["status"] != status:
                continue
            
            filtered_deployments.append(deployment)
        
        # Apply pagination
        paginated_deployments = filtered_deployments[offset:offset + limit]
        
        # Format deployments
        return [self._format_deployment_response(d) for d in paginated_deployments]
    
    async def update_deployment(
        self,
        deployment_id: str,
        deployment_update: DeploymentUpdate,
        tenant_id: str,
        user_id: str
    ) -> Optional[DeploymentResponse]:
        """
        Update deployment status and details
        """
        # Get deployment
        deployment = self.deployments.get(deployment_id)
        
        # Check if deployment exists and belongs to tenant
        if not deployment or deployment["tenant_id"] != tenant_id:
            return None
        
        # Update deployment
        if deployment_update.status is not None:
            deployment["status"] = deployment_update.status
            
            # Set started_at if status is running
            if deployment_update.status == DeploymentStatus.RUNNING and not deployment["started_at"]:
                deployment["started_at"] = datetime.utcnow()
            
            # Set completed_at if status is completed or failed
            if deployment_update.status in [DeploymentStatus.COMPLETED, DeploymentStatus.FAILED] and not deployment["completed_at"]:
                deployment["completed_at"] = datetime.utcnow()
        
        if deployment_update.outputs is not None:
            deployment["outputs"] = deployment_update.outputs
        
        if deployment_update.resources is not None:
            deployment["resources"] = deployment_update.resources
        
        if deployment_update.logs is not None:
            deployment["logs"] = deployment_update.logs
        
        if deployment_update.error_message is not None:
            deployment["error_message"] = deployment_update.error_message
        
        if deployment_update.error_details is not None:
            deployment["error_details"] = deployment_update.error_details
        
        if deployment_update.completed_at is not None:
            deployment["completed_at"] = deployment_update.completed_at
        
        # Update updated_at
        deployment["updated_at"] = datetime.utcnow()
        
        # Return deployment response
        return self._format_deployment_response(deployment)
    
    async def delete_deployment(
        self,
        deployment_id: str,
        tenant_id: str
    ) -> bool:
        """
        Delete a deployment
        """
        # Get deployment
        deployment = self.deployments.get(deployment_id)
        
        # Check if deployment exists and belongs to tenant
        if not deployment or deployment["tenant_id"] != tenant_id:
            return False
        
        # Delete deployment
        del self.deployments[deployment_id]
        
        return True
    
    async def _process_deployment(self, deployment_id: str) -> None:
        """
        Process deployment in background
        """
        # Get deployment
        deployment = self.deployments.get(deployment_id)
        if not deployment:
            return
        
        try:
            # Update status to running
            deployment["status"] = DeploymentStatus.RUNNING
            deployment["started_at"] = datetime.utcnow()
            deployment["updated_at"] = datetime.utcnow()
            
            # Get template content
            template_content = await self._get_template_content(deployment)
            
            # Create temporary directory for deployment
            with tempfile.TemporaryDirectory() as temp_dir:
                # Write template to file
                template_file = os.path.join(temp_dir, "template")
                if deployment["template_type"] == TemplateType.TERRAFORM:
                    template_file += ".tf"
                elif deployment["template_type"] == TemplateType.ARM:
                    template_file += ".json"
                elif deployment["template_type"] == TemplateType.CLOUDFORMATION:
                    template_file += ".yaml"
                
                with open(template_file, "w") as f:
                    f.write(template_content)
                
                # Get cloud credentials
                cloud_credentials = await self._get_cloud_credentials(deployment)
                
                # Deploy based on template type
                if deployment["template_type"] == TemplateType.TERRAFORM:
                    result = await self.terraform_service.deploy(
                        template_dir=temp_dir,
                        variables=deployment["variables"],
                        credentials=cloud_credentials,
                        is_dry_run=deployment["is_dry_run"],
                        auto_approve=deployment["auto_approve"]
                    )
                elif deployment["template_type"] == TemplateType.ARM:
                    result = await self.arm_service.deploy(
                        template_file=template_file,
                        parameters=deployment["parameters"],
                        credentials=cloud_credentials,
                        is_dry_run=deployment["is_dry_run"]
                    )
                elif deployment["template_type"] == TemplateType.CLOUDFORMATION:
                    result = await self.cloudformation_service.deploy(
                        template_file=template_file,
                        parameters=deployment["parameters"],
                        credentials=cloud_credentials,
                        is_dry_run=deployment["is_dry_run"]
                    )
                else:
                    raise ValueError(f"Unsupported template type: {deployment['template_type']}")
                
                # Update deployment with results
                deployment["outputs"] = result.get("outputs", {})
                deployment["resources"] = result.get("resources", [])
                deployment["logs"] = result.get("logs", "")
                
                # Update status
                if result.get("success"):
                    deployment["status"] = DeploymentStatus.COMPLETED
                else:
                    deployment["status"] = DeploymentStatus.FAILED
                    deployment["error_message"] = result.get("error_message", "Unknown error")
                    deployment["error_details"] = result.get("error_details", {})
        
        except Exception as e:
            # Update status to failed
            deployment["status"] = DeploymentStatus.FAILED
            deployment["error_message"] = str(e)
        
        finally:
            # Update completed_at and updated_at
            deployment["completed_at"] = datetime.utcnow()
            deployment["updated_at"] = datetime.utcnow()
            
            # Send deployment details to main API
            await self._send_deployment_details(deployment)
    
    async def _get_template_content(self, deployment: Dict[str, Any]) -> str:
        """
        Get template content from template_id, template_url, or template_code
        """
        # If template_code is provided, use it
        if deployment.get("template_code"):
            return deployment["template_code"]
        
        # If template_url is provided, download it
        if deployment.get("template_url"):
            response = requests.get(deployment["template_url"])
            response.raise_for_status()
            return response.text
        
        # If template_id is provided, get it from the main API
        if deployment.get("template_id"):
            response = requests.get(
                f"{settings.MAIN_API_URL}/api/templates/{deployment['template_id']}",
                headers={"Authorization": f"Bearer {self._get_token()}"}
            )
            response.raise_for_status()
            template_data = response.json()
            return template_data.get("code", "")
        
        raise ValueError("No template source provided")
    
    async def _get_cloud_credentials(self, deployment: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get cloud credentials for deployment
        """
        # Get cloud account details from main API
        response = requests.get(
            f"{settings.MAIN_API_URL}/api/cloud-accounts/{deployment['cloud_account']['id']}",
            headers={"Authorization": f"Bearer {self._get_token()}"}
        )
        response.raise_for_status()
        cloud_account = response.json()
        
        # Get credentials based on provider
        if deployment["provider"] == CloudProvider.AWS:
            return {
                "aws_access_key_id": cloud_account.get("connectionDetails", {}).get("aws_access_key_id"),
                "aws_secret_access_key": cloud_account.get("connectionDetails", {}).get("aws_secret_access_key"),
                "aws_region": cloud_account.get("connectionDetails", {}).get("aws_region", "us-east-1")
            }
        elif deployment["provider"] == CloudProvider.AZURE:
            return {
                "client_id": cloud_account.get("connectionDetails", {}).get("client_id"),
                "client_secret": cloud_account.get("connectionDetails", {}).get("client_secret"),
                "tenant_id": cloud_account.get("connectionDetails", {}).get("tenant_id"),
                "subscription_id": cloud_account.get("connectionDetails", {}).get("subscription_id")
            }
        elif deployment["provider"] == CloudProvider.GCP:
            return {
                "credentials_json": cloud_account.get("connectionDetails", {}).get("credentials_json"),
                "project_id": cloud_account.get("connectionDetails", {}).get("project_id")
            }
        
        return {}
    
    async def _get_cloud_account(self, cloud_account_id: str, tenant_id: str) -> CloudAccountInfo:
        """
        Get cloud account details from main API
        """
        try:
            response = requests.get(
                f"{settings.MAIN_API_URL}/api/cloud-accounts/{cloud_account_id}",
                headers={"Authorization": f"Bearer {self._get_token()}"}
            )
            response.raise_for_status()
            cloud_account = response.json()
            
            return CloudAccountInfo(
                id=cloud_account["id"],
                name=cloud_account["name"],
                provider=cloud_account["provider"]
            )
        except Exception as e:
            # Return minimal info if API call fails
            return CloudAccountInfo(
                id=cloud_account_id,
                name="Unknown",
                provider=CloudProvider.AWS  # Default provider
            )
    
    async def _get_environment(self, environment_id: str, tenant_id: str) -> EnvironmentInfo:
        """
        Get environment details from main API
        """
        try:
            response = requests.get(
                f"{settings.MAIN_API_URL}/api/environments/{environment_id}",
                headers={"Authorization": f"Bearer {self._get_token()}"}
            )
            response.raise_for_status()
            environment = response.json()
            
            return EnvironmentInfo(
                id=environment["id"],
                name=environment["name"]
            )
        except Exception as e:
            # Return minimal info if API call fails
            return EnvironmentInfo(
                id=environment_id,
                name="Unknown"
            )
    
    async def _send_deployment_details(self, deployment: Dict[str, Any]) -> None:
        """
        Send deployment details to main API
        """
        try:
            # Format deployment details
            deployment_details = {
                "deployment_id": deployment["id"],
                "name": deployment["name"],
                "description": deployment["description"],
                "status": deployment["status"],
                "provider": deployment["provider"],
                "cloud_account_id": deployment["cloud_account"]["id"],
                "environment_id": deployment["environment"]["id"],
                "template_type": deployment["template_type"],
                "parameters": deployment["parameters"],
                "variables": deployment["variables"],
                "outputs": deployment["outputs"],
                "resources": deployment["resources"],
                "logs": deployment.get("logs", ""),
                "error_message": deployment.get("error_message"),
                "error_details": deployment.get("error_details", {}),
                "created_at": deployment["created_at"].isoformat(),
                "updated_at": deployment["updated_at"].isoformat(),
                "started_at": deployment["started_at"].isoformat() if deployment["started_at"] else None,
                "completed_at": deployment["completed_at"].isoformat() if deployment["completed_at"] else None,
                "is_dry_run": deployment["is_dry_run"],
                "auto_approve": deployment["auto_approve"],
                "tenant_id": deployment["tenant_id"],
                "user_id": deployment["user_id"]
            }
            
            # Send to main API
            response = requests.post(
                f"{settings.MAIN_API_URL}/api/deployment-container/deployments",
                headers={"Authorization": f"Bearer {self._get_token()}"},
                json=deployment_details
            )
            response.raise_for_status()
        
        except Exception as e:
            # Log error but don't fail the deployment
            print(f"Error sending deployment details to main API: {str(e)}")
    
    def _format_deployment_response(self, deployment: Dict[str, Any]) -> DeploymentResponse:
        """
        Format deployment response
        """
        return DeploymentResponse(
            id=deployment["id"],
            name=deployment["name"],
            description=deployment["description"],
            status=deployment["status"],
            provider=deployment["provider"],
            cloud_account=deployment["cloud_account"],
            environment=deployment["environment"],
            template_type=deployment["template_type"],
            parameters=deployment["parameters"],
            variables=deployment["variables"],
            outputs=deployment["outputs"],
            resources=deployment["resources"],
            created_at=deployment["created_at"],
            updated_at=deployment["updated_at"],
            started_at=deployment["started_at"],
            completed_at=deployment["completed_at"],
            is_dry_run=deployment["is_dry_run"],
            auto_approve=deployment["auto_approve"],
            error_message=deployment["error_message"]
        )
    
    def _get_token(self) -> str:
        """
        Get token for API calls
        """
        # In a real implementation, this would use a service account token
        # For now, return a placeholder
        return "service_account_token"

