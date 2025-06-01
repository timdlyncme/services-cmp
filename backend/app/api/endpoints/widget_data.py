from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta

from app.db.session import get_db
from app.api.endpoints.auth import get_current_user
from app.models.user import User, Tenant
from app.models.deployment import Deployment, CloudAccount, Template
from app.schemas.dashboard import WidgetDataRequest, WidgetDataResponse

router = APIRouter()


@router.post("/data", response_model=WidgetDataResponse)
def get_widget_data(
    request: WidgetDataRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get data for a specific widget"""
    
    # Use tenant from request or current user's tenant
    tenant_id = request.tenant_id or current_user.tenant_id
    
    try:
        if request.data_source == "/api/deployments/stats":
            data = get_deployment_stats(db, tenant_id, request.config)
        elif request.data_source == "/api/cloud-accounts/stats":
            data = get_cloud_account_stats(db, tenant_id, request.config)
        elif request.data_source == "/api/templates/stats":
            data = get_template_stats(db, tenant_id, request.config)
        elif request.data_source == "/api/deployments/by-provider":
            data = get_deployments_by_provider(db, tenant_id, request.config)
        elif request.data_source == "/api/deployments/status-overview":
            data = get_deployment_status_overview(db, tenant_id, request.config)
        elif request.data_source == "/api/deployments/timeline":
            data = get_deployment_timeline(db, tenant_id, request.config)
        elif request.data_source == "/api/deployments/recent":
            data = get_recent_deployments(db, tenant_id, request.config)
        elif request.data_source == "/api/cloud-accounts/status":
            data = get_cloud_account_status(db, tenant_id, request.config)
        elif request.data_source == "static":
            data = get_static_widget_data(request.config)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown data source: {request.data_source}"
            )
        
        return WidgetDataResponse(
            widget_type=request.widget_type,
            data=data,
            last_updated=datetime.utcnow()
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching widget data: {str(e)}"
        )


def get_deployment_stats(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get deployment statistics"""
    
    query = db.query(Deployment).filter(Deployment.tenant_id == tenant_id)
    
    # Apply filters from config
    if config and "filter" in config:
        filter_str = config["filter"]
        if "status:" in filter_str:
            status_filter = filter_str.split("status:")[1]
            query = query.filter(Deployment.status == status_filter)
    
    total_count = query.count()
    
    # Get status breakdown
    status_counts = db.query(
        Deployment.status,
        func.count(Deployment.id)
    ).filter(Deployment.tenant_id == tenant_id).group_by(Deployment.status).all()
    
    return {
        "total": total_count,
        "status_breakdown": {status: count for status, count in status_counts},
        "running": next((count for status, count in status_counts if status == "running"), 0),
        "failed": next((count for status, count in status_counts if status == "failed"), 0),
        "pending": next((count for status, count in status_counts if status == "pending"), 0)
    }


def get_cloud_account_stats(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get cloud account statistics"""
    
    query = db.query(CloudAccount).filter(CloudAccount.tenant_id == tenant_id)
    total_count = query.count()
    
    # Get status breakdown
    status_counts = db.query(
        CloudAccount.status,
        func.count(CloudAccount.id)
    ).filter(CloudAccount.tenant_id == tenant_id).group_by(CloudAccount.status).all()
    
    # Get provider breakdown
    provider_counts = db.query(
        CloudAccount.provider,
        func.count(CloudAccount.id)
    ).filter(CloudAccount.tenant_id == tenant_id).group_by(CloudAccount.provider).all()
    
    return {
        "total": total_count,
        "status_breakdown": {status: count for status, count in status_counts},
        "provider_breakdown": {provider: count for provider, count in provider_counts},
        "connected": next((count for status, count in status_counts if status == "connected"), 0),
        "warning": next((count for status, count in status_counts if status == "warning"), 0),
        "error": next((count for status, count in status_counts if status == "error"), 0)
    }


def get_template_stats(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get template statistics"""
    
    query = db.query(Template).filter(Template.tenant_id == tenant_id)
    total_count = query.count()
    
    # Get provider breakdown
    provider_counts = db.query(
        Template.provider,
        func.count(Template.id)
    ).filter(Template.tenant_id == tenant_id).group_by(Template.provider).all()
    
    return {
        "total": total_count,
        "provider_breakdown": {provider: count for provider, count in provider_counts}
    }


def get_deployments_by_provider(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get deployment distribution by cloud provider"""
    
    provider_counts = db.query(
        Deployment.provider,
        func.count(Deployment.id)
    ).filter(Deployment.tenant_id == tenant_id).group_by(Deployment.provider).all()
    
    return {
        "chart_data": [
            {"name": provider.upper(), "value": count}
            for provider, count in provider_counts
        ],
        "total": sum(count for _, count in provider_counts)
    }


def get_deployment_status_overview(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get deployment status distribution"""
    
    status_counts = db.query(
        Deployment.status,
        func.count(Deployment.id)
    ).filter(Deployment.tenant_id == tenant_id).group_by(Deployment.status).all()
    
    return {
        "chart_data": [
            {"name": status.title(), "value": count}
            for status, count in status_counts
        ],
        "total": sum(count for _, count in status_counts)
    }


def get_deployment_timeline(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get deployment activity timeline"""
    
    # Default to 30 days
    time_range = config.get("time_range", "30d") if config else "30d"
    days = int(time_range.replace("d", ""))
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Get deployments created in the time range, grouped by date
    deployments = db.query(
        func.date(Deployment.created_at).label("date"),
        func.count(Deployment.id).label("count")
    ).filter(
        and_(
            Deployment.tenant_id == tenant_id,
            Deployment.created_at >= start_date
        )
    ).group_by(func.date(Deployment.created_at)).order_by("date").all()
    
    return {
        "chart_data": [
            {"date": str(date), "deployments": count}
            for date, count in deployments
        ],
        "time_range": time_range,
        "total_period": sum(count for _, count in deployments)
    }


def get_recent_deployments(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get recent deployments"""
    
    limit = config.get("limit", 5) if config else 5
    
    recent_deployments = db.query(Deployment).filter(
        Deployment.tenant_id == tenant_id
    ).order_by(Deployment.created_at.desc()).limit(limit).all()
    
    return {
        "deployments": [
            {
                "id": deployment.deployment_id,
                "name": deployment.name,
                "status": deployment.status,
                "provider": deployment.provider,
                "environment": deployment.environment,
                "template_name": deployment.template_name,
                "created_at": deployment.created_at.isoformat(),
                "updated_at": deployment.updated_at.isoformat() if deployment.updated_at else None
            }
            for deployment in recent_deployments
        ],
        "total": len(recent_deployments)
    }


def get_cloud_account_status(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get cloud account status overview"""
    
    cloud_accounts = db.query(CloudAccount).filter(
        CloudAccount.tenant_id == tenant_id
    ).order_by(CloudAccount.name).all()
    
    return {
        "accounts": [
            {
                "id": account.cloud_account_id,
                "name": account.name,
                "provider": account.provider,
                "status": account.status,
                "created_at": account.created_at.isoformat(),
                "updated_at": account.updated_at.isoformat() if account.updated_at else None
            }
            for account in cloud_accounts
        ],
        "total": len(cloud_accounts),
        "status_summary": {
            "connected": len([a for a in cloud_accounts if a.status == "connected"]),
            "warning": len([a for a in cloud_accounts if a.status == "warning"]),
            "error": len([a for a in cloud_accounts if a.status == "error"])
        }
    }


def get_static_widget_data(config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get static widget data (for text widgets, etc.)"""
    
    if not config:
        return {"content": "No configuration provided"}
    
    text_type = config.get("text_type", "welcome")
    
    if text_type == "welcome":
        return {
            "title": config.get("title", "Welcome"),
            "content": config.get("content", "Welcome to your dashboard"),
            "type": "welcome"
        }
    elif text_type == "actions":
        return {
            "actions": config.get("actions", []),
            "type": "actions"
        }
    else:
        return {
            "content": config.get("content", "Static content"),
            "type": "static"
        }

