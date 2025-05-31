from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base, generate_uuid


class Dashboard(Base):
    __tablename__ = "dashboards"
    
    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    layout_config = Column(JSON, nullable=True)  # Store grid layout configuration
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign Keys
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"), nullable=False)
    created_by_id = Column(UUID(as_uuid=False), ForeignKey("users.user_id"), nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="dashboards")
    created_by = relationship("User", back_populates="dashboards")
    widgets = relationship("DashboardWidget", back_populates="dashboard", cascade="all, delete-orphan")


class DashboardWidget(Base):
    __tablename__ = "dashboard_widgets"
    
    id = Column(Integer, primary_key=True, index=True)
    widget_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    title = Column(String, nullable=False)
    widget_type = Column(String, nullable=False)  # 'metric', 'chart', 'table', 'list', etc.
    data_source = Column(String, nullable=False)  # 'deployments', 'cloud_accounts', 'templates', etc.
    configuration = Column(JSON, nullable=True)  # Widget-specific configuration
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    width = Column(Integer, default=1)
    height = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    refresh_interval = Column(Integer, default=300)  # Refresh interval in seconds (default 5 minutes)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign Keys
    dashboard_id = Column(UUID(as_uuid=False), ForeignKey("dashboards.dashboard_id"), nullable=False)
    
    # Relationships
    dashboard = relationship("Dashboard", back_populates="widgets")


class WidgetType(Base):
    __tablename__ = "widget_types"
    
    id = Column(Integer, primary_key=True, index=True)
    type_name = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=True)  # Icon name or path
    category = Column(String, nullable=True)  # 'metrics', 'charts', 'data', etc.
    default_config = Column(JSON, nullable=True)  # Default configuration for this widget type
    data_sources = Column(JSON, nullable=True)  # Available data sources for this widget type
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

