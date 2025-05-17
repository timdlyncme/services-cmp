import json
import logging
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

router = APIRouter()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class NexusAIConfig:
    """
    Class to store NexusAI configuration
    """
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    api_version: str = "2023-05-15"
    deployment_name: Optional[str] = None
    
    @classmethod
    def is_configured(cls) -> bool:
        """
        Check if NexusAI is configured
        """
        return (
            cls.api_key is not None and
            cls.endpoint is not None and
            cls.deployment_name is not None
        )
    
    @classmethod
    def update_config(
        cls,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        api_version: Optional[str] = None,
        deployment_name: Optional[str] = None
    ) -> None:
        """
        Update NexusAI configuration
        """
        if api_key is not None:
            cls.api_key = api_key
        if endpoint is not None:
            cls.endpoint = endpoint
        if api_version is not None:
            cls.api_version = api_version
        if deployment_name is not None:
            cls.deployment_name = deployment_name


# Initialize NexusAI configuration from settings
NexusAIConfig.update_config(
    api_key=settings.AZURE_OPENAI_API_KEY,
    endpoint=settings.AZURE_OPENAI_ENDPOINT,
    api_version=settings.AZURE_OPENAI_API_VERSION,
    deployment_name=settings.AZURE_OPENAI_DEPLOYMENT_NAME
)

# Store chat history
chat_history: Dict[str, List[Dict[str, str]]] = {}


@router.post("/chat")
def chat(
    message: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Chat with NexusAI
    """
    # Check if user has permission to use NexusAI
    has_permission = any(p.name == "use:nexus_ai" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Check if NexusAI is configured
    if not NexusAIConfig.is_configured():
        return {
            "message": "NexusAI is not configured. Please configure it first.",
            "configured": False
        }
    
    # Get chat history for user
    user_id = str(current_user.id)
    if user_id not in chat_history:
        chat_history[user_id] = []
    
    # Add user message to chat history
    chat_history[user_id].append({
        "role": "user",
        "content": message
    })
    
    try:
        # Call Azure OpenAI API
        url = f"{NexusAIConfig.endpoint}/openai/deployments/{NexusAIConfig.deployment_name}/chat/completions?api-version={NexusAIConfig.api_version}"
        headers = {
            "Content-Type": "application/json",
            "api-key": NexusAIConfig.api_key
        }
        payload = {
            "messages": chat_history[user_id],
            "max_tokens": 1000,
            "temperature": 0.7,
            "top_p": 0.95,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "stop": None
        }
        
        logger.info(f"Sending request to Azure OpenAI API: {url}")
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code != 200:
            logger.error(f"Error from Azure OpenAI API: {response.text}")
            return {
                "message": f"Error from Azure OpenAI API: {response.text}",
                "configured": True,
                "success": False
            }
        
        # Parse response
        response_json = response.json()
        assistant_message = response_json["choices"][0]["message"]["content"]
        
        # Add assistant message to chat history
        chat_history[user_id].append({
            "role": "assistant",
            "content": assistant_message
        })
        
        # Limit chat history to last 20 messages
        if len(chat_history[user_id]) > 20:
            chat_history[user_id] = chat_history[user_id][-20:]
        
        return {
            "message": assistant_message,
            "configured": True,
            "success": True
        }
    
    except Exception as e:
        logger.error(f"Error calling Azure OpenAI API: {str(e)}")
        return {
            "message": f"Error calling Azure OpenAI API: {str(e)}",
            "configured": True,
            "success": False
        }


@router.get("/config")
def get_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get NexusAI configuration
    """
    # Check if user has permission to manage NexusAI
    has_permission = any(p.name == "manage:nexus_ai" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return {
        "endpoint": NexusAIConfig.endpoint,
        "api_version": NexusAIConfig.api_version,
        "deployment_name": NexusAIConfig.deployment_name,
        "configured": NexusAIConfig.is_configured()
    }


@router.post("/config")
def update_config(
    api_key: Optional[str] = None,
    endpoint: Optional[str] = None,
    api_version: Optional[str] = None,
    deployment_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update NexusAI configuration
    """
    # Check if user has permission to manage NexusAI
    has_permission = any(p.name == "manage:nexus_ai" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Update configuration
    NexusAIConfig.update_config(
        api_key=api_key,
        endpoint=endpoint,
        api_version=api_version,
        deployment_name=deployment_name
    )
    
    return {
        "message": "Configuration updated successfully",
        "configured": NexusAIConfig.is_configured()
    }


@router.get("/status")
def get_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get NexusAI status
    """
    # Check if user has permission to use NexusAI
    has_permission = any(p.name == "use:nexus_ai" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Check if NexusAI is configured
    if not NexusAIConfig.is_configured():
        return {
            "status": "not_configured",
            "message": "NexusAI is not configured. Please configure it first."
        }
    
    try:
        # Test connection to Azure OpenAI API
        url = f"{NexusAIConfig.endpoint}/openai/deployments?api-version={NexusAIConfig.api_version}"
        headers = {
            "api-key": NexusAIConfig.api_key
        }
        
        logger.info(f"Testing connection to Azure OpenAI API: {url}")
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            logger.error(f"Error connecting to Azure OpenAI API: {response.text}")
            return {
                "status": "error",
                "message": f"Error connecting to Azure OpenAI API: {response.text}"
            }
        
        # Check if deployment exists
        deployments = response.json()["data"]
        deployment_exists = any(d["id"] == NexusAIConfig.deployment_name for d in deployments)
        
        if not deployment_exists:
            logger.error(f"Deployment {NexusAIConfig.deployment_name} not found")
            return {
                "status": "error",
                "message": f"Deployment {NexusAIConfig.deployment_name} not found"
            }
        
        return {
            "status": "connected",
            "message": "Connected to Azure OpenAI API"
        }
    
    except Exception as e:
        logger.error(f"Error testing connection to Azure OpenAI API: {str(e)}")
        return {
            "status": "error",
            "message": f"Error testing connection to Azure OpenAI API: {str(e)}"
        }


@router.get("/logs")
def get_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get NexusAI logs
    """
    # Check if user has permission to manage NexusAI
    has_permission = any(p.name == "manage:nexus_ai" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Get chat history for user
    user_id = str(current_user.id)
    if user_id not in chat_history:
        return {
            "logs": []
        }
    
    return {
        "logs": chat_history[user_id]
    }

