from app.db.init_db import init_db
import logging
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import sys
import os

# Import all models to ensure they're registered with Base
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import CloudAccount, Environment, Template, TemplateVersion, Deployment, DeploymentHistory
from app.models.integration import IntegrationConfig
from app.models.template_foundry import TemplateFoundry
from app.db.session import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Initializing database")
    
    # Create database engine and session
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    
    # Create all tables first
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Call init_db with the database session
        init_db(db)
        logger.info("Database initialization completed")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        db.rollback()
        raise
    finally:
        db.close()
