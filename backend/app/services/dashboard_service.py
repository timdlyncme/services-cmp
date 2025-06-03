"""
Dashboard service for handling default dashboard creation and management.
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.dashboard import Dashboard, DashboardWidget, UserWidget
from app.models.user import User


class DefaultDashboardConfig:
    """Configuration for default dashboard creation"""
    
    # Default dashboard metadata
    DASHBOARD_NAME = "My Dashboard"
    DASHBOARD_DESCRIPTION = "Your personalized dashboard with essential widgets to get you started"
    
    # Default widgets configuration with their positions and sizes
    DEFAULT_WIDGETS = [
        {
            "widget_name": "Welcome Message",
            "position_x": 0,
            "position_y": 0,
            "width": 6,
            "height": 2,
            "custom_config": {
                "text_type": "welcome",
                "title": "Welcome to Your Dashboard",
                "content": "Welcome to your cloud management platform! This dashboard provides an overview of your infrastructure and deployments. Use the widgets below to monitor your resources and get started with key tasks."
            }
        },
        {
            "widget_name": "Getting Started",
            "position_x": 6,
            "position_y": 0,
            "width": 3,
            "height": 6,
            "custom_config": {
                "show_progress": True,
                "auto_hide_completed": False
            }
        },
        {
            "widget_name": "Total Deployments",
            "position_x": 0,
            "position_y": 2,
            "width": 2,
            "height": 1,
            "custom_config": None
        },
        {
            "widget_name": "Running Deployments",
            "position_x": 2,
            "position_y": 2,
            "width": 2,
            "height": 1,
            "custom_config": None
        },
        {
            "widget_name": "Cloud Accounts",
            "position_x": 4,
            "position_y": 2,
            "width": 2,
            "height": 1,
            "custom_config": None
        },
        {
            "widget_name": "Quick Actions",
            "position_x": 0,
            "position_y": 3,
            "width": 3,
            "height": 2,
            "custom_config": {
                "text_type": "actions",
                "actions": [
                    {"label": "New Deployment", "url": "/deployments/new"},
                    {"label": "Add Cloud Account", "url": "/cloud-accounts/new"},
                    {"label": "Browse Templates", "url": "/templates"}
                ]
            }
        },
        {
            "widget_name": "Recent Deployments",
            "position_x": 3,
            "position_y": 3,
            "width": 3,
            "height": 3,
            "custom_config": {
                "list_type": "deployments",
                "limit": 5,
                "show_status": True
            }
        }
    ]


def create_default_dashboard(db: Session, user: User) -> Dashboard:
    """
    Create a default dashboard for a first-time user.
    
    Args:
        db: Database session
        user: User object for whom to create the dashboard
        
    Returns:
        Dashboard: The newly created default dashboard
        
    Raises:
        Exception: If dashboard creation fails
    """
    try:
        # Create the dashboard
        dashboard = Dashboard(
            name=DefaultDashboardConfig.DASHBOARD_NAME,
            description=DefaultDashboardConfig.DASHBOARD_DESCRIPTION,
            is_default=True,
            user_id=user.user_id,
            layout_config={}  # Will be populated with grid layout
        )
        
        db.add(dashboard)
        db.flush()  # Flush to get the dashboard_id
        
        # Get available widget templates
        widget_templates = {}
        for widget_config in DefaultDashboardConfig.DEFAULT_WIDGETS:
            widget_name = widget_config["widget_name"]
            template = db.query(DashboardWidget).filter(
                and_(
                    DashboardWidget.name == widget_name,
                    DashboardWidget.is_active == True
                )
            ).first()
            
            if template:
                widget_templates[widget_name] = template
            else:
                print(f"Warning: Widget template '{widget_name}' not found, skipping...")
        
        # Create user widgets for the dashboard
        created_widgets = []
        for widget_config in DefaultDashboardConfig.DEFAULT_WIDGETS:
            widget_name = widget_config["widget_name"]
            template = widget_templates.get(widget_name)
            
            if template:
                # Merge custom config with template default config
                final_config = template.default_config.copy() if template.default_config else {}
                if widget_config["custom_config"]:
                    final_config.update(widget_config["custom_config"])
                
                user_widget = UserWidget(
                    dashboard_id=dashboard.dashboard_id,
                    widget_id=template.widget_id,
                    position_x=widget_config["position_x"],
                    position_y=widget_config["position_y"],
                    width=widget_config["width"],
                    height=widget_config["height"],
                    custom_config=final_config if final_config else None,
                    is_visible=True
                )
                
                db.add(user_widget)
                created_widgets.append(user_widget)
        
        # Commit all changes
        db.commit()
        db.refresh(dashboard)
        
        print(f"✅ Created default dashboard '{dashboard.name}' for user {user.username} with {len(created_widgets)} widgets")
        return dashboard
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating default dashboard for user {user.username}: {str(e)}")
        raise


def should_create_default_dashboard(db: Session, user: User) -> bool:
    """
    Check if a default dashboard should be created for the user.
    
    Args:
        db: Database session
        user: User object to check
        
    Returns:
        bool: True if a default dashboard should be created
    """
    # Check if user has any active dashboards
    existing_dashboards = db.query(Dashboard).filter(
        and_(
            Dashboard.user_id == user.user_id,
            Dashboard.is_active == True
        )
    ).count()
    
    return existing_dashboards == 0


def get_or_create_default_dashboard(db: Session, user: User) -> List[Dashboard]:
    """
    Get user's dashboards, creating a default one if none exist.
    
    Args:
        db: Database session
        user: User object
        
    Returns:
        List[Dashboard]: List of user's dashboards (including newly created default if applicable)
    """
    # Get existing dashboards
    dashboards = db.query(Dashboard).filter(
        and_(
            Dashboard.user_id == user.user_id,
            Dashboard.is_active == True
        )
    ).order_by(Dashboard.is_default.desc(), Dashboard.date_created.asc()).all()
    
    # If no dashboards exist, create a default one
    if not dashboards:
        try:
            default_dashboard = create_default_dashboard(db, user)
            dashboards = [default_dashboard]
        except Exception as e:
            print(f"Failed to create default dashboard for user {user.username}: {str(e)}")
            # Return empty list if creation fails - user will see empty state
            dashboards = []
    
    return dashboards
