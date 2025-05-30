"""
Migration script to add NexusAI tables.

This script adds the following tables:
- nexus_ai_config: Stores the NexusAI configuration
- nexus_ai_logs: Stores the NexusAI logs
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, MetaData, Table, create_engine
from datetime import datetime

from app.core.config import settings

# Create a connection to the database
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
metadata = MetaData()

# Define the tables
nexus_ai_config = Table(
    "nexus_ai_config",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("api_key", String, nullable=True),
    Column("endpoint", String, nullable=True),
    Column("deployment_name", String, nullable=True),
    Column("api_version", String, default="2023-05-15"),
    Column("created_at", DateTime, default=datetime.utcnow),
    Column("updated_at", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    Column("last_status", String, default="disconnected"),
    Column("last_checked", DateTime, nullable=True),
    Column("last_error", String, nullable=True),
)

nexus_ai_logs = Table(
    "nexus_ai_logs",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("timestamp", DateTime, default=datetime.utcnow),
    Column("level", String, default="info"),
    Column("message", String),
    Column("details", JSON, nullable=True),
)

def upgrade():
    """Create the tables."""
    # Create the tables
    nexus_ai_config.create(engine, checkfirst=True)
    nexus_ai_logs.create(engine, checkfirst=True)
    
    # Initialize the config table with default values if it's empty
    with engine.connect() as conn:
        # Check if the config table is empty
        result = conn.execute("SELECT COUNT(*) FROM nexus_ai_config")
        count = result.scalar()
        
        if count == 0:
            # Insert default values
            conn.execute(
                nexus_ai_config.insert().values(
                    api_key=None,
                    endpoint=None,
                    deployment_name=None,
                    api_version="2023-05-15",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    last_status="disconnected",
                    last_checked=None,
                    last_error=None,
                )
            )
            
            # Commit the transaction
            conn.commit()

def downgrade():
    """Drop the tables."""
    # Drop the tables
    nexus_ai_logs.drop(engine, checkfirst=True)
    nexus_ai_config.drop(engine, checkfirst=True)

if __name__ == "__main__":
    upgrade()

