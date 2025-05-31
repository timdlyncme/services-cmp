from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# Widget Type Schemas
class WidgetTypeBase(BaseModel):
    type_name: str
    display_name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    default_config: Optional[Dict[str, Any]] = None
    data_sources: Optional[List[str]] = None


class WidgetTypeCreate(WidgetTypeBase):
    pass


class WidgetTypeResponse(WidgetTypeBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Dashboard Widget Schemas
class DashboardWidgetBase(BaseModel):
    title: str
    widget_type: str
    data_source: str
    configuration: Optional[Dict[str, Any]] = None
    position_x: int = 0
    position_y: int = 0
    width: int = 1
    height: int = 1
    refresh_interval: int = 300


class DashboardWidgetCreate(DashboardWidgetBase):
    pass


class DashboardWidgetUpdate(BaseModel):
    title: Optional[str] = None
    widget_type: Optional[str] = None
    data_source: Optional[str] = None
    configuration: Optional[Dict[str, Any]] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    refresh_interval: Optional[int] = None
    is_active: Optional[bool] = None


class DashboardWidgetResponse(DashboardWidgetBase):
    id: int
    widget_id: str
    dashboard_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Dashboard Schemas
class DashboardBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False
    layout_config: Optional[Dict[str, Any]] = None


class DashboardCreate(DashboardBase):
    pass


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    layout_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class DashboardResponse(DashboardBase):
    id: int
    dashboard_id: str
    created_by_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    widgets: List[DashboardWidgetResponse] = []

    class Config:
        from_attributes = True


class DashboardListResponse(BaseModel):
    id: int
    dashboard_id: str
    name: str
    description: Optional[str] = None
    is_default: bool
    is_active: bool
    widget_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Widget Data Schemas
class WidgetDataRequest(BaseModel):
    widget_type: str
    data_source: str
    configuration: Optional[Dict[str, Any]] = None


class WidgetDataResponse(BaseModel):
    data: Dict[str, Any]
    last_updated: datetime
    next_refresh: Optional[datetime] = None

