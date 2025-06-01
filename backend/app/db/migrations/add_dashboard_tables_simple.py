"""
Simple database migration script to add dashboard tables.
This script creates the tables for the enhanced dashboard feature using raw SQL.
"""

import os
import sys
from sqlalchemy import create_engine, text

# Add the parent directory to the path so we can import our config
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings


def run_migration():
    """Run the dashboard tables migration using raw SQL"""
    
    # Create database engine
    engine = create_engine(settings.DATABASE_URL)
    
    print("Creating dashboard tables...")
    
    with engine.connect() as connection:
        # Create dashboards table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS dashboards (
                id SERIAL PRIMARY KEY,
                dashboard_id VARCHAR(36) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_default BOOLEAN DEFAULT FALSE,
                layout_config JSONB,
                is_active BOOLEAN DEFAULT TRUE,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_id VARCHAR(36) NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );
        """))
        
        # Create dashboard_widgets table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS dashboard_widgets (
                id SERIAL PRIMARY KEY,
                widget_id VARCHAR(36) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                widget_type VARCHAR(50) NOT NULL,
                category VARCHAR(50) NOT NULL,
                default_config JSONB,
                data_source VARCHAR(255),
                min_width INTEGER DEFAULT 1,
                min_height INTEGER DEFAULT 1,
                max_width INTEGER,
                max_height INTEGER,
                is_active BOOLEAN DEFAULT TRUE,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        # Create user_widgets table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS user_widgets (
                id SERIAL PRIMARY KEY,
                user_widget_id VARCHAR(36) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
                custom_name VARCHAR(255),
                position_x INTEGER DEFAULT 0,
                position_y INTEGER DEFAULT 0,
                width INTEGER DEFAULT 1,
                height INTEGER DEFAULT 1,
                custom_config JSONB,
                is_visible BOOLEAN DEFAULT TRUE,
                date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                dashboard_id VARCHAR(36) NOT NULL,
                widget_id VARCHAR(36) NOT NULL,
                FOREIGN KEY (dashboard_id) REFERENCES dashboards(dashboard_id) ON DELETE CASCADE,
                FOREIGN KEY (widget_id) REFERENCES dashboard_widgets(widget_id) ON DELETE CASCADE
            );
        """))
        
        # Create indexes
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_dashboards_is_active ON dashboards(is_active);"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_category ON dashboard_widgets(category);"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_widget_type ON dashboard_widgets(widget_type);"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_user_widgets_dashboard_id ON user_widgets(dashboard_id);"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_user_widgets_widget_id ON user_widgets(widget_id);"))
        
        connection.commit()
        
        print("Dashboard tables created successfully!")
        
        # Insert default widget templates
        print("Inserting default widget templates...")
        
        # Platform Statistics Widgets
        default_widgets = [
            {
                "name": "Total Deployments",
                "description": "Shows the total number of deployments across all environments",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/deployments/stats",
                "default_config": '{"chart_type": "number", "icon": "database", "color": "blue"}',
                "min_width": 1,
                "min_height": 1,
                "max_width": 2,
                "max_height": 1
            },
            {
                "name": "Running Deployments",
                "description": "Shows the number of currently running deployments",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/deployments/stats",
                "default_config": '{"chart_type": "number", "icon": "check-circle", "color": "green", "filter": "status:running"}',
                "min_width": 1,
                "min_height": 1,
                "max_width": 2,
                "max_height": 1
            },
            {
                "name": "Failed Deployments",
                "description": "Shows the number of failed deployments",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/deployments/stats",
                "default_config": '{"chart_type": "number", "icon": "alert-circle", "color": "red", "filter": "status:failed"}',
                "min_width": 1,
                "min_height": 1,
                "max_width": 2,
                "max_height": 1
            },
            {
                "name": "Cloud Accounts",
                "description": "Shows the total number of connected cloud accounts",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/cloud-accounts/stats",
                "default_config": '{"chart_type": "number", "icon": "cloud-cog", "color": "purple"}',
                "min_width": 1,
                "min_height": 1,
                "max_width": 2,
                "max_height": 1
            },
            {
                "name": "Templates",
                "description": "Shows the total number of available templates",
                "widget_type": "platform_stats",
                "category": "statistics",
                "data_source": "/api/templates/stats",
                "default_config": '{"chart_type": "number", "icon": "file-text", "color": "orange"}',
                "min_width": 1,
                "min_height": 1,
                "max_width": 2,
                "max_height": 1
            },
            
            # Visual Widgets
            {
                "name": "Deployments by Provider",
                "description": "Pie chart showing deployment distribution across cloud providers",
                "widget_type": "visual",
                "category": "charts",
                "data_source": "/api/deployments/by-provider",
                "default_config": '{"chart_type": "pie", "title": "Deployments by Provider"}',
                "min_width": 2,
                "min_height": 2,
                "max_width": 4,
                "max_height": 3
            },
            {
                "name": "Deployment Status Overview",
                "description": "Bar chart showing deployment status distribution",
                "widget_type": "visual",
                "category": "charts",
                "data_source": "/api/deployments/status-overview",
                "default_config": '{"chart_type": "bar", "title": "Deployment Status Overview"}',
                "min_width": 2,
                "min_height": 2,
                "max_width": 4,
                "max_height": 3
            },
            {
                "name": "Deployment Timeline",
                "description": "Line chart showing deployment activity over time",
                "widget_type": "visual",
                "category": "charts",
                "data_source": "/api/deployments/timeline",
                "default_config": '{"chart_type": "line", "title": "Deployment Timeline", "time_range": "30d"}',
                "min_width": 3,
                "min_height": 2,
                "max_width": 6,
                "max_height": 3
            },
            
            # Status and Monitoring Widgets
            {
                "name": "Recent Deployments",
                "description": "List of the most recent deployments",
                "widget_type": "status",
                "category": "monitoring",
                "data_source": "/api/deployments/recent",
                "default_config": '{"list_type": "deployments", "limit": 5, "show_status": true}',
                "min_width": 2,
                "min_height": 2,
                "max_width": 4,
                "max_height": 4
            },
            {
                "name": "Cloud Account Status",
                "description": "Status overview of connected cloud accounts",
                "widget_type": "status",
                "category": "monitoring",
                "data_source": "/api/cloud-accounts/status",
                "default_config": '{"list_type": "cloud_accounts", "show_health": true}',
                "min_width": 2,
                "min_height": 2,
                "max_width": 4,
                "max_height": 3
            },
            
            # Text-based Information Widgets
            {
                "name": "Welcome Message",
                "description": "Customizable welcome message widget",
                "widget_type": "text",
                "category": "information",
                "data_source": "static",
                "default_config": '{"text_type": "welcome", "title": "Welcome to your Dashboard", "content": "Manage your cloud infrastructure deployments from this centralized dashboard."}',
                "min_width": 2,
                "min_height": 1,
                "max_width": 6,
                "max_height": 2
            },
            {
                "name": "Quick Actions",
                "description": "Quick action buttons for common tasks",
                "widget_type": "text",
                "category": "information",
                "data_source": "static",
                "default_config": '{"text_type": "actions", "actions": [{"label": "New Deployment", "url": "/deployments/new"}, {"label": "Add Cloud Account", "url": "/cloud-accounts/new"}, {"label": "Browse Templates", "url": "/templates"}]}',
                "min_width": 2,
                "min_height": 1,
                "max_width": 3,
                "max_height": 2
            }
        ]
        
        for widget_data in default_widgets:
            # Check if widget already exists
            result = connection.execute(text(
                "SELECT COUNT(*) FROM dashboard_widgets WHERE name = :name"
            ), {"name": widget_data["name"]})
            
            if result.scalar() == 0:
                connection.execute(text("""
                    INSERT INTO dashboard_widgets (
                        name, description, widget_type, category, default_config, 
                        data_source, min_width, min_height, max_width, max_height
                    ) VALUES (
                        :name, :description, :widget_type, :category, :default_config,
                        :data_source, :min_width, :min_height, :max_width, :max_height
                    )
                """), widget_data)
        
        connection.commit()
        print(f"Inserted {len(default_widgets)} default widget templates!")
    
    print("Dashboard migration completed successfully!")


if __name__ == "__main__":
    run_migration()

