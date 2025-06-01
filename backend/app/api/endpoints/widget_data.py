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
        elif request.widget_type == "cloud_accounts_status":
            accounts = db.query(CloudAccount).filter(
                CloudAccount.tenant_id == current_user.tenant.tenant_id
            ).all()
            
            account_data = []
            for account in accounts:
                account_data.append({
                    "id": account.account_id,  # Use account_id instead of cloud_account_id
                    "name": account.name,
                    "provider": account.provider,
                    "status": account.status,
                    "description": account.description
                })
            
            return WidgetDataResponse(
                widget_type=request.widget_type,
                data={"accounts": account_data},
                last_updated=datetime.utcnow()
            )
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
    """Get deployment statistics for widgets"""
    
    # Base query for deployments in the tenant
    base_query = db.query(Deployment).filter(Deployment.tenant_id == tenant_id)
    
    # Apply filters if specified in config
    filter_type = config.get("filter", "") if config else ""
    if filter_type == "status:running":
        query = base_query.filter(Deployment.status == "running")
    elif filter_type == "status:failed":
        query = base_query.filter(Deployment.status == "failed")
    elif filter_type == "status:completed":
        query = base_query.filter(Deployment.status == "completed")
    else:
        query = base_query
    
    count = query.count()
    
    return {"count": count}


def get_cloud_account_stats(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get cloud account statistics for count widgets"""
    
    query = db.query(CloudAccount).filter(CloudAccount.tenant_id == tenant_id)
    total_count = query.count()
    
    return {"count": total_count}


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
    
    # Get deployments with their environment and cloud account relationships
    deployments = db.query(Deployment).filter(
        Deployment.tenant_id == tenant_id
    ).all()
    
    provider_counts = {}
    for deployment in deployments:
        provider = "unknown"
        if deployment.environment and deployment.environment.cloud_accounts:
            provider = deployment.environment.cloud_accounts[0].provider
        
        provider_counts[provider] = provider_counts.get(provider, 0) + 1
    
    # Format for chart visualization
    chart_data = [
        {"name": provider, "value": count}
        for provider, count in provider_counts.items()
    ]
    
    return {
        "chart_data": chart_data,
        "provider_counts": provider_counts
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
    """Get recent deployments for status widgets"""
    
    limit = config.get("limit", 5) if config else 5
    
    # Get recent deployments with environment and cloud account info
    deployments = db.query(Deployment).filter(
        Deployment.tenant_id == tenant_id
    ).order_by(Deployment.created_at.desc()).limit(limit).all()
    
    deployment_data = []
    for deployment in deployments:
        # Get provider from environment's cloud accounts
        provider = "unknown"
        if deployment.environment and deployment.environment.cloud_accounts:
            provider = deployment.environment.cloud_accounts[0].provider
        
        deployment_data.append({
            "id": deployment.deployment_id,
            "name": deployment.name,
            "status": deployment.status,
            "environment": deployment.environment.name if deployment.environment else "Unknown",
            "provider": provider,
            "created_at": deployment.created_at.isoformat() if deployment.created_at else None
        })
    
    return {"deployments": deployment_data}


def get_cloud_account_status(db: Session, tenant_id: str, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Get cloud account status information for status widgets"""
    
    accounts = db.query(CloudAccount).filter(
        CloudAccount.tenant_id == tenant_id
    ).all()
    
    account_data = []
    for account in accounts:
        account_data.append({
            "id": account.account_id,  # Use account_id instead of cloud_account_id
            "name": account.name,
            "provider": account.provider,
            "status": account.status,
            "description": account.description
        })
    
    return {"accounts": account_data}


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
