from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base


class TemplateFoundryVersion(Base):
    __tablename__ = "template_foundry_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String)
    changes = Column(String, nullable=True)
    code = Column(Text)  # The actual template code
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    template_id = Column(Integer, ForeignKey("template_foundry.id"))
    template = relationship("TemplateFoundry", back_populates="versions")
    
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User")

