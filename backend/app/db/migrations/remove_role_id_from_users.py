"""
Migration to remove role_id column from users table.

This migration removes the role_id column from the users table since roles are now
managed through the user_tenant_assignments table for proper multi-tenant support.

Before running this migration, ensure that:
1. All user roles are properly stored in user_tenant_assignments table
2. The application code has been updated to use tenant assignments for role resolution
3. A backup of the database has been created

Run this migration with: python -m app.db.migrations.remove_role_id_from_users
"""

from sqlalchemy import text
from app.db.session import SessionLocal
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def upgrade():
    """Remove role_id column from users table"""
    db = SessionLocal()
    try:
        logger.info("Starting migration: remove role_id from users table")
        
        # First, verify that all users have tenant assignments
        result = db.execute(text("""
            SELECT COUNT(*) as count 
            FROM users u 
            LEFT JOIN user_tenant_assignments uta ON u.user_id = uta.user_id 
            WHERE uta.user_id IS NULL
        """))
        users_without_assignments = result.fetchone()[0]
        
        if users_without_assignments > 0:
            logger.warning(f"Found {users_without_assignments} users without tenant assignments")
            # You may want to create default assignments here or fail the migration
            
        # Check if role_id column exists
        result = db.execute(text("""
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'role_id'
        """))
        
        if result.fetchone()[0] == 0:
            logger.info("role_id column does not exist in users table, skipping migration")
            return
            
        # Remove the foreign key constraint first
        logger.info("Dropping foreign key constraint on role_id")
        db.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_id_fkey"))
        
        # Remove the role_id column
        logger.info("Dropping role_id column from users table")
        db.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS role_id"))
        
        db.commit()
        logger.info("Successfully removed role_id column from users table")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def downgrade():
    """Add back role_id column to users table"""
    db = SessionLocal()
    try:
        logger.info("Starting downgrade: add role_id back to users table")
        
        # Check if role_id column already exists
        result = db.execute(text("""
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'role_id'
        """))
        
        if result.fetchone()[0] > 0:
            logger.info("role_id column already exists in users table, skipping downgrade")
            return
            
        # Add the role_id column back
        logger.info("Adding role_id column back to users table")
        db.execute(text("ALTER TABLE users ADD COLUMN role_id INTEGER"))
        
        # Add the foreign key constraint
        logger.info("Adding foreign key constraint on role_id")
        db.execute(text("ALTER TABLE users ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id)"))
        
        # Optionally populate role_id from primary tenant assignments
        logger.info("Populating role_id from primary tenant assignments")
        db.execute(text("""
            UPDATE users 
            SET role_id = (
                SELECT uta.role_id 
                FROM user_tenant_assignments uta 
                WHERE uta.user_id = users.user_id 
                AND uta.is_primary = true 
                LIMIT 1
            )
        """))
        
        db.commit()
        logger.info("Successfully added role_id column back to users table")
        
    except Exception as e:
        logger.error(f"Downgrade failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()

