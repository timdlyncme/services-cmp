from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import datetime

from app.models.base_models import Base, generate_uuid


class Dashboard(Base):
    """
    User-specific dashboard configurations.
    Each user can have multiple dashboards that persist across tenant switching.
    """
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_default = Column(Boolean, default=False)
    layout_config = Column(JSON, nullable=True)  # Stores grid layout configuration
    is_active = Column(Boolean, default=True)
    date_created = Column(DateTime, default=datetime.datetime.utcnow)
    date_modified = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Foreign Keys
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.user_id"), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="dashboards")
    user_widgets = relationship("UserWidget", back_populates="dashboard", cascade="all, delete-orphan")


class DashboardWidget(Base):
    """
    Catalog of available widget templates and configurations.
    These are the predefined widget types that users can add to their dashboards.
    """
    __tablename__ = "dashboard_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    widget_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    widget_type = Column(String, nullable=False)  # 'platform_stats', 'visual', 'text', 'status'
    category = Column(String, nullable=False)  # 'statistics', 'charts', 'monitoring', 'information'
    default_config = Column(JSON, nullable=True)  # Default widget configuration
    data_source = Column(String, nullable=True)  # API endpoint or data source identifier
    min_width = Column(Integer, default=1)  # Minimum grid width
    min_height = Column(Integer, default=1)  # Minimum grid height
    max_width = Column(Integer, nullable=True)  # Maximum grid width (null = unlimited)
    max_height = Column(Integer, nullable=True)  # Maximum grid height (null = unlimited)
    is_active = Column(Boolean, default=True)
    date_created = Column(DateTime, default=datetime.datetime.utcnow)
    date_modified = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user_widgets = relationship("UserWidget", back_populates="widget_template")


class UserWidget(Base):
    """
    User-specific widget instances with customizations.
    Links a user's dashboard to a widget template with custom configuration.
    """
    __tablename__ = "user_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_widget_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    custom_name = Column(String, nullable=True)  # User's custom name for the widget
    position_x = Column(Integer, default=0)  # Grid position X
    position_y = Column(Integer, default=0)  # Grid position Y
    width = Column(Integer, default=1)  # Grid width
    height = Column(Integer, default=1)  # Grid height
    custom_config = Column(JSON, nullable=True)  # User's custom widget configuration
    is_visible = Column(Boolean, default=True)
    date_created = Column(DateTime, default=datetime.datetime.utcnow)
    date_modified = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Foreign Keys
    dashboard_id = Column(UUID(as_uuid=False), ForeignKey("dashboards.dashboard_id"), nullable=False)
    widget_id = Column(UUID(as_uuid=False), ForeignKey("dashboard_widgets.widget_id"), nullable=False)
    
    # Relationships
    dashboard = relationship("Dashboard", back_populates="user_widgets")
    widget_template = relationship("DashboardWidget", back_populates="user_widgets")

