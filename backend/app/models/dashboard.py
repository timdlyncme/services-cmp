from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import datetime

from app.models.base_models import Base, generate_uuid


class Dashboard(Base):
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    layout = Column(JSON, nullable=True)  # Stores widget positions and sizes
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Foreign Keys
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.user_id"), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="dashboards")
    user_widgets = relationship("UserWidget", back_populates="dashboard", cascade="all, delete-orphan")


class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    widget_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    widget_type = Column(String, nullable=False)  # 'stat_card', 'chart', 'table', etc.
    category = Column(String, nullable=False)  # 'deployments', 'cloud_accounts', 'analytics', etc.
    default_config = Column(JSON, nullable=True)  # Default configuration for the widget
    data_source = Column(String, nullable=False)  # API endpoint or data source identifier
    chart_type = Column(String, nullable=True)  # 'bar', 'line', 'pie', 'area', etc. (for chart widgets)
    min_width = Column(Integer, default=1)  # Minimum grid width
    min_height = Column(Integer, default=1)  # Minimum grid height
    default_width = Column(Integer, default=2)  # Default grid width
    default_height = Column(Integer, default=2)  # Default grid height
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user_widgets = relationship("UserWidget", back_populates="dashboard_widget")


class UserWidget(Base):
    __tablename__ = "user_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_widget_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    custom_name = Column(String, nullable=True)  # User's custom name for the widget
    position_x = Column(Integer, nullable=False, default=0)
    position_y = Column(Integer, nullable=False, default=0)
    width = Column(Integer, nullable=False, default=2)
    height = Column(Integer, nullable=False, default=2)
    custom_config = Column(JSON, nullable=True)  # User's custom configuration
    is_visible = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Foreign Keys
    dashboard_id = Column(UUID(as_uuid=False), ForeignKey("dashboards.dashboard_id"), nullable=False)
    widget_id = Column(UUID(as_uuid=False), ForeignKey("dashboard_widgets.widget_id"), nullable=False)
    
    # Relationships
    dashboard = relationship("Dashboard", back_populates="user_widgets")
    dashboard_widget = relationship("DashboardWidget", back_populates="user_widgets")

