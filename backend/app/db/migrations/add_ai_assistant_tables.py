"""
Migration script to add AI Assistant tables.

This script adds the following tables:
- ai_assistant_config: Stores the AI Assistant configuration
- ai_assistant_logs: Stores the AI Assistant logs
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, MetaData, Table, create_engine
from datetime import datetime

from app.core.config import settings

# Create a connection to the database
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
metadata = MetaData()

# Define the tables
ai_assistant_config = Table(
    "ai_assistant_config",
    metadata,
    Column("id", Integer, primary_key=True, index=True),
    Column("api_key", String, nullable=True),
    Column("endpoint", String, nullable=True),
    Column("deployment_name", String, nullable=True),
    Column("model", String, default="gpt-4"),
    Column("api_version", String, default="2023-05-15"),
    Column("created_at", DateTime, default=datetime.utcnow),
    Column("updated_at", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
    Column("last_status", String, default="disconnected"),
    Column("last_checked", DateTime, nullable=True),
    Column("last_error", String, nullable=True),
)

ai_assistant_logs = Table(
    "ai_assistant_logs",
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
    ai_assistant_config.create(engine, checkfirst=True)
    ai_assistant_logs.create(engine, checkfirst=True)
    
    # Initialize the config table with default values if it's empty
    with engine.connect() as conn:
        # Check if the config table is empty
        from sqlalchemy import text
        result = conn.execute(text("SELECT COUNT(*) FROM ai_assistant_config"))
        count = result.scalar()
        
        if count == 0:
            # Insert default values
            conn.execute(
                ai_assistant_config.insert().values(
                    api_key=None,
                    endpoint=None,
                    deployment_name=None,
                    model="gpt-4",
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
    ai_assistant_logs.drop(engine, checkfirst=True)
    ai_assistant_config.drop(engine, checkfirst=True)

if __name__ == "__main__":
    upgrade()
