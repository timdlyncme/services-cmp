"""
Add dashboard tables migration.

This migration creates the tables for the enhanced dashboard functionality:
- dashboards: User-specific dashboards
- dashboard_widgets: Widget catalog/templates
- user_widgets: User customizations of widgets
"""

import os
import sys
from sqlalchemy import create_engine, text

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cmpuser:cmppassword@localhost:5432/cmpdb")
engine = create_engine(DATABASE_URL)


def upgrade():
    """Create dashboard tables."""
    with engine.connect() as connection:
        # Create dashboards table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS dashboards (
                id SERIAL PRIMARY KEY,
                dashboard_id UUID UNIQUE NOT NULL,
                name VARCHAR NOT NULL,
                description VARCHAR,
                is_default BOOLEAN DEFAULT FALSE,
                layout JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
            );
        """))
        
        # Create dashboard_widgets table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS dashboard_widgets (
                id SERIAL PRIMARY KEY,
                widget_id UUID UNIQUE NOT NULL,
                name VARCHAR NOT NULL,
                description VARCHAR,
                category VARCHAR,
                widget_type VARCHAR NOT NULL,
                chart_type VARCHAR,
                data_source VARCHAR NOT NULL,
                default_config JSONB,
                default_size JSONB,
                icon VARCHAR,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        # Create user_widgets table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS user_widgets (
                id SERIAL PRIMARY KEY,
                user_widget_id UUID UNIQUE NOT NULL,
                custom_name VARCHAR,
                custom_config JSONB,
                position JSONB,
                color_scheme VARCHAR,
                filters JSONB,
                is_visible BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
                widget_id INTEGER NOT NULL REFERENCES dashboard_widgets(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
            );
        """))
        
        # Create indexes
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);
            CREATE INDEX IF NOT EXISTS idx_dashboards_dashboard_id ON dashboards(dashboard_id);
            CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_widget_id ON dashboard_widgets(widget_id);
            CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_category ON dashboard_widgets(category);
            CREATE INDEX IF NOT EXISTS idx_user_widgets_dashboard_id ON user_widgets(dashboard_id);
            CREATE INDEX IF NOT EXISTS idx_user_widgets_user_id ON user_widgets(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_widgets_widget_id ON user_widgets(widget_id);
        """))
        
        # Insert default dashboard widgets
        connection.execute(text("""
            INSERT INTO dashboard_widgets (widget_id, name, description, category, widget_type, chart_type, data_source, default_config, default_size, icon, is_active)
            VALUES 
                (gen_random_uuid(), 'Total Deployments', 'Shows the total number of deployments', 'deployments', 'card', NULL, 'deployments/count', '{"showPercentage": false}', '{"w": 3, "h": 2}', 'Database', TRUE),
                (gen_random_uuid(), 'Running Deployments', 'Shows the number of running deployments', 'deployments', 'card', NULL, 'deployments/running', '{"showPercentage": true}', '{"w": 3, "h": 2}', 'CheckCircle2', TRUE),
                (gen_random_uuid(), 'Failed Deployments', 'Shows the number of failed deployments', 'deployments', 'card', NULL, 'deployments/failed', '{"showPercentage": false}', '{"w": 3, "h": 2}', 'AlertCircle', TRUE),
                (gen_random_uuid(), 'Cloud Accounts', 'Shows connected cloud accounts', 'cloud', 'card', NULL, 'cloud-accounts/count', '{"showStatus": true}', '{"w": 3, "h": 2}', 'CloudCog', TRUE),
                (gen_random_uuid(), 'Deployments by Provider', 'Chart showing deployments by cloud provider', 'deployments', 'chart', 'pie', 'deployments/by-provider', '{"showLegend": true}', '{"w": 6, "h": 4}', 'PieChart', TRUE),
                (gen_random_uuid(), 'Deployment Status Timeline', 'Timeline chart of deployment statuses', 'deployments', 'chart', 'line', 'deployments/timeline', '{"timeRange": "7d"}', '{"w": 8, "h": 4}', 'TrendingUp', TRUE),
                (gen_random_uuid(), 'Recent Deployments', 'Table of recent deployments', 'deployments', 'table', NULL, 'deployments/recent', '{"limit": 10}', '{"w": 12, "h": 6}', 'List', TRUE),
                (gen_random_uuid(), 'Cloud Provider Status', 'Status overview of cloud providers', 'cloud', 'table', NULL, 'cloud-accounts/status', '{"showDetails": true}', '{"w": 8, "h": 4}', 'Server', TRUE),
                (gen_random_uuid(), 'Resource Usage', 'Chart showing resource usage across deployments', 'analytics', 'chart', 'bar', 'analytics/resource-usage', '{"groupBy": "provider"}', '{"w": 6, "h": 4}', 'BarChart3', TRUE),
                (gen_random_uuid(), 'Templates Usage', 'Most used templates', 'templates', 'chart', 'doughnut', 'templates/usage', '{"showCount": true}', '{"w": 4, "h": 4}', 'FileText', TRUE)
            ON CONFLICT (widget_id) DO NOTHING;
        """))
        
        connection.commit()
        print("Dashboard tables created successfully!")


def downgrade():
    """Drop dashboard tables."""
    with engine.connect() as connection:
        connection.execute(text("DROP TABLE IF EXISTS user_widgets CASCADE;"))
        connection.execute(text("DROP TABLE IF EXISTS dashboard_widgets CASCADE;"))
        connection.execute(text("DROP TABLE IF EXISTS dashboards CASCADE;"))
        connection.commit()
        print("Dashboard tables dropped successfully!")


if __name__ == "__main__":
    upgrade()
