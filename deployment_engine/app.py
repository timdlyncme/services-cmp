from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Any
import jwt
import os
import json
from datetime import datetime
import uuid
from deploy.azure import AzureDeployer

app = FastAPI(title="Deployment Engine API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Azure deployer
azure_deployer = AzureDeployer()

# JWT settings
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# In-memory storage for deployments (would be replaced with a database in production)
deployments = {}

# Authentication dependency
def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Check if token has required permissions
        permissions = payload.get("permissions", [])
        
        return {
            "user_id": payload.get("sub"),
            "username": payload.get("name"),
            "tenant_id": payload.get("tenant_id"),
            "permissions": permissions
        }
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")

# Permission check dependency
def check_permission(required_permission: str):
    def check(user: dict = Depends(get_current_user)):
        if required_permission not in user["permissions"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return check

# Routes
@app.get("/")
def read_root():
    return {"message": "Deployment Engine API"}

# Credentials endpoints
@app.post("/credentials")
def set_credentials(
    credentials: Dict[str, str],
    user: dict = Depends(check_permission("deployment:manage"))
):
    try:
        # Set Azure credentials
        azure_deployer.set_credentials(
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            tenant_id=credentials["tenant_id"],
            subscription_id=credentials["subscription_id"]
        )
        
        return {"message": "Credentials set successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/credentials")
def get_credentials(user: dict = Depends(check_permission("deployment:read"))):
    try:
        # Get Azure credentials status
        status = azure_deployer.get_credential_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Deployment endpoints
@app.post("/deployments")
def create_deployment(
    deployment: Dict[str, Any],
    user: dict = Depends(check_permission("deployment:create"))
):
    try:
        # Generate deployment ID
        deployment_id = str(uuid.uuid4())
        
        # Extract deployment details
        name = deployment.get("name", "Unnamed deployment")
        description = deployment.get("description", "")
        deployment_type = deployment.get("deployment_type", "arm")
        resource_group = deployment.get("resource_group", f"rg-{name.lower()}")
        location = deployment.get("location", "eastus")
        template = deployment.get("template", {})
        parameters = deployment.get("parameters", {})
        
        # Prepare template data
        template_data = {}
        if template.get("source") == "url" and template.get("url"):
            template_data["template_url"] = template["url"]
        elif template.get("source") == "code" and template.get("code"):
            template_data["template_body"] = template["code"]
        else:
            raise HTTPException(status_code=400, detail="Invalid template data")
        
        # Deploy to Azure
        result = azure_deployer.deploy(
            resource_group=resource_group,
            deployment_name=name,
            location=location,
            template_data=template_data,
            parameters=parameters,
            deployment_type=deployment_type
        )
        
        # Store deployment details
        deployments[deployment_id] = {
            "deployment_id": deployment_id,
            "name": name,
            "description": description,
            "resource_group": resource_group,
            "location": location,
            "deployment_type": deployment_type,
            "status": result.get("status", "unknown"),
            "azure_deployment_id": result.get("azure_deployment_id"),
            "tenant_id": user["tenant_id"],
            "created_by": user["user_id"],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        return {
            "deployment_id": deployment_id,
            "status": result.get("status", "unknown"),
            "azure_deployment_id": result.get("azure_deployment_id"),
            "created_at": deployments[deployment_id]["created_at"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/deployments")
def list_deployments(
    status: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
    user: dict = Depends(check_permission("deployment:read"))
):
    try:
        # Filter deployments by tenant
        tenant_deployments = [
            d for d in deployments.values()
            if d["tenant_id"] == user["tenant_id"]
        ]
        
        # Filter by status if provided
        if status:
            tenant_deployments = [d for d in tenant_deployments if d["status"] == status]
        
        # Sort by created_at in descending order
        tenant_deployments.sort(key=lambda x: x["created_at"], reverse=True)
        
        # Apply pagination
        paginated_deployments = tenant_deployments[offset:offset + limit]
        
        return paginated_deployments
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/deployments/{deployment_id}")
def get_deployment(
    deployment_id: str,
    user: dict = Depends(check_permission("deployment:read"))
):
    try:
        # Check if deployment exists
        if deployment_id not in deployments:
            raise HTTPException(status_code=404, detail="Deployment not found")
        
        # Check if user has access to this deployment
        deployment = deployments[deployment_id]
        if deployment["tenant_id"] != user["tenant_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get deployment status from Azure
        if deployment.get("azure_deployment_id") and deployment.get("resource_group"):
            azure_status = azure_deployer.get_deployment_status(
                resource_group=deployment["resource_group"],
                deployment_name=deployment["azure_deployment_id"]
            )
            
            # Update deployment status
            deployment["status"] = azure_status.get("status", deployment["status"])
            deployment["resources"] = azure_status.get("resources", [])
            deployment["outputs"] = azure_status.get("outputs", {})
            deployment["updated_at"] = datetime.utcnow().isoformat()
        
        return deployment
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/deployments/{deployment_id}")
def update_deployment(
    deployment_id: str,
    update_data: Dict[str, Any],
    user: dict = Depends(check_permission("deployment:update"))
):
    try:
        # Check if deployment exists
        if deployment_id not in deployments:
            raise HTTPException(status_code=404, detail="Deployment not found")
        
        # Check if user has access to this deployment
        deployment = deployments[deployment_id]
        if deployment["tenant_id"] != user["tenant_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Extract update details
        template = update_data.get("template")
        parameters = update_data.get("parameters")
        
        # Prepare template data
        template_data = None
        if template:
            template_data = {}
            if template.get("source") == "url" and template.get("url"):
                template_data["template_url"] = template["url"]
            elif template.get("source") == "code" and template.get("code"):
                template_data["template_body"] = template["code"]
        
        # Update deployment in Azure
        result = azure_deployer.update_deployment(
            resource_group=deployment["resource_group"],
            deployment_name=deployment["azure_deployment_id"],
            template_data=template_data,
            parameters=parameters
        )
        
        # Update deployment status
        deployment["status"] = result.get("status", deployment["status"])
        deployment["updated_at"] = datetime.utcnow().isoformat()
        
        return {
            "deployment_id": deployment_id,
            "status": deployment["status"],
            "message": result.get("message", "Deployment update initiated")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/deployments/{deployment_id}")
def delete_deployment(
    deployment_id: str,
    user: dict = Depends(check_permission("deployment:delete"))
):
    try:
        # Check if deployment exists
        if deployment_id not in deployments:
            raise HTTPException(status_code=404, detail="Deployment not found")
        
        # Check if user has access to this deployment
        deployment = deployments[deployment_id]
        if deployment["tenant_id"] != user["tenant_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete deployment from Azure
        result = azure_deployer.delete_deployment(
            resource_group=deployment["resource_group"],
            deployment_name=deployment["azure_deployment_id"]
        )
        
        # Update deployment status
        deployment["status"] = "deleting"
        deployment["updated_at"] = datetime.utcnow().isoformat()
        
        return {
            "deployment_id": deployment_id,
            "status": "deleting",
            "message": result.get("message", "Deployment deletion initiated")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)

