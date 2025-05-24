import os
import json
import yaml
import tempfile
import uuid
from typing import Dict, Any, List, Optional
import asyncio
import boto3
from botocore.exceptions import ClientError

class CloudFormationService:
    def __init__(self):
        pass
    
    async def deploy(
        self,
        template_file: str,
        parameters: Dict[str, Any],
        credentials: Dict[str, Any],
        is_dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Deploy CloudFormation template
        """
        try:
            # Read template
            with open(template_file, "r") as f:
                template_content = f.read()
            
            # Extract credentials
            aws_access_key_id = credentials.get("aws_access_key_id")
            aws_secret_access_key = credentials.get("aws_secret_access_key")
            aws_region = credentials.get("aws_region", "us-east-1")
            
            if not all([aws_access_key_id, aws_secret_access_key]):
                return {
                    "success": False,
                    "error_message": "Missing AWS credentials",
                    "error_details": {"missing_credentials": True},
                    "logs": "Error: Missing AWS credentials"
                }
            
            # Create AWS session
            session = boto3.Session(
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                region_name=aws_region
            )
            
            # Create CloudFormation client
            cf_client = session.client("cloudformation")
            
            # Generate stack name
            stack_name = f"stack-{uuid.uuid4().hex[:8]}"
            
            # Format parameters for CloudFormation
            cf_parameters = []
            for key, value in parameters.items():
                cf_parameters.append({
                    "ParameterKey": key,
                    "ParameterValue": str(value)
                })
            
            # If dry run, validate template
            if is_dry_run:
                try:
                    validation_response = cf_client.validate_template(
                        TemplateBody=template_content
                    )
                    
                    # Parse template to extract resources
                    if template_file.endswith(".yaml") or template_file.endswith(".yml"):
                        template = yaml.safe_load(template_content)
                    else:
                        template = json.loads(template_content)
                    
                    return {
                        "success": True,
                        "outputs": {},
                        "resources": self._extract_resources_from_template(template),
                        "logs": f"CloudFormation template validation successful: {json.dumps(validation_response, default=str, indent=2)}"
                    }
                
                except ClientError as e:
                    return {
                        "success": False,
                        "error_message": "CloudFormation template validation failed",
                        "error_details": {
                            "error": str(e)
                        },
                        "logs": f"Error: CloudFormation template validation failed. Error: {str(e)}"
                    }
            
            # Deploy CloudFormation template
            try:
                create_response = cf_client.create_stack(
                    StackName=stack_name,
                    TemplateBody=template_content,
                    Parameters=cf_parameters,
                    Capabilities=["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM", "CAPABILITY_AUTO_EXPAND"],
                    OnFailure="DELETE"
                )
                
                stack_id = create_response["StackId"]
                
                # Poll for stack creation completion
                max_retries = 60
                retry_count = 0
                stack_status = "CREATE_IN_PROGRESS"
                stack_logs = []
                
                while stack_status == "CREATE_IN_PROGRESS" and retry_count < max_retries:
                    await asyncio.sleep(10)
                    
                    describe_response = cf_client.describe_stacks(
                        StackName=stack_id
                    )
                    
                    stack = describe_response["Stacks"][0]
                    stack_status = stack["StackStatus"]
                    stack_logs.append(f"Stack status: {stack_status}")
                    
                    retry_count += 1
                
                # Get stack events for logs
                events_response = cf_client.describe_stack_events(
                    StackName=stack_id
                )
                
                for event in events_response["StackEvents"]:
                    stack_logs.append(f"{event['Timestamp']} - {event['LogicalResourceId']} - {event['ResourceStatus']} - {event.get('ResourceStatusReason', '')}")
                
                # Check if stack creation was successful
                if stack_status == "CREATE_COMPLETE":
                    # Get outputs
                    outputs = {}
                    if "Outputs" in stack:
                        for output in stack["Outputs"]:
                            outputs[output["OutputKey"]] = output["OutputValue"]
                    
                    # Get resources
                    resources_response = cf_client.list_stack_resources(
                        StackName=stack_id
                    )
                    
                    resources = []
                    for resource in resources_response["StackResourceSummaries"]:
                        resources.append(f"{resource['LogicalResourceId']} ({resource['ResourceType']})")
                    
                    return {
                        "success": True,
                        "outputs": outputs,
                        "resources": resources,
                        "logs": "\n".join(stack_logs)
                    }
                else:
                    return {
                        "success": False,
                        "error_message": f"CloudFormation stack creation failed with status: {stack_status}",
                        "error_details": {
                            "status": stack_status,
                            "stack_id": stack_id
                        },
                        "logs": "\n".join(stack_logs)
                    }
            
            except ClientError as e:
                return {
                    "success": False,
                    "error_message": "CloudFormation stack creation failed",
                    "error_details": {
                        "error": str(e)
                    },
                    "logs": f"Error: CloudFormation stack creation failed. Error: {str(e)}"
                }
        
        except Exception as e:
            return {
                "success": False,
                "error_message": str(e),
                "error_details": {"exception": str(e)},
                "logs": f"Exception: {str(e)}"
            }
    
    def _extract_resources_from_template(self, template: Dict[str, Any]) -> List[str]:
        """
        Extract resources from CloudFormation template
        """
        resources = []
        
        if "Resources" in template:
            for resource_id, resource in template["Resources"].items():
                if "Type" in resource:
                    resources.append(f"{resource_id} ({resource['Type']})")
        
        return resources

