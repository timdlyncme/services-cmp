"""
Migration script to add Dashboard tables.

This script adds the following tables:
- dashboards: Stores dashboard configurations
- dashboard_widgets: Stores widget configurations for dashboards
- widget_types: Stores available widget types and their configurations
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, Text, ForeignKey, MetaData, Table, create_engine
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from app.core.config import settings

# Create a connection to the database
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
metadata = MetaData()

def generate_uuid():
    """Generate a UUID string for use as an ID"""
    return str(uuid.uuid4())

# Define the tables
dashboards = Table(
    "dashboards",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("dashboard_id", UUID(as_uuid=False), unique=True, index=True, default=generate_uuid),
    Column("name", String, nullable=False),
    Column("description", Text, nullable=True),
    Column("is_default", Boolean, default=False),
    Column("is_active", Boolean, default=True),
    Column("layout_config", JSON, nullable=True),
    Column("created_at", DateTime, default=datetime.utcnow),
    Column("updated_at", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    Column("tenant_id", UUID(as_uuid=False), ForeignKey("tenants.tenant_id"), nullable=False),
    Column("created_by_id", UUID(as_uuid=False), ForeignKey("users.user_id"), nullable=False),
)

dashboard_widgets = Table(
    "dashboard_widgets",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("widget_id", UUID(as_uuid=False), unique=True, index=True, default=generate_uuid),
    Column("title", String, nullable=False),
    Column("widget_type", String, nullable=False),
    Column("data_source", String, nullable=False),
    Column("configuration", JSON, nullable=True),
    Column("position_x", Integer, default=0),
    Column("position_y", Integer, default=0),
    Column("width", Integer, default=1),
    Column("height", Integer, default=1),
    Column("is_active", Boolean, default=True),
    Column("refresh_interval", Integer, default=300),
    Column("created_at", DateTime, default=datetime.utcnow),
    Column("updated_at", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    Column("dashboard_id", UUID(as_uuid=False), ForeignKey("dashboards.dashboard_id"), nullable=False),
)

widget_types = Table(
    "widget_types",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("type_name", String, unique=True, nullable=False),
    Column("display_name", String, nullable=False),
    Column("description", Text, nullable=True),
    Column("icon", String, nullable=True),
    Column("category", String, nullable=True),
    Column("default_config", JSON, nullable=True),
    Column("data_sources", JSON, nullable=True),
    Column("is_active", Boolean, default=True),
    Column("created_at", DateTime, default=datetime.utcnow),
    Column("updated_at", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)

def upgrade():
    """Create the dashboard tables"""
    print("Creating dashboard tables...")
    
    # Create all tables
    metadata.create_all(engine)
    
    # Insert default widget types
    with engine.connect() as conn:
        # Insert default widget types
        widget_types_data = [
            {
                "type_name": "metric",
                "display_name": "Metric Card",
                "description": "Display a single metric with optional comparison",
                "icon": "BarChart3",
                "category": "metrics",
                "default_config": {
                    "show_trend": True,
                    "show_comparison": False,
                    "format": "number"
                },
                "data_sources": ["deployments", "cloud_accounts", "templates", "environments"]
            },
            {
                "type_name": "chart",
                "display_name": "Chart",
                "description": "Display data in various chart formats",
                "icon": "PieChart",
                "category": "charts",
                "default_config": {
                    "chart_type": "pie",
                    "show_legend": True,
                    "show_labels": True
                },
                "data_sources": ["deployments", "cloud_accounts", "templates"]
            },
            {
                "type_name": "list",
                "display_name": "Data List",
                "description": "Display data in a list format",
                "icon": "List",
                "category": "data",
                "default_config": {
                    "max_items": 10,
                    "show_status": True,
                    "show_dates": True
                },
                "data_sources": ["deployments", "cloud_accounts", "templates", "environments"]
            },
            {
                "type_name": "table",
                "display_name": "Data Table",
                "description": "Display data in a table format with sorting and filtering",
                "icon": "Table",
                "category": "data",
                "default_config": {
                    "sortable": True,
                    "filterable": True,
                    "paginated": True,
                    "page_size": 10
                },
                "data_sources": ["deployments", "cloud_accounts", "templates", "environments"]
            },
            {
                "type_name": "status",
                "display_name": "Status Overview",
                "description": "Display status information with color coding",
                "icon": "Activity",
                "category": "metrics",
                "default_config": {
                    "show_counts": True,
                    "show_percentages": True,
                    "color_coding": True
                },
                "data_sources": ["deployments", "cloud_accounts"]
            }
        ]
        
        for widget_type in widget_types_data:
            conn.execute(widget_types.insert().values(**widget_type))
        
        conn.commit()
    
    print("Dashboard tables created successfully!")

def downgrade():
    """Drop the dashboard tables"""
    print("Dropping dashboard tables...")
    
    # Drop tables in reverse order due to foreign key constraints
    with engine.connect() as conn:
        conn.execute("DROP TABLE IF EXISTS dashboard_widgets CASCADE")
        conn.execute("DROP TABLE IF EXISTS dashboards CASCADE")
        conn.execute("DROP TABLE IF EXISTS widget_types CASCADE")
        conn.commit()
    
    print("Dashboard tables dropped successfully!")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()

