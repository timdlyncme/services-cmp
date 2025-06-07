from typing import Any, Dict, List, Optional
import logging
import json
import time
import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.ai_assistant import AIAssistantConfig, AIAssistantLog
from app.models.user import Tenant
from app.core.permissions import has_permission_in_tenant

router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Debug logs for development
DEBUG_LOGS = []

def add_log(message: str, level: str = "info", details: Any = None, tenant_id: str = None):
    """Add a log entry to the debug logs"""
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "level": level,
        "message": message,
        "details": details
    }
    DEBUG_LOGS.append(log_entry)
    logger.info(f"[AIAssistant] {level.upper()}: {message}")
    
    # Also add to database with tenant_id if provided
    if tenant_id:
        try:
            db = next(get_db())
            db_log = AIAssistantLog(
                timestamp=datetime.now(),
                level=level,
                message=message,
                details=details,
                tenant_id=tenant_id
            )
            db.add(db_log)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to add log to database: {e}")

# Helper function to get the current configuration
def get_config(db: Session, tenant_id: str):
    """Get the current AI Assistant configuration from the database for a specific tenant"""
    config = db.query(AIAssistantConfig).filter(AIAssistantConfig.tenant_id == tenant_id).first()
    if not config:
        # Create a default config if none exists for this tenant
        config = AIAssistantConfig(tenant_id=tenant_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

def get_config_read_only(db: Session, tenant_id: str):
    """Get the current AI Assistant configuration from the database for a specific tenant (read-only)"""
    return db.query(AIAssistantConfig).filter(AIAssistantConfig.tenant_id == tenant_id).first()
    return config

# Helper function to get or create configuration (for write operations)
def get_or_create_config(db: Session, tenant_id: str):
    """Get or create AI Assistant configuration from the database for a specific tenant"""
    config = db.query(AIAssistantConfig).filter(AIAssistantConfig.tenant_id == tenant_id).first()
    if not config:
        # Create a default config if none exists for this tenant
        config = AIAssistantConfig(tenant_id=tenant_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

# Models
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    max_completion_tokens: Optional[int] = 1000
    temperature: Optional[float] = 1.0
    stream: Optional[bool] = False
    template_data: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    message: ChatMessage
    usage: Dict[str, Any]


class ConfigRequest(BaseModel):
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    api_version: Optional[str] = None
    deployment_name: Optional[str] = None
    model: Optional[str] = None


class ConfigResponse(BaseModel):
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    api_version: str
    deployment_name: Optional[str] = None
    model: Optional[str] = None


class StatusResponse(BaseModel):
    status: str
    last_checked: Optional[str] = None
    error: Optional[str] = None


class LogEntry(BaseModel):
    timestamp: str
    level: str
    message: str


class LogsResponse(BaseModel):
    logs: List[LogEntry]


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: Optional[str] = Query(None, description="Tenant ID for configuration")
) -> Any:
    """
    Chat with Azure OpenAI
    """
    # Use the provided tenant_id if it exists, otherwise use the current user's tenant
    config_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
    
    # Check if user has permission to use AI Assistant
    if not has_permission_in_tenant(current_user, "use:ai_assistant", config_tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Get the configuration from the database
    config = get_or_create_config(db, config_tenant_id)
    
    # Check if Azure OpenAI is configured
    if not config.api_key or not config.endpoint or not config.deployment_name:
        add_log("Azure OpenAI is not configured", "error", tenant_id=config_tenant_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Azure OpenAI is not configured"
        )
    
    # Log the request for debugging
    if request.template_data:
        add_log(f"Received template data with request: {len(str(request.template_data))} bytes", "info", tenant_id=config_tenant_id)
    else:
        add_log("No template data received with request", "info", tenant_id=config_tenant_id)
    
    # If streaming is requested, use the streaming endpoint
    if request.stream:
        return await stream_chat(request, current_user, db, config_tenant_id)

    try:
        add_log(f"Sending request to Azure OpenAI: {len(request.messages)} messages", tenant_id=config_tenant_id)
        
        # Prepare the request to Azure OpenAI
        azure_url = f"{config.endpoint}/openai/deployments/{config.deployment_name}/chat/completions?api-version={config.api_version}"
        
        headers = {
            "Content-Type": "application/json",
            "api-key": config.api_key
        }
        
        # Prepare messages with template data if available
        messages = [{
            "role": msg.role,
            "content": msg.content
        } for msg in request.messages]
        
        # Log system message if it exists
        system_message_index = next((i for i, msg in enumerate(messages) if msg["role"] == "system"), None)
        if system_message_index is not None:
            add_log(f"System message found: {messages[system_message_index]['content'][:100]}...", "info", tenant_id=config_tenant_id)
        else:
            add_log("No system message found in request", "info", tenant_id=config_tenant_id)
        
        # If template data is provided, add it to the system message
        if request.template_data:
            # Find the system message or create one if it doesn't exist
            system_message_index = next((i for i, msg in enumerate(messages) if msg["role"] == "system"), None)
            
            if system_message_index is not None:
                # Append template data to existing system message
                template_data_str = json.dumps(request.template_data, indent=2)
                messages[system_message_index]["content"] += f"\n\nHere is the current template data to help you provide accurate responses:\n```json\n{template_data_str}\n```\n\nWhen answering questions about the template, always use this data to provide accurate information."
                add_log(f"Added template data to existing system message", "info", tenant_id=config_tenant_id)
            else:
                # Create a new system message with template data
                template_data_str = json.dumps(request.template_data, indent=2)
                system_message = {
                    "role": "system",
                    "content": f"You are an AI assistant that helps with understanding and modifying cloud templates. You have knowledge about Azure, AWS, and GCP resources and infrastructure as code.\n\nHere is the current template data to help you provide accurate responses:\n```json\n{template_data_str}\n```\n\nWhen answering questions about the template, always use this data to provide accurate information."
                }
                messages.insert(0, system_message)
                add_log(f"Created new system message with template data", "info", tenant_id=config_tenant_id)
        
        payload = {
            "messages": messages,
            "max_tokens": request.max_completion_tokens,
            "temperature": request.temperature
        }
        
        # Send the request to Azure OpenAI
        start_time = time.time()
        response = requests.post(azure_url, headers=headers, json=payload)
        end_time = time.time()
        
        add_log(f"Request completed in {end_time - start_time:.2f} seconds", tenant_id=config_tenant_id)
        
        # Check if the request was successful
        if response.status_code != 200:
            add_log(f"Error from Azure OpenAI: {response.status_code} {response.text}", "error", tenant_id=config_tenant_id)
            
            # Update connection status in the database
            config.last_status = "error"
            config.last_checked = datetime.utcnow()
            config.last_error = f"Error: {response.status_code} {response.text}"
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error from Azure OpenAI: {response.status_code} {response.text}"
            )
        
        # Parse the response
        response_data = response.json()
        
        # Update connection status in the database
        config.last_status = "connected"
        config.last_checked = datetime.utcnow()
        config.last_error = None
        db.commit()
        
        add_log("Successfully received response from Azure OpenAI", tenant_id=config_tenant_id)
        
        # Return the response
        return {
            "message": ChatMessage(
                role="assistant",
                content=response_data["choices"][0]["message"]["content"]
            ),
            "usage": response_data["usage"]
        }
    
    except Exception as e:
        # Update connection status in the database
        config.last_status = "error"
        config.last_checked = datetime.utcnow()
        config.last_error = str(e)
        db.commit()
        
        add_log(f"Error in chat endpoint: {str(e)}", "error", tenant_id=config_tenant_id)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error: {str(e)}"
        )


@router.post("/stream")
async def stream_chat_endpoint(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: Optional[str] = Query(None, description="Tenant ID for configuration")
) -> StreamingResponse:
    """
    Stream chat responses from Azure OpenAI
    """
    # Use the provided tenant_id if it exists, otherwise use the current user's tenant
    config_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
    
    # Check if user has permission to use AI Assistant
    if not has_permission_in_tenant(current_user, "use:ai_assistant", config_tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # The issue is here - we need to await the coroutine
    generator = stream_chat(request, current_user, db, config_tenant_id)
    
    return StreamingResponse(
        generator,
        media_type="text/event-stream"
    )


async def stream_chat(
    request: ChatRequest,
    current_user: User,
    db: Session,
    config_tenant_id: str
):
    """
    Stream chat responses from Azure OpenAI
    """

    # Check if tenant exists
    tenant = db.query(Tenant).filter(Tenant.tenant_id == config_tenant_id).first()
    if not tenant:
        error_msg = json.dumps({"error": f"Tenant with ID {config_tenant_id} not found"})
        yield f"data: {error_msg}\n\n"

        return

    # Get the configuration from the database
    config = get_or_create_config(db, config_tenant_id)
    
    # Check if Azure OpenAI is configured
    if not config.api_key or not config.endpoint or not config.deployment_name:
        add_log("Azure OpenAI is not configured for streaming", "error", tenant_id=config_tenant_id)
        yield f"data: {json.dumps({'error': 'Azure OpenAI is not configured'})}\n\n"
        return
    
    try:
        add_log(f"Sending streaming request to Azure OpenAI: {len(request.messages)} messages", tenant_id=config_tenant_id)
        
        # Prepare the request to Azure OpenAI
        azure_url = f"{config.endpoint}/openai/deployments/{config.deployment_name}/chat/completions?api-version={config.api_version}"
        
        headers = {
            "Content-Type": "application/json",
            "api-key": config.api_key
        }
        
        # Prepare messages with template data if available
        messages = [{
            "role": msg.role,
            "content": msg.content
        } for msg in request.messages]
        
        # Log system message if it exists
        system_message_index = next((i for i, msg in enumerate(messages) if msg["role"] == "system"), None)
        if system_message_index is not None:
            add_log(f"System message found in streaming: {messages[system_message_index]['content'][:100]}...", "info", tenant_id=config_tenant_id)
        else:
            add_log("No system message found in streaming request", "info", tenant_id=config_tenant_id)
        
        # If template data is provided, add it to the system message
        if request.template_data:
            # Find the system message or create one if it doesn't exist
            system_message_index = next((i for i, msg in enumerate(messages) if msg["role"] == "system"), None)
            
            if system_message_index is not None:
                # Append template data to existing system message
                template_data_str = json.dumps(request.template_data, indent=2)
                messages[system_message_index]["content"] += f"\n\nHere is the current template data to help you provide accurate responses:\n```json\n{template_data_str}\n```\n\nWhen answering questions about the template, always use this data to provide accurate information."
                add_log(f"Added template data to existing system message in streaming", "info", tenant_id=config_tenant_id)
            else:
                # Create a new system message with template data
                template_data_str = json.dumps(request.template_data, indent=2)
                system_message = {
                    "role": "system",
                    "content": f"You are an AI assistant that helps with understanding and modifying cloud templates. You have knowledge about Azure, AWS, and GCP resources and infrastructure as code.\n\nHere is the current template data to help you provide accurate responses:\n```json\n{template_data_str}\n```\n\nWhen answering questions about the template, always use this data to provide accurate information."
                }
                messages.insert(0, system_message)
                add_log(f"Created new system message with template data in streaming", "info", tenant_id=config_tenant_id)
        
        payload = {
            "messages": messages,
            "max_tokens": request.max_completion_tokens,
            "temperature": request.temperature,
            "stream": True
        }
        
        # Send the request to Azure OpenAI with streaming
        with requests.post(azure_url, headers=headers, json=payload, stream=True) as response:
            if response.status_code != 200:
                error_msg = f"Error from Azure OpenAI: {response.status_code} {response.text}"
                add_log(error_msg, "error", tenant_id=config_tenant_id)
                
                # Update connection status in the database
                config.last_status = "error"
                config.last_checked = datetime.utcnow()
                config.last_error = error_msg
                db.commit()
                
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                return
            
            # Update connection status in the database
            config.last_status = "connected"
            config.last_checked = datetime.utcnow()
            config.last_error = None
            db.commit()
            
            # Process the streaming response
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        if line.startswith('data: [DONE]'):
                            break
                        
                        data = line[6:]  # Remove 'data: ' prefix
                        try:
                            chunk = json.loads(data)
                            if 'choices' in chunk and len(chunk['choices']) > 0:
                                delta = chunk['choices'][0].get('delta', {})
                                if 'content' in delta and delta['content']:
                                    yield f"data: {json.dumps({'content': delta['content']})}\n\n"
                        except json.JSONDecodeError:
                            add_log(f"Error parsing JSON: {data}", "error", tenant_id=config_tenant_id)
            
            add_log("Successfully completed streaming response", tenant_id=config_tenant_id)
            yield f"data: [DONE]\n\n"
    
    except Exception as e:
        # Update connection status in the database
        config = get_or_create_config(db, config_tenant_id)
        config.last_status = "error"
        config.last_checked = datetime.utcnow()
        config.last_error = str(e)
        db.commit()
        
        error_msg = f"Error in streaming chat: {str(e)}"
        add_log(error_msg, "error", tenant_id=config_tenant_id)
        yield f"data: {json.dumps({'error': error_msg})}\n\n"


@router.get("/config", response_model=ConfigResponse)
async def get_config_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: Optional[str] = Query(None, description="Tenant ID for configuration")
) -> Any:
    """
    Get Azure OpenAI configuration
    """
    # Use the provided tenant_id if it exists, otherwise use the current user's tenant
    config_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
    
    # Check if user has permission to manage nexus AI (changed from manage:settings)
    if not has_permission_in_tenant(current_user, "manage:nexus_ai", config_tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Check if tenant exists
    tenant = db.query(Tenant).filter(Tenant.tenant_id == config_tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant with ID {config_tenant_id} not found"
        )
    
    # Get the configuration from the database
    config = get_config_read_only(db, config_tenant_id)
    
    # If no config exists, return default empty values
    if not config:
        return {
            "api_key": None,
            "endpoint": None,
            "api_version": "2023-05-15",
            "deployment_name": None,
            "model": "gpt-4"
        }
    
    # Return the configuration (mask the API key)
    return {
        "api_key": "********" if config.api_key else None,
        "endpoint": config.endpoint,
        "api_version": config.api_version,
        "deployment_name": config.deployment_name,
        "model": config.model
    }


@router.post("/config", response_model=ConfigResponse)
async def update_config(
    request: ConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: Optional[str] = Query(None, description="Tenant ID for configuration"),
) -> Any:
    """
    Update Azure OpenAI configuration
    """
    # Use the provided tenant_id if it exists, otherwise use the current user's tenant
    config_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
    
    # Check if user has permission to manage nexus AI (changed from manage:settings)
    if not has_permission_in_tenant(current_user, "manage:nexus_ai", config_tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Check if tenant exists
    tenant = db.query(Tenant).filter(Tenant.tenant_id == config_tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant with ID {config_tenant_id} not found"
        )
    
    # Get the configuration from the database
    config = get_or_create_config(db, config_tenant_id)
    
    # Update the configuration
    if request.api_key is not None:
        config.api_key = request.api_key
        add_log("API key updated", tenant_id=config_tenant_id)
    
    if request.endpoint is not None:
        config.endpoint = request.endpoint
        add_log("Endpoint updated", tenant_id=config_tenant_id)
    
    if request.api_version is not None:
        config.api_version = request.api_version
        add_log("API version updated", tenant_id=config_tenant_id)
    
    if request.deployment_name is not None:
        config.deployment_name = request.deployment_name
        add_log("Deployment name updated", tenant_id=config_tenant_id)
    
    if request.model is not None:
        config.model = request.model
        add_log("Model updated", tenant_id=config_tenant_id)
    
    # Save the changes to the database
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    
    # Return the updated configuration (mask the API key)
    return {
        "api_key": "********" if config.api_key else None,
        "endpoint": config.endpoint,
        "api_version": config.api_version,
        "deployment_name": config.deployment_name,
        "model": config.model
    }


@router.get("/status", response_model=StatusResponse)
async def get_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: Optional[str] = Query(None, description="Tenant ID for configuration")
) -> Any:
    """
    Get Azure OpenAI connection status
    """
    # Get the configuration from the database

    # Use the provided tenant_id if it exists, otherwise use the current user's tenant
    config_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
    
    # Check if tenant exists
    tenant = db.query(Tenant).filter(Tenant.tenant_id == config_tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant with ID {config_tenant_id} not found"
        )
    config = get_config_read_only(db, config_tenant_id)
    
    # Check if Azure OpenAI is configured
    if not config or not config.api_key or not config.endpoint or not config.deployment_name:
        return {
            "status": "not_configured",
            "last_checked": datetime.now().isoformat(),
            "error": "Azure OpenAI is not configured"
        }
    
    # If the status is already "connected" and was checked recently, return the cached status
    if (config.last_status == "connected" and 
        config.last_checked and 
        (datetime.utcnow() - config.last_checked).total_seconds() < 60):
        return {
            "status": config.last_status,
            "last_checked": config.last_checked.isoformat() if config.last_checked else None,
            "error": config.last_error
        }
    
    # Otherwise, check the connection by making a simple request to the chat endpoint
    try:
        add_log("Checking connection to Azure OpenAI", tenant_id=config_tenant_id)
        
        # Prepare the request to Azure OpenAI
        azure_url = f"{config.endpoint}/openai/deployments/{config.deployment_name}/chat/completions?api-version={config.api_version}"
        
        headers = {
            "Content-Type": "application/json",
            "api-key": config.api_key
        }
        
        # Send a minimal request to check if the deployment exists and is accessible
        payload = {
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 5,
            "temperature": 1.0,
            "n": 1
        }
        
        # Send the request to Azure OpenAI
        response = requests.post(azure_url, headers=headers, json=payload)
        
        # Check if the request was successful
        if response.status_code != 200:
            add_log(f"Error checking connection: {response.status_code} {response.text}", "error", tenant_id=config_tenant_id)
            config.last_status = "error"
            config.last_checked = datetime.utcnow()
            config.last_error = f"Error: {response.status_code} {response.text}"
        else:
            add_log("Connection successful", tenant_id=config_tenant_id)
            config.last_status = "connected"
            config.last_checked = datetime.utcnow()
            config.last_error = None
        
        # Save the changes to the database
        db.commit()
    
    except Exception as e:
        add_log(f"Error checking connection: {str(e)}", "error", tenant_id=config_tenant_id)
        config.last_status = "error"
        config.last_checked = datetime.utcnow()
        config.last_error = str(e)
        db.commit()
    
    return {
        "status": config.last_status,
        "last_checked": config.last_checked.isoformat() if config.last_checked else None,
        "error": config.last_error
    }


@router.get("/logs", response_model=LogsResponse)
async def get_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: Optional[str] = Query(None, description="Tenant ID for configuration")
) -> Any:
    """
    Get debug logs
    """
    # Use the provided tenant_id if it exists, otherwise use the current user's tenant
    config_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
    
    # Check if user has permission to manage nexus AI (changed from manage:settings)
    if not has_permission_in_tenant(current_user, "manage:nexus_ai", config_tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    config_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
    
    # Check if tenant exists
    tenant = db.query(Tenant).filter(Tenant.tenant_id == config_tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant with ID {config_tenant_id} not found"
        )

    # Get logs from the database
    logs = db.query(AIAssistantLog).filter(AIAssistantLog.tenant_id == config_tenant_id).order_by(AIAssistantLog.timestamp.desc()).limit(100).all()
    
    # Convert to response format
    log_entries = [
        {
            "timestamp": log.timestamp.isoformat(),
            "level": log.level,
            "message": log.message
        }
        for log in logs
    ]
    
    # Return the logs
    return {
        "logs": log_entries
    }
