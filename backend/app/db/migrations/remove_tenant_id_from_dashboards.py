"""
Migration: Remove tenant_id from dashboards table
Date: 2025-05-31
Description: Remove tenant_id column from dashboards table to scope dashboards to users instead of tenants
"""

import logging
from sqlalchemy import text
from app.db.session import get_db

logger = logging.getLogger(__name__)

def migrate():
    """Remove tenant_id column from dashboards table"""
    db = next(get_db())
    
    try:
        logger.info("Starting migration: Remove tenant_id from dashboards table")
        
        # Check if the column exists before trying to drop it
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'dashboards' AND column_name = 'tenant_id'
        """))
        
        if result.fetchone():
            logger.info("Dropping tenant_id column from dashboards table")
            
            # Drop the foreign key constraint first
            db.execute(text("""
                ALTER TABLE dashboards 
                DROP CONSTRAINT IF EXISTS dashboards_tenant_id_fkey
            """))
            
            # Drop the column
            db.execute(text("""
                ALTER TABLE dashboards 
                DROP COLUMN IF EXISTS tenant_id
            """))
            
            db.commit()
            logger.info("Successfully removed tenant_id column from dashboards table")
        else:
            logger.info("tenant_id column does not exist in dashboards table, skipping migration")
            
    except Exception as e:
        logger.error(f"Error during migration: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate()

