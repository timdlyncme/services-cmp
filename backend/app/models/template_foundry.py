from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base, generate_uuid


class TemplateFoundry(Base):
    __tablename__ = "template_foundry"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String)
    description = Column(String, nullable=True)
    type = Column(String)  # terraform, arm, cloudformation, etc.
    provider = Column(String)  # azure, aws, gcp, etc.
    code = Column(Text)  # The actual template code
    version = Column(String)
    categories = Column(JSON, default=[])
    is_published = Column(Boolean, default=False)
    author = Column(String)
    commit_id = Column(UUID(as_uuid=False), nullable=True, default=generate_uuid)  # For version control
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))  # Changed to UUID type
    tenant = relationship("Tenant", back_populates="template_foundry_items")
    
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_by = relationship("User", back_populates="template_foundry_items")
    
    # Relationship with versions
    versions = relationship("TemplateFoundryVersion", back_populates="template", cascade="all, delete-orphan")
