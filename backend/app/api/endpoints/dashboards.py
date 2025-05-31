from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
import logging

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.dashboard import Dashboard, DashboardWidget, WidgetType
from app.models.deployment import Deployment, CloudAccount, Template, Environment
from app.schemas.dashboard import (
    DashboardCreate, DashboardUpdate, DashboardResponse, DashboardListResponse,
    DashboardWidgetCreate, DashboardWidgetUpdate, DashboardWidgetResponse,
    WidgetTypeResponse, WidgetDataRequest, WidgetDataResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()


# Widget Types - Must be before parameterized routes
@router.get("/widget-types", response_model=List[WidgetTypeResponse])
async def get_widget_types(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get available widget types"""
    query = db.query(WidgetType).filter(WidgetType.is_active == True)
    
    if category:
        query = query.filter(WidgetType.category == category)
    
    return query.all()


# Dashboard CRUD operations
@router.get("/", response_model=List[DashboardListResponse])
async def get_dashboards(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all dashboards for the current user's tenant"""
    dashboards = db.query(Dashboard).filter(
        and_(
            Dashboard.created_by_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).offset(skip).limit(limit).all()
    
    # Add widget count to each dashboard
    result = []
    for dashboard in dashboards:
        widget_count = db.query(func.count(DashboardWidget.id)).filter(
            and_(
                DashboardWidget.dashboard_id == dashboard.dashboard_id,
                DashboardWidget.is_active == True
            )
        ).scalar()
        
        result.append(DashboardListResponse(
            id=dashboard.id,
            dashboard_id=dashboard.dashboard_id,
            name=dashboard.name,
            description=dashboard.description,
            is_default=dashboard.is_default,
            is_active=dashboard.is_active,
            widget_count=widget_count,
            created_at=dashboard.created_at,
            updated_at=dashboard.updated_at
        ))
    
    return result


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific dashboard with its widgets"""
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.created_by_id == current_user.user_id,
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
async def create_dashboard(
    dashboard_data: DashboardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new dashboard"""
    # If this is set as default, unset other default dashboards
    if dashboard_data.is_default:
        db.query(Dashboard).filter(
            and_(
                Dashboard.created_by_id == current_user.user_id,
                Dashboard.is_default == True
            )
        ).update({"is_default": False})
    
    dashboard = Dashboard(
        name=dashboard_data.name,
        description=dashboard_data.description,
        is_default=dashboard_data.is_default,
        layout_config=dashboard_data.layout_config,
        created_by_id=current_user.user_id,
    )
    
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    
    return dashboard


@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: str,
    dashboard_data: DashboardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a dashboard"""
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.created_by_id == current_user.user_id
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # If setting as default, unset other default dashboards
    if dashboard_data.is_default:
        db.query(Dashboard).filter(
            and_(
                Dashboard.created_by_id == current_user.user_id,
                Dashboard.is_default == True,
                Dashboard.dashboard_id != dashboard_id
            )
        ).update({"is_default": False})
    
    # Update fields
    update_data = dashboard_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dashboard, field, value)
    
    dashboard.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dashboard)
    
    return dashboard


@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a dashboard (soft delete)"""
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.created_by_id == current_user.user_id
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    # Soft delete
    dashboard.is_active = False
    dashboard.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Dashboard deleted successfully"}


# Widget CRUD Operations
@router.get("/{dashboard_id}/widgets", response_model=List[DashboardWidgetResponse])
async def get_dashboard_widgets(
    dashboard_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all widgets for a dashboard"""
    # Verify dashboard exists and user has access
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.created_by_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    widgets = db.query(DashboardWidget).filter(
        and_(
            DashboardWidget.dashboard_id == dashboard_id,
            DashboardWidget.is_active == True
        )
    ).all()
    
    return widgets


@router.post("/{dashboard_id}/widgets", response_model=DashboardWidgetResponse)
async def create_widget(
    dashboard_id: str,
    widget_data: DashboardWidgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new widget for a dashboard"""
    # Verify dashboard exists and user has access
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.created_by_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    widget = DashboardWidget(
        title=widget_data.title,
        widget_type=widget_data.widget_type,
        data_source=widget_data.data_source,
        configuration=widget_data.configuration,
        position_x=widget_data.position_x,
        position_y=widget_data.position_y,
        width=widget_data.width,
        height=widget_data.height,
        refresh_interval=widget_data.refresh_interval,
        dashboard_id=dashboard_id
    )
    
    db.add(widget)
    db.commit()
    db.refresh(widget)
    
    return widget


@router.put("/{dashboard_id}/widgets/{widget_id}", response_model=DashboardWidgetResponse)
async def update_widget(
    dashboard_id: str,
    widget_id: str,
    widget_data: DashboardWidgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a widget"""
    # Verify dashboard exists and user has access
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.created_by_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    widget = db.query(DashboardWidget).filter(
        and_(
            DashboardWidget.widget_id == widget_id,
            DashboardWidget.dashboard_id == dashboard_id
        )
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Update fields
    update_data = widget_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(widget, field, value)
    
    widget.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(widget)
    
    return widget


@router.delete("/{dashboard_id}/widgets/{widget_id}")
async def delete_widget(
    dashboard_id: str,
    widget_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a widget (soft delete)"""
    # Verify dashboard exists and user has access
    dashboard = db.query(Dashboard).filter(
        and_(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.created_by_id == current_user.user_id,
            Dashboard.is_active == True
        )
    ).first()
    
    if not dashboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found"
        )
    
    widget = db.query(DashboardWidget).filter(
        and_(
            DashboardWidget.widget_id == widget_id,
            DashboardWidget.dashboard_id == dashboard_id
        )
    ).first()
    
    if not widget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found"
        )
    
    # Soft delete
    widget.is_active = False
    widget.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Widget deleted successfully"}


# Widget Data
@router.post("/widget-data", response_model=WidgetDataResponse)
async def get_widget_data(
    request: WidgetDataRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get data for a specific widget"""
    # Use the current user's tenant
    widget_tenant_id = current_user.tenant.tenant_id
    
    # Check if user has permission to view data for this tenant
            )
    
    try:
        data = await _fetch_widget_data(
            request.widget_type,
            request.data_source,
            request.configuration or {},
            widget_tenant_id,
            db
        )
        
        return WidgetDataResponse(
            data=data,
            last_updated=datetime.utcnow()
        )
    except Exception as e:
        logger.error(f"Error fetching widget data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch widget data"
        )


async def _fetch_widget_data(
    widget_type: str,
    data_source: str,
    configuration: Dict[str, Any],
    tenant_id: str,
    db: Session
) -> Dict[str, Any]:
    """Fetch data for a widget based on its type and data source"""
    
    if data_source == "deployments":
        deployments = db.query(Deployment).filter(Deployment.tenant_id == tenant_id).all()
        
        if widget_type == "metric":
            return {
                "total": len(deployments),
                "running": len([d for d in deployments if d.status == "running"]),
                "failed": len([d for d in deployments if d.status == "failed"]),
                "pending": len([d for d in deployments if d.status == "pending"])
            }
        elif widget_type == "chart":
            # Group by provider
            provider_counts = {}
            for deployment in deployments:
                provider = deployment.provider
                provider_counts[provider] = provider_counts.get(provider, 0) + 1
            return {"chart_data": provider_counts}
        elif widget_type == "list":
            # Recent deployments
            recent = sorted(deployments, key=lambda x: x.created_at, reverse=True)[:5]
            return {
                "items": [
                    {
                        "id": d.deployment_id,
                        "name": d.name,
                        "status": d.status,
                        "provider": d.provider,
                        "created_at": d.created_at.isoformat()
                    }
                    for d in recent
                ]
            }
    
    elif data_source == "cloud_accounts":
        accounts = db.query(CloudAccount).filter(CloudAccount.tenant_id == tenant_id).all()
        
        if widget_type == "metric":
            return {
                "total": len(accounts),
                "connected": len([a for a in accounts if a.status == "connected"]),
                "warning": len([a for a in accounts if a.status == "warning"]),
                "error": len([a for a in accounts if a.status == "error"])
            }
        elif widget_type == "list":
            return {
                "items": [
                    {
                        "id": str(a.id),
                        "name": a.name,
                        "provider": a.provider,
                        "status": a.status
                    }
                    for a in accounts
                ]
            }
    
    elif data_source == "templates":
        templates = db.query(Template).filter(Template.tenant_id == tenant_id).all()
        
        if widget_type == "metric":
            return {"total": len(templates)}
        elif widget_type == "list":
            return {
                "items": [
                    {
                        "id": str(t.id),
                        "name": t.name,
                        "provider": t.provider,
                        "created_at": t.created_at.isoformat()
                    }
                    for t in templates[:10]
                ]
            }
    
    elif data_source == "environments":
        environments = db.query(Environment).filter(Environment.tenant_id == tenant_id).all()
        
        if widget_type == "metric":
            return {"total": len(environments)}
        elif widget_type == "list":
            return {
                "items": [
                    {
                        "id": str(e.id),
                        "name": e.name,
                        "type": e.environment_type,
                        "created_at": e.created_at.isoformat()
                    }
                    for e in environments
                ]
            }
    
    # Default empty data
    return {"message": "No data available for this widget configuration"}
