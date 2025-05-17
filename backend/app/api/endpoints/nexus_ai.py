from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import requests
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

router = APIRouter()


class AzureOpenAIConfig(BaseModel):
    api_key: str
    endpoint: str
    deployment_name: str
    api_version: str = "2023-05-15"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.95
    frequency_penalty: Optional[float] = 0
    presence_penalty: Optional[float] = 0
    stop: Optional[List[str]] = None


class ChatResponse(BaseModel):
    message: ChatMessage
    usage: Dict[str, int]
    model: str


class ConfigUpdateRequest(BaseModel):
    api_key: str
    endpoint: str
    deployment_name: str
    api_version: Optional[str] = "2023-05-15"


@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Chat with Azure OpenAI
    """
    # Check if Azure OpenAI is configured
    if not all([
        settings.AZURE_OPENAI_API_KEY,
        settings.AZURE_OPENAI_ENDPOINT,
        settings.AZURE_OPENAI_DEPLOYMENT_NAME
    ]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Azure OpenAI is not configured. Please configure it first."
        )
    
    # Prepare request to Azure OpenAI
    url = f"{settings.AZURE_OPENAI_ENDPOINT}/openai/deployments/{settings.AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version={settings.AZURE_OPENAI_API_VERSION}"
    
    headers = {
        "Content-Type": "application/json",
        "api-key": settings.AZURE_OPENAI_API_KEY
    }
    
    payload = {
        "messages": [{"role": msg.role, "content": msg.content} for msg in request.messages],
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
        "top_p": request.top_p,
        "frequency_penalty": request.frequency_penalty,
        "presence_penalty": request.presence_penalty,
    }
    
    if request.stop:
        payload["stop"] = request.stop
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        
        return {
            "message": {
                "role": result["choices"][0]["message"]["role"],
                "content": result["choices"][0]["message"]["content"]
            },
            "usage": result["usage"],
            "model": result["model"]
        }
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error communicating with Azure OpenAI: {str(e)}"
        )


@router.get("/config", response_model=AzureOpenAIConfig)
def get_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get Azure OpenAI configuration
    """
    # Check if user has permission to view settings
    # This would be a more robust check in a real application
    has_permission = True
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return {
        "api_key": settings.AZURE_OPENAI_API_KEY or "",
        "endpoint": settings.AZURE_OPENAI_ENDPOINT or "",
        "deployment_name": settings.AZURE_OPENAI_DEPLOYMENT_NAME or "",
        "api_version": settings.AZURE_OPENAI_API_VERSION
    }


@router.post("/config", response_model=AzureOpenAIConfig)
def update_config(
    request: ConfigUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Update Azure OpenAI configuration
    """
    # Check if user has permission to manage settings
    # This would be a more robust check in a real application
    has_permission = True
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # In a real application, you would update these settings in a database
    # For this example, we'll just update the settings object
    # Note: This is not persistent across restarts
    settings.AZURE_OPENAI_API_KEY = request.api_key
    settings.AZURE_OPENAI_ENDPOINT = request.endpoint
    settings.AZURE_OPENAI_DEPLOYMENT_NAME = request.deployment_name
    settings.AZURE_OPENAI_API_VERSION = request.api_version
    
    return {
        "api_key": settings.AZURE_OPENAI_API_KEY,
        "endpoint": settings.AZURE_OPENAI_ENDPOINT,
        "deployment_name": settings.AZURE_OPENAI_DEPLOYMENT_NAME,
        "api_version": settings.AZURE_OPENAI_API_VERSION
    }


@router.get("/status")
def check_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Check Azure OpenAI connection status
    """
    # Check if Azure OpenAI is configured
    if not all([
        settings.AZURE_OPENAI_API_KEY,
        settings.AZURE_OPENAI_ENDPOINT,
        settings.AZURE_OPENAI_DEPLOYMENT_NAME
    ]):
        return {
            "status": "not_configured",
            "message": "Azure OpenAI is not configured"
        }
    
    # Test connection to Azure OpenAI
    url = f"{settings.AZURE_OPENAI_ENDPOINT}/openai/deployments?api-version={settings.AZURE_OPENAI_API_VERSION}"
    
    headers = {
        "api-key": settings.AZURE_OPENAI_API_KEY
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        # Check if the deployment exists
        deployments = response.json()["data"]
        deployment_exists = any(d["id"] == settings.AZURE_OPENAI_DEPLOYMENT_NAME for d in deployments)
        
        if deployment_exists:
            return {
                "status": "connected",
                "message": "Successfully connected to Azure OpenAI"
            }
        else:
            return {
                "status": "deployment_not_found",
                "message": f"Deployment '{settings.AZURE_OPENAI_DEPLOYMENT_NAME}' not found"
            }
    except requests.exceptions.RequestException as e:
        return {
            "status": "error",
            "message": f"Error connecting to Azure OpenAI: {str(e)}"
        }

