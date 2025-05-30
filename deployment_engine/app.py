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
from credential_manager import credential_manager
from azure.mgmt.resourcegraph import ResourceGraphClient
from azure.mgmt.resourcegraph.models import QueryRequest

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

# API settings
API_URL = os.getenv("API_URL", "http://api:8000")

# In-memory storage for deployments (would be replaced with a database in production)
deployments = {}

# Active polling threads
polling_threads = {}

def poll_deployment_status(deployment_id, resource_group, azure_deployment_id, access_token, tenant_id):
    """
    Background task to poll for deployment status updates
    
    Args:
        deployment_id: The deployment ID from the backend
        resource_group: The Azure resource group
        azure_deployment_id: The Azure deployment ID
        access_token: The user's access token for authentication
        tenant_id: The user's tenant ID
    """
    logger.info(f"Starting status polling for deployment {deployment_id}")
    logger.info(f"Resource group: {resource_group}, Azure deployment ID: {azure_deployment_id}")
    
    try:
        # Continue polling until deployment is complete or failed
        while True:
            # Get tenant-specific Azure deployer with fresh credentials
            azure_deployer = credential_manager.create_azure_deployer_for_tenant(
                tenant_id
            )
            if not azure_deployer:
                logger.error(f"Failed to get Azure deployer for tenant {tenant_id}")
                break
            
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
                
                # Add deployment_result if available
                if deployment_id in deployments and "deployment_result" in deployments[deployment_id]:
                    update_data["deployment_result"] = deployments[deployment_id]["deployment_result"]
                
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
        tenant_id = user_data.get("tenantId")  # Use camelCase as returned by backend API
        
        # Extract permissions from user data
        permissions = user_data.get("permissions", [])
        if not isinstance(permissions, list):
            permissions = []
        
        # Extract role from user data
        role = user_data.get("role", "user")
        
        logger.debug(f"Extracted user info: user_id={user_id}, username={username}, tenant_id={tenant_id}, role={role}")
        
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
@app.post("/credentials", tags=["credentials"])
def set_credentials(
    credentials: Dict[str, str],
    user: dict = Depends(check_permission("deployment:manage"))
):
    """
    DEPRECATED: This endpoint is deprecated in favor of database-driven credential management.
    Credentials are now automatically loaded from the database based on tenant context.
    This endpoint is maintained for backward compatibility but does not perform any action.
    """
    logger.warning(f"Deprecated /credentials endpoint called by user: {user['username']}")
    return {"message": "Credentials are now managed automatically from database"}

@app.get("/credentials", tags=["credentials"])
def get_credentials(
    settings_id: Optional[str] = None,
    target_tenant_id: Optional[str] = None,
    user: dict = Depends(check_permission("deployment:read"))
):
    """
    Get Azure credentials status for the current tenant or a target tenant.
    Credentials are loaded fresh from the database.
    
    Args:
        settings_id (Optional[str]): Specific settings ID to use for credentials
        target_tenant_id (Optional[str]): Target tenant ID (admin/MSP only)
    """
    try:
        # Determine which tenant to use
        tenant_id = user["tenant_id"]
        
        # If target_tenant_id is provided, check if user has permission to access other tenants
        if target_tenant_id and target_tenant_id != user["tenant_id"]:
            # Only admin or MSP users can access other tenants
            if user.get("role") not in ["admin", "msp"]:
                raise HTTPException(
                    status_code=403, 
                    detail="Not authorized to access credentials for other tenants"
                )
            tenant_id = target_tenant_id
        
        logger.debug(f"Getting credentials status for tenant: {tenant_id}, settings_id: {settings_id}")
        
        # Get credential status from database
        status = credential_manager.get_tenant_credential_status(tenant_id, settings_id)
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting credentials for tenant {tenant_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/credentials/subscription", tags=["credentials"])
def set_subscription(
    subscription: Dict[str, str],
    user: dict = Depends(check_permission("deployment:manage"))
):
    """
    DEPRECATED: Subscription management is now handled automatically.
    This endpoint is maintained for backward compatibility.
    """
    logger.warning(f"Deprecated /credentials/subscription endpoint called by user: {user['username']}")
    return {"message": "Subscription management is now handled automatically"}

@app.get("/credentials/subscriptions", tags=["credentials"])
def list_subscriptions(
    settings_id: Optional[str] = None,
    target_tenant_id: Optional[str] = None,
    user: dict = Depends(check_permission("deployment:read"))
):
    """
    List Azure subscriptions for the current tenant or a target tenant.
    Uses fresh credentials from the database.
    
    Args:
        settings_id (Optional[str]): Specific settings ID to use for credentials
        target_tenant_id (Optional[str]): Target tenant ID (admin/MSP only)
    """
    try:
        # Determine which tenant to use
        tenant_id = user["tenant_id"]
        
        # If target_tenant_id is provided, check if user has permission to access other tenants
        if target_tenant_id and target_tenant_id != user["tenant_id"]:
            # Only admin or MSP users can access other tenants
            if user.get("role") not in ["admin", "msp"]:
                raise HTTPException(
                    status_code=403, 
                    detail="Not authorized to access credentials for other tenants"
                )
            tenant_id = target_tenant_id
        
        logger.debug(f"Listing subscriptions for tenant: {tenant_id}, settings_id: {settings_id}")
        
        # Get subscriptions using tenant-specific credentials
        result = credential_manager.list_tenant_subscriptions(
            tenant_id, 
            settings_id=settings_id
        )
        
        # Check if the operation was successful
        if not result.get("success", False):
            error_message = result.get("error", "Unknown error occurred")
            logger.error(f"Failed to list subscriptions for tenant {tenant_id}: {error_message}")
            raise HTTPException(status_code=400, detail=error_message)
        
        return result.get("subscriptions", [])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing subscriptions for tenant {tenant_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Deployment endpoints
@app.post("/deployments", tags=["deployments"])
def create_deployment(
    deployment: Dict[str, Any],
    background_tasks: BackgroundTasks,
    target_tenant_id: Optional[str] = None,
    user: dict = Depends(check_permission("deployment:create"))
):
    try:
        # Determine which tenant to use for this deployment
        deployment_tenant_id = user["tenant_id"]
        
        # If target_tenant_id is provided, check if user has permission to deploy for other tenants
        if target_tenant_id and target_tenant_id != user["tenant_id"]:
            # Only admin or MSP users can deploy for other tenants
            if user.get("role") not in ["admin", "msp"]:
                raise HTTPException(
                    status_code=403, 
                    detail="Not authorized to create deployments for other tenants"
                )
            deployment_tenant_id = target_tenant_id
            logger.info(f"Using target tenant ID for deployment: {deployment_tenant_id}")
        else:
            logger.info(f"Using user's tenant ID for deployment: {deployment_tenant_id}")
        
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
        settings_id = deployment.get("settings_id")  # Optional specific settings ID
        
        logger.info(f"Credentials provided: client_id={bool(client_id)}, client_secret={bool(client_secret)}, tenant_id={bool(tenant_id)}, subscription_id={bool(subscription_id)}")
        
        # Get tenant-specific Azure deployer with fresh credentials from database
        azure_deployer = credential_manager.create_azure_deployer_for_tenant(
            deployment_tenant_id, 
            settings_id=settings_id
        )
        
        if not azure_deployer:
            logger.error(f"Failed to get Azure credentials for tenant {deployment_tenant_id}")
            raise ValueError("Azure credentials not configured for this tenant")
        
        # If credentials are provided in the deployment request, use them to override
        if client_id and client_secret and tenant_id:
            logger.info("Using Azure credentials from deployment request")
            azure_deployer.set_credentials(
                client_id=client_id,
                client_secret=client_secret,
                tenant_id=tenant_id,
                subscription_id=subscription_id
            )
        
        # Verify credentials are configured
        cred_status = azure_deployer.get_credential_status()
        if not cred_status.get("configured", False):
            logger.error("Azure credentials not properly configured")
            raise HTTPException(
                status_code=400, 
                detail="Azure credentials not properly configured"
            )
        
        # Ensure we have a resource client
        if not azure_deployer.resource_client:
            logger.info("ResourceManagementClient not available, attempting to ensure resource client")
            try:
                azure_deployer._ensure_resource_client()
            except Exception as e:
                logger.error(f"Failed to ensure resource client: {str(e)}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to configure Azure resource client: {str(e)}"
                )
        
        # Final check - ensure we have a resource client
        if not azure_deployer.resource_client:
            logger.error("ResourceManagementClient still not available after ensure_resource_client")
            raise HTTPException(
                status_code=400, 
                detail="Azure resource client not configured"
            )
        
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
            "tenant_id": deployment_tenant_id,
            "created_by": user["user_id"],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "resources": [],
            "outputs": {},
            "logs": [],
            "deployment_result": result  # Store the full deployment result
        }
        
        logger.info(f"Stored deployment details in memory: {deployment_id}")
        
        # Start background polling for deployment status
        logger.info(f"Starting background polling thread for deployment {deployment_id}")
        thread = threading.Thread(
            target=poll_deployment_status,
            args=(deployment_id, resource_group, azure_deployment_name, user["token"], deployment_tenant_id)
        )
        thread.daemon = True
        thread.start()
        polling_threads[deployment_id] = thread
        
        return {
            "deployment_id": deployment_id,  # Return the consistent deployment ID
            "status": result.get("status", "in_progress"),
            "azure_deployment_id": azure_deployment_name,
            "created_at": deployments[deployment_id]["created_at"]
        }
    except Exception as e:
        logger.error(f"Error creating deployment: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/resources", tags=["resources"])
def get_resource_details(
    resource_id: str,
    target_tenant_id: Optional[str] = None,
    settings_id: Optional[str] = None,
    user: dict = Depends(check_permission("deployment:read"))
):
    """
    Get Azure resource details by resource ID.
    
    Args:
        resource_id (str): The Azure resource ID to fetch details for
        target_tenant_id (Optional[str]): Target tenant ID (admin/MSP only)
        settings_id (Optional[str]): Specific settings ID to use for credentials
    
    Returns:
        dict: Resource details from Azure
    """
    try:
        # Determine which tenant to use
        tenant_id = user["tenant_id"]
        
        # If target_tenant_id is provided, check if user has permission to access other tenants
        if target_tenant_id and target_tenant_id != user["tenant_id"]:
            # Only admin or MSP users can access other tenants
            if user.get("role") not in ["admin", "msp"]:
                raise HTTPException(
                    status_code=403, 
                    detail="Not authorized to access resources for other tenants"
                )
            tenant_id = target_tenant_id
        
        logger.info(f"Fetching resource details for resource_id: {resource_id}, tenant: {tenant_id}")
        
        # Get tenant-specific Azure deployer with fresh credentials
        azure_deployer = credential_manager.create_azure_deployer_for_tenant(
            tenant_id, 
            settings_id=settings_id
        )
        
        if not azure_deployer:
            logger.error(f"Failed to get Azure credentials for tenant {tenant_id}")
            raise HTTPException(
                status_code=400, 
                detail="Azure credentials not configured for this tenant"
            )
        
        # Verify credentials are configured
        cred_status = azure_deployer.get_credential_status()
        if not cred_status.get("configured", False):
            logger.error("Azure credentials not properly configured")
            raise HTTPException(
                status_code=400, 
                detail="Azure credentials not properly configured"
            )
        
        # Ensure we have a resource client
        if not azure_deployer.resource_client:
            logger.info("ResourceManagementClient not available, attempting to ensure resource client")
            try:
                azure_deployer._ensure_resource_client()
            except Exception as e:
                logger.error(f"Failed to ensure resource client: {str(e)}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to configure Azure resource client: {str(e)}"
                )
        
        # Final check - ensure we have a resource client
        if not azure_deployer.resource_client:
            logger.error("ResourceManagementClient still not available after ensure_resource_client")
            raise HTTPException(
                status_code=400, 
                detail="Azure resource client not configured"
            )
        
        # Fetch resource details using get_by_id method
        logger.info(f"Calling ResourceManagementClient.get_by_id for resource: {resource_id}")
        resource = azure_deployer.resource_client.resources.get_by_id(
            resource_id=resource_id,
            api_version="2021-04-01"  # Use a recent API version
        )
        
        # Convert the resource object to a dictionary
        resource_dict = {
            "id": resource.id,
            "name": resource.name,
            "type": resource.type,
            "location": resource.location,
            "kind": getattr(resource, 'kind', None),
            "managed_by": getattr(resource, 'managed_by', None),
            "sku": resource.sku.as_dict() if resource.sku else None,
            "plan": resource.plan.as_dict() if resource.plan else None,
            "properties": resource.properties,
            "tags": resource.tags,
            "identity": resource.identity.as_dict() if resource.identity else None,
            "created_time": resource.created_time.isoformat() if resource.created_time else None,
            "changed_time": resource.changed_time.isoformat() if resource.changed_time else None,
            "provisioning_state": getattr(resource, 'provisioning_state', None)
        }
        
        logger.info(f"Successfully fetched resource details for: {resource.name} ({resource.type})")
        return resource_dict
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching resource details for {resource_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch resource details: {str(e)}")

@app.get("/resourcegraph", tags=["resourcegraph"])
def query_azure_resource_graph(
    query: str,
    user: dict = Depends(check_permission("deployment:read"))
):
    """
    Query Azure Resource Graph.
    
    Args:
        query (str): The Azure Resource Graph query to execute
    
    Returns:
        list: Query results from Azure Resource Graph
    """
    try:
        # Determine which tenant to use
        tenant_id = user["tenant_id"]
        
        logger.info(f"Executing Azure Resource Graph query for tenant: {tenant_id}")
        logger.info(f"Query: {query}")
        
        # Get tenant-specific Azure deployer with fresh credentials
        azure_deployer = credential_manager.create_azure_deployer_for_tenant(
            tenant_id
        )
        
        if not azure_deployer:
            logger.error(f"Failed to get Azure credentials for tenant {tenant_id}")
            raise HTTPException(
                status_code=400, 
                detail="Azure credentials not configured for this tenant"
            )
        
        # Verify credentials are configured
        cred_status = azure_deployer.get_credential_status()
        if not cred_status.get("configured", False):
            logger.error("Azure credentials not properly configured")
            raise HTTPException(
                status_code=400, 
                detail="Azure credentials not properly configured"
            )
        
        # Create a Resource Graph client using the same credentials as the deployer
        logger.info("Creating ResourceGraphClient")
        resource_graph_client = ResourceGraphClient(azure_deployer.credentials)
        
        # Create the query request
        query_request = QueryRequest(query=query)
        
        # Execute the query
        logger.info("Executing Resource Graph query")
        result = resource_graph_client.resources(query_request)
        
        # Convert the result to a list of dictionaries
        results = []
        if result.data:
            for item in result.data:
                # Convert each item to a dictionary
                if hasattr(item, 'as_dict'):
                    results.append(item.as_dict())
                else:
                    # Fallback for items that don't have as_dict method
                    results.append(dict(item))
        
        logger.info(f"Successfully executed query, returned {len(results)} results")
        return {
            "data": results,
            "count": len(results),
            "query": query
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing Azure Resource Graph query: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to execute query: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")
