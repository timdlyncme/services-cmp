"""
Database schema update script.

This script creates all the database tables based on the SQLAlchemy models.
Run this script before initializing the database with data.
"""

import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.session import Base
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import CloudAccount, Environment, Template, TemplateVersion, Deployment, DeploymentHistory
from app.models.integration import IntegrationConfig
from app.models.template_foundry import TemplateFoundry
from app.models.nexus_ai import NexusAIConfig, NexusAILog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_tables():
    """Create all database tables."""
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    
    # Import all models to ensure they're registered with the Base metadata
    logger.info("Creating database tables...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")

if __name__ == "__main__":
    create_tables()
