from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base, generate_uuid

class ServiceAccount(Base):
    __tablename__ = "service_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    service_account_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    scope = Column(String, default="system")  # system, tenant, etc.
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))
    tenant = relationship("Tenant", back_populates="service_accounts")
    
    role_id = Column(Integer, ForeignKey("roles.id"))
    role = relationship("Role", back_populates="service_accounts")

# Add relationship to Tenant model
from app.models.tenant import Tenant
Tenant.service_accounts = relationship("ServiceAccount", back_populates="tenant")

# Add relationship to Role model
from app.models.role import Role
Role.service_accounts = relationship("ServiceAccount", back_populates="role")

