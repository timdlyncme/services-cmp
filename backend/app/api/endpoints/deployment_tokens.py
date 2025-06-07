"""
API endpoints for deployment context token management.

Provides secure token generation for users with deployment permissions.
"""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.core.deployment_tokens import DeploymentContextToken
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class DeploymentTokenResponse(BaseModel):
    """Response model for deployment token generation."""
    token: str
    expires_in_minutes: int = 30


@router.post("/token", response_model=DeploymentTokenResponse)
def generate_deployment_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Generate a deployment context token for authorized users.
    
    This endpoint creates a secure, time-limited token that allows users with
    'deploy:templates' permission to access environments and cloud accounts
    during deployment workflows.
    
    Returns:
        DeploymentTokenResponse: Contains the secure token and expiration info
        
    Raises:
        HTTPException: 403 if user lacks deploy:templates permission
        HTTPException: 500 if token generation fails
    """
    try:
        # Check if user has permission to deploy templates
        has_deploy_permission = any(
            p.name == "deploy:templates" 
            for p in current_user.role.permissions
        )
        
        if not has_deploy_permission:
            logger.warning(
                f"User {current_user.username} attempted to generate deployment token "
                f"without deploy:templates permission"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="deploy:templates permission required to generate deployment tokens"
            )
        
        # Generate secure token
        token = DeploymentContextToken.generate_token(
            user_id=current_user.user_id,
            secret_key=settings.DEPLOYMENT_SECRET_KEY
        )
        
        logger.info(
            f"Generated deployment token for user {current_user.username} "
            f"(user_id: {current_user.user_id})"
        )
        
        return DeploymentTokenResponse(
            token=token,
            expires_in_minutes=30
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(
            f"Failed to generate deployment token for user {current_user.username}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate deployment token"
        )


@router.post("/validate-token")
def validate_deployment_token(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Validate a deployment context token (for debugging/testing).
    
    Args:
        token: The token to validate
        
    Returns:
        dict: Validation result with token info
    """
    try:
        is_valid = DeploymentContextToken.validate_token(
            token=token,
            user_id=current_user.user_id,
            secret_key=settings.DEPLOYMENT_SECRET_KEY
        )
        
        token_age = DeploymentContextToken.get_token_age(token)
        
        return {
            "valid": is_valid,
            "user_id": current_user.user_id,
            "token_age_seconds": token_age.total_seconds() if token_age else None
        }
        
    except Exception as e:
        logger.error(f"Error validating token: {e}")
        return {
            "valid": False,
            "error": str(e)
        }

