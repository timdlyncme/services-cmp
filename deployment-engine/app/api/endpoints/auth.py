from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import requests
from typing import Dict, Any, Optional

from app.core.config import settings

router = APIRouter()
security = HTTPBearer()

@router.get("/validate-token")
def validate_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Validate JWT token by forwarding to the main API
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

