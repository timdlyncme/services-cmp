from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, UUID4
import uuid

from app.db.session import get_db
from app.models.dashboard import Dashboard, DashboardWidget, UserWidget
from app.models.user import User
from app.api.deps import get_current_user


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
    
    class Config:
        from_attributes = True


class WidgetCatalogResponse(BaseModel):
    id: int
    widget_id: str
    name: str
    description: Optional[str]
    widget_type: str
    category: str
    default_config: Optional[dict]
    data_source: str
    chart_type: Optional[str]
    min_width: int
    min_height: int
    default_width: int
    default_height: int
    
    class Config:
        from_attributes = True


class UserWidgetCreate(BaseModel):
    widget_id: str
    custom_name: Optional[str] = None
    position_x: int = 0
    position_y: int = 0
    width: int = 2
    height: int = 2
    custom_config: Optional[dict] = None


class UserWidgetUpdate(BaseModel):
    custom_name: Optional[str] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    custom_config: Optional[dict] = None
    is_visible: Optional[bool] = None


class UserWidgetResponse(BaseModel):
    id: int
    user_widget_id: str
    custom_name: Optional[str]
    position_x: int
    position_y: int
    width: int
    height: int
    custom_config: Optional[dict]
    is_visible: bool
    dashboard_widget: WidgetCatalogResponse
    
    class Config:
        from_attributes = True


class DashboardWithWidgetsResponse(BaseModel):
    dashboard: DashboardResponse
    widgets: List[UserWidgetResponse]
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[DashboardResponse])
async def get_user_dashboards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all dashboards for the current user"""
    dashboards = db.query(Dashboard).filter(
        Dashboard.user_id == current_user.user_id
    ).order_by(Dashboard.is_default.desc(), Dashboard.created_at.asc()).all()
    
    return dashboards


@router.post("/", response_model=DashboardResponse)
async def create_dashboard(
    dashboard_data: DashboardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new dashboard for the current user"""
    
    # If this is set as default, unset other defaults
    if dashboard_data.is_default:
        db.query(Dashboard).filter(
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_default == True
        ).update({"is_default": False})
    
    dashboard = Dashboard(
        dashboard_id=str(uuid.uuid4()),
        name=dashboard_data.name,
        description=dashboard_data.description,
        is_default=dashboard_data.is_default,
        user_id=current_user.user_id
    )
    
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    
    return dashboard


@router.get("/{dashboard_id}", response_model=DashboardWithWidgetsResponse)
async def get_dashboard_with_widgets(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific dashboard with its widgets"""
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Get user widgets for this dashboard
    user_widgets = db.query(UserWidget).filter(
        UserWidget.dashboard_id == dashboard_id,
        UserWidget.is_visible == True
    ).all()
    
    return DashboardWithWidgetsResponse(
        dashboard=dashboard,
        widgets=user_widgets
    )


@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: str,
    dashboard_data: DashboardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a dashboard"""
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # If setting as default, unset other defaults
    if dashboard_data.is_default:
        db.query(Dashboard).filter(
            Dashboard.user_id == current_user.user_id,
            Dashboard.dashboard_id != dashboard_id,
            Dashboard.is_default == True
        ).update({"is_default": False})
    
    # Update dashboard fields
    update_data = dashboard_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dashboard, field, value)
    
    db.commit()
    db.refresh(dashboard)
    
    return dashboard


@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a dashboard"""
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    db.delete(dashboard)
    db.commit()
    
    return {"message": "Dashboard deleted successfully"}


@router.get("/widgets/catalog", response_model=List[WidgetCatalogResponse])
async def get_widget_catalog(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get available widgets from the catalog"""
    query = db.query(DashboardWidget).filter(DashboardWidget.is_active == True)
    
    if category:
        query = query.filter(DashboardWidget.category == category)
    
    widgets = query.order_by(DashboardWidget.category, DashboardWidget.name).all()
    return widgets


@router.post("/{dashboard_id}/widgets", response_model=UserWidgetResponse)
async def add_widget_to_dashboard(
    dashboard_id: str,
    widget_data: UserWidgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a widget to a dashboard"""
    # Verify dashboard ownership
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Verify widget exists
    widget = db.query(DashboardWidget).filter(
        DashboardWidget.widget_id == widget_data.widget_id,
        DashboardWidget.is_active == True
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Create user widget
    user_widget = UserWidget(
        user_widget_id=str(uuid.uuid4()),
        dashboard_id=dashboard_id,
        widget_id=widget_data.widget_id,
        custom_name=widget_data.custom_name,
        position_x=widget_data.position_x,
        position_y=widget_data.position_y,
        width=widget_data.width,
        height=widget_data.height,
        custom_config=widget_data.custom_config
    )
    
    db.add(user_widget)
    db.commit()
    db.refresh(user_widget)
    
    return user_widget


@router.put("/{dashboard_id}/widgets/{user_widget_id}", response_model=UserWidgetResponse)
async def update_dashboard_widget(
    dashboard_id: str,
    user_widget_id: str,
    widget_data: UserWidgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a widget on a dashboard"""
    # Verify dashboard ownership and widget exists
    user_widget = db.query(UserWidget).join(Dashboard).filter(
        UserWidget.user_widget_id == user_widget_id,
        UserWidget.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.user_id
    ).first()
    
    if not user_widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Update widget fields
    update_data = widget_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user_widget, field, value)
    
    db.commit()
    db.refresh(user_widget)
    
    return user_widget


@router.delete("/{dashboard_id}/widgets/{user_widget_id}")
async def remove_widget_from_dashboard(
    dashboard_id: str,
    user_widget_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a widget from a dashboard"""
    # Verify dashboard ownership and widget exists
    user_widget = db.query(UserWidget).join(Dashboard).filter(
        UserWidget.user_widget_id == user_widget_id,
        UserWidget.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.user_id
    ).first()
    
    if not user_widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    db.delete(user_widget)
    db.commit()
    
    return {"message": "Widget removed successfully"}


@router.post("/{dashboard_id}/widgets/bulk-update")
async def bulk_update_widget_positions(
    dashboard_id: str,
    widgets: List[dict],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk update widget positions (for drag and drop)"""
    # Verify dashboard ownership
    dashboard = db.query(Dashboard).filter(
        Dashboard.dashboard_id == dashboard_id,
        Dashboard.user_id == current_user.user_id
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Update widget positions
    for widget_update in widgets:
        user_widget = db.query(UserWidget).filter(
            UserWidget.user_widget_id == widget_update["user_widget_id"],
            UserWidget.dashboard_id == dashboard_id
        ).first()
        
        if user_widget:
            user_widget.position_x = widget_update.get("position_x", user_widget.position_x)
            user_widget.position_y = widget_update.get("position_y", user_widget.position_y)
            user_widget.width = widget_update.get("width", user_widget.width)
            user_widget.height = widget_update.get("height", user_widget.height)
    
    db.commit()
    
    return {"message": "Widget positions updated successfully"}

