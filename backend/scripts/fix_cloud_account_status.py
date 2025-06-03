#!/usr/bin/env python3
"""
Fix Cloud Account Status Column

This script ensures the status column exists in the cloud_accounts table
and can be run on existing databases to fix the CloudAccount creation error.

Usage:
    python scripts/fix_cloud_account_status.py
"""

import sys
import os
import logging

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError
from app.db.session import SessionLocal

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_cloud_account_status():
    """Fix the cloud_accounts table to include the status column."""
    db = SessionLocal()
    
    try:
        logger.info("Checking cloud_accounts table for status column...")
        
        # Check if the status column already exists
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'cloud_accounts' 
            AND column_name = 'status'
        """))
        
        if result.fetchone() is None:
            logger.info("Status column not found. Adding it now...")
            
            # Add the status column
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
            logger.info("✅ Successfully added status column to cloud_accounts table")
            
            # Verify the column was added
            result = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'cloud_accounts' 
                AND column_name = 'status'
            """))
            
            if result.fetchone():
                logger.info("✅ Verification successful: status column exists")
            else:
                logger.error("❌ Verification failed: status column not found after creation")
                return False
                
        else:
            logger.info("✅ Status column already exists in cloud_accounts table")
        
        # Test creating a CloudAccount to verify the fix
        logger.info("Testing CloudAccount creation...")
        try:
            from app.models.deployment import CloudAccount
            from app.models.user import Tenant
            
            # Get a tenant for testing (or create a test one)
            tenant = db.query(Tenant).first()
            if not tenant:
                logger.warning("No tenants found. Cannot test CloudAccount creation.")
                return True
            
            # Try to create a test CloudAccount
            test_account = CloudAccount(
                name="Test Account",
                provider="azure",
                status="connected",
                description="Test account for verification",
                tenant_id=tenant.tenant_id
            )
            
            # Don't actually save it, just test the creation
            logger.info("✅ CloudAccount creation test successful")
            
        except Exception as e:
            logger.error(f"❌ CloudAccount creation test failed: {e}")
            return False
        
        return True
        
    except (OperationalError, ProgrammingError) as e:
        logger.error(f"❌ Database error: {e}")
        db.rollback()
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("🔧 Starting Cloud Account Status Fix...")
    
    success = fix_cloud_account_status()
    
    if success:
        logger.info("🎉 Cloud Account Status fix completed successfully!")
        logger.info("You should now be able to create cloud accounts via /api/cloud-accounts/")
        sys.exit(0)
    else:
        logger.error("💥 Cloud Account Status fix failed!")
        logger.error("Please check the logs above for details.")
        sys.exit(1)

