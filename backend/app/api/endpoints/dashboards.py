from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, UUID4

from app.db.session import get_db
from app.models.dashboard import Dashboard, DashboardWidget, UserWidget
from app.models.user import User
from app.api.deps import get_current_user


router = APIRouter()


# Pydantic models for request/response
class DashboardWidgetResponse(BaseModel):
    id: int
    widget_id: str
    name: str
    description: Optional[str]
    widget_type: str
    category: str
    default_config: Optional[dict]
    data_source: str
    refresh_interval: int
    is_active: bool

    class Config:
        from_attributes = True


class UserWidgetCreate(BaseModel):
    dashboard_widget_id: int
    position_x: int = 0
    position_y: int = 0
    width: int = 4
    height: int = 4
    custom_title: Optional[str] = None
    custom_config: Optional[dict] = None
    is_visible: bool = True


class UserWidgetUpdate(BaseModel):
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    custom_title: Optional[str] = None
    custom_config: Optional[dict] = None
    is_visible: Optional[bool] = None


class UserWidgetResponse(BaseModel):
    id: int
    user_widget_id: str
    position_x: int
    position_y: int
    width: int
    height: int
    custom_title: Optional[str]
    custom_config: Optional[dict]
    is_visible: bool
    dashboard_widget: DashboardWidgetResponse

    class Config:
        from_attributes = True


class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False
    layout_config: Optional[dict] = None


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    layout_config: Optional[dict] = None


class DashboardResponse(BaseModel):
    id: int
    dashboard_id: str
    name: str
    description: Optional[str]
    is_default: bool
    layout_config: Optional[dict]
    user_widgets: List[UserWidgetResponse]

    class Config:
        from_attributes = True


@router.get("/available-widgets", response_model=List[DashboardWidgetResponse])
def get_available_widgets(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all available dashboard widgets, optionally filtered by category"""
    query = db.query(DashboardWidget).filter(DashboardWidget.is_active == True)
    
    if category:
        query = query.filter(DashboardWidget.category == category)
    
    widgets = query.all()
    return widgets


@router.get("/", response_model=List[DashboardResponse])
def get_user_dashboards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all dashboards for the current user"""
    dashboards = db.query(Dashboard).filter(
        Dashboard.user_id == current_user.id
    ).all()
    
    return dashboards


@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(
    dashboard_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific dashboard by ID"""
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    return dashboard


@router.post("/", response_model=DashboardResponse)
def create_dashboard(
    dashboard_data: DashboardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new dashboard for the current user"""
    # If this is set as default, unset other default dashboards
    if dashboard_data.is_default:
        db.query(Dashboard).filter(
            Dashboard.user_id == current_user.id,
            Dashboard.is_default == True
        ).update({"is_default": False})
    
    dashboard = Dashboard(
        name=dashboard_data.name,
        description=dashboard_data.description,
        is_default=dashboard_data.is_default,
        layout_config=dashboard_data.layout_config,
        user_id=current_user.id
    )
    
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    
    return dashboard


@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(
    dashboard_id: str,
    dashboard_data: DashboardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a dashboard"""
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # If setting as default, unset other default dashboards
    if dashboard_data.is_default:
        db.query(Dashboard).filter(
            Dashboard.user_id == current_user.id,
            Dashboard.is_default == True,
            Dashboard.id != dashboard.id
        ).update({"is_default": False})
    
    # Update fields
    for field, value in dashboard_data.dict(exclude_unset=True).items():
        setattr(dashboard, field, value)
    
    db.commit()
    db.refresh(dashboard)
    
    return dashboard


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a dashboard"""
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    db.delete(dashboard)
    db.commit()
    
    return {"message": "Dashboard deleted successfully"}


@router.post("/{dashboard_id}/widgets", response_model=UserWidgetResponse)
def add_widget_to_dashboard(
    dashboard_id: str,
    widget_data: UserWidgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a widget to a dashboard"""
    # Verify dashboard exists and belongs to user
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Verify widget exists
    dashboard_widget = db.query(DashboardWidget).filter(
        DashboardWidget.id == widget_data.dashboard_widget_id,
        DashboardWidget.is_active == True
    ).first()
    
    if not dashboard_widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard widget not found"
        )
    
    user_widget = UserWidget(
        dashboard_id=dashboard.id,
        dashboard_widget_id=widget_data.dashboard_widget_id,
        position_x=widget_data.position_x,
        position_y=widget_data.position_y,
        width=widget_data.width,
        height=widget_data.height,
        custom_title=widget_data.custom_title,
        custom_config=widget_data.custom_config,
        is_visible=widget_data.is_visible
    )
    
    db.add(user_widget)
    db.commit()
    db.refresh(user_widget)
    
    return user_widget


@router.put("/{dashboard_id}/widgets/{user_widget_id}", response_model=UserWidgetResponse)
def update_dashboard_widget(
    dashboard_id: str,
    user_widget_id: str,
    widget_data: UserWidgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a widget in a dashboard"""
    # Verify dashboard exists and belongs to user
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Find the user widget
    user_widget = db.query(UserWidget).filter(
        UserWidget.user_widget_id == user_widget_id,
        UserWidget.dashboard_id == dashboard.id
    ).first()
    
    if not user_widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found in dashboard"
        )
    
    # Update fields
    for field, value in widget_data.dict(exclude_unset=True).items():
        setattr(user_widget, field, value)
    
    db.commit()
    db.refresh(user_widget)
    
    return user_widget


@router.delete("/{dashboard_id}/widgets/{user_widget_id}")
def remove_widget_from_dashboard(
    dashboard_id: str,
    user_widget_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a widget from a dashboard"""
    # Verify dashboard exists and belongs to user
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Find the user widget
    user_widget = db.query(UserWidget).filter(
        UserWidget.user_widget_id == user_widget_id,
        UserWidget.dashboard_id == dashboard.id
    ).first()
    
    if not user_widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found in dashboard"
        )
    
    db.delete(user_widget)
    db.commit()
    
    return {"message": "Widget removed from dashboard successfully"}


@router.get("/stats/deployments")
def get_deployment_stats(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get deployment statistics for dashboard widgets"""
    # This endpoint would integrate with your existing deployment service
    # For now, return a placeholder structure
    return {
        "total": 0,
        "running": 0,
        "failed": 0,
        "pending": 0,
        "by_provider": {},
        "recent": []
    }


@router.get("/stats/cloud-accounts")
def get_cloud_account_stats(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get cloud account statistics for dashboard widgets"""
    # This endpoint would integrate with your existing cloud account service
    # For now, return a placeholder structure
    return {
        "total": 0,
        "connected": 0,
        "warning": 0,
        "error": 0,
        "by_provider": {}
    }


@router.get("/stats/templates")
def get_template_stats(
    tenant_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get template statistics for dashboard widgets"""
    # This endpoint would integrate with your existing template service
    # For now, return a placeholder structure
    return {
        "total": 0,
        "by_category": {},
        "by_provider": {}
    }

