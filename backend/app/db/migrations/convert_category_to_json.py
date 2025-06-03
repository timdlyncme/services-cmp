"""
Migration script to convert template category column from String to JSON
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
import json

def convert_category_to_json():
    """
    Convert existing template category data from String to JSON arrays
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
        # First, create a backup column
        try:
            db.execute(text("ALTER TABLE templates ADD COLUMN category_backup TEXT"))
            db.commit()
            print("Added backup column")
        except Exception as e:
            print(f"Backup column might already exist: {e}")
            db.rollback()
        
        # Copy existing category data to backup
        db.execute(text("UPDATE templates SET category_backup = category WHERE category IS NOT NULL"))
        db.commit()
        print("Backed up existing category data")
        
        # Get all templates with category data
        result = db.execute(text("SELECT id, category FROM templates WHERE category IS NOT NULL AND category != ''"))
        templates = result.fetchall()
        
        print(f"Found {len(templates)} templates with category data to convert")
        
        # Convert each template's category to JSON array
        for template in templates:
            template_id, category_value = template
            
            if category_value:
                # Check if it's already a JSON array
                try:
                    # Try to parse as JSON first
                    if isinstance(category_value, str) and category_value.startswith('['):
                        categories = json.loads(category_value)
                    else:
                        # Treat as comma-separated string
                        categories = [cat.strip() for cat in str(category_value).split(",") if cat.strip()]
                except (json.JSONDecodeError, AttributeError):
                    # If parsing fails, treat as single category
                    categories = [str(category_value).strip()] if str(category_value).strip() else []
                
                categories_json = json.dumps(categories)
                
                # Update the template with the new categories JSON
                db.execute(
                    text("UPDATE templates SET category = :categories WHERE id = :id"),
                    {"categories": categories_json, "id": template_id}
                )
                
                print(f"Converted template {template_id}: '{category_value}' -> {categories}")
        
        # Commit all changes
        db.commit()
        print("Migration completed successfully")
        
        # Verify the conversion
        result = db.execute(text("SELECT id, category FROM templates WHERE category IS NOT NULL LIMIT 5"))
        samples = result.fetchall()
        print("Sample converted data:")
        for sample in samples:
            print(f"  Template {sample[0]}: {sample[1]}")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    convert_category_to_json()

