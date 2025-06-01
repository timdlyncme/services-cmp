"""
Migration script to add dashboard-related tables
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime


def get_db_connection():
    """Get database connection using environment variables"""
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "services_cmp"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password"),
        port=os.getenv("DB_PORT", "5432")
    )


def create_dashboard_tables():
    """Create dashboard-related tables"""
    
    # SQL statements to create the tables
    create_dashboards_table = """
    CREATE TABLE IF NOT EXISTS dashboards (
        id SERIAL PRIMARY KEY,
        dashboard_id UUID UNIQUE NOT NULL,
        name VARCHAR NOT NULL,
        description TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        layout JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
    );
    """
    
    create_dashboard_widgets_table = """
    CREATE TABLE IF NOT EXISTS dashboard_widgets (
        id SERIAL PRIMARY KEY,
        widget_id UUID UNIQUE NOT NULL,
        name VARCHAR NOT NULL,
        description TEXT,
        widget_type VARCHAR NOT NULL,
        category VARCHAR NOT NULL,
        default_config JSONB,
        data_source VARCHAR NOT NULL,
        chart_type VARCHAR,
        min_width INTEGER DEFAULT 1,
        min_height INTEGER DEFAULT 1,
        default_width INTEGER DEFAULT 2,
        default_height INTEGER DEFAULT 2,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    create_user_widgets_table = """
    CREATE TABLE IF NOT EXISTS user_widgets (
        id SERIAL PRIMARY KEY,
        user_widget_id UUID UNIQUE NOT NULL,
        custom_name VARCHAR,
        position_x INTEGER NOT NULL DEFAULT 0,
        position_y INTEGER NOT NULL DEFAULT 0,
        width INTEGER NOT NULL DEFAULT 2,
        height INTEGER NOT NULL DEFAULT 2,
        custom_config JSONB,
        is_visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dashboard_id UUID NOT NULL REFERENCES dashboards(dashboard_id) ON DELETE CASCADE,
        widget_id UUID NOT NULL REFERENCES dashboard_widgets(widget_id) ON DELETE CASCADE
    );
    """
    
    # Create indexes for better performance
    create_indexes = [
        "CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);",
        "CREATE INDEX IF NOT EXISTS idx_dashboards_dashboard_id ON dashboards(dashboard_id);",
        "CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_widget_id ON dashboard_widgets(widget_id);",
        "CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_category ON dashboard_widgets(category);",
        "CREATE INDEX IF NOT EXISTS idx_user_widgets_dashboard_id ON user_widgets(dashboard_id);",
        "CREATE INDEX IF NOT EXISTS idx_user_widgets_widget_id ON user_widgets(widget_id);",
        "CREATE INDEX IF NOT EXISTS idx_user_widgets_user_widget_id ON user_widgets(user_widget_id);"
    ]
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        print("Creating dashboard tables...")
        
        # Create tables
        cursor.execute(create_dashboards_table)
        print("✓ Created dashboards table")
        
        cursor.execute(create_dashboard_widgets_table)
        print("✓ Created dashboard_widgets table")
        
        cursor.execute(create_user_widgets_table)
        print("✓ Created user_widgets table")
        
        # Create indexes
        for index_sql in create_indexes:
            cursor.execute(index_sql)
        print("✓ Created indexes")
        
        conn.commit()
        print("✓ Dashboard tables migration completed successfully!")
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Error creating dashboard tables: {e}")
        raise
    finally:
        if conn:
            cursor.close()
            conn.close()


def seed_default_widgets():
    """Seed the dashboard_widgets table with default widgets"""
    
    default_widgets = [
        {
            'widget_id': 'gen_uuid()',
            'name': 'Total Deployments',
            'description': 'Shows the total number of deployments across all environments',
            'widget_type': 'stat_card',
            'category': 'deployments',
            'default_config': '{"icon": "database", "color": "blue"}',
            'data_source': 'deployments/stats/total',
            'chart_type': None,
            'min_width': 1,
            'min_height': 1,
            'default_width': 2,
            'default_height': 1
        },
        {
            'widget_id': 'gen_uuid()',
            'name': 'Running Deployments',
            'description': 'Shows the number of currently running deployments',
            'widget_type': 'stat_card',
            'category': 'deployments',
            'default_config': '{"icon": "check-circle", "color": "green"}',
            'data_source': 'deployments/stats/running',
            'chart_type': None,
            'min_width': 1,
            'min_height': 1,
            'default_width': 2,
            'default_height': 1
        },
        {
            'widget_id': 'gen_uuid()',
            'name': 'Failed Deployments',
            'description': 'Shows the number of failed deployments',
            'widget_type': 'stat_card',
            'category': 'deployments',
            'default_config': '{"icon": "alert-circle", "color": "red"}',
            'data_source': 'deployments/stats/failed',
            'chart_type': None,
            'min_width': 1,
            'min_height': 1,
            'default_width': 2,
            'default_height': 1
        },
        {
            'widget_id': 'gen_uuid()',
            'name': 'Cloud Accounts',
            'description': 'Shows the total number of connected cloud accounts',
            'widget_type': 'stat_card',
            'category': 'cloud_accounts',
            'default_config': '{"icon": "cloud", "color": "purple"}',
            'data_source': 'cloud-accounts/stats/total',
            'chart_type': None,
            'min_width': 1,
            'min_height': 1,
            'default_width': 2,
            'default_height': 1
        },
        {
            'widget_id': 'gen_uuid()',
            'name': 'Deployments by Provider',
            'description': 'Chart showing deployment distribution across cloud providers',
            'widget_type': 'chart',
            'category': 'deployments',
            'default_config': '{"showLegend": true, "showTooltip": true}',
            'data_source': 'deployments/stats/by-provider',
            'chart_type': 'pie',
            'min_width': 2,
            'min_height': 2,
            'default_width': 3,
            'default_height': 2
        },
        {
            'widget_id': 'gen_uuid()',
            'name': 'Deployment Status Over Time',
            'description': 'Line chart showing deployment status trends over time',
            'widget_type': 'chart',
            'category': 'deployments',
            'default_config': '{"showLegend": true, "showTooltip": true, "timeRange": "30d"}',
            'data_source': 'deployments/stats/timeline',
            'chart_type': 'line',
            'min_width': 3,
            'min_height': 2,
            'default_width': 4,
            'default_height': 2
        },
        {
            'widget_id': 'gen_uuid()',
            'name': 'Recent Deployments',
            'description': 'Table showing the most recent deployments',
            'widget_type': 'table',
            'category': 'deployments',
            'default_config': '{"limit": 10, "showStatus": true}',
            'data_source': 'deployments/recent',
            'chart_type': None,
            'min_width': 3,
            'min_height': 2,
            'default_width': 4,
            'default_height': 3
        },
        {
            'widget_id': 'gen_uuid()',
            'name': 'Cloud Account Status',
            'description': 'Chart showing cloud account status distribution',
            'widget_type': 'chart',
            'category': 'cloud_accounts',
            'default_config': '{"showLegend": true, "showTooltip": true}',
            'data_source': 'cloud-accounts/stats/status',
            'chart_type': 'doughnut',
            'min_width': 2,
            'min_height': 2,
            'default_width': 3,
            'default_height': 2
        }
    ]
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        print("Seeding default widgets...")
        
        # First, check if widgets already exist
        cursor.execute("SELECT COUNT(*) FROM dashboard_widgets")
        count = cursor.fetchone()[0]
        
        if count > 0:
            print(f"✓ Dashboard widgets already exist ({count} widgets found)")
            return
        
        # Insert default widgets
        for widget in default_widgets:
            insert_sql = """
            INSERT INTO dashboard_widgets (
                widget_id, name, description, widget_type, category, 
                default_config, data_source, chart_type, min_width, 
                min_height, default_width, default_height
            ) VALUES (
                gen_random_uuid(), %(name)s, %(description)s, %(widget_type)s, 
                %(category)s, %(default_config)s::jsonb, %(data_source)s, 
                %(chart_type)s, %(min_width)s, %(min_height)s, 
                %(default_width)s, %(default_height)s
            )
            """
            cursor.execute(insert_sql, widget)
        
        conn.commit()
        print(f"✓ Seeded {len(default_widgets)} default widgets")
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Error seeding default widgets: {e}")
        raise
    finally:
        if conn:
            cursor.close()
            conn.close()


if __name__ == "__main__":
    print("Starting dashboard tables migration...")
    create_dashboard_tables()
    seed_default_widgets()
    print("✅ Migration completed successfully!")

