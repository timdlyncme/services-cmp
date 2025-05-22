"""
Migration script to migrate existing NexusAI configuration to the database.

This script reads the environment variables for NexusAI configuration and
stores them in the database.
"""

import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.nexus_ai import NexusAIConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_config():
    """Migrate NexusAI configuration from environment variables to the database."""
    # Create a connection to the database
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if there's already a configuration in the database
        config = db.query(NexusAIConfig).first()
        
        if not config:
            # Create a new configuration
            config = NexusAIConfig()
            db.add(config)
        
        # Update the configuration with values from environment variables
        config.api_key = settings.AZURE_OPENAI_API_KEY
        config.endpoint = settings.AZURE_OPENAI_ENDPOINT
        config.deployment_name = settings.AZURE_OPENAI_DEPLOYMENT_NAME
        config.api_version = settings.AZURE_OPENAI_API_VERSION
        
        # Save the changes
        db.commit()
        
        logger.info("NexusAI configuration migrated successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Error migrating NexusAI configuration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_config()

