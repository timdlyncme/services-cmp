from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import datetime

from app.models.base_models import Base


class UserTenantAssignment(Base):
    """
    Junction table for many-to-many relationship between Users and Tenants.
    Allows users to be assigned to multiple tenants with different roles.
    
    SSO_FUTURE: This table will also track SSO-provisioned users and their
    Azure AD group mappings for automated role assignment.
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
    
    # SSO_FUTURE: Provisioning tracking for automated user management
    # These fields will track how users were assigned to tenants (manual vs SSO)
    provisioned_via = Column(String, default="manual", nullable=False)  # "manual", "sso_auto", "sso_jit"
    
    # SSO_FUTURE: Azure AD group mapping for role inheritance
    # When SSO is implemented, users can be assigned to tenants based on Azure AD group membership
    external_group_id = Column(String, nullable=True, index=True)  # Azure AD Group Object ID
    external_role_mapping = Column(String, nullable=True)  # Azure AD role claim or group name
    
    # SSO_FUTURE: Sync tracking for automated provisioning
    # These timestamps help track when SSO users were last synchronized
    auto_provisioned_at = Column(DateTime, nullable=True)  # When user was auto-assigned via SSO
    last_sso_sync = Column(DateTime, nullable=True)  # Last time SSO sync updated this assignment
    
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
    
    # SSO_FUTURE: Methods for SSO provisioning management
    def is_sso_provisioned(self) -> bool:
        """Check if this assignment was created via SSO"""
        return self.provisioned_via in ["sso_auto", "sso_jit"]
    
    def can_be_auto_updated(self) -> bool:
        """Check if this assignment can be automatically updated by SSO sync"""
        return self.is_sso_provisioned() and self.external_group_id is not None
