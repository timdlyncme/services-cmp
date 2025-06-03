"""
Migration script to convert template categories from comma-separated strings to JSON arrays
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
import json

def migrate_categories_to_json():
    """
    Convert existing template category data from comma-separated strings to JSON arrays
    """
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL environment variable not set")
        return
    
    # Create engine and session
    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # First, add the new categories column if it doesn't exist
        try:
            db.execute(text("ALTER TABLE templates ADD COLUMN categories JSON DEFAULT '[]'"))
            db.commit()
            print("Added categories column")
        except Exception as e:
            print(f"Categories column might already exist or error adding it: {e}")
            db.rollback()
        
        # Get all templates with category data
        result = db.execute(text("SELECT id, category FROM templates WHERE category IS NOT NULL AND category != ''"))
        templates = result.fetchall()
        
        print(f"Found {len(templates)} templates with category data to migrate")
        
        # Convert each template's category string to JSON array
        for template in templates:
            template_id, category_string = template
            
            if category_string:
                # Split comma-separated categories and clean them
                categories = [cat.strip() for cat in category_string.split(",") if cat.strip()]
                categories_json = json.dumps(categories)
                
                # Update the template with the new categories JSON
                db.execute(
                    text("UPDATE templates SET categories = :categories WHERE id = :id"),
                    {"categories": categories_json, "id": template_id}
                )
                
                print(f"Migrated template {template_id}: '{category_string}' -> {categories}")
        
        # Commit all changes
        db.commit()
        print("Migration completed successfully")
        
        # Optionally, drop the old category column (commented out for safety)
        # db.execute(text("ALTER TABLE templates DROP COLUMN category"))
        # db.commit()
        # print("Dropped old category column")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_categories_to_json()

