import boto3
import json
import uuid
from botocore.exceptions import ClientError

class AWSDeployer:
    def __init__(self):
        # Initialize AWS clients
        self.cloudformation = boto3.client('cloudformation')
        self.s3 = boto3.client('s3')
        self.iam = boto3.client('iam')
        
    def deploy(self, environment, template_data, parameters=None, deployment_id=None):
        """
        Deploy a CloudFormation template to AWS
        
        Args:
            environment (str): The environment name (used for stack naming)
            template_data (dict): The template data, either URL or template body
            parameters (dict, optional): Parameters for the template
            deployment_id (str, optional): Unique ID for the deployment
            
        Returns:
            dict: Deployment result with status and details
        """
        if not deployment_id:
            deployment_id = str(uuid.uuid4())
            
        stack_name = f"{environment}-{deployment_id[:8]}"
        
        # Prepare parameters for CloudFormation
        cf_parameters = []
        if parameters:
            for key, value in parameters.items():
                cf_parameters.append({
                    'ParameterKey': key,
                    'ParameterValue': value
                })
        
        try:
            # Check if template is a URL or direct template code
            if 'template_url' in template_data:
                response = self.cloudformation.create_stack(
                    StackName=stack_name,
                    TemplateURL=template_data['template_url'],
                    Parameters=cf_parameters,
                    Capabilities=['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
                    OnFailure='ROLLBACK'
                )
            else:
                response = self.cloudformation.create_stack(
                    StackName=stack_name,
                    TemplateBody=template_data['template_body'],
                    Parameters=cf_parameters,
                    Capabilities=['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
                    OnFailure='ROLLBACK'
                )
                
            return {
                "status": "in_progress",
                "provider": "aws",
                "deployment_type": "cloudformation",
                "cloud_deployment_id": response['StackId'],
                "deployment_id": deployment_id,
                "environment": environment
            }
            
        except ClientError as e:
            return {
                "status": "failed",
                "provider": "aws",
                "deployment_id": deployment_id,
                "environment": environment,
                "error_details": str(e)
            }
    
    def get_deployment_status(self, stack_id):
        """
        Get the status of a CloudFormation deployment
        
        Args:
            stack_id (str): The CloudFormation stack ID
            
        Returns:
            dict: Status and details of the deployment
        """
        try:
            response = self.cloudformation.describe_stacks(StackName=stack_id)
            stack = response['Stacks'][0]
            
            # Get stack resources
            resources_response = self.cloudformation.list_stack_resources(StackName=stack_id)
            resources = resources_response.get('StackResourceSummaries', [])
            
            # Get stack outputs
            outputs = {}
            for output in stack.get('Outputs', []):
                outputs[output['OutputKey']] = output['OutputValue']
            
            return {
                "status": self._map_status(stack['StackStatus']),
                "cloud_status": stack['StackStatus'],
                "cloud_resources": [
                    {
                        "logical_id": r['LogicalResourceId'],
                        "physical_id": r.get('PhysicalResourceId', ''),
                        "type": r['ResourceType'],
                        "status": r['ResourceStatus']
                    } for r in resources
                ],
                "outputs": outputs,
                "created_at": stack['CreationTime'].isoformat() if 'CreationTime' in stack else None,
                "updated_at": stack.get('LastUpdatedTime', '').isoformat() if 'LastUpdatedTime' in stack else None
            }
            
        except ClientError as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def update_deployment(self, stack_id, template_data, parameters=None):
        """
        Update an existing CloudFormation deployment
        
        Args:
            stack_id (str): The CloudFormation stack ID
            template_data (dict): The template data, either URL or template body
            parameters (dict, optional): Parameters for the template
            
        Returns:
            dict: Update result with status and details
        """
        # Prepare parameters for CloudFormation
        cf_parameters = []
        if parameters:
            for key, value in parameters.items():
                cf_parameters.append({
                    'ParameterKey': key,
                    'ParameterValue': value
                })
        
        try:
            # Check if template is a URL or direct template code
            if 'template_url' in template_data:
                response = self.cloudformation.update_stack(
                    StackName=stack_id,
                    TemplateURL=template_data['template_url'],
                    Parameters=cf_parameters,
                    Capabilities=['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM']
                )
            else:
                response = self.cloudformation.update_stack(
                    StackName=stack_id,
                    TemplateBody=template_data['template_body'],
                    Parameters=cf_parameters,
                    Capabilities=['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM']
                )
                
            return {
                "status": "in_progress",
                "cloud_deployment_id": response['StackId']
            }
            
        except ClientError as e:
            # Check if the error is "No updates are to be performed"
            if "No updates are to be performed" in str(e):
                return {
                    "status": "completed",
                    "message": "No updates were needed"
                }
            
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def delete_deployment(self, stack_id):
        """
        Delete a CloudFormation deployment
        
        Args:
            stack_id (str): The CloudFormation stack ID
            
        Returns:
            dict: Deletion result with status
        """
        try:
            self.cloudformation.delete_stack(StackName=stack_id)
            return {
                "status": "in_progress",
                "message": "Deletion initiated"
            }
            
        except ClientError as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def _map_status(self, cloud_status):
        """Map CloudFormation status to our standard status"""
        if cloud_status in ['CREATE_IN_PROGRESS', 'UPDATE_IN_PROGRESS', 'DELETE_IN_PROGRESS']:
            return 'in_progress'
        elif cloud_status in ['CREATE_COMPLETE', 'UPDATE_COMPLETE']:
            return 'completed'
        elif cloud_status in ['CREATE_FAILED', 'ROLLBACK_COMPLETE', 'ROLLBACK_FAILED', 
                             'UPDATE_FAILED', 'UPDATE_ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_FAILED']:
            return 'failed'
        else:
            return 'unknown'

