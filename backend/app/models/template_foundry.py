from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Table, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base


class TemplateFoundry(Base):
    __tablename__ = "template_foundry"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(String, nullable=True)
    type = Column(String)  # terraform, arm, cloudformation
    provider = Column(String)  # azure, aws, gcp
    code = Column(String)
    version = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_published = Column(Boolean, default=False)
    categories = Column(JSON, nullable=True)
    author = Column(String, nullable=True)
    commit_id = Column(String, nullable=True)
    
    # Relationships
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    tenant = relationship("Tenant", back_populates="template_foundry")
    
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_by = relationship("User", foreign_keys=[created_by_id])
    
    # Add relationship to Tenant model
    from app.models.user import Tenant
    Tenant.template_foundry = relationship("TemplateFoundry", back_populates="tenant")

