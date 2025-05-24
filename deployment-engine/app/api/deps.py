from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import requests
from typing import Dict, Any, Generator

from app.core.config import settings
from app.services.deployment_service import DeploymentService

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Get current user from token
    """
    try:
        # Forward token to main API for validation
        response = requests.get(
            f"{settings.MAIN_API_URL}/api/auth/validate-token",
            headers={"Authorization": f"Bearer {credentials.credentials}"}
        )
        
        # If validation fails, raise exception
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Return user info
        return response.json()
    
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating token: {str(e)}",
        )

def get_deployment_service() -> DeploymentService:
    """
    Get deployment service
    """
    return DeploymentService()

