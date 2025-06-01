from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from app.db.session import get_db
from app.models.user import User
from app.models.deployment import CloudAccount, Deployment
from app.api.deps import get_current_user


router = APIRouter()


@router.get("/deployments/stats/total")
async def get_total_deployments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total number of deployments"""
    if not current_user.tenant_id:
        return {"value": 0, "label": "Total Deployments"}
    
    total = db.query(func.count(Deployment.id)).filter(
        Deployment.tenant_id == current_user.tenant_id
    ).scalar()
    
    return {
        "value": total or 0,
        "label": "Total Deployments",
        "subtitle": f"Across all environments"
    }


@router.get("/deployments/stats/running")
async def get_running_deployments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get number of running deployments"""
    if not current_user.tenant_id:
        return {"value": 0, "label": "Running Deployments"}
    
    running = db.query(func.count(Deployment.id)).filter(
        Deployment.tenant_id == current_user.tenant_id,
        Deployment.status == "running"
    ).scalar()
    
    total = db.query(func.count(Deployment.id)).filter(
        Deployment.tenant_id == current_user.tenant_id
    ).scalar()
    
    percentage = round((running / total) * 100) if total > 0 else 0
    
    return {
        "value": running or 0,
        "label": "Running Deployments",
        "subtitle": f"{percentage}% of total deployments"
    }


@router.get("/deployments/stats/failed")
async def get_failed_deployments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get number of failed deployments"""
    if not current_user.tenant_id:
        return {"value": 0, "label": "Failed Deployments"}
    
    failed = db.query(func.count(Deployment.id)).filter(
        Deployment.tenant_id == current_user.tenant_id,
        Deployment.status == "failed"
    ).scalar()
    
    pending = db.query(func.count(Deployment.id)).filter(
        Deployment.tenant_id == current_user.tenant_id,
        Deployment.status == "pending"
    ).scalar()
    
    return {
        "value": failed or 0,
        "label": "Failed Deployments",
        "subtitle": f"{pending or 0} pending resolution"
    }


@router.get("/cloud-accounts/stats/total")
async def get_total_cloud_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total number of cloud accounts"""
    if not current_user.tenant_id:
        return {"value": 0, "label": "Cloud Accounts"}
    
    total = db.query(func.count(CloudAccount.id)).filter(
        CloudAccount.tenant_id == current_user.tenant_id
    ).scalar()
    
    connected = db.query(func.count(CloudAccount.id)).filter(
        CloudAccount.tenant_id == current_user.tenant_id,
        CloudAccount.status == "connected"
    ).scalar()
    
    issues = total - connected if total and connected else 0
    
    return {
        "value": total or 0,
        "label": "Cloud Accounts",
        "subtitle": f"{connected or 0} connected, {issues} with issues"
    }


@router.get("/deployments/stats/by-provider")
async def get_deployments_by_provider(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get deployment distribution by cloud provider"""
    if not current_user.tenant_id:
        return []
    
    results = db.query(
        Deployment.provider,
        func.count(Deployment.id).label('count')
    ).filter(
        Deployment.tenant_id == current_user.tenant_id
    ).group_by(Deployment.provider).all()
    
    data = []
    colors = {
        'aws': '#FF9900',
        'azure': '#0078D4',
        'gcp': '#4285F4',
        'other': '#6B7280'
    }
    
    for provider, count in results:
        data.append({
            "name": provider.upper() if provider else "Unknown",
            "value": count,
            "fill": colors.get(provider.lower() if provider else 'other', colors['other'])
        })
    
    return data


@router.get("/cloud-accounts/stats/status")
async def get_cloud_accounts_by_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get cloud account distribution by status"""
    if not current_user.tenant_id:
        return []
    
    results = db.query(
        CloudAccount.status,
        func.count(CloudAccount.id).label('count')
    ).filter(
        CloudAccount.tenant_id == current_user.tenant_id
    ).group_by(CloudAccount.status).all()
    
    data = []
    colors = {
        'connected': '#10B981',
        'warning': '#F59E0B',
        'error': '#EF4444',
        'disconnected': '#6B7280'
    }
    
    for status, count in results:
        data.append({
            "name": status.title() if status else "Unknown",
            "value": count,
            "fill": colors.get(status.lower() if status else 'disconnected', colors['disconnected'])
        })
    
    return data


@router.get("/deployments/stats/timeline")
async def get_deployment_timeline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = 30
):
    """Get deployment status timeline"""
    if not current_user.tenant_id:
        return []
    
    # Get deployments from the last N days
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Query deployments grouped by date and status
    results = db.query(
        func.date(Deployment.created_at).label('date'),
        Deployment.status,
        func.count(Deployment.id).label('count')
    ).filter(
        Deployment.tenant_id == current_user.tenant_id,
        Deployment.created_at >= start_date
    ).group_by(
        func.date(Deployment.created_at),
        Deployment.status
    ).order_by(func.date(Deployment.created_at)).all()
    
    # Organize data by date
    timeline_data = {}
    for date, status, count in results:
        date_str = date.strftime('%Y-%m-%d')
        if date_str not in timeline_data:
            timeline_data[date_str] = {
                'date': date_str,
                'running': 0,
                'failed': 0,
                'pending': 0,
                'completed': 0
            }
        timeline_data[date_str][status] = count
    
    return list(timeline_data.values())


@router.get("/deployments/recent")
async def get_recent_deployments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 10
):
    """Get recent deployments"""
    if not current_user.tenant_id:
        return []
    
    deployments = db.query(Deployment).filter(
        Deployment.tenant_id == current_user.tenant_id
    ).order_by(Deployment.created_at.desc()).limit(limit).all()
    
    data = []
    for deployment in deployments:
        data.append({
            "id": deployment.id,
            "name": deployment.name,
            "status": deployment.status,
            "provider": deployment.provider,
            "environment": deployment.environment,
            "template_name": deployment.template_name,
            "created_at": deployment.created_at.isoformat() if deployment.created_at else None,
            "updated_at": deployment.updated_at.isoformat() if deployment.updated_at else None
        })
    
    return data


@router.get("/templates/stats/total")
async def get_total_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total number of templates"""
    # This would need to be implemented based on your Template model
    # For now, returning a placeholder
    return {
        "value": 0,
        "label": "Templates",
        "subtitle": "Available templates"
    }


@router.get("/environments/stats/total")
async def get_total_environments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total number of environments"""
    # This would need to be implemented based on your Environment model
    # For now, returning a placeholder
    return {
        "value": 0,
        "label": "Environments",
        "subtitle": "Configured environments"
    }

