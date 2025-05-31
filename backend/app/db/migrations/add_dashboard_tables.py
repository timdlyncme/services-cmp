"""
Database migration to add dashboard tables for customizable dashboard widgets.

This migration adds three new tables:
1. dashboards - User-specific dashboards (not tenant-specific)
2. dashboard_widgets - Available widget types and configurations
3. user_widgets - User customizations and widget placements
"""

from sqlalchemy import text
from app.db.session import engine


def upgrade():
    """Add dashboard tables"""
    with engine.connect() as connection:
        # Create dashboards table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS dashboards (
                id SERIAL PRIMARY KEY,
                dashboard_id UUID UNIQUE NOT NULL,
                name VARCHAR NOT NULL,
                description VARCHAR,
                is_default BOOLEAN DEFAULT FALSE,
                layout_config JSONB,
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
                widget_type VARCHAR NOT NULL,
                category VARCHAR NOT NULL,
                default_config JSONB,
                data_source VARCHAR NOT NULL,
                refresh_interval INTEGER DEFAULT 300,
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
                position_x INTEGER DEFAULT 0,
                position_y INTEGER DEFAULT 0,
                width INTEGER DEFAULT 4,
                height INTEGER DEFAULT 4,
                custom_title VARCHAR,
                custom_config JSONB,
                is_visible BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
                dashboard_widget_id INTEGER NOT NULL REFERENCES dashboard_widgets(id) ON DELETE CASCADE
            );
        """))
        
        # Create indexes for better performance
        connection.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);
            CREATE INDEX IF NOT EXISTS idx_dashboards_dashboard_id ON dashboards(dashboard_id);
            CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_widget_id ON dashboard_widgets(widget_id);
            CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_category ON dashboard_widgets(category);
            CREATE INDEX IF NOT EXISTS idx_user_widgets_dashboard_id ON user_widgets(dashboard_id);
            CREATE INDEX IF NOT EXISTS idx_user_widgets_user_widget_id ON user_widgets(user_widget_id);
        """))
        
        # Insert default dashboard widgets
        connection.execute(text("""
            INSERT INTO dashboard_widgets (widget_id, name, description, widget_type, category, default_config, data_source, refresh_interval) VALUES
            (gen_random_uuid(), 'Total Deployments', 'Shows total number of deployments across all cloud providers', 'card', 'deployments', '{"icon": "Database", "color": "blue"}', '/api/deployments/stats', 300),
            (gen_random_uuid(), 'Running Deployments', 'Shows number of currently running deployments', 'card', 'deployments', '{"icon": "CheckCircle2", "color": "green"}', '/api/deployments/stats', 300),
            (gen_random_uuid(), 'Failed Deployments', 'Shows number of failed deployments requiring attention', 'card', 'deployments', '{"icon": "AlertCircle", "color": "red"}', '/api/deployments/stats', 300),
            (gen_random_uuid(), 'Cloud Accounts', 'Shows connected cloud provider accounts', 'card', 'cloud_accounts', '{"icon": "CloudCog", "color": "purple"}', '/api/cloud-accounts/stats', 300),
            (gen_random_uuid(), 'Recent Deployments', 'List of most recent infrastructure deployments', 'list', 'deployments', '{"limit": 5, "showStatus": true}', '/api/deployments/recent', 180),
            (gen_random_uuid(), 'Deployments by Provider', 'Chart showing deployment distribution across cloud providers', 'chart', 'deployments', '{"chartType": "pie", "colors": ["#3b82f6", "#f59e0b", "#10b981"]}', '/api/deployments/by-provider', 300),
            (gen_random_uuid(), 'Cloud Account Status', 'Chart showing cloud account connection status', 'chart', 'cloud_accounts', '{"chartType": "doughnut", "colors": ["#10b981", "#f59e0b", "#ef4444"]}', '/api/cloud-accounts/status', 300),
            (gen_random_uuid(), 'Templates Overview', 'Shows available templates by category', 'card', 'templates', '{"icon": "FileText", "color": "indigo"}', '/api/templates/stats', 300),
            (gen_random_uuid(), 'Deployment Timeline', 'Timeline chart of deployments over time', 'chart', 'deployments', '{"chartType": "line", "timeRange": "30d"}', '/api/deployments/timeline', 300),
            (gen_random_uuid(), 'Resource Usage', 'Shows resource usage across deployments', 'chart', 'resources', '{"chartType": "bar", "metrics": ["cpu", "memory", "storage"]}', '/api/resources/usage', 600)
            ON CONFLICT (widget_id) DO NOTHING;
        """))
        
        connection.commit()
        print("Dashboard tables created successfully!")


def downgrade():
    """Remove dashboard tables"""
    with engine.connect() as connection:
        connection.execute(text("DROP TABLE IF EXISTS user_widgets CASCADE;"))
        connection.execute(text("DROP TABLE IF EXISTS dashboard_widgets CASCADE;"))
        connection.execute(text("DROP TABLE IF EXISTS dashboards CASCADE;"))
        connection.commit()
        print("Dashboard tables removed successfully!")


if __name__ == "__main__":
    upgrade()

