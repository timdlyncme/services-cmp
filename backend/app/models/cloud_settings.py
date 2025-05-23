from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base, generate_uuid

class CloudSettings(Base):
    __tablename__ = "cloud_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    settings_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    
    # Provider information
    provider = Column(String)  # azure, aws, gcp - we'll only use azure for now
    
    # Azure credentials
    client_id = Column(String, nullable=True)  # Service Principal Client ID
    client_secret = Column(String, nullable=True)  # Service Principal Secret
    tenant_id = Column(String, nullable=True)  # Azure AD Tenant ID
    subscription_id = Column(String, nullable=True)  # Azure Subscription ID
    
    # Status and metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization_tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))
    organization_tenant = relationship("Tenant", back_populates="cloud_settings")

# Add relationship to Tenant model
from app.models.user import Tenant
Tenant.cloud_settings = relationship("CloudSettings", back_populates="organization_tenant")

