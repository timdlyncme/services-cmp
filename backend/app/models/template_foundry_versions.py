from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base, generate_uuid


class TemplateFoundryVersion(Base):
    __tablename__ = "template_foundry_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    version = Column(String)
    changes = Column(String, nullable=True)
    code = Column(Text)  # The actual template code
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    template_id = Column(Integer, ForeignKey("template_foundry.id"))
    template = relationship("TemplateFoundry", back_populates="versions")
    
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User")
