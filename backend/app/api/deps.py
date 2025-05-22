"""
API dependencies.

This module contains dependencies used across API endpoints.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import uuid

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current user from the token
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Try to find user by user_id first
    try:
        # Check if user_id is a valid UUID
        if user_id.startswith("user-"):
            # Legacy format - strip the prefix
            user_id = user_id[5:]
        
        # Try to parse as UUID
        try:
            uuid_obj = uuid.UUID(user_id)
            user = db.query(User).filter(User.user_id == str(uuid_obj)).first()
        except ValueError:
            # Not a valid UUID, try to find by numeric ID
            try:
                id_value = int(user_id)
                user = db.query(User).filter(User.id == id_value).first()
            except (ValueError, TypeError):
                user = None
    except Exception as e:
        print(f"Error finding user: {e}")
        user = None
    
    if user is None:
        raise credentials_exception
    
    return user
