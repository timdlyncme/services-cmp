from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import requests
import os
import logging

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.deployment import Environment, CloudAccount
from app.models.cloud_settings import CloudSettings

router = APIRouter()

# Deployment engine API URL
DEPLOYMENT_ENGINE_URL = os.getenv("DEPLOYMENT_ENGINE_URL", "http://deployment-engine:5000")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@router.get("/{environment_id}/resources", response_model=List[Dict[str, Any]])
def get_environment_resources(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    environment_id: str = Path(..., description="The environment ID"),
    provider: Optional[str] = Query(None, description="Filter by cloud provider (azure, aws, gcp)")
):
    """
    Get resources for a specific environment from the deployment container
    """
    # Check if user has permission to view resources
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Get environment
        environment = db.query(Environment).filter(
            Environment.environment_id == environment_id,
            Environment.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not environment:
            raise HTTPException(status_code=404, detail="Environment not found")
        
        # Get cloud accounts associated with this environment
        cloud_accounts = environment.cloud_accounts
        
        if not cloud_accounts:
            return []
        
        # Filter by provider if specified
        if provider:
            cloud_accounts = [ca for ca in cloud_accounts if ca.provider == provider]
        
        all_resources = []
        
        # For each cloud account, get resources
        for cloud_account in cloud_accounts:
            # Get cloud settings
            cloud_settings = cloud_account.cloud_settings
            
            if not cloud_settings:
                logger.warning(f"No cloud settings found for cloud account {cloud_account.name}")
                continue
            
            # Generate token for deployment engine
            token = get_token_for_deployment_engine(current_user)
            
            # Set credentials in deployment engine
            headers = {"Authorization": f"Bearer {token}"}
            
            # Prepare credentials based on provider
            if cloud_account.provider == "azure":
                credentials = {
                    "client_id": cloud_settings.client_id,
                    "client_secret": cloud_settings.client_secret,
                    "tenant_id": cloud_settings.tenant_id
                }
            elif cloud_account.provider == "aws":
                credentials = {
                    "access_key": cloud_settings.access_key,
                    "secret_key": cloud_settings.secret_key
                }
            elif cloud_account.provider == "gcp":
                credentials = {
                    "project_id": cloud_settings.project_id,
                    "service_account_key": cloud_settings.service_account_key
                }
            else:
                logger.warning(f"Unsupported provider: {cloud_account.provider}")
                continue
            
            # Set credentials in deployment engine
            set_response = requests.post(
                f"{DEPLOYMENT_ENGINE_URL}/credentials",
                headers=headers,
                json=credentials
            )
            
            if set_response.status_code != 200:
                logger.error(f"Error setting credentials: {set_response.text}")
                continue
            
            # Get subscription IDs
            subscription_ids = cloud_account.cloud_ids
            if not subscription_ids:
                logger.warning(f"No subscription IDs found for cloud account {cloud_account.name}")
                continue
            
            # Convert subscription IDs to comma-separated string
            subscription_ids_str = ",".join(subscription_ids)
            
            # Get resources from deployment engine
            response = requests.get(
                f"{DEPLOYMENT_ENGINE_URL}/credentials/resources",
                headers=headers,
                params={"subscription_ids": subscription_ids_str}
            )
            
            if response.status_code != 200:
                logger.error(f"Error getting resources: {response.text}")
                continue
            
            # Add resources to result
            resources = response.json()
            
            # Add environment and cloud account info to each resource
            for resource in resources:
                resource["environment_id"] = environment.environment_id
                resource["environment_name"] = environment.name
                resource["cloud_account_id"] = cloud_account.account_id
                resource["cloud_account_name"] = cloud_account.name
            
            all_resources.extend(resources)
        
        return all_resources
    
    except Exception as e:
        logger.error(f"Error getting environment resources: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def get_token_for_deployment_engine(user: User) -> str:
    """
    Generate a JWT token for the deployment engine.
    This token should include the necessary permissions.
    """
    import jwt
    import time
    
    # Get permissions from user role
    permissions = []
    if user.role:
        permissions = [p.name for p in user.role.permissions]
    
    # Map permissions to deployment engine format
    deployment_permissions = []
    permission_mapping = {
        "view:deployments": "deployment:read",
        "create:deployments": "deployment:create",
        "update:deployments": "deployment:update",
        "delete:deployments": "deployment:delete",
        "deployment:read": "deployment:read",
        "deployment:create": "deployment:create",
        "deployment:update": "deployment:update",
        "deployment:delete": "deployment:delete",
        "deployment:manage": "deployment:manage"
    }
    
    for p in permissions:
        if p in permission_mapping:
            deployment_permissions.append(permission_mapping[p])
    
    # Add deployment:manage permission for the deployment engine
    if "deployment:create" in permissions or "deployment:update" in permissions or "deployment:delete" in permissions:
        if "deployment:manage" not in deployment_permissions:
            deployment_permissions.append("deployment:manage")
    
    # Create token payload
    payload = {
        "sub": str(user.user_id),
        "name": user.username,
        "permissions": deployment_permissions,
        "tenant_id": str(user.tenant_id),
        "exp": int(time.time()) + 3600  # 1 hour expiration
    }
    
    # Sign token
    token = jwt.encode(
        payload,
        os.getenv("JWT_SECRET", "your-secret-key"),
        algorithm=os.getenv("JWT_ALGORITHM", "HS256")
    )
    
    return token
