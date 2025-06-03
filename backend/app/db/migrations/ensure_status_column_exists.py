"""
Ensure status column exists in cloud_accounts table

This migration ensures the status column exists in the cloud_accounts table
and handles the case where it might already exist or not exist.
"""

import logging
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, ProgrammingError

logger = logging.getLogger(__name__)

def upgrade(db: Session) -> None:
    """
    Add status column to cloud_accounts table if it doesn't exist
    """
    try:
        # Check if the status column already exists
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cloud_accounts' 
            AND column_name = 'status'
        """))
        
        if result.fetchone() is None:
            # Column doesn't exist, add it
            logger.info("Adding status column to cloud_accounts table")
            db.execute(text("""
                ALTER TABLE cloud_accounts 
                ADD COLUMN status VARCHAR DEFAULT 'connected'
            """))
            
            # Update existing records to have the default status
            db.execute(text("""
                UPDATE cloud_accounts 
                SET status = 'connected' 
                WHERE status IS NULL
            """))
            
            db.commit()
            logger.info("Successfully added status column to cloud_accounts table")
        else:
            logger.info("Status column already exists in cloud_accounts table")
            
    except (OperationalError, ProgrammingError) as e:
        logger.error(f"Error adding status column: {e}")
        db.rollback()
        raise

def downgrade(db: Session) -> None:
    """
    Remove status column from cloud_accounts table
    """
    try:
        # Check if the status column exists before trying to drop it
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cloud_accounts' 
            AND column_name = 'status'
        """))
        
        if result.fetchone() is not None:
            logger.info("Removing status column from cloud_accounts table")
            db.execute(text("ALTER TABLE cloud_accounts DROP COLUMN status"))
            db.commit()
            logger.info("Successfully removed status column from cloud_accounts table")
        else:
            logger.info("Status column doesn't exist in cloud_accounts table")
            
    except (OperationalError, ProgrammingError) as e:
        logger.error(f"Error removing status column: {e}")
        db.rollback()
        raise

if __name__ == "__main__":
    # This can be run as a standalone script
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    try:
        upgrade(db)
    finally:
        db.close()

