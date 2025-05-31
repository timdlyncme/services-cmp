from datetime import timedelta
from typing import Any
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import authenticate_user, create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import Token, LoginResponse, User as UserSchema
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Use user.user_id as the subject for the token (UUID)
    access_token = create_access_token(
        subject=str(user.user_id), expires_delta=access_token_expires
    )
    
    # Get permissions from user role
    permissions = []
    if user.role:
        permissions = [p.name for p in user.role.permissions]
    
    # Convert user to UserSchema
    user_schema = UserSchema(
        id=user.id,
        user_id=user.user_id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role.name,
        tenantId=user.tenant.tenant_id,
        permissions=permissions
    )
    
    return {
        "user": user_schema.model_dump(),  # Convert to dictionary
        "token": access_token,
        "token_type": "bearer"
    }


@router.options("/login")
def options_login():
    """
    Handle preflight requests for login
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@router.get("/me", response_model=UserSchema)
def read_users_me(current_user: User = Depends(get_current_user)) -> Any:
    """
    Get current user
    """
    # Get permissions from user role
    permissions = []
    if current_user.role:
        permissions = [p.name for p in current_user.role.permissions]
    
    # Convert user to UserSchema
    user_schema = UserSchema(
        id=current_user.id,
        user_id=current_user.user_id,
        username=current_user.username,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role.name,
        tenantId=current_user.tenant.tenant_id,
        permissions=permissions
    )
    
    return user_schema.model_dump()


@router.get("/verify")
def verify_token(current_user: User = Depends(get_current_user)) -> Any:
    """
    Verify if the token is valid
    """
    return {"valid": True}
