from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_

from app.db.session import get_db
from app.api.endpoints.auth import get_current_user
from app.models.user import User
from app.models.dashboard import Dashboard, DashboardWidget, UserWidget
from app.schemas.dashboard import (
    DashboardCreate, DashboardUpdate, DashboardResponse, DashboardWithWidgetsResponse,
    DashboardWidgetResponse, UserWidgetCreate, UserWidgetUpdate, UserWidgetResponse,
    BulkUserWidgetUpdate, DashboardLayoutUpdate, WidgetDataRequest, WidgetDataResponse,
    DashboardStatsResponse
)
from app.services.dashboard_service import get_or_create_default_dashboard

router = APIRouter()


# Dashboard CRUD Operations
@router.get("/", response_model=List[DashboardResponse])
def get_user_dashboards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all dashboards for the current user, creating a default one if none exist"""
    dashboards = get_or_create_default_dashboard(db, current_user)
    return dashboards


@router.get("/{dashboard_id}", response_model=DashboardWithWidgetsResponse)
def get_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific dashboard with its widgets"""
    dashboard = db.query(Dashboard).options(
        joinedload(Dashboard.user_widgets).joinedload(UserWidget.widget_template)
    ).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new dashboard for the current user"""
    
    # If this is set as default, unset other defaults
    if dashboard_data.is_default:
        db.query(Dashboard).filter(
            and_(
                Dashboard.user_id == current_user.user_id,
                Dashboard.is_default == True
            )
        ).update({"is_default": False})
    
    dashboard = Dashboard(
        **dashboard_data.dict(),
        user_id=current_user.user_id
    )
    
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    
    return dashboard


@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(
    dashboard_id: str,
    dashboard_data: DashboardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a dashboard"""
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # If setting as default, unset other defaults
    if dashboard_data.is_default:
        db.query(Dashboard).filter(
            and_(
                Dashboard.user_id == current_user.user_id,
                Dashboard.is_default == True,
                Dashboard.dashboard_id != dashboard_id
            )
        ).update({"is_default": False})
    
    # Update dashboard fields
    update_data = dashboard_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dashboard, field, value)
    
    db.commit()
    db.refresh(dashboard)
    
    return dashboard


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a dashboard and all associated user widgets"""
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Hard delete - this will also delete associated user_widgets due to cascade="all, delete-orphan"
    db.delete(dashboard)
    db.commit()
    
    return {"message": "Dashboard deleted successfully"}


# Widget Template Operations
@router.get("/widgets/templates", response_model=List[DashboardWidgetResponse])
def get_widget_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    widget_type: Optional[str] = Query(None, description="Filter by widget type"),
    db: Session = Depends(get_db)
):
    """Get available widget templates"""
    query = db.query(DashboardWidget).filter(DashboardWidget.is_active == True)
    
    if category:
        query = query.filter(DashboardWidget.category == category)
    
    if widget_type:
        query = query.filter(DashboardWidget.widget_type == widget_type)
    
    templates = query.order_by(DashboardWidget.category, DashboardWidget.name).all()
    
    return templates


# User Widget Operations
@router.post("/{dashboard_id}/widgets", response_model=UserWidgetResponse)
def add_widget_to_dashboard(
    dashboard_id: str,
    widget_data: UserWidgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a widget to a dashboard"""
    
    # Verify dashboard ownership
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Verify widget template exists
    widget_template = db.query(DashboardWidget).filter(
        and_(
            DashboardWidget.widget_id == widget_data.widget_id,
            DashboardWidget.is_active == True
        )
    ).first()
    
    if not widget_template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget template not found"
        )
    
    # Create user widget
    user_widget = UserWidget(
        dashboard_id=dashboard_id,
        widget_id=widget_data.widget_id,
        custom_name=widget_data.custom_name,
        position_x=widget_data.position_x,
        position_y=widget_data.position_y,
        width=max(widget_data.width, widget_template.min_width),
        height=max(widget_data.height, widget_template.min_height),
        custom_config=widget_data.custom_config,
        is_visible=widget_data.is_visible
    )
    
    # Validate max dimensions
    if widget_template.max_width and user_widget.width > widget_template.max_width:
        user_widget.width = widget_template.max_width
    if widget_template.max_height and user_widget.height > widget_template.max_height:
        user_widget.height = widget_template.max_height
    
    db.add(user_widget)
    db.commit()
    db.refresh(user_widget)
    
    # Load the widget with template information
    user_widget_with_template = db.query(UserWidget).options(
        joinedload(UserWidget.widget_template)
    ).filter(UserWidget.user_widget_id == user_widget.user_widget_id).first()
    
    return user_widget_with_template


@router.put("/widgets/{user_widget_id}", response_model=UserWidgetResponse)
def update_user_widget(
    user_widget_id: str,
    widget_data: UserWidgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a user widget"""
    
    # Get user widget with dashboard ownership check
    user_widget = db.query(UserWidget).join(Dashboard).filter(
        and_(
            UserWidget.user_widget_id == user_widget_id,
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not user_widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Get widget template for validation
    widget_template = db.query(DashboardWidget).filter(
        DashboardWidget.widget_id == user_widget.widget_id
    ).first()
    
    # Update widget fields
    update_data = widget_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "width" and widget_template:
            value = max(value, widget_template.min_width)
            if widget_template.max_width:
                value = min(value, widget_template.max_width)
        elif field == "height" and widget_template:
            value = max(value, widget_template.min_height)
            if widget_template.max_height:
                value = min(value, widget_template.max_height)
        
        setattr(user_widget, field, value)
    
    db.commit()
    db.refresh(user_widget)
    
    # Load the widget with template information
    user_widget_with_template = db.query(UserWidget).options(
        joinedload(UserWidget.widget_template)
    ).filter(UserWidget.user_widget_id == user_widget.user_widget_id).first()
    
    return user_widget_with_template


@router.delete("/widgets/{user_widget_id}")
def remove_widget_from_dashboard(
    user_widget_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a widget from a dashboard"""
    
    # Get user widget with dashboard ownership check
    user_widget = db.query(UserWidget).join(Dashboard).filter(
        and_(
            UserWidget.user_widget_id == user_widget_id,
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not user_widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    db.delete(user_widget)
    db.commit()
    
    return {"message": "Widget removed successfully"}


# Bulk Operations
@router.put("/{dashboard_id}/layout", response_model=DashboardWithWidgetsResponse)
def update_dashboard_layout(
    dashboard_id: str,
    layout_data: DashboardLayoutUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update dashboard layout and widget positions in bulk"""
    
    # Verify dashboard ownership
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Update dashboard layout config
    dashboard.layout_config = layout_data.layout_config
    
    # Update widget positions and configurations
    for widget_update in layout_data.widgets:
        user_widget_id = widget_update.get("user_widget_id")
        if not user_widget_id:
            continue
        
        user_widget = db.query(UserWidget).filter(
            and_(
                UserWidget.user_widget_id == user_widget_id,
                UserWidget.dashboard_id == dashboard_id
            )
        ).first()
        
        if user_widget:
            # Update position and size
            if "position_x" in widget_update:
                user_widget.position_x = widget_update["position_x"]
            if "position_y" in widget_update:
                user_widget.position_y = widget_update["position_y"]
            if "width" in widget_update:
                user_widget.width = widget_update["width"]
            if "height" in widget_update:
                user_widget.height = widget_update["height"]
            if "is_visible" in widget_update:
                user_widget.is_visible = widget_update["is_visible"]
    
    db.commit()
    
    # Return updated dashboard with widgets
    updated_dashboard = db.query(Dashboard).options(
        joinedload(Dashboard.user_widgets).joinedload(UserWidget.widget_template)
    ).filter(Dashboard.dashboard_id == dashboard_id).first()
    
    return updated_dashboard


# Dashboard Statistics
@router.get("/stats/overview", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics for the current user"""
    
    # Count user's dashboards
    total_dashboards = db.query(func.count(Dashboard.id)).filter(
        and_(
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).scalar()
    
    # Count user's widgets
    total_widgets = db.query(func.count(UserWidget.id)).join(Dashboard).filter(
        and_(
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).scalar()
    
    # Count active widgets
    active_widgets = db.query(func.count(UserWidget.id)).join(Dashboard).filter(
        and_(
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True,
            UserWidget.is_visible == True
        )
    ).scalar()
    
    # Widget types distribution
    widget_types = db.query(
        DashboardWidget.widget_type,
        func.count(UserWidget.id)
    ).join(UserWidget).join(Dashboard).filter(
        and_(
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).group_by(DashboardWidget.widget_type).all()
    
    # Categories distribution
    categories = db.query(
        DashboardWidget.category,
        func.count(UserWidget.id)
    ).join(UserWidget).join(Dashboard).filter(
        and_(
            Dashboard.user_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).group_by(DashboardWidget.category).all()
    
    return DashboardStatsResponse(
        total_dashboards=total_dashboards or 0,
        total_widgets=total_widgets or 0,
        active_widgets=active_widgets or 0,
        widget_types={wt[0]: wt[1] for wt in widget_types},
        categories={cat[0]: cat[1] for cat in categories}
    )
