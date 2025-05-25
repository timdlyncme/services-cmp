#!/usr/bin/env python3
import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection parameters
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "cmp")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")

def apply_migration(migration_file):
    """Apply a SQL migration file to the database"""
    try:
        # Connect to the database
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        # Create a cursor
        cursor = conn.cursor()
        
        # Read the migration file
        with open(migration_file, 'r') as f:
            sql = f.read()
        
        # Execute the SQL
        cursor.execute(sql)
        
        # Close the cursor and connection
        cursor.close()
        conn.close()
        
        print(f"Migration {migration_file} applied successfully")
        return True
    
    except Exception as e:
        print(f"Error applying migration {migration_file}: {e}")
        return False

def main():
    """Main function to apply migrations"""
    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Get the parent directory (backend)
    backend_dir = os.path.dirname(script_dir)
    
    # Get the migrations directory
    migrations_dir = os.path.join(backend_dir, "app", "migrations")
    
    # Check if a specific migration file was specified
    if len(sys.argv) > 1:
        migration_file = sys.argv[1]
        migration_path = os.path.join(migrations_dir, migration_file)
        
        if not os.path.exists(migration_path):
            print(f"Migration file {migration_file} not found")
            sys.exit(1)
        
        # Apply the migration
        if apply_migration(migration_path):
            print(f"Migration {migration_file} applied successfully")
        else:
            print(f"Failed to apply migration {migration_file}")
            sys.exit(1)
    
    else:
        # Apply all migrations in the directory
        migration_files = [f for f in os.listdir(migrations_dir) if f.endswith('.sql')]
        
        if not migration_files:
            print("No migration files found")
            sys.exit(0)
        
        # Sort migration files to ensure they are applied in the correct order
        migration_files.sort()
        
        # Apply each migration
        for migration_file in migration_files:
            migration_path = os.path.join(migrations_dir, migration_file)
            
            if apply_migration(migration_path):
                print(f"Migration {migration_file} applied successfully")
            else:
                print(f"Failed to apply migration {migration_file}")
                sys.exit(1)
    
    print("All migrations applied successfully")

if __name__ == "__main__":
    main()

