from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base, generate_uuid


class Dashboard(Base):
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_default = Column(Boolean, default=False)
    layout = Column(JSON, nullable=True)  # Store grid layout configuration
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships - Dashboard is linked to users, NOT tenant-specific
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="dashboards")
    
    # Relationship with user widgets
    user_widgets = relationship("UserWidget", back_populates="dashboard", cascade="all, delete-orphan")


class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    widget_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)  # e.g., "cloud", "deployments", "analytics"
    widget_type = Column(String, nullable=False)  # e.g., "card", "chart", "table", "graph"
    chart_type = Column(String, nullable=True)  # e.g., "bar", "line", "pie", "doughnut"
    data_source = Column(String, nullable=False)  # API endpoint or data source identifier
    default_config = Column(JSON, nullable=True)  # Default configuration for the widget
    default_size = Column(JSON, nullable=True)  # Default width and height
    icon = Column(String, nullable=True)  # Icon name for the widget catalog
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with user widgets
    user_widgets = relationship("UserWidget", back_populates="widget")


class UserWidget(Base):
    __tablename__ = "user_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_widget_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    custom_name = Column(String, nullable=True)  # User's custom name for the widget
    custom_config = Column(JSON, nullable=True)  # User's custom configuration
    position = Column(JSON, nullable=True)  # Grid position (x, y, w, h)
    color_scheme = Column(String, nullable=True)  # Custom color scheme
    filters = Column(JSON, nullable=True)  # User-defined filters
    is_visible = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    dashboard = relationship("Dashboard", back_populates="user_widgets")
    
    widget_id = Column(Integer, ForeignKey("dashboard_widgets.id"), nullable=False)
    widget = relationship("DashboardWidget", back_populates="user_widgets")
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="user_widgets")

