"""
Migration script to add date_created and date_modified columns to the tenants table.

This script adds the following columns to the tenants table:
- date_created: Timestamp when the tenant was created
- date_modified: Timestamp when the tenant was last modified
"""

from sqlalchemy import Column, DateTime, MetaData, Table, create_engine
from datetime import datetime

from app.core.config import settings

# Create a connection to the database
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
metadata = MetaData()

def upgrade():
    """Add date_created and date_modified columns to the tenants table."""
    # Connect to the database
    with engine.connect() as conn:
        # Add date_created column
        conn.execute(
            """
            ALTER TABLE tenants 
            ADD COLUMN IF NOT EXISTS date_created TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            """
        )
        
        # Add date_modified column
        conn.execute(
            """
            ALTER TABLE tenants 
            ADD COLUMN IF NOT EXISTS date_modified TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            """
        )
        
        # Update existing records to have date_created and date_modified values
        conn.execute(
            """
            UPDATE tenants 
            SET date_created = NOW(), date_modified = NOW() 
            WHERE date_created IS NULL OR date_modified IS NULL
            """
        )
        
        # Commit the transaction
        conn.commit()

def downgrade():
    """Remove date_created and date_modified columns from the tenants table."""
    # Connect to the database
    with engine.connect() as conn:
        # Remove date_modified column
        conn.execute(
            """
            ALTER TABLE tenants 
            DROP COLUMN IF EXISTS date_modified
            """
        )
        
        # Remove date_created column
        conn.execute(
            """
            ALTER TABLE tenants 
            DROP COLUMN IF EXISTS date_created
            """
        )
        
        # Commit the transaction
        conn.commit()

if __name__ == "__main__":
    upgrade()

