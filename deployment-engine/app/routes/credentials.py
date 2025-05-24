from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
from typing import Dict, List, Any, Optional

# Create a blueprint for credentials routes
credentials_bp = Blueprint('credentials', __name__)

# Store credentials in memory (in a real implementation, this would be more secure)
credentials_store = {}

@credentials_bp.route('/credentials', methods=['POST'])
@jwt_required()
def set_credentials():
    """
    Set cloud provider credentials
    """
    data = request.json
    
    # Validate required fields
    required_fields = ['client_id', 'client_secret', 'tenant_id']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Store credentials with user ID as key
    user_id = get_jwt_identity()
    credentials_store[user_id] = data
    
    return jsonify({'message': 'Credentials set successfully'}), 200

@credentials_bp.route('/credentials/subscriptions', methods=['GET'])
@jwt_required()
def get_subscriptions():
    """
    Get available subscriptions for the current credentials
    """
    user_id = get_jwt_identity()
    
    # Check if credentials exist
    if user_id not in credentials_store:
        return jsonify({'error': 'No credentials found'}), 404
    
    creds = credentials_store[user_id]
    provider = creds.get('provider', 'azure')  # Default to Azure
    
    try:
        if provider == 'azure':
            # Get Azure subscriptions
            subscriptions = get_azure_subscriptions(creds)
            return jsonify(subscriptions), 200
        elif provider == 'aws':
            # Get AWS accounts
            accounts = get_aws_accounts(creds)
            return jsonify(accounts), 200
        elif provider == 'gcp':
            # Get GCP projects
            projects = get_gcp_projects(creds)
            return jsonify(projects), 200
        else:
            return jsonify({'error': f'Unsupported provider: {provider}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@credentials_bp.route('/credentials/resources', methods=['GET'])
@jwt_required()
def get_resources():
    """
    Get available resources for the current credentials and specified subscriptions
    """
    user_id = get_jwt_identity()
    
    # Check if credentials exist
    if user_id not in credentials_store:
        return jsonify({'error': 'No credentials found'}), 404
    
    creds = credentials_store[user_id]
    provider = creds.get('provider', 'azure')  # Default to Azure
    
    # Get subscription IDs from query parameters
    subscription_ids_param = request.args.get('subscription_ids', '')
    subscription_ids = subscription_ids_param.split(',') if subscription_ids_param else []
    
    try:
        if provider == 'azure':
            # Get Azure resources
            resources = get_azure_resources(creds, subscription_ids)
            return jsonify(resources), 200
        elif provider == 'aws':
            # Get AWS resources
            resources = get_aws_resources(creds, subscription_ids)
            return jsonify(resources), 200
        elif provider == 'gcp':
            # Get GCP resources
            resources = get_gcp_resources(creds, subscription_ids)
            return jsonify(resources), 200
        else:
            return jsonify({'error': f'Unsupported provider: {provider}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Helper functions for different cloud providers

def get_azure_subscriptions(creds: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Get available Azure subscriptions using the Azure SDK
    """
    from azure.identity import ClientSecretCredential
    from azure.mgmt.subscription import SubscriptionClient
    
    # Create Azure credential
    credential = ClientSecretCredential(
        tenant_id=creds['tenant_id'],
        client_id=creds['client_id'],
        client_secret=creds['client_secret']
    )
    
    # Create subscription client
    subscription_client = SubscriptionClient(credential)
    
    # Get subscriptions
    subscriptions = []
    for subscription in subscription_client.subscriptions.list():
        subscriptions.append({
            'id': subscription.subscription_id,
            'name': subscription.display_name,
            'state': subscription.state
        })
    
    return subscriptions

def get_azure_resources(creds: Dict[str, str], subscription_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Get Azure resources for the specified subscriptions
    """
    from azure.identity import ClientSecretCredential
    from azure.mgmt.resource import ResourceManagementClient
    
    # Create Azure credential
    credential = ClientSecretCredential(
        tenant_id=creds['tenant_id'],
        client_id=creds['client_id'],
        client_secret=creds['client_secret']
    )
    
    all_resources = []
    
    # Get resources for each subscription
    for subscription_id in subscription_ids:
        # Create resource client
        resource_client = ResourceManagementClient(
            credential=credential,
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
                resource_dict['subscription_id'] = subscription_id
                resource_dict['resource_group'] = resource_group.name
                
                # Extract resource type from full type
                resource_dict['type'] = resource_dict['type'].split('/')[-1]
                
                # Add status (Azure doesn't provide this directly)
                resource_dict['status'] = 'running'
                
                # Add created_at (Azure doesn't provide this directly)
                resource_dict['created_at'] = resource_dict.get('created_time', None)
                
                all_resources.append(resource_dict)
    
    return all_resources

def get_aws_accounts(creds: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Get available AWS accounts
    """
    # Implementation for AWS
    # This is a placeholder - actual implementation would use boto3
    return []

def get_aws_resources(creds: Dict[str, str], account_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Get AWS resources for the specified accounts
    """
    # Implementation for AWS
    # This is a placeholder - actual implementation would use boto3
    return []

def get_gcp_projects(creds: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Get available GCP projects
    """
    # Implementation for GCP
    # This is a placeholder - actual implementation would use google-cloud-resource-manager
    return []

def get_gcp_resources(creds: Dict[str, str], project_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Get GCP resources for the specified projects
    """
    # Implementation for GCP
    # This is a placeholder - actual implementation would use google-cloud-resource-manager
    return []
