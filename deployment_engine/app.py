from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Any
import requests
import os
import json
from datetime import datetime
import uuid
import logging
from deploy.azure import AzureDeployer

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

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

# Authentication functions
def get_token_from_header(authorization: str = Header(None)) -> str:
    """Extract token from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    return parts[1]

def decode_token(token: str) -> dict:
    """Decode JWT token"""
    import jwt
    
    try:
        payload = jwt.decode(
            token,
            os.getenv("JWT_SECRET", "your-secret-key"),
            algorithms=[os.getenv("JWT_ALGORITHM", "HS256")]
        )
        return payload
    except jwt.PyJWTError as e:
        logger.error(f"Token decode error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(token: str = Depends(get_token_from_header)) -> dict:
    """Get current user from token"""
    return decode_token(token)

def check_permission(required_permission: str):
    """Check if user has required permission"""
    def _check_permission(user: dict = Depends(get_current_user)) -> dict:
        if "permissions" not in user or required_permission not in user["permissions"]:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return user
    return _check_permission

# API settings
API_URL = os.getenv("API_URL", "http://api:8000")

# In-memory storage for deployments (would be replaced with a database in production)
deployments = {}

# Routes
@app.get("/")
def read_root():
    return {"message": "Deployment Engine API"}

# Debug endpoint to check token
@app.get("/debug-token")
def debug_token(user: dict = Depends(get_current_user)):
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "tenant_id": user["tenant_id"],
        "permissions": user["permissions"]
    }

# Credentials endpoints
@app.post("/credentials")
def set_credentials(
    credentials: Dict[str, str],
    user: dict = Depends(check_permission("deployment:manage"))
):
    try:
        logger.debug(f"Setting credentials for user: {user['username']}")
        
        # Set Azure credentials
        azure_deployer.set_credentials(
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"],
            tenant_id=credentials["tenant_id"],
            subscription_id=credentials.get("subscription_id")
        )
        
        return {"message": "Credentials set successfully"}
    except Exception as e:
        logger.error(f"Error setting credentials: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/credentials")
def get_credentials(user: dict = Depends(check_permission("deployment:read"))):
    try:
        logger.debug(f"Getting credentials for user: {user['username']}")
        # Get Azure credentials status
        status = azure_deployer.get_credential_status()
        return status
    except Exception as e:
        logger.error(f"Error getting credentials: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/credentials/subscription")
def set_subscription(
    subscription: Dict[str, str],
    user: dict = Depends(check_permission("deployment:manage"))
):
    try:
        logger.debug(f"Setting subscription for user: {user['username']}")
        # Set Azure subscription
        result = azure_deployer.set_subscription(subscription["subscription_id"])
        return result
    except Exception as e:
        logger.error(f"Error setting subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/credentials/subscriptions")
def list_subscriptions(user: dict = Depends(check_permission("deployment:read"))):
    try:
        logger.debug(f"Listing subscriptions for user: {user['username']}")
        # List Azure subscriptions
        subscriptions = azure_deployer.list_subscriptions()
        return subscriptions
    except Exception as e:
        logger.error(f"Error listing subscriptions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/credentials/resources")
def list_resources(
    subscription_ids: str = None,
    user: dict = Depends(check_permission("deployment:read"))
):
    try:
        logger.debug(f"Listing resources for user: {user['username']}")
        
        # Parse subscription IDs
        subscription_id_list = []
        if subscription_ids:
            subscription_id_list = subscription_ids.split(",")
        
        # If no subscription IDs provided, use the current one
        if not subscription_id_list and azure_deployer.subscription_id:
            subscription_id_list = [azure_deployer.subscription_id]
        
        if not subscription_id_list:
            raise HTTPException(status_code=400, detail="No subscription IDs provided and no default subscription set")
        
        # Get resources for each subscription
        all_resources = []
        for subscription_id in subscription_id_list:
            try:
                # Set the subscription
                azure_deployer.set_subscription(subscription_id)
                
                # Get resource groups
                resource_groups = azure_deployer.resource_client.resource_groups.list()
                
                # Get resources for each resource group
                for resource_group in resource_groups:
                    resources = azure_deployer.resource_client.resources.list_by_resource_group(resource_group.name)
                    
                    for resource in resources:
                        # Convert to dictionary and add subscription and resource group info
                        resource_dict = {
                            "id": resource.id,
                            "name": resource.name,
                            "type": resource.type.split('/')[-1],
                            "location": resource.location,
                            "subscription_id": subscription_id,
                            "resource_group": resource_group.name,
                            "provider": "azure",
                            "status": "running",  # Azure doesn't provide this directly
                            "created_at": None  # Azure doesn't provide this directly
                        }
                        
                        all_resources.append(resource_dict)
            except Exception as e:
                logger.error(f"Error getting resources for subscription {subscription_id}: {str(e)}")
                # Continue with other subscriptions
        
        return all_resources
    except Exception as e:
        logger.error(f"Error listing resources: {str(e)}")
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
        logger.error(f"Error creating deployment: {str(e)}")
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
        logger.error(f"Error listing deployments: {str(e)}")
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
        logger.error(f"Error getting deployment: {str(e)}")
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
        logger.error(f"Error updating deployment: {str(e)}")
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
        logger.error(f"Error deleting deployment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
