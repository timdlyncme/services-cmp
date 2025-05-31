from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.models.base_models import Base, generate_uuid


class Dashboard(Base):
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_default = Column(Boolean, default=False)
    layout_config = Column(JSON, nullable=True)  # Store grid layout configuration
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships - Dashboard is linked to users, NOT tenant-specific
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="dashboards")
    
    # Relationship with UserWidget
    user_widgets = relationship("UserWidget", back_populates="dashboard", cascade="all, delete-orphan")


class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    widget_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    widget_type = Column(String, nullable=False)  # text, chart, graph, card, etc.
    category = Column(String, nullable=False)  # cloud_accounts, deployments, templates, etc.
    default_config = Column(JSON, nullable=True)  # Default widget configuration
    data_source = Column(String, nullable=False)  # API endpoint or data source identifier
    refresh_interval = Column(Integer, default=300)  # Refresh interval in seconds (default 5 minutes)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with UserWidget
    user_widgets = relationship("UserWidget", back_populates="dashboard_widget")


class UserWidget(Base):
    __tablename__ = "user_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_widget_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    width = Column(Integer, default=4)  # Grid width (1-12)
    height = Column(Integer, default=4)  # Grid height
    custom_title = Column(String, nullable=True)  # User can rename the widget
    custom_config = Column(JSON, nullable=True)  # User customizations (colors, filters, chart type, etc.)
    is_visible = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    dashboard = relationship("Dashboard", back_populates="user_widgets")
    
    dashboard_widget_id = Column(Integer, ForeignKey("dashboard_widgets.id"), nullable=False)
    dashboard_widget = relationship("DashboardWidget", back_populates="user_widgets")


# Add relationship to User model
from app.models.user import User
User.dashboards = relationship("Dashboard", back_populates="user")

