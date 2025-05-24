import os
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.deployment import CloudSettings

def get_azure_credentials(settings_id: int, db: Session = None) -> Dict[str, str]:
    """
    Get Azure credentials from the database
    """
    if db is None:
        db = SessionLocal()
    
    try:
        # Get cloud settings
        settings = db.query(CloudSettings).filter(CloudSettings.id == settings_id).first()
        
        if not settings:
            raise ValueError(f"Cloud settings with ID {settings_id} not found")
        
        # Extract credentials
        credentials = {
            "client_id": settings.client_id,
            "client_secret": settings.client_secret,
            "tenant_id": settings.tenant_id,
            "subscription_id": settings.subscription_id
        }
        
        return credentials
    finally:
        if db is not None:
            db.close()

def get_azure_resources_for_subscriptions(settings_id: int, subscription_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Get Azure resources for a list of subscriptions
    """
    try:
        # Import Azure SDK modules here to avoid dependency issues
        from azure.identity import ClientSecretCredential
        from azure.mgmt.resource import ResourceManagementClient
        
        # Get credentials
        credentials = get_azure_credentials(settings_id)
        
        # Create Azure credential
        azure_credential = ClientSecretCredential(
            tenant_id=credentials["tenant_id"],
            client_id=credentials["client_id"],
            client_secret=credentials["client_secret"]
        )
        
        all_resources = []
        
        # Get resources for each subscription
        for subscription_id in subscription_ids:
            # Create resource client
            resource_client = ResourceManagementClient(
                credential=azure_credential,
                subscription_id=subscription_id
            )
            
            # Get all resource groups
            resource_groups = resource_client.resource_groups.list()
            
            # Get resources for each resource group
            for resource_group in resource_groups:
                resources = resource_client.resources.list_by_resource_group(resource_group.name)
                
                for resource in resources:
                    # Convert to dictionary and add subscription and resource group info
                    resource_dict = resource.as_dict()
                    resource_dict["subscription_id"] = subscription_id
                    resource_dict["resource_group"] = resource_group.name
                    
                    all_resources.append(resource_dict)
        
        return all_resources
    except Exception as e:
        # Log the error and re-raise
        print(f"Error getting Azure resources: {str(e)}")
        raise

