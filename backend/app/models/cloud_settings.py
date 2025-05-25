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
    name = Column(String, nullable=True)  # Friendly name for the credentials
    
    # Connection details as JSON
    connection_details = Column(JSON, nullable=True)  # Contains client_id, client_secret, tenant_id, etc.
    
    # Status and metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))
    tenant = relationship("Tenant", back_populates="cloud_settings")
    
    # Relationship with CloudAccount
    cloud_accounts = relationship("CloudAccount", back_populates="cloud_settings")

    def __init__(self, **kwargs):
        # Handle backward compatibility for organization_tenant_id
        if 'organization_tenant_id' in kwargs and 'tenant_id' not in kwargs:
            kwargs['tenant_id'] = kwargs.pop('organization_tenant_id')
        
        # Explicitly handle connection_details to ensure it's properly set
        self.connection_details = kwargs.pop('connection_details', None)
        super(CloudSettings, self).__init__(**kwargs)

# Add relationship to Tenant model
from app.models.user import Tenant
Tenant.cloud_settings = relationship("CloudSettings", back_populates="tenant")
