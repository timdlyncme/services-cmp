"""
Dashboard service module.

This module provides business logic for dashboard operations.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime

from app.models.dashboard import Dashboard, DashboardWidget, UserWidget
from app.models.deployment import Deployment, CloudAccount
from app.models.user import User


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_user_dashboards(self, user_id: int) -> List[Dashboard]:
        """Get all dashboards for a user."""
        return self.db.query(Dashboard).filter(Dashboard.user_id == user_id).all()

    def create_dashboard(self, user_id: int, dashboard_data: Dict[str, Any]) -> Dashboard:
        """Create a new dashboard for a user."""
        # If this is set as default, unset other defaults
        if dashboard_data.get('is_default', False):
            self.db.query(Dashboard).filter(
                and_(Dashboard.user_id == user_id, Dashboard.is_default == True)
            ).update({'is_default': False})

        dashboard = Dashboard(
            user_id=user_id,
            **dashboard_data
        )
        self.db.add(dashboard)
        self.db.commit()
        self.db.refresh(dashboard)
        return dashboard

    def get_dashboard_by_id(self, dashboard_id: str, user_id: int) -> Optional[Dashboard]:
        """Get a dashboard by ID, ensuring it belongs to the user."""
        return self.db.query(Dashboard).filter(
            and_(Dashboard.dashboard_id == dashboard_id, Dashboard.user_id == user_id)
        ).first()

    def update_dashboard(self, dashboard_id: str, user_id: int, update_data: Dict[str, Any]) -> Optional[Dashboard]:
        """Update a dashboard."""
        dashboard = self.get_dashboard_by_id(dashboard_id, user_id)
        if not dashboard:
            return None

        # If setting as default, unset other defaults
        if update_data.get('is_default', False):
            self.db.query(Dashboard).filter(
                and_(Dashboard.user_id == user_id, Dashboard.is_default == True, Dashboard.id != dashboard.id)
            ).update({'is_default': False})

        for key, value in update_data.items():
            setattr(dashboard, key, value)
        
        dashboard.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(dashboard)
        return dashboard

    def delete_dashboard(self, dashboard_id: str, user_id: int) -> bool:
        """Delete a dashboard."""
        dashboard = self.get_dashboard_by_id(dashboard_id, user_id)
        if not dashboard:
            return False

        self.db.delete(dashboard)
        self.db.commit()
        return True

    def get_widget_catalog(self, category: Optional[str] = None) -> List[DashboardWidget]:
        """Get available widgets from the catalog."""
        query = self.db.query(DashboardWidget).filter(DashboardWidget.is_active == True)
        if category:
            query = query.filter(DashboardWidget.category == category)
        return query.all()

    def add_user_widget(self, user_id: int, widget_data: Dict[str, Any]) -> UserWidget:
        """Add a widget to a user's dashboard."""
        user_widget = UserWidget(
            user_id=user_id,
            **widget_data
        )
        self.db.add(user_widget)
        self.db.commit()
        self.db.refresh(user_widget)
        return user_widget

    def update_user_widget(self, user_widget_id: str, user_id: int, update_data: Dict[str, Any]) -> Optional[UserWidget]:
        """Update a user widget."""
        user_widget = self.db.query(UserWidget).filter(
            and_(UserWidget.user_widget_id == user_widget_id, UserWidget.user_id == user_id)
        ).first()
        
        if not user_widget:
            return None

        for key, value in update_data.items():
            setattr(user_widget, key, value)
        
        user_widget.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user_widget)
        return user_widget

    def remove_user_widget(self, user_widget_id: str, user_id: int) -> bool:
        """Remove a user widget."""
        user_widget = self.db.query(UserWidget).filter(
            and_(UserWidget.user_widget_id == user_widget_id, UserWidget.user_id == user_id)
        ).first()
        
        if not user_widget:
            return False

        self.db.delete(user_widget)
        self.db.commit()
        return True

    def update_dashboard_layout(self, dashboard_id: str, user_id: int, layout_data: Dict[str, Any]) -> bool:
        """Update the layout of a dashboard."""
        dashboard = self.get_dashboard_by_id(dashboard_id, user_id)
        if not dashboard:
            return False

        dashboard.layout = layout_data
        dashboard.updated_at = datetime.utcnow()
        self.db.commit()
        return True

    def get_widget_data(self, data_source: str, user: User, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Get data for a specific widget based on data source."""
        if filters is None:
            filters = {}

        # Get current tenant for filtering data
        tenant_id = user.tenant_id

        if data_source == "deployments/count":
            count = self.db.query(Deployment).filter(Deployment.tenant_id == tenant_id).count()
            return {"value": count, "label": "Total Deployments"}

        elif data_source == "deployments/running":
            total = self.db.query(Deployment).filter(Deployment.tenant_id == tenant_id).count()
            running = self.db.query(Deployment).filter(
                and_(Deployment.tenant_id == tenant_id, Deployment.status == "running")
            ).count()
            percentage = round((running / total * 100) if total > 0 else 0, 1)
            return {"value": running, "label": "Running Deployments", "percentage": percentage}

        elif data_source == "deployments/failed":
            failed = self.db.query(Deployment).filter(
                and_(Deployment.tenant_id == tenant_id, Deployment.status == "failed")
            ).count()
            return {"value": failed, "label": "Failed Deployments"}

        elif data_source == "cloud-accounts/count":
            total = self.db.query(CloudAccount).filter(CloudAccount.tenant_id == tenant_id).count()
            connected = self.db.query(CloudAccount).filter(
                and_(CloudAccount.tenant_id == tenant_id, CloudAccount.status == "connected")
            ).count()
            return {"value": total, "label": "Cloud Accounts", "connected": connected}

        elif data_source == "deployments/by-provider":
            deployments = self.db.query(Deployment).filter(Deployment.tenant_id == tenant_id).all()
            provider_counts = {}
            for deployment in deployments:
                provider = deployment.provider or "unknown"
                provider_counts[provider] = provider_counts.get(provider, 0) + 1
            
            data = [{"name": provider.title(), "value": count} for provider, count in provider_counts.items()]
            return {"data": data, "type": "pie"}

        elif data_source == "deployments/timeline":
            # Get deployments from the last 7 days by default
            from datetime import datetime, timedelta
            days = filters.get("timeRange", "7d")
            days_count = int(days.replace("d", ""))
            
            start_date = datetime.utcnow() - timedelta(days=days_count)
            deployments = self.db.query(Deployment).filter(
                and_(Deployment.tenant_id == tenant_id, Deployment.created_at >= start_date)
            ).all()
            
            # Group by date and status
            timeline_data = {}
            for deployment in deployments:
                date_key = deployment.created_at.strftime("%Y-%m-%d")
                if date_key not in timeline_data:
                    timeline_data[date_key] = {"running": 0, "failed": 0, "completed": 0, "pending": 0}
                timeline_data[date_key][deployment.status] = timeline_data[date_key].get(deployment.status, 0) + 1
            
            data = [{"date": date, **counts} for date, counts in sorted(timeline_data.items())]
            return {"data": data, "type": "line"}

        elif data_source == "deployments/recent":
            limit = filters.get("limit", 10)
            deployments = self.db.query(Deployment).filter(
                Deployment.tenant_id == tenant_id
            ).order_by(Deployment.created_at.desc()).limit(limit).all()
            
            data = []
            for deployment in deployments:
                data.append({
                    "id": deployment.deployment_id,
                    "name": deployment.name,
                    "status": deployment.status,
                    "provider": deployment.provider,
                    "environment": deployment.environment.name if deployment.environment else "Unknown",
                    "template": deployment.template.name if deployment.template else "Unknown",
                    "created_at": deployment.created_at.isoformat()
                })
            
            return {"data": data, "type": "table"}

        elif data_source == "cloud-accounts/status":
            accounts = self.db.query(CloudAccount).filter(CloudAccount.tenant_id == tenant_id).all()
            
            data = []
            for account in accounts:
                data.append({
                    "id": account.account_id,
                    "name": account.name,
                    "provider": account.provider,
                    "status": account.status,
                    "created_at": account.created_at.isoformat()
                })
            
            return {"data": data, "type": "table"}

        elif data_source == "analytics/resource-usage":
            # This would require more complex analytics
            # For now, return mock data structure
            return {
                "data": [
                    {"provider": "Azure", "cpu": 75, "memory": 60, "storage": 45},
                    {"provider": "AWS", "cpu": 50, "memory": 80, "storage": 30},
                    {"provider": "GCP", "cpu": 30, "memory": 40, "storage": 60}
                ],
                "type": "bar"
            }

        elif data_source == "templates/usage":
            # Get template usage from deployments
            deployments = self.db.query(Deployment).filter(Deployment.tenant_id == tenant_id).all()
            template_counts = {}
            for deployment in deployments:
                template_name = deployment.template.name if deployment.template else "Unknown"
                template_counts[template_name] = template_counts.get(template_name, 0) + 1
            
            data = [{"name": template, "value": count} for template, count in template_counts.items()]
            return {"data": data, "type": "doughnut"}

        else:
            return {"error": f"Unknown data source: {data_source}"}

