#!/usr/bin/env python3
"""
Script to initialize the database with default data.
"""

import os
import sys
from pathlib import Path

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).parent.parent))

import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.init_db import init_db, create_sample_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main() -> None:
    """Run database initialization."""
    logger.info("Creating initial data")
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        init_db(db)
        
        # Ask if sample data should be created
        create_samples = input("Do you want to create sample data? (y/n): ").lower() == "y"
        if create_samples:
            create_sample_data(db)
        
        logger.info("Initial data created")
    except Exception as e:
        logger.error(f"Error creating initial data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()

