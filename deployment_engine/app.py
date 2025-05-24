from fastapi import FastAPI, Depends, HTTPException, Header, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Any
import requests
import os
import json
from datetime import datetime
import uuid
import logging
import threading
import time

from deploy.azure import AzureDeployer

# Configure logging
logging.basicConfig(level=logging.INFO)
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

# API settings
API_URL = os.getenv("API_URL", "http://api:8000")

# In-memory storage for deployments (would be replaced with a database in production)
deployments = {}

# Active polling threads
polling_threads = {}

def poll_deployment_status(deployment_id, resource_group, azure_deployment_id, access_token):
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
                    f"{API_URL}/api/deployments/engine/{deployment_id}/status",
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
            time.sleep(10)  # Poll every 10 seconds
    except Exception as e:
        logger.error(f"Error in status polling thread: {str(e)}")
    finally:
        # Remove thread from active polling threads
        if deployment_id in polling_threads:
            del polling_threads[deployment_id]
        logger.info(f"Stopped status polling for deployment {deployment_id}")

# Permission check dependency
def check_permission(required_permission: str):
    def check(user: dict = Depends(get_current_user)):
        logger.debug(f"Checking permission: {required_permission}")
        logger.debug(f"User permissions: {user['permissions']}")
        
        # Check if user has the required permission
        if required_permission in user["permissions"]:
            return user
        
        # Check for view:deployments permission for deployment:read
        if required_permission == "deployment:read" and "view:deployments" in user["permissions"]:
            return user
        
        # Check for create:deployments permission for deployment:create
        if required_permission == "deployment:create" and "create:deployments" in user["permissions"]:
            return user
        
        # Check for update:deployments permission for deployment:update
        if required_permission == "deployment:update" and "update:deployments" in user["permissions"]:
            return user
        
        # Check for delete:deployments permission for deployment:delete
        if required_permission == "deployment:delete" and "delete:deployments" in user["permissions"]:
            return user
        
        # Check for admin or msp role for deployment:manage
        if required_permission == "deployment:manage" and user["role"] in ["admin", "msp"]:
            return user
        
        raise HTTPException(status_code=403, detail=f"Insufficient permissions. Required: {required_permission}")
    return check

# Authentication dependency
def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        logger.debug(f"Validating token via backend API")
        
        # Use the backend API to validate the token
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_URL}/api/auth/me", headers=headers)
        
        if response.status_code != 200:
            logger.error(f"Token validation failed: {response.text}")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_data = response.json()
        logger.debug(f"User data from API: {user_data}")
        
        # Extract user information
        user_id = user_data.get("id")
        username = user_data.get("username")
        tenant_id = user_data.get("tenantId")
        
        # Extract permissions from user data
        permissions = user_data.get("permissions", [])
        if not isinstance(permissions, list):
            permissions = []
        
        # Get role information
        role = user_data.get("role")
        
        logger.debug(f"Extracted user_id: {user_id}")
        logger.debug(f"Extracted username: {username}")
        logger.debug(f"Extracted tenant_id: {tenant_id}")
        logger.debug(f"Extracted permissions: {permissions}")
        logger.debug(f"Extracted role: {role}")
        
        return {
            "user_id": user_id,
            "username": username,
            "tenant_id": tenant_id,
            "permissions": permissions,
            "role": role,
            "token": token  # Include the token for background tasks
        }
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")

# Routes
@app.get("/")
def read_root():
    return {"message": "Deployment Engine API"}

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
        
        # Extract Azure credentials if provided
        client_id = deployment.get("client_id")
        client_secret = deployment.get("client_secret")
        tenant_id = deployment.get("tenant_id")
        subscription_id = deployment.get("subscription_id")
        
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
            deployment_name=azure_deployment_name,
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
            "status": result.get("status", "in_progress"),
            "azure_deployment_id": azure_deployment_name,
            "tenant_id": user["tenant_id"],
            "created_by": user["user_id"],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "resources": [],
            "outputs": {},
            "logs": []
        }
        
        # Start status polling in a background thread
        thread = threading.Thread(
            target=poll_deployment_status,
            args=(deployment_id, resource_group, azure_deployment_name, user["token"])
        )
        thread.daemon = True
        thread.start()
        
        # Store thread reference
        polling_threads[deployment_id] = thread
        
        return {
            "deployment_id": deployment_id,
            "status": result.get("status", "in_progress"),
            "azure_deployment_id": azure_deployment_name,
            "created_at": deployments[deployment_id]["created_at"]
        }
    except Exception as e:
        logger.error(f"Error creating deployment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
