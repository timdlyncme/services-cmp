from fastapi import FastAPI, HTTPException, Depends, Header, Body, Query, Path
from fastapi.security import OAuth2PasswordBearer
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, Field
import jwt
import json
import os
from enum import Enum
import uuid
from datetime import datetime

# Import deployers
from deploy.azure import AzureDeployer
from deploy.aws import AWSDeployer
from deploy.gcp import GCPDeployer
from deploy.terraform import TerraformDeployer

# Create FastAPI app
app = FastAPI(title="Deployment Engine API", 
              description="API for deploying cloud resources across multiple providers",
              version="1.0.0")

# Initialize deployers
azure_deployer = AzureDeployer()
aws_deployer = AWSDeployer()
gcp_deployer = GCPDeployer()
terraform_deployer = TerraformDeployer()

# JWT Secret - should be loaded from environment variable in production
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# In-memory storage for deployment details (replace with database in production)
deployment_store = {}

# Enums for validation
class CloudProvider(str, Enum):
    AWS = "aws"
    AZURE = "azure"
    GCP = "gcp"

class DeploymentType(str, Enum):
    NATIVE = "native"
    TERRAFORM = "terraform"

class TemplateSource(str, Enum):
    URL = "url"
    CODE = "code"

class DeploymentStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

# Pydantic models for request/response validation
class TemplateData(BaseModel):
    source: TemplateSource
    url: Optional[str] = None
    code: Optional[str] = None

class DeploymentRequest(BaseModel):
    name: str
    description: Optional[str] = None
    provider: CloudProvider
    deployment_type: DeploymentType
    environment: str
    template: TemplateData
    parameters: Optional[Dict[str, Any]] = None
    project_id: Optional[str] = None  # For GCP

class DeploymentResponse(BaseModel):
    deployment_id: str
    status: DeploymentStatus
    provider: CloudProvider
    deployment_type: DeploymentType
    cloud_deployment_id: Optional[str] = None
    created_at: datetime
    message: Optional[str] = None

class DeploymentDetails(BaseModel):
    deployment_id: str
    name: str
    description: Optional[str] = None
    status: DeploymentStatus
    provider: CloudProvider
    deployment_type: DeploymentType
    template_source: TemplateSource
    template_url: Optional[str] = None
    cloud_deployment_id: Optional[str] = None
    cloud_region: Optional[str] = None
    cloud_resources: Optional[List[Dict[str, Any]]] = None
    outputs: Optional[Dict[str, Any]] = None
    logs: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

class UpdateDeploymentRequest(BaseModel):
    template: Optional[TemplateData] = None
    parameters: Optional[Dict[str, Any]] = None

class UpdateDeploymentResponse(BaseModel):
    deployment_id: str
    status: DeploymentStatus
    message: Optional[str] = None

class DeleteDeploymentResponse(BaseModel):
    deployment_id: str
    status: DeploymentStatus
    message: Optional[str] = None

# Authentication dependency
async def verify_token(authorization: str = Header(...)):
    try:
        # Extract token from Authorization header
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        token = authorization.replace("Bearer ", "")
        
        # Verify token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Check permissions (simplified - in production, check against database)
        if "permissions" not in payload or "deployment:manage" not in payload["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# API endpoints
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/deployments", response_model=DeploymentResponse)
async def create_deployment(
    request: DeploymentRequest,
    user_data: dict = Depends(verify_token)
):
    # Generate a unique deployment ID
    deployment_id = str(uuid.uuid4())
    
    # Prepare template data for the deployer
    template_data = {}
    if request.template.source == TemplateSource.URL:
        template_data["template_url"] = request.template.url
    else:
        if request.deployment_type == DeploymentType.TERRAFORM:
            template_data["template_content"] = request.template.code
        else:
            template_data["template_body"] = request.template.code
    
    # Initialize deployment record
    deployment_record = {
        "deployment_id": deployment_id,
        "name": request.name,
        "description": request.description,
        "status": DeploymentStatus.PENDING,
        "provider": request.provider,
        "deployment_type": request.deployment_type,
        "template_source": request.template.source,
        "template_url": request.template.url if request.template.source == TemplateSource.URL else None,
        "parameters": request.parameters,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "user_id": user_data.get("sub")
    }
    
    # Store the deployment record
    deployment_store[deployment_id] = deployment_record
    
    try:
        # Deploy based on provider and type
        if request.deployment_type == DeploymentType.TERRAFORM:
            # Use Terraform deployer for any provider
            result = terraform_deployer.deploy(
                environment=request.environment,
                template_data=template_data,
                parameters=request.parameters,
                deployment_id=deployment_id,
                provider=request.provider
            )
        else:
            # Use native deployers
            if request.provider == CloudProvider.AWS:
                result = aws_deployer.deploy(
                    environment=request.environment,
                    template_data=template_data,
                    parameters=request.parameters,
                    deployment_id=deployment_id
                )
            elif request.provider == CloudProvider.AZURE:
                result = azure_deployer.deploy(
                    environment=request.environment,
                    template_id=deployment_id,  # Using deployment_id as template_id
                    parameters=request.parameters
                )
            elif request.provider == CloudProvider.GCP:
                if not request.project_id:
                    raise HTTPException(status_code=400, detail="Project ID is required for GCP deployments")
                
                result = gcp_deployer.deploy(
                    environment=request.environment,
                    template_data=template_data,
                    parameters=request.parameters,
                    deployment_id=deployment_id,
                    project_id=request.project_id
                )
        
        # Update deployment record with result
        deployment_store[deployment_id].update({
            "status": result.get("status", DeploymentStatus.IN_PROGRESS),
            "cloud_deployment_id": result.get("cloud_deployment_id"),
            "cloud_resources": result.get("cloud_resources"),
            "outputs": result.get("outputs"),
            "logs": result.get("logs"),
            "error_details": result.get("error_details"),
            "state_info": result.get("state_info"),  # For Terraform
            "updated_at": datetime.utcnow()
        })
        
        if result.get("status") == "completed":
            deployment_store[deployment_id]["completed_at"] = datetime.utcnow()
        
        return {
            "deployment_id": deployment_id,
            "status": deployment_store[deployment_id]["status"],
            "provider": request.provider,
            "deployment_type": request.deployment_type,
            "cloud_deployment_id": result.get("cloud_deployment_id"),
            "created_at": deployment_store[deployment_id]["created_at"],
            "message": "Deployment initiated successfully"
        }
    
    except Exception as e:
        # Update deployment record with error
        deployment_store[deployment_id].update({
            "status": DeploymentStatus.FAILED,
            "error_details": {"message": str(e)},
            "updated_at": datetime.utcnow()
        })
        
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/deployments", response_model=List[DeploymentResponse])
async def list_deployments(
    provider: Optional[CloudProvider] = None,
    status: Optional[DeploymentStatus] = None,
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_data: dict = Depends(verify_token)
):
    # Filter deployments based on query parameters
    filtered_deployments = []
    
    for deployment_id, deployment in deployment_store.items():
        if provider and deployment["provider"] != provider:
            continue
        
        if status and deployment["status"] != status:
            continue
        
        # Add to filtered list
        filtered_deployments.append({
            "deployment_id": deployment_id,
            "status": deployment["status"],
            "provider": deployment["provider"],
            "deployment_type": deployment["deployment_type"],
            "cloud_deployment_id": deployment.get("cloud_deployment_id"),
            "created_at": deployment["created_at"],
            "name": deployment["name"]
        })
    
    # Apply pagination
    paginated_deployments = filtered_deployments[offset:offset + limit]
    
    return paginated_deployments

@app.get("/deployments/{deployment_id}", response_model=DeploymentDetails)
async def get_deployment(
    deployment_id: str = Path(..., description="The ID of the deployment to retrieve"),
    user_data: dict = Depends(verify_token)
):
    # Check if deployment exists
    if deployment_id not in deployment_store:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    deployment = deployment_store[deployment_id]
    
    # If deployment is in progress, check the current status
    if deployment["status"] in [DeploymentStatus.PENDING, DeploymentStatus.IN_PROGRESS]:
        try:
            # Get status based on provider and type
            if deployment["deployment_type"] == DeploymentType.TERRAFORM:
                # Use Terraform deployer for any provider
                if "state_info" in deployment:
                    result = terraform_deployer.get_deployment_status(deployment["state_info"])
                else:
                    result = {"status": deployment["status"]}
            else:
                # Use native deployers
                if deployment["provider"] == CloudProvider.AWS:
                    if "cloud_deployment_id" in deployment:
                        result = aws_deployer.get_deployment_status(deployment["cloud_deployment_id"])
                    else:
                        result = {"status": deployment["status"]}
                elif deployment["provider"] == CloudProvider.AZURE:
                    # Implement Azure status check
                    result = {"status": deployment["status"]}
                elif deployment["provider"] == CloudProvider.GCP:
                    if "cloud_deployment_id" in deployment and "project_id" in deployment:
                        result = gcp_deployer.get_deployment_status(
                            deployment["cloud_deployment_id"],
                            deployment["project_id"]
                        )
                    else:
                        result = {"status": deployment["status"]}
            
            # Update deployment record with result
            deployment.update({
                "status": result.get("status", deployment["status"]),
                "cloud_resources": result.get("cloud_resources", deployment.get("cloud_resources")),
                "outputs": result.get("outputs", deployment.get("outputs")),
                "error_details": result.get("error_details", deployment.get("error_details")),
                "updated_at": datetime.utcnow()
            })
            
            if result.get("status") == "completed" and not deployment.get("completed_at"):
                deployment["completed_at"] = datetime.utcnow()
        
        except Exception as e:
            # Log the error but don't update the deployment status
            print(f"Error checking deployment status: {e}")
    
    return deployment

@app.put("/deployments/{deployment_id}", response_model=UpdateDeploymentResponse)
async def update_deployment(
    request: UpdateDeploymentRequest,
    deployment_id: str = Path(..., description="The ID of the deployment to update"),
    user_data: dict = Depends(verify_token)
):
    # Check if deployment exists
    if deployment_id not in deployment_store:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    deployment = deployment_store[deployment_id]
    
    # Check if deployment can be updated
    if deployment["status"] == DeploymentStatus.FAILED:
        raise HTTPException(status_code=400, detail="Failed deployments cannot be updated")
    
    # Prepare template data for the deployer
    template_data = None
    if request.template:
        template_data = {}
        if request.template.source == TemplateSource.URL:
            template_data["template_url"] = request.template.url
        else:
            if deployment["deployment_type"] == DeploymentType.TERRAFORM:
                template_data["template_content"] = request.template.code
            else:
                template_data["template_body"] = request.template.code
    
    try:
        # Update based on provider and type
        if deployment["deployment_type"] == DeploymentType.TERRAFORM:
            # Use Terraform deployer for any provider
            if "state_info" not in deployment:
                raise HTTPException(status_code=400, detail="Deployment state information not found")
            
            result = terraform_deployer.update_deployment(
                state_info=deployment["state_info"],
                template_data=template_data,
                parameters=request.parameters
            )
        else:
            # Use native deployers
            if deployment["provider"] == CloudProvider.AWS:
                if "cloud_deployment_id" not in deployment:
                    raise HTTPException(status_code=400, detail="Cloud deployment ID not found")
                
                result = aws_deployer.update_deployment(
                    stack_id=deployment["cloud_deployment_id"],
                    template_data=template_data,
                    parameters=request.parameters
                )
            elif deployment["provider"] == CloudProvider.AZURE:
                # Implement Azure update
                result = {"status": "in_progress", "message": "Update initiated"}
            elif deployment["provider"] == CloudProvider.GCP:
                if "cloud_deployment_id" not in deployment or "project_id" not in deployment:
                    raise HTTPException(status_code=400, detail="Cloud deployment ID or project ID not found")
                
                result = gcp_deployer.update_deployment(
                    deployment_name=deployment["cloud_deployment_id"],
                    project_id=deployment["project_id"],
                    template_data=template_data,
                    parameters=request.parameters
                )
        
        # Update deployment record with result
        deployment.update({
            "status": result.get("status", DeploymentStatus.IN_PROGRESS),
            "cloud_resources": result.get("cloud_resources", deployment.get("cloud_resources")),
            "outputs": result.get("outputs", deployment.get("outputs")),
            "logs": result.get("logs", deployment.get("logs")),
            "error_details": result.get("error_details", deployment.get("error_details")),
            "updated_at": datetime.utcnow()
        })
        
        if result.get("status") == "completed" and not deployment.get("completed_at"):
            deployment["completed_at"] = datetime.utcnow()
        
        return {
            "deployment_id": deployment_id,
            "status": deployment["status"],
            "message": result.get("message", "Update initiated successfully")
        }
    
    except Exception as e:
        # Update deployment record with error
        deployment.update({
            "status": DeploymentStatus.FAILED,
            "error_details": {"message": str(e)},
            "updated_at": datetime.utcnow()
        })
        
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/deployments/{deployment_id}", response_model=DeleteDeploymentResponse)
async def delete_deployment(
    deployment_id: str = Path(..., description="The ID of the deployment to delete"),
    user_data: dict = Depends(verify_token)
):
    # Check if deployment exists
    if deployment_id not in deployment_store:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    deployment = deployment_store[deployment_id]
    
    try:
        # Delete based on provider and type
        if deployment["deployment_type"] == DeploymentType.TERRAFORM:
            # Use Terraform deployer for any provider
            if "state_info" not in deployment:
                raise HTTPException(status_code=400, detail="Deployment state information not found")
            
            result = terraform_deployer.delete_deployment(deployment["state_info"])
        else:
            # Use native deployers
            if deployment["provider"] == CloudProvider.AWS:
                if "cloud_deployment_id" not in deployment:
                    raise HTTPException(status_code=400, detail="Cloud deployment ID not found")
                
                result = aws_deployer.delete_deployment(deployment["cloud_deployment_id"])
            elif deployment["provider"] == CloudProvider.AZURE:
                # Implement Azure delete
                result = {"status": "in_progress", "message": "Deletion initiated"}
            elif deployment["provider"] == CloudProvider.GCP:
                if "cloud_deployment_id" not in deployment or "project_id" not in deployment:
                    raise HTTPException(status_code=400, detail="Cloud deployment ID or project ID not found")
                
                result = gcp_deployer.delete_deployment(
                    deployment_name=deployment["cloud_deployment_id"],
                    project_id=deployment["project_id"]
                )
        
        # Update deployment record with result
        deployment.update({
            "status": DeploymentStatus.IN_PROGRESS if result.get("status") == "in_progress" else DeploymentStatus.COMPLETED,
            "updated_at": datetime.utcnow()
        })
        
        if result.get("status") == "completed":
            deployment["completed_at"] = datetime.utcnow()
        
        return {
            "deployment_id": deployment_id,
            "status": deployment["status"],
            "message": result.get("message", "Deletion initiated successfully")
        }
    
    except Exception as e:
        # Update deployment record with error
        deployment.update({
            "status": DeploymentStatus.FAILED,
            "error_details": {"message": str(e)},
            "updated_at": datetime.utcnow()
        })
        
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)

