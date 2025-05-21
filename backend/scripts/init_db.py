"""
Database initialization script.

This script:
1. Creates all database tables
2. Initializes the database with default data
3. Creates sample data for testing
"""

import logging
import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.session import Base
from app.db.init_db import init_db, create_sample_data

# Import all models to ensure they're registered with Base
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import CloudAccount, Environment, Template, TemplateVersion, Deployment, DeploymentHistory
from app.models.integration import IntegrationConfig
from app.models.template_foundry import TemplateFoundry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_db():
    """Set up the database by creating tables and initializing with data."""
    # Create database engine
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    
    # Create all tables
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Initialize database with default data
        logger.info("Initializing database with default data...")
        init_db(db)
        
        # Create sample data
        logger.info("Creating sample data...")
        create_sample_data(db)
        
        logger.info("Database setup completed successfully")
    except Exception as e:
        logger.error(f"Error during database setup: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    setup_db()

