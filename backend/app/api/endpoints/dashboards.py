"""
Dashboard API endpoints.

This module provides API endpoints for managing user dashboards and widgets.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, UUID4

from app.db.session import get_db
from app.models.dashboard import Dashboard, DashboardWidget, UserWidget
from app.models.user import User
from app.api.deps import get_current_user
from app.services.dashboard_service import DashboardService

router = APIRouter()


# Pydantic models for request/response
class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    layout: Optional[dict] = None


class DashboardResponse(BaseModel):
    id: int
    dashboard_id: str
    name: str
    description: Optional[str]
    is_default: bool
    layout: Optional[dict]
    created_at: str
    updated_at: str
    user_widgets: List[dict] = []

    class Config:
        from_attributes = True


class WidgetCatalogResponse(BaseModel):
    id: int
    widget_id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    widget_type: str
    chart_type: Optional[str]
    data_source: str
    default_config: Optional[dict]
    default_size: Optional[dict]
    icon: Optional[str]

    class Config:
        from_attributes = True


class UserWidgetCreate(BaseModel):
    widget_id: int
    dashboard_id: int
    custom_name: Optional[str] = None
    custom_config: Optional[dict] = None
    position: Optional[dict] = None
    color_scheme: Optional[str] = None
    filters: Optional[dict] = None


class UserWidgetUpdate(BaseModel):
    custom_name: Optional[str] = None
    custom_config: Optional[dict] = None
    position: Optional[dict] = None
    color_scheme: Optional[str] = None
    filters: Optional[dict] = None
    is_visible: Optional[bool] = None


class UserWidgetResponse(BaseModel):
    id: int
    user_widget_id: str
    custom_name: Optional[str]
    custom_config: Optional[dict]
    position: Optional[dict]
    color_scheme: Optional[str]
    filters: Optional[dict]
    is_visible: bool
    widget: WidgetCatalogResponse

    class Config:
        from_attributes = True


@router.get("/", response_model=List[DashboardResponse])
async def get_user_dashboards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all dashboards for the current user."""
    service = DashboardService(db)
    return service.get_user_dashboards(current_user.id)


@router.post("/", response_model=DashboardResponse)
async def create_dashboard(
    dashboard_data: DashboardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new dashboard for the current user."""
    service = DashboardService(db)
    return service.create_dashboard(current_user.id, dashboard_data.dict())


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific dashboard by ID."""
    service = DashboardService(db)
    dashboard = service.get_dashboard_by_id(dashboard_id, current_user.id)
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    return dashboard


@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: str,
    dashboard_data: DashboardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a dashboard."""
    service = DashboardService(db)
    dashboard = service.update_dashboard(dashboard_id, current_user.id, dashboard_data.dict(exclude_unset=True))
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    return dashboard


@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a dashboard."""
    service = DashboardService(db)
    success = service.delete_dashboard(dashboard_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    return {"message": "Dashboard deleted successfully"}


@router.get("/widget-catalog", response_model=List[WidgetCatalogResponse])
async def get_widget_catalog(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get available widgets from the catalog."""
    service = DashboardService(db)
    return service.get_widget_catalog(category)


@router.post("/{dashboard_id}/widgets", response_model=UserWidgetResponse)
async def add_widget_to_dashboard(
    dashboard_id: str,
    widget_data: UserWidgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a widget to a dashboard."""
    service = DashboardService(db)
    
    # Verify dashboard belongs to user
    dashboard = service.get_dashboard_by_id(dashboard_id, current_user.id)
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    widget_data_dict = widget_data.dict()
    widget_data_dict['dashboard_id'] = dashboard.id
    
    return service.add_user_widget(current_user.id, widget_data_dict)


@router.put("/user-widgets/{user_widget_id}", response_model=UserWidgetResponse)
async def update_user_widget(
    user_widget_id: str,
    widget_data: UserWidgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a user widget."""
    service = DashboardService(db)
    widget = service.update_user_widget(user_widget_id, current_user.id, widget_data.dict(exclude_unset=True))
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    return widget


@router.delete("/user-widgets/{user_widget_id}")
async def remove_user_widget(
    user_widget_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a widget from a dashboard."""
    service = DashboardService(db)
    success = service.remove_user_widget(user_widget_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    return {"message": "Widget removed successfully"}


@router.post("/{dashboard_id}/layout")
async def update_dashboard_layout(
    dashboard_id: str,
    layout_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the layout of a dashboard."""
    service = DashboardService(db)
    success = service.update_dashboard_layout(dashboard_id, current_user.id, layout_data)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    return {"message": "Layout updated successfully"}


@router.get("/widget-data/{data_source}")
async def get_widget_data(
    data_source: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    filters: Optional[str] = None
):
    """Get data for a specific widget."""
    service = DashboardService(db)
    
    # Parse filters if provided
    filter_dict = {}
    if filters:
        try:
            import json
            filter_dict = json.loads(filters)
        except:
            pass
    
    return service.get_widget_data(data_source, current_user, filter_dict)
