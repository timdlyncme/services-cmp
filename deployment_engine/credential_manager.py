"""
Multi-tenant credential manager for the deployment engine.
This module handles tenant-specific credential management and database integration.
"""

import os
import json
import logging
from typing import Dict, Optional, Any
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Boolean, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
from deploy.azure import AzureDeployer

logger = logging.getLogger(__name__)

# Database configuration
POSTGRES_SERVER = os.getenv("POSTGRES_SERVER", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_USER = os.getenv("POSTGRES_USER", "cmpuser")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "cmppassword")
POSTGRES_DB = os.getenv("POSTGRES_DB", "cmpdb")

DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"

# Database models (minimal definitions for cloud_settings)
Base = declarative_base()

class CloudSettings(Base):
    __tablename__ = "cloud_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    settings_id = Column(UUID(as_uuid=False), unique=True, index=True)
    provider = Column(String)
    name = Column(String, nullable=True)
    connection_details = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    tenant_id = Column(UUID(as_uuid=False))


class MultiTenantCredentialManager:
    """
    Manages Azure credentials for multiple tenants.
    Provides fresh credential loading from database and tenant isolation.
    """
    
    def __init__(self):
        """Initialize the credential manager with database connection."""
        try:
            self.engine = create_engine(DATABASE_URL)
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
            logger.info("Successfully connected to database for credential management")
        except Exception as e:
            logger.error(f"Failed to connect to database: {str(e)}")
            raise
    
    def get_database_session(self) -> Session:
        """Get a database session."""
        return self.SessionLocal()
    
    def get_tenant_credentials(self, tenant_id: str, settings_id: Optional[str] = None) -> Optional[Dict[str, str]]:
        """
        Get fresh credentials for a specific tenant from the database.
        
        Args:
            tenant_id (str): The tenant ID
            settings_id (str, optional): Specific settings ID to use
            
        Returns:
            Dict[str, str]: Credentials dictionary or None if not found
        """
        try:
            db = self.get_database_session()
            
            # Build query for active credentials
            query = db.query(CloudSettings).filter(
                CloudSettings.tenant_id == tenant_id,
                CloudSettings.is_active == True,
                CloudSettings.provider == "azure"
            )
            
            # If specific settings_id is provided, filter by it
            if settings_id:
                query = query.filter(CloudSettings.settings_id == settings_id)
            
            # Get the most recent credentials
            cloud_settings = query.order_by(CloudSettings.updated_at.desc()).first()
            
            if not cloud_settings or not cloud_settings.connection_details:
                logger.warning(f"No active Azure credentials found for tenant {tenant_id}")
                return None
            
            # Extract credentials from connection_details
            connection_details = cloud_settings.connection_details
            if isinstance(connection_details, str):
                connection_details = json.loads(connection_details)
            
            credentials = {
                "client_id": connection_details.get("client_id", ""),
                "client_secret": connection_details.get("client_secret", ""),
                "tenant_id": connection_details.get("tenant_id", ""),
                "subscription_id": connection_details.get("subscription_id", "")
            }
            
            # Validate that required credentials are present
            if not all([credentials["client_id"], credentials["client_secret"], credentials["tenant_id"]]):
                logger.error(f"Incomplete credentials for tenant {tenant_id}")
                return None
            
            logger.info(f"Successfully loaded credentials for tenant {tenant_id}")
            return credentials
            
        except Exception as e:
            logger.error(f"Error loading credentials for tenant {tenant_id}: {str(e)}")
            return None
        finally:
            db.close()
    
    def create_azure_deployer_for_tenant(self, tenant_id: str, settings_id: Optional[str] = None) -> Optional[AzureDeployer]:
        """
        Create a fresh AzureDeployer instance with tenant-specific credentials.
        
        Args:
            tenant_id (str): The tenant ID
            settings_id (str, optional): Specific settings ID to use
            
        Returns:
            AzureDeployer: Configured deployer instance or None if credentials not found
        """
        try:
            # Get fresh credentials from database
            credentials = self.get_tenant_credentials(tenant_id, settings_id)
            if not credentials:
                return None
            
            # Create new AzureDeployer instance
            deployer = AzureDeployer()
            
            # Set credentials
            deployer.set_credentials(
                client_id=credentials["client_id"],
                client_secret=credentials["client_secret"],
                tenant_id=credentials["tenant_id"],
                subscription_id=credentials.get("subscription_id")
            )
            
            logger.info(f"Created Azure deployer for tenant {tenant_id}")
            return deployer
            
        except Exception as e:
            logger.error(f"Error creating Azure deployer for tenant {tenant_id}: {str(e)}")
            return None
    
    def get_tenant_credential_status(self, tenant_id: str, settings_id: Optional[str] = None) -> dict:
        """
        Get credential status for a specific tenant.
        
        Args:
            tenant_id (str): The tenant ID
            settings_id (Optional[str]): Specific settings ID to check
            
        Returns:
            dict: Credential status information
        """
        try:
            with self.SessionLocal() as session:
                query = session.query(CloudSettings).filter(
                    CloudSettings.tenant_id == tenant_id,
                    CloudSettings.provider == "azure",
                    CloudSettings.is_active == True
                )
                
                # If settings_id is provided, filter by it
                if settings_id:
                    query = query.filter(CloudSettings.settings_id == settings_id)
                
                creds = query.first()
                
                if not creds or not creds.connection_details:
                    return {"configured": False, "message": "No Azure credentials found"}
                
                # Check if all required fields are present
                connection_details = creds.connection_details
                if isinstance(connection_details, str):
                    connection_details = json.loads(connection_details)
                
                required_fields = ["client_id", "client_secret", "tenant_id"]
                missing_fields = [field for field in required_fields 
                                if not connection_details.get(field)]
                
                if missing_fields:
                    return {
                        "configured": False, 
                        "message": f"Missing required fields: {', '.join(missing_fields)}"
                    }
                
                return {
                    "configured": True,
                    "message": "Azure credentials configured",
                    "settings_id": str(creds.settings_id),
                    "name": creds.name
                }
                
        except Exception as e:
            logger.error(f"Error getting credential status for tenant {tenant_id}: {str(e)}")
            return {"configured": False, "message": f"Error: {str(e)}"}
    
    def list_tenant_subscriptions(self, tenant_id: str, settings_id: Optional[str] = None) -> list:
        """
        List Azure subscriptions for a specific tenant.
        
        Args:
            tenant_id (str): The tenant ID
            settings_id (str, optional): Specific settings ID to use
            
        Returns:
            list: List of subscriptions
        """
        try:
            deployer = self.create_azure_deployer_for_tenant(tenant_id, settings_id)
            if not deployer:
                return []
            
            subscriptions = deployer.list_subscriptions()
            return subscriptions
            
        except Exception as e:
            logger.error(f"Error listing subscriptions for tenant {tenant_id}: {str(e)}")
            return []


# Global instance
credential_manager = MultiTenantCredentialManager()
