from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import datetime

from app.models.base_models import Base


class UserTenantAssignment(Base):
    """
    Junction table for many-to-many relationship between Users and Tenants.
    Allows users to be assigned to multiple tenants with different roles.
    """
    __tablename__ = "user_tenant_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    
    # Assignment metadata
    is_primary = Column(Boolean, default=False, nullable=False)  # Mark user's primary tenant
    is_active = Column(Boolean, default=True, nullable=False)    # Allow deactivating assignments
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="tenant_assignments")
    tenant = relationship("Tenant", back_populates="user_assignments")
    role = relationship("Role")
    
    # Ensure unique user-tenant combinations
    __table_args__ = (
        {"schema": None}  # Use default schema
    )
    
    def __repr__(self):
        return f"<UserTenantAssignment(user_id={self.user_id}, tenant_id={self.tenant_id}, role={self.role.name if self.role else 'None'}, is_primary={self.is_primary})>"
