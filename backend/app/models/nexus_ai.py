from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base

class NexusAIConfig(Base):
    __tablename__ = "nexus_ai_config"
    
    id = Column(Integer, primary_key=True, index=True)
    api_key = Column(String, nullable=True)
    endpoint = Column(String, nullable=True)
    deployment_name = Column(String, nullable=True)
    api_version = Column(String, default="2023-05-15")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Store the last connection status
    last_status = Column(String, default="disconnected")
    last_checked = Column(DateTime, nullable=True)
    last_error = Column(String, nullable=True)

class NexusAILog(Base):
    __tablename__ = "nexus_ai_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    level = Column(String, default="info")
    message = Column(String)
    details = Column(JSON, nullable=True)

