import os
import uuid
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import threading
import time
import requests

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from deploy.azure import AzureDeployer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Deployment Engine")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize deployers
azure_deployer = AzureDeployer()

# In-memory storage for deployments
# In a production environment, this would be a database
deployments = {}

# Backend API URL for updating deployment status
BACKEND_API_URL = os.environ.get("BACKEND_API_URL", "http://localhost:8000/api")

# Status polling interval in seconds
POLLING_INTERVAL = 10

# Active polling threads
polling_threads = {}

def poll_deployment_status(deployment_id: str, resource_group: str, azure_deployment_id: str, access_token: str):
    """
    Background task to poll for deployment status updates
    
    Args:
        deployment_id: The deployment ID
        resource_group: The Azure resource group
        azure_deployment_id: The Azure deployment ID
        access_token: The user's access token for authentication
    """
    logger.info(f"Starting status polling for deployment {deployment_id}")
    
    try:
        # Continue polling until deployment is complete or failed
        while True:
            # Get deployment status from Azure
            azure_status = azure_deployer.get_deployment_status(
                resource_group=resource_group,
                deployment_name=azure_deployment_id
            )
            
            status = azure_status.get("status", "in_progress")
            resources = azure_status.get("resources", [])
            outputs = azure_status.get("outputs", {})
            logs = azure_status.get("logs", [])
            
            # Update deployment in memory
            if deployment_id in deployments:
                deployments[deployment_id]["status"] = status
                deployments[deployment_id]["resources"] = resources
                deployments[deployment_id]["outputs"] = outputs
                deployments[deployment_id]["logs"] = logs
                deployments[deployment_id]["updated_at"] = datetime.utcnow().isoformat()
            
            # Send update to backend API
            try:
                headers = {"Authorization": f"Bearer {access_token}"}
                update_data = {
                    "status": status,
                    "resources": resources,
                    "outputs": outputs,
                    "logs": logs
                }
                
                response = requests.put(
                    f"{BACKEND_API_URL}/deployments/engine/{deployment_id}/status",
                    headers=headers,
                    json=update_data
                )
                
                if response.status_code != 200:
                    logger.error(f"Failed to update deployment status: {response.text}")
            except Exception as e:
                logger.error(f"Error updating deployment status: {str(e)}")
            
            # If deployment is complete or failed, stop polling
            if status in ["succeeded", "failed", "canceled"]:
                logger.info(f"Deployment {deployment_id} {status}, stopping polling")
                break
            
            # Sleep before next poll
            time.sleep(POLLING_INTERVAL)
    except Exception as e:
        logger.error(f"Error in status polling thread: {str(e)}")
    finally:
        # Remove thread from active polling threads
        if deployment_id in polling_threads:
            del polling_threads[deployment_id]
        logger.info(f"Stopped status polling for deployment {deployment_id}")

# Authentication dependency
def check_permission(permission: str):
    def _check_permission(authorization: str = Depends(lambda: None)):
        # In a real application, this would validate the token and check permissions
        # For now, we'll just return a mock user
        return {
            "id": "user123",
            "tenant_id": "tenant123",
            "permissions": [permission]
        }
    return _check_permission

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
        "permissions": user["permissions"],
        "role": user["role"]
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
            tenant_id=credentials["tenant_id"]
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
        result = azure_deployer.set_subscription(
            subscription_id=subscription["subscription_id"]
        )
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

# Deployment endpoints
@app.post("/deployments")
def create_deployment(
    deployment: Dict[str, Any],
    background_tasks: BackgroundTasks,
    user: dict = Depends(check_permission("deployment:create"))
):
    try:
        # Generate deployment ID
        deployment_id = str(uuid.uuid4())
        
        # Extract deployment details
        name = deployment.get("name", "Unnamed deployment")
        description = deployment.get("description", "")
        deployment_type = deployment.get("deployment_type", "arm")
        
        # Create a sanitized resource group name (no spaces or special characters)
        sanitized_name = name.lower().replace(' ', '-')
        # Remove any other special characters
        import re
        sanitized_name = re.sub(r'[^a-z0-9\-]', '', sanitized_name)
        resource_group = deployment.get("resource_group", f"rg-{sanitized_name}")
        
        # Use UUID for Azure deployment name to avoid issues with spaces and special characters
        azure_deployment_name = f"deploy-{deployment_id}"
        
        location = deployment.get("location", "eastus")
        template = deployment.get("template", {})
        parameters = deployment.get("parameters", {})
        
        # Log parameters for debugging
        logger.debug(f"Received parameters: {parameters}")
        
        # Extract Azure credentials if provided
        client_id = deployment.get("client_id")
        client_secret = deployment.get("client_secret")
        tenant_id = deployment.get("tenant_id")
        subscription_id = deployment.get("subscription_id")
        
        # Log credentials (without sensitive info)
        logger.debug(f"Received credentials: client_id={client_id is not None}, client_secret={client_secret is not None}")
        
        # Set Azure credentials if provided
        if client_id and client_secret and tenant_id:
            logger.debug("Setting Azure credentials from deployment request")
            azure_deployer.set_credentials(
                client_id=client_id,
                client_secret=client_secret,
                tenant_id=tenant_id,
                subscription_id=subscription_id
            )
        
        # Prepare template data
        template_source = template.get("source", "code")
        template_data = {}
        
        if template_source == "url":
            template_data["template_url"] = template.get("url")
        elif template_source == "code":
            template_data["template_body"] = template.get("code")
        
        # Deploy to Azure
        result = azure_deployer.deploy(
            resource_group=resource_group,
            deployment_name=azure_deployment_name,
            location=location,
            template_data=template_data,
            parameters=parameters,
            deployment_type=deployment_type
        )
        
        # Store deployment in memory
        deployments[deployment_id] = {
            "deployment_id": deployment_id,
            "name": name,
            "description": description,
            "status": result.get("status", "pending"),
            "resource_group": resource_group,
            "azure_deployment_id": result.get("azure_deployment_id"),
            "tenant_id": user["tenant_id"],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "resources": [],
            "outputs": {},
            "logs": []
        }
        
        # Start status polling in a background thread
        access_token = deployment.get("access_token", "")
        thread = threading.Thread(
            target=poll_deployment_status,
            args=(deployment_id, resource_group, azure_deployment_name, access_token)
        )
        thread.daemon = True
        thread.start()
        
        # Store thread reference
        polling_threads[deployment_id] = thread
        
        return {
            "deployment_id": deployment_id,
            "status": result.get("status", "unknown"),
            "resource_group": resource_group,
            "azure_deployment_id": result.get("azure_deployment_id"),
            "created_at": datetime.utcnow().isoformat()
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
