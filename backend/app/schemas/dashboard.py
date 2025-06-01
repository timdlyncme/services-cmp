from typing import Any, List, Optional, Dict
from pydantic import BaseModel, Field
from datetime import datetime


# Dashboard Schemas
class DashboardBase(BaseModel):
    name: str = Field(..., description="Dashboard name")
    description: Optional[str] = Field(None, description="Dashboard description")
    is_default: bool = Field(False, description="Whether this is the user's default dashboard")
    layout_config: Optional[Dict[str, Any]] = Field(None, description="Grid layout configuration")


class DashboardCreate(DashboardBase):
    pass


class DashboardUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Dashboard name")
    description: Optional[str] = Field(None, description="Dashboard description")
    is_default: Optional[bool] = Field(None, description="Whether this is the user's default dashboard")
    layout_config: Optional[Dict[str, Any]] = Field(None, description="Grid layout configuration")


class DashboardResponse(DashboardBase):
    dashboard_id: str
    is_active: bool
    date_created: datetime
    date_modified: datetime
    user_id: str
    
    class Config:
        from_attributes = True


# Dashboard Widget Template Schemas
class DashboardWidgetBase(BaseModel):
    name: str = Field(..., description="Widget template name")
    description: Optional[str] = Field(None, description="Widget description")
    widget_type: str = Field(..., description="Widget type: platform_stats, visual, text, status")
    category: str = Field(..., description="Widget category: statistics, charts, monitoring, information")
    default_config: Optional[Dict[str, Any]] = Field(None, description="Default widget configuration")
    data_source: Optional[str] = Field(None, description="API endpoint or data source identifier")
    min_width: int = Field(1, description="Minimum grid width")
    min_height: int = Field(1, description="Minimum grid height")
    max_width: Optional[int] = Field(None, description="Maximum grid width")
    max_height: Optional[int] = Field(None, description="Maximum grid height")


class DashboardWidgetCreate(DashboardWidgetBase):
    pass


class DashboardWidgetUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Widget template name")
    description: Optional[str] = Field(None, description="Widget description")
    widget_type: Optional[str] = Field(None, description="Widget type")
    category: Optional[str] = Field(None, description="Widget category")
    default_config: Optional[Dict[str, Any]] = Field(None, description="Default widget configuration")
    data_source: Optional[str] = Field(None, description="API endpoint or data source identifier")
    min_width: Optional[int] = Field(None, description="Minimum grid width")
    min_height: Optional[int] = Field(None, description="Minimum grid height")
    max_width: Optional[int] = Field(None, description="Maximum grid width")
    max_height: Optional[int] = Field(None, description="Maximum grid height")
    is_active: Optional[bool] = Field(None, description="Whether the widget template is active")


class DashboardWidgetResponse(DashboardWidgetBase):
    widget_id: str
    is_active: bool
    date_created: datetime
    date_modified: datetime
    
    class Config:
        from_attributes = True


# User Widget Instance Schemas
class UserWidgetBase(BaseModel):
    custom_name: Optional[str] = Field(None, description="User's custom name for the widget")
    position_x: int = Field(0, description="Grid position X")
    position_y: int = Field(0, description="Grid position Y")
    width: int = Field(1, description="Grid width")
    height: int = Field(1, description="Grid height")
    custom_config: Optional[Dict[str, Any]] = Field(None, description="User's custom widget configuration")
    is_visible: bool = Field(True, description="Whether the widget is visible")


class UserWidgetCreate(UserWidgetBase):
    dashboard_id: str = Field(..., description="Dashboard ID")
    widget_id: str = Field(..., description="Widget template ID")


class UserWidgetUpdate(BaseModel):
    custom_name: Optional[str] = Field(None, description="User's custom name for the widget")
    position_x: Optional[int] = Field(None, description="Grid position X")
    position_y: Optional[int] = Field(None, description="Grid position Y")
    width: Optional[int] = Field(None, description="Grid width")
    height: Optional[int] = Field(None, description="Grid height")
    custom_config: Optional[Dict[str, Any]] = Field(None, description="User's custom widget configuration")
    is_visible: Optional[bool] = Field(None, description="Whether the widget is visible")


class UserWidgetResponse(UserWidgetBase):
    user_widget_id: str
    dashboard_id: str
    widget_id: str
    date_created: datetime
    date_modified: datetime
    
    # Include widget template information
    widget_template: DashboardWidgetResponse
    
    class Config:
        from_attributes = True


# Dashboard with Widgets Response
class DashboardWithWidgetsResponse(DashboardResponse):
    user_widgets: List[UserWidgetResponse] = []
    
    class Config:
        from_attributes = True


# Widget Data Schemas (for actual widget content)
class WidgetDataRequest(BaseModel):
    widget_type: str = Field(..., description="Widget type")
    data_source: str = Field(..., description="Data source identifier")
    config: Optional[Dict[str, Any]] = Field(None, description="Widget configuration")
    tenant_id: Optional[str] = Field(None, description="Tenant ID for data filtering")


class WidgetDataResponse(BaseModel):
    widget_type: str
    data: Dict[str, Any]
    last_updated: datetime
    
    class Config:
        from_attributes = True


# Bulk Operations
class BulkUserWidgetUpdate(BaseModel):
    widgets: List[Dict[str, Any]] = Field(..., description="List of widget updates with user_widget_id and update data")


class DashboardLayoutUpdate(BaseModel):
    layout_config: Dict[str, Any] = Field(..., description="Complete layout configuration")
    widgets: List[Dict[str, Any]] = Field(..., description="Widget positions and configurations")


# Dashboard Statistics
class DashboardStatsResponse(BaseModel):
    total_dashboards: int
    total_widgets: int
    active_widgets: int
    widget_types: Dict[str, int]
    categories: Dict[str, int]
    
    class Config:
        from_attributes = True

