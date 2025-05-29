"""
Script to run a specific migration.
"""

import sys
import importlib.util
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migration(migration_file):
    """Run a specific migration file."""
    try:
        # Import the migration module
        spec = importlib.util.spec_from_file_location("migration", migration_file)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        
        # Run the upgrade function
        logger.info(f"Running migration: {migration_file}")
        migration.upgrade()
        logger.info(f"Migration completed successfully: {migration_file}")
        
        return True
    except Exception as e:
        logger.error(f"Error running migration: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        logger.error("Please provide a migration file path")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    success = run_migration(migration_file)
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

