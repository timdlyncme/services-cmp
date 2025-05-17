from typing import Any, List
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import authenticate_user, create_access_token
from app.db.session import get_db
from app.models.user import User, Permission, Role, Tenant
from app.schemas.user import User as UserSchema, LoginResponse, Token, TokenData, Permission as PermissionSchema

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


async def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
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
        token_data = TokenData(user_id=user_id)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.user_id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    return user


@router.post("/login", response_model=LoginResponse)
def login_access_token(
    db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
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
    access_token = create_access_token(
        user.user_id, expires_delta=access_token_expires
    )
    
    # Get user permissions
    role_permissions = db.query(Permission).join(
        Role.permissions
    ).filter(Role.id == user.role_id).all()
    
    user_permissions = db.query(Permission).join(
        User.permissions
    ).filter(User.id == user.id).all()
    
    # Combine permissions
    all_permissions = list(set(role_permissions + user_permissions))
    
    # Convert to schema
    permissions = [
        PermissionSchema(id=p.id, name=p.name, description=p.description)
        for p in all_permissions
    ]
    
    # Create response
    return {
        "user": {
            "id": user.user_id,
            "name": user.name,
            "email": user.email,
            "role": user.role.name,
            "tenantId": user.tenant.tenant_id,
            "permissions": permissions
        },
        "token": access_token
    }


@router.post("/login/test-token", response_model=UserSchema)
def test_token(current_user: User = Depends(get_current_user)) -> Any:
    """
    Test access token
    """
    return current_user


@router.get("/verify", response_model=UserSchema)
def verify_token(current_user: User = Depends(get_current_user)) -> Any:
    """
    Verify access token and return user data
    """
    # Get user permissions
    db = next(get_db())
    role_permissions = db.query(Permission).join(
        Role.permissions
    ).filter(Role.id == current_user.role_id).all()
    
    user_permissions = db.query(Permission).join(
        User.permissions
    ).filter(User.id == current_user.id).all()
    
    # Combine permissions
    all_permissions = list(set(role_permissions + user_permissions))
    
    # Convert to schema
    permissions = [
        PermissionSchema(id=p.id, name=p.name, description=p.description)
        for p in all_permissions
    ]
    
    # Create response
    return {
        "id": current_user.user_id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role.name,
        "tenantId": current_user.tenant.tenant_id,
        "permissions": permissions
    }


@router.get("/permission/{name}")
def check_permission(
    name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Any:
    """
    Check if user has a specific permission
    """
    # Check role permissions
    role_permission = db.query(Permission).join(
        Role.permissions
    ).filter(Role.id == current_user.role_id, Permission.name == name).first()
    
    # Check user permissions
    user_permission = db.query(Permission).join(
        User.permissions
    ).filter(User.id == current_user.id, Permission.name == name).first()
    
    has_permission = role_permission is not None or user_permission is not None
    
    return {"hasPermission": has_permission}

