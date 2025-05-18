from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base


class IntegrationConfig(Base):
    __tablename__ = "integration_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    integration_id = Column(String, unique=True, index=True)
    name = Column(String)
    type = Column(String)  # cloud, ai, other
    provider = Column(String)  # azure, aws, gcp, openai, other
    status = Column(String)  # connected, warning, error, pending
    last_checked = Column(DateTime, default=datetime.utcnow)
    settings = Column(JSON, default={})
    
    # Relationships
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    tenant = relationship("Tenant", back_populates="integration_configs")
