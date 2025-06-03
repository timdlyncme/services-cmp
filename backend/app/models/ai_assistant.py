"""
AI Assistant models.

This module contains the database models for AI Assistant.
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.session import Base


class AIAssistantConfig(Base):
    """
    AI Assistant configuration model.
    
    This model stores the configuration for Azure OpenAI integration,
    including API keys, endpoints, and deployment names.
    """
    __tablename__ = "ai_assistant_config"
    
    id = Column(Integer, primary_key=True, index=True)
    api_key = Column(String, nullable=True)
    endpoint = Column(String, nullable=True)
    deployment_name = Column(String, nullable=True)
    model = Column(String, default="gpt-4")
    api_version = Column(String, default="2023-05-15")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_status = Column(String, default="disconnected")
    last_checked = Column(DateTime, nullable=True)
    last_error = Column(String, nullable=True)
    
    # Tenant relationship
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))
    tenant = relationship("Tenant", back_populates="ai_assistant_configs")


class AIAssistantLog(Base):
    """
    AI Assistant log model.
    
    This model stores logs for AI Assistant operations.
    """
    __tablename__ = "ai_assistant_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    level = Column(String, default="info")
    message = Column(String)
    details = Column(JSON, nullable=True)
    
    # Tenant relationship
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))
    tenant = relationship("Tenant", back_populates="ai_assistant_logs")

