"""
Deployment context token system for secure, time-limited access to deployment resources.

This module provides cryptographically secure tokens that allow users with 'deploy:templates'
permission to access environments and cloud accounts only during deployment workflows.
"""

import secrets
import hmac
import hashlib
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class DeploymentContextToken:
    """
    Handles generation and validation of deployment context tokens.
    
    Tokens are HMAC-based, user-specific, and time-limited to prevent abuse.
    """
    
    @staticmethod
    def generate_token(user_id: str, secret_key: str) -> str:
        """
        Generate a secure deployment context token.
        
        Args:
            user_id: The user ID to bind the token to
            secret_key: Secret key for HMAC signing
            
        Returns:
            str: Secure token in format "user_id:timestamp:signature"
        """
        try:
            timestamp = int(datetime.utcnow().timestamp())
            payload = f"{user_id}:{timestamp}"
            signature = hmac.new(
                secret_key.encode(), 
                payload.encode(), 
                hashlib.sha256
            ).hexdigest()
            
            token = f"{payload}:{signature}"
            logger.info(f"Generated deployment token for user {user_id}")
            return token
            
        except Exception as e:
            logger.error(f"Failed to generate deployment token for user {user_id}: {e}")
            raise
    
    @staticmethod
    def validate_token(
        token: str, 
        user_id: str, 
        secret_key: str, 
        max_age_minutes: int = 30
    ) -> bool:
        """
        Validate a deployment context token.
        
        Args:
            token: The token to validate
            user_id: Expected user ID
            secret_key: Secret key for HMAC verification
            max_age_minutes: Maximum token age in minutes (default: 30)
            
        Returns:
            bool: True if token is valid, False otherwise
        """
        try:
            # Parse token components
            parts = token.split(':')
            if len(parts) != 3:
                logger.warning(f"Invalid token format for user {user_id}")
                return False
                
            token_user_id, timestamp_str, signature = parts
            
            # Verify user matches
            if token_user_id != user_id:
                logger.warning(f"Token user mismatch: expected {user_id}, got {token_user_id}")
                return False
            
            # Verify signature
            payload = f"{token_user_id}:{timestamp_str}"
            expected_signature = hmac.new(
                secret_key.encode(), 
                payload.encode(), 
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                logger.warning(f"Invalid token signature for user {user_id}")
                return False
            
            # Check expiration
            try:
                timestamp = int(timestamp_str)
                token_time = datetime.fromtimestamp(timestamp)
                age = datetime.utcnow() - token_time
                
                if age > timedelta(minutes=max_age_minutes):
                    logger.info(f"Expired token for user {user_id} (age: {age})")
                    return False
                    
            except (ValueError, OSError) as e:
                logger.warning(f"Invalid timestamp in token for user {user_id}: {e}")
                return False
            
            logger.debug(f"Valid deployment token for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error validating deployment token for user {user_id}: {e}")
            return False
    
    @staticmethod
    def extract_user_id(token: str) -> Optional[str]:
        """
        Extract user ID from token without full validation.
        
        Args:
            token: The token to extract from
            
        Returns:
            Optional[str]: User ID if extractable, None otherwise
        """
        try:
            parts = token.split(':')
            if len(parts) >= 1:
                return parts[0]
        except Exception:
            pass
        return None
    
    @staticmethod
    def get_token_age(token: str) -> Optional[timedelta]:
        """
        Get the age of a token without full validation.
        
        Args:
            token: The token to check
            
        Returns:
            Optional[timedelta]: Token age if extractable, None otherwise
        """
        try:
            parts = token.split(':')
            if len(parts) >= 2:
                timestamp = int(parts[1])
                token_time = datetime.fromtimestamp(timestamp)
                return datetime.utcnow() - token_time
        except Exception:
            pass
        return None


def is_valid_deployment_context(
    request_headers: dict, 
    user_id: str, 
    secret_key: str
) -> bool:
    """
    Convenience function to validate deployment context from request headers.
    
    Args:
        request_headers: HTTP request headers
        user_id: Expected user ID
        secret_key: Secret key for validation
        
    Returns:
        bool: True if valid deployment context, False otherwise
    """
    deployment_token = request_headers.get("X-Deployment-Context")
    if not deployment_token:
        return False
    
    return DeploymentContextToken.validate_token(
        deployment_token, 
        user_id, 
        secret_key
    )

