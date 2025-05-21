"""
Database migration script to update the schema with new tables and fields.

This script should be run after updating the models to ensure the database schema is in sync.
"""

import os
import sys
from pathlib import Path

# Add the parent directory to sys.path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Boolean, DateTime, Table, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

from app.core.config import settings
from app.models.base_models import Base
from app.models.user import User, Tenant, Role, Permission
from app.models.deployment import (
    CloudAccount, Environment, Template, Deployment,
    TemplateVersion, DeploymentHistory, environment_cloud_account
)
from app.models.template_foundry import TemplateFoundry

# Create engine and session
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def run_migration():
    """Run the migration to update the database schema."""
    print("Starting database migration...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()

