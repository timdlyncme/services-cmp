from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
import logging

from app.core.config import settings
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Configure logging
logger = logging.getLogger(__name__)

def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password
    """
    return pwd_context.hash(password)


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Authenticate a user
    """
    # First try to authenticate as a regular user
    user = db.query(User).filter(User.email == email).first()
    if user and verify_password(password, user.hashed_password):
        return user
    
    # If not found or password doesn't match, try as a service account
    try:
        # Import here to avoid circular imports
        from app.models.service_account import ServiceAccount
        
        # Try to authenticate as a service account using username
        service_account = db.query(ServiceAccount).filter(ServiceAccount.username == email).first()
        if service_account and verify_password(password, service_account.hashed_password):
            # Create a User-like object for the service account
            # This is a simplified approach - in a production system, you might want to
            # create a proper abstraction for this
            user = User()
            user.id = service_account.id
            user.user_id = service_account.service_account_id
            user.username = service_account.username
            user.email = service_account.username  # Use username as email for service accounts
            user.full_name = service_account.name
            user.is_active = service_account.is_active
            user.tenant_id = service_account.tenant_id
            user.role_id = service_account.role_id
            user.is_service_account = True  # Add a flag to indicate this is a service account
            
            return user
    except ImportError as e:
        # Log the error but continue - this might happen during initial setup
        logger.warning(f"Service account authentication not available: {str(e)}")
    
    return None
