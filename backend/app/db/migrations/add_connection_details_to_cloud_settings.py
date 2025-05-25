"""
Migration script to add connection_details JSON column to cloud_settings table
and migrate existing credentials to the new structure.
"""

from sqlalchemy import Column, JSON, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session
from app.db.session import engine

Base = declarative_base()

def migrate():
    """
    Add connection_details JSON column to cloud_settings table and
    migrate existing credentials to the new structure.
    """
    # Add connection_details column
    with engine.connect() as connection:
        # Check if column already exists
        result = connection.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='cloud_settings' AND column_name='connection_details'"
        ))
        if not result.fetchone():
            # Add the column if it doesn't exist
            connection.execute(text(
                "ALTER TABLE cloud_settings ADD COLUMN connection_details JSONB"
            ))
            print("Added connection_details column to cloud_settings table")
            
            # Migrate existing data
            connection.execute(text(
                """
                UPDATE cloud_settings 
                SET connection_details = jsonb_build_object(
                    'client_id', client_id,
                    'client_secret', client_secret,
                    'tenant_id', tenant_id,
                    'subscription_id', subscription_id
                )
                WHERE client_id IS NOT NULL OR client_secret IS NOT NULL OR tenant_id IS NOT NULL
                """
            ))
            print("Migrated existing credentials to connection_details")
        else:
            print("connection_details column already exists in cloud_settings table")

if __name__ == "__main__":
    migrate()

