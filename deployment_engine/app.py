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
        deployment_id: The deployment ID from the backend
        resource_group: The Azure resource group
        azure_deployment_id: The Azure deployment ID
        access_token: The user's access token for authentication
    """
    logger.info(f"Starting status polling for deployment {deployment_id}")
    logger.info(f"Resource group: {resource_group}, Azure deployment ID: {azure_deployment_id}")
    
    try:
        # Continue polling until deployment is complete or failed
        while True:
            # Get deployment status from Azure
            logger.info(f"Polling Azure for deployment status: {azure_deployment_id}")
            azure_status = azure_deployer.get_deployment_status(
                resource_group=resource_group,
                deployment_name=azure_deployment_id
            )
            
            status = azure_status.get("status", "in_progress")
            resources = azure_status.get("resources", [])
            outputs = azure_status.get("outputs", {})
            logs = azure_status.get("logs", [])
            
            logger.info(f"Deployment {deployment_id} status: {status}")
            logger.info(f"Resources: {len(resources)}, Outputs: {len(outputs) if outputs else 0}, Logs: {len(logs)}")
            
            # Update deployment in memory
            if deployment_id in deployments:
                deployments[deployment_id]["status"] = status
                deployments[deployment_id]["resources"] = resources
                deployments[deployment_id]["outputs"] = outputs
                deployments[deployment_id]["logs"] = logs
                deployments[deployment_id]["updated_at"] = datetime.utcnow().isoformat()
                logger.info(f"Updated in-memory deployment {deployment_id}")
            else:
                logger.warning(f"Deployment {deployment_id} not found in memory")
            
            # Send update to backend API
            try:
                logger.info(f"Sending status update to backend API for deployment {deployment_id}")
                headers = {"Authorization": f"Bearer {access_token}"}
                update_data = {
                    "status": status,
                    "resources": resources,
                    "outputs": outputs,
                    "logs": logs
                }
                
                # Log the request details
                logger.info(f"Request URL: {API_URL}/api/deployments/engine/{deployment_id}/status")
                logger.info(f"Request headers: Authorization: Bearer [REDACTED]")
                logger.info(f"Request data: {json.dumps(update_data, default=str)[:500]}...")
                
                response = requests.put(
                    f"{API_URL}/api/deployments/engine/{deployment_id}/status",
                    headers=headers,
                    json=update_data
                )
                
                logger.info(f"Response status code: {response.status_code}")
                
                if response.status_code != 200:
                    logger.error(f"Failed to update deployment status: {response.text}")
                    # Try to parse the response for more details
                    try:
                        error_details = response.json()
                        logger.error(f"Error details: {json.dumps(error_details, default=str)}")
                    except:
                        logger.error("Could not parse error response as JSON")
                else:
                    logger.info(f"Successfully updated deployment status in backend")
            except Exception as e:
                logger.error(f"Error updating deployment status: {str(e)}", exc_info=True)
            
            # If deployment is complete or failed, stop polling
            if status in ["succeeded", "failed", "canceled"]:
                logger.info(f"Deployment {deployment_id} {status}, stopping polling")
                break
            
            # Sleep before next poll
            logger.info(f"Sleeping for 10 seconds before next poll for deployment {deployment_id}")
            time.sleep(10)  # Poll every 10 seconds
    except Exception as e:
        logger.error(f"Error in status polling thread: {str(e)}", exc_info=True)
    finally:
        # Remove thread from active polling threads
        if deployment_id in polling_threads:
            del polling_threads[deployment_id]
        logger.info(f"Stopped status polling for deployment {deployment_id}")

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
        # Use the deployment ID from the backend if provided, otherwise generate a new one
        deployment_id = deployment.get("deployment_id")
        if not deployment_id:
            deployment_id = str(uuid.uuid4())
            logger.warning(f"No deployment_id provided by backend, generating new ID: {deployment_id}")
        else:
            logger.info(f"Using deployment_id provided by backend: {deployment_id}")
        
        logger.info(f"Creating deployment with ID: {deployment_id}")
        
        # Extract deployment details
        name = deployment.get("name", "Unnamed deployment")
        description = deployment.get("description", "")
        deployment_type = deployment.get("deployment_type", "arm")
        
        logger.info(f"Deployment details: name={name}, type={deployment_type}")
        
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
        
        logger.info(f"Resource group: {resource_group}, Location: {location}")
        logger.info(f"Azure deployment name: {azure_deployment_name}")
        
        # Extract Azure credentials if provided
        client_id = deployment.get("client_id")
        client_secret = deployment.get("client_secret")
        tenant_id = deployment.get("tenant_id")
        subscription_id = deployment.get("subscription_id")
        
        logger.info(f"Credentials provided: client_id={bool(client_id)}, client_secret={bool(client_secret)}, tenant_id={bool(tenant_id)}, subscription_id={bool(subscription_id)}")
        
        # Set Azure credentials from deployment request
        if client_id and client_secret and tenant_id:
            logger.info("Setting Azure credentials from deployment request")
            azure_deployer.set_credentials(
                client_id=client_id,
                client_secret=client_secret,
                tenant_id=tenant_id,
                subscription_id=subscription_id
            )
        else:
            logger.error(f"Missing required credentials: client_id={bool(client_id)}, client_secret={bool(client_secret)}, tenant_id={bool(tenant_id)}")
            raise ValueError("Missing required Azure credentials")
        
        # Check if Azure credentials are configured
        cred_status = azure_deployer.get_credential_status()
        if not cred_status.get("configured", False):
            logger.error("Azure credentials not configured")
            raise ValueError("Azure credentials not configured")
        
        # Set subscription if provided and not already set
        if subscription_id and azure_deployer.subscription_id != subscription_id:
            logger.info(f"Setting subscription ID: {subscription_id}")
            azure_deployer.set_subscription(subscription_id)
        
        # Prepare template data
        template_data = {}
        if template.get("source") == "url" and template.get("url"):
            template_data["template_url"] = template["url"]
            logger.info(f"Using template URL: {template['url']}")
        elif template.get("source") == "code" and template.get("code"):
            template_data["template_body"] = template["code"]
            logger.info(f"Using template code (length: {len(template['code'])})")
        else:
            logger.error("Invalid template data")
            raise HTTPException(status_code=400, detail="Invalid template data")
        
        # Log parameters
        logger.info(f"Deployment parameters: {json.dumps(parameters, default=str)[:500]}...")
        
        # Deploy to Azure
        logger.info(f"Starting Azure deployment: {azure_deployment_name}")
        result = azure_deployer.deploy(
            resource_group=resource_group,
            deployment_name=azure_deployment_name,
            location=location,
            template_data=template_data,
            parameters=parameters,
            deployment_type=deployment_type
        )
        
        logger.info(f"Azure deployment result: {json.dumps(result, default=str)}")
        
        # Store deployment details
        deployments[deployment_id] = {
            "deployment_id": deployment_id,  # Use the consistent deployment ID
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
        
        logger.info(f"Stored deployment details in memory: {deployment_id}")
        
        # Start status polling in a background thread
        logger.info(f"Starting background polling thread for deployment {deployment_id}")
        thread = threading.Thread(
            target=poll_deployment_status,
            args=(deployment_id, resource_group, azure_deployment_name, user["token"])
        )
        thread.daemon = True
        thread.start()
        
        # Store thread reference
        polling_threads[deployment_id] = thread
        logger.info(f"Background polling thread started for deployment {deployment_id}")
        
        return {
            "deployment_id": deployment_id,  # Return the consistent deployment ID
            "status": result.get("status", "in_progress"),
            "azure_deployment_id": azure_deployment_name,
            "created_at": deployments[deployment_id]["created_at"]
        }
    except Exception as e:
        logger.error(f"Error creating deployment: {str(e)}", exc_info=True)
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
            deployment["logs"] = azure_status.get("logs", [])
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

@app.delete("/deployments/{deployment_id}/resources")
def delete_deployment_resources(
    deployment_id: str,
    user: dict = Depends(check_permission("deployment:delete"))
):
    try:
        # Check if deployment exists - handle both raw UUID and prefixed format
        # First, try to find the deployment with the exact ID
        if deployment_id in deployments:
            deployment = deployments[deployment_id]
        else:
            # If not found, try to find by matching the deployment_id field
            matching_deployments = [
                d for d in deployments.values() 
                if d.get("deployment_id") == deployment_id
            ]
            
            if matching_deployments:
                # Use the first matching deployment
                deployment = matching_deployments[0]
                # Get the key used in the deployments dictionary
                deployment_key = next(
                    k for k, v in deployments.items() 
                    if v.get("deployment_id") == deployment_id
                )
                logger.info(f"Found deployment with ID {deployment_id} using key {deployment_key}")
            else:
                # If still not found, check if it's a cloud_deployment_id
                matching_deployments = [
                    d for d in deployments.values() 
                    if d.get("azure_deployment_id") == deployment_id
                ]
                
                if matching_deployments:
                    # Use the first matching deployment
                    deployment = matching_deployments[0]
                    # Get the key used in the deployments dictionary
                    deployment_key = next(
                        k for k, v in deployments.items() 
                        if v.get("azure_deployment_id") == deployment_id
                    )
                    logger.info(f"Found deployment with azure_deployment_id {deployment_id} using key {deployment_key}")
                else:
                    # If still not found, try to match by removing any prefix
                    if "-" in deployment_id:
                        # Try to extract UUID part if it's in format "prefix-uuid"
                        parts = deployment_id.split("-", 1)
                        if len(parts) > 1:
                            uuid_part = parts[1]
                            matching_deployments = [
                                d for d in deployments.values() 
                                if d.get("deployment_id", "").endswith(uuid_part)
                            ]
                            
                            if matching_deployments:
                                # Use the first matching deployment
                                deployment = matching_deployments[0]
                                # Get the key used in the deployments dictionary
                                deployment_key = next(
                                    k for k, v in deployments.items() 
                                    if v.get("deployment_id", "").endswith(uuid_part)
                                )
                                logger.info(f"Found deployment with UUID part {uuid_part} using key {deployment_key}")
                            else:
                                logger.error(f"Deployment {deployment_id} not found after trying all matching methods")
                                raise HTTPException(status_code=404, detail="Deployment not found")
                        else:
                            logger.error(f"Deployment {deployment_id} not found and couldn't parse UUID part")
                            raise HTTPException(status_code=404, detail="Deployment not found")
                    else:
                        logger.error(f"Deployment {deployment_id} not found")
                        raise HTTPException(status_code=404, detail="Deployment not found")
        
        # Check if user has access to this deployment
        if deployment["tenant_id"] != user["tenant_id"]:
            logger.error(f"User {user['username']} does not have access to deployment {deployment_id}")
            raise HTTPException(status_code=403, detail="Access denied")
        
        logger.info(f"Deleting resources for deployment {deployment_id}")
        logger.info(f"Resource group: {deployment.get('resource_group')}, Azure deployment ID: {deployment.get('azure_deployment_id')}")
        
        # Delete resources from Azure but keep the deployment record
        result = azure_deployer.delete_deployment_resources(
            resource_group=deployment["resource_group"],
            deployment_name=deployment["azure_deployment_id"]
        )
        
        logger.info(f"Resource deletion result: {result}")
        
        # Update deployment status
        deployment["status"] = "archived"
        deployment["updated_at"] = datetime.utcnow().isoformat()
        
        # Update resources status
        if "resources" in deployment:
            logger.info(f"Updating status for {len(deployment['resources'])} resources")
            for resource in deployment["resources"]:
                resource["status"] = "Deleted"
        
        return {
            "deployment_id": deployment_id,
            "status": "archived",
            "message": result.get("message", "Deployment resources deleted successfully")
        }
    except Exception as e:
        logger.error(f"Error deleting deployment resources: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
