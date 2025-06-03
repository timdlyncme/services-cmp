"""
Database migration script to add dashboard tables.
This script creates the tables for the enhanced dashboard feature:
- dashboards: User-specific dashboard configurations
- dashboard_widgets: Catalog of available widget templates
- user_widgets: User-specific widget instances with customizations
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to the path so we can import our models
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings
from app.models.base_models import Base
# Import all models to ensure they are registered with SQLAlchemy
from app.models import *  # This imports all models including CloudSettings
from app.models.dashboard import Dashboard, DashboardWidget, UserWidget


def run_migration():
    """Run the dashboard tables migration"""
    
    # Create database engine
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    
    # Create all dashboard tables
    print("Creating dashboard tables...")
    
    # Create the tables
    Dashboard.__table__.create(engine, checkfirst=True)
    DashboardWidget.__table__.create(engine, checkfirst=True)
    UserWidget.__table__.create(engine, checkfirst=True)
    
    print("Dashboard tables created successfully!")
    
    # Insert default widget templates
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        print("Inserting default widget templates...")
        
        # Platform Statistics Widgets
        default_widgets = [
            {
                "name": "Total Deployments",
                "description": "Shows the total number of deployments across all environments",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/deployments/stats",
                "default_config": {
                    "chart_type": "number",
                    "icon": "database",
                    "color": "blue"
                },
                "min_width": 2,
                "min_height": 1,
                "max_width": 3,
                "max_height": 1
            },
            {
                "name": "Running Deployments",
                "description": "Shows the number of currently running deployments",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/deployments/stats",
                "default_config": {
                    "chart_type": "number",
                    "icon": "check-circle",
                    "color": "green",
                    "filter": "status:running"
                },
                "min_width": 2,
                "min_height": 1,
                "max_width": 3,
                "max_height": 1
            },
            {
                "name": "Failed Deployments",
                "description": "Shows the number of failed deployments",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/deployments/stats",
                "default_config": {
                    "chart_type": "number",
                    "icon": "alert-circle",
                    "color": "red",
                    "filter": "status:failed"
                },
                "min_width": 2,
                "min_height": 1,
                "max_width": 3,
                "max_height": 1
            },
            {
                "name": "Cloud Accounts",
                "description": "Shows the total number of connected cloud accounts",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/cloud-accounts/stats",
                "default_config": {
                    "chart_type": "number",
                    "icon": "cloud-cog",
                    "color": "purple"
                },
                "min_width": 2,
                "min_height": 1,
                "max_width": 3,
                "max_height": 1
            },
            {
                "name": "Templates",
                "description": "Shows the total number of available templates",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/templates/stats",
                "default_config": {
                    "chart_type": "number",
                    "icon": "file-text",
                    "color": "orange"
                },
                "min_width": 2,
                "min_height": 1,
                "max_width": 3,
                "max_height": 1
            },
            
            # Visual Widgets
            {
                "name": "Deployments by Provider",
                "description": "Pie chart showing deployment distribution across cloud providers",
                "widget_type": "visual",
                "category": "charts",
                "data_source": "/api/deployments/by-provider",
                "default_config": {
                    "chart_type": "pie",
                    "title": "Deployments by Provider"
                },
                "min_width": 3,
                "min_height": 3,
                "max_width": 4,
                "max_height": 4
            },
            {
                "name": "Deployment Status Overview",
                "description": "Bar chart showing deployment status distribution",
                "widget_type": "visual",
                "category": "charts",
                "data_source": "/api/deployments/status-overview",
                "default_config": {
                    "chart_type": "bar",
                    "title": "Deployment Status Overview"
                },
                "min_width": 3,
                "min_height": 3,
                "max_width": 4,
                "max_height": 4
            },
            {
                "name": "Deployment Timeline",
                "description": "Line chart showing deployment activity over time",
                "widget_type": "visual",
                "category": "charts",
                "data_source": "/api/deployments/timeline",
                "default_config": {
                    "chart_type": "line",
                    "title": "Deployment Timeline",
                    "time_range": "30d"
                },
                "min_width": 4,
                "min_height": 3,
                "max_width": 6,
                "max_height": 4
            },
            
            # Status and Monitoring Widgets
            {
                "name": "Recent Deployments",
                "description": "List of the most recent deployments",
                "widget_type": "status",
                "category": "monitoring",
                "data_source": "/api/deployments/recent",
                "default_config": {
                    "list_type": "deployments",
                    "limit": 5,
                    "show_status": True
                },
                "min_width": 3,
                "min_height": 3,
                "max_width": 4,
                "max_height": 6
            },
            {
                "name": "Cloud Account Status",
                "description": "Status overview of connected cloud accounts",
                "widget_type": "status",
                "category": "monitoring",
                "data_source": "/api/cloud-accounts/status",
                "default_config": {
                    "list_type": "cloud_accounts",
                    "show_health": True
                },
                "min_width": 3,
                "min_height": 3,
                "max_width": 4,
                "max_height": 6
            },
            
            # Text-based Information Widgets
            {
                "name": "Welcome Message",
                "description": "Customizable welcome message widget",
                "widget_type": "text",
                "category": "information",
                "data_source": "static",
                "default_config": {
                    "text_type": "welcome",
                    "title": "Welcome to your Dashboard",
                    "content": "Manage your cloud infrastructure deployments from this centralized dashboard."
                },
                "min_width": 3,
                "min_height": 2,
                "max_width": 6,
                "max_height": 3
            },
            {
                "name": "Quick Actions",
                "description": "Quick action buttons for common tasks",
                "widget_type": "text",
                "category": "information",
                "data_source": "static",
                "default_config": {
                    "text_type": "actions",
                    "actions": [
                        {"label": "New Deployment", "url": "/deployments/new"},
                        {"label": "Add Cloud Account", "url": "/cloud-accounts/new"},
                        {"label": "Browse Templates", "url": "/templates"}
                    ]
                },
                "min_width": 3,
                "min_height": 2,
                "max_width": 3,
                "max_height": 2
            },
            {
                "name": "Getting Started",
                "description": "Checklist to help first-time users get started with the platform",
                "widget_type": "getting_started",
                "category": "onboarding",
                "data_source": "/api/getting-started/status",
                "default_config": {
                    "show_progress": True,
                    "auto_hide_completed": False
                },
                "min_width": 3,
                "min_height": 6,
                "max_width": 4,
                "max_height": 6
            }
        ]
        
        for widget_data in default_widgets:
            # Check if widget already exists
            existing_widget = db.query(DashboardWidget).filter(
                DashboardWidget.name == widget_data["name"]
            ).first()
            
            if not existing_widget:
                widget = DashboardWidget(**widget_data)
                db.add(widget)
        
        db.commit()
        print(f"Inserted {len(default_widgets)} default widget templates!")
        
    except Exception as e:
        print(f"Error inserting default widgets: {e}")
        db.rollback()
    finally:
        db.close()
    
    print("Dashboard migration completed successfully!")


if __name__ == "__main__":
    run_migration()
