"""
API access control middleware for enforcing user API restrictions.

This middleware enforces the api_enabled flag for users, blocking direct API access
for users who don't have API privileges while allowing deployment context access.
"""

from typing import Callable
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging
import re

from app.api.deps import get_current_user
from app.db.session import get_db
from app.core.deployment_tokens import is_valid_deployment_context
from app.core.config import settings

logger = logging.getLogger(__name__)


class APIAccessControlMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce API access restrictions based on user api_enabled flag.
    
    Users with api_enabled=False are blocked from most API endpoints except:
    - Authentication endpoints
    - Deployment token generation
    - Deployment context requests (with valid tokens)
    """
    
    # Endpoints that are always allowed regardless of api_enabled flag
    ALWAYS_ALLOWED_PATTERNS = [
        r"^/api/auth/.*",           # Authentication endpoints
        r"^/api/deployment/token$", # Deployment token generation
        r"^/api/users/me$",         # Current user info
        r"^/api/dashboards/.*",     # Dashboard endpoints (UI functionality)
        r"^/api/deployments/.*",    # Deployment viewing (users need to see their deployments)
        r"^/docs.*",                # API documentation
        r"^/openapi\.json$",        # OpenAPI schema
        r"^/health.*",              # Health checks
    ]
    
    # Endpoints that require deployment context for api_enabled=False users
    DEPLOYMENT_CONTEXT_PATTERNS = [
        r"^/api/environments/?$",
        r"^/api/cloud-accounts/?$",
        r"^/api/templates/?.*",     # Templates for deployment context
    ]
    
    # Endpoints that are blocked for api_enabled=False users (direct API access)
    RESTRICTED_PATTERNS = [
        r"^/api/users/.*",          # User management (except /me)
        r"^/api/tenants/.*",        # Tenant management
        r"^/api/integrations/.*",   # Integration management
    ]
    
    def __init__(self, app):
        super().__init__(app)
        self.always_allowed_regex = [re.compile(pattern) for pattern in self.ALWAYS_ALLOWED_PATTERNS]
        self.deployment_context_regex = [re.compile(pattern) for pattern in self.DEPLOYMENT_CONTEXT_PATTERNS]
        self.restricted_regex = [re.compile(pattern) for pattern in self.RESTRICTED_PATTERNS]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and enforce API access restrictions.
        """
        try:
            # Skip middleware for OPTIONS requests (CORS preflight)
            if request.method == "OPTIONS":
                return await call_next(request)
            
            # Skip middleware for non-API requests
            if not request.url.path.startswith("/api/"):
                return await call_next(request)
            
            path = request.url.path
            
            # Check if endpoint is always allowed
            if any(regex.match(path) for regex in self.always_allowed_regex):
                return await call_next(request)
            
            # Get current user from token
            user = await self._get_current_user(request)
            if not user:
                return await call_next(request)  # Let auth middleware handle it
            
            # MSP users have full access
            if user.is_msp_user:
                return await call_next(request)
            
            # Check if user has API access enabled
            if not user.api_enabled:
                # Check if this is a restricted endpoint (except /api/users/me which is in always_allowed)
                if any(regex.match(path) for regex in self.restricted_regex) and path != "/api/users/me":
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "API access disabled for this user"}
                    )
                
                # Check if this requires deployment context
                if any(regex.match(path) for regex in self.deployment_context_regex):
                    # Allow these endpoints for UI functionality
                    return await call_next(request)
            
            # Allow all other requests
            return await call_next(request)
            
        except Exception as e:
            logger.error(f"Error in API access control middleware: {e}")
            # On error, allow the request to proceed to avoid breaking the application
            return await call_next(request)
    
    def _is_always_allowed(self, path: str) -> bool:
        """Check if the path is always allowed regardless of API settings."""
        return any(regex.match(path) for regex in self.always_allowed_regex)
    
    def _requires_deployment_context(self, path: str) -> bool:
        """Check if the path requires deployment context for restricted users."""
        return any(regex.match(path) for regex in self.deployment_context_regex)
    
    def _has_valid_deployment_context(self, request: Request, user) -> bool:
        """Check if the request has a valid deployment context token."""
        try:
            return is_valid_deployment_context(
                request_headers=dict(request.headers),
                user_id=user.user_id,
                secret_key=settings.DEPLOYMENT_SECRET_KEY
            )
        except Exception as e:
            logger.error(f"Error validating deployment context: {e}")
            return False
    
    async def _get_current_user(self, request: Request):
        """Extract current user from request token."""
        try:
            # Get authorization header
            authorization = request.headers.get("Authorization")
            if not authorization or not authorization.startswith("Bearer "):
                return None
            
            token = authorization.split(" ")[1]
            
            # Get database session
            db = next(get_db())
            
            # Get user from token
            user = get_current_user(token, db)
            return user
            
        except Exception as e:
            logger.debug(f"Could not extract user from request: {e}")
            return None
