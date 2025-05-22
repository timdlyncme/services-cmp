import os
import json
import uuid
import subprocess
import tempfile
import shutil
import requests
from pathlib import Path

class TerraformDeployer:
    def __init__(self):
        # Ensure terraform is installed
        self._check_terraform_installed()
        
    def deploy(self, environment, template_data, parameters=None, deployment_id=None, provider=None):
        """
        Deploy infrastructure using Terraform
        
        Args:
            environment (str): The environment name
            template_data (dict): The template data, either URL or template content
            parameters (dict, optional): Variables for Terraform
            deployment_id (str, optional): Unique ID for the deployment
            provider (str, optional): Cloud provider (aws, azure, gcp)
            
        Returns:
            dict: Deployment result with status and details
        """
        if not deployment_id:
            deployment_id = str(uuid.uuid4())
            
        # Create a temporary directory for the deployment
        temp_dir = tempfile.mkdtemp(prefix=f"tf-{environment}-{deployment_id[:8]}-")
        
        try:
            # Prepare the Terraform files
            self._prepare_terraform_files(temp_dir, template_data, parameters)
            
            # Initialize Terraform
            init_result = self._run_terraform_command(temp_dir, ["init"])
            if init_result['returncode'] != 0:
                return {
                    "status": "failed",
                    "provider": provider or "terraform",
                    "deployment_type": "terraform",
                    "deployment_id": deployment_id,
                    "environment": environment,
                    "error_details": init_result['stderr']
                }
            
            # Run Terraform plan
            plan_result = self._run_terraform_command(temp_dir, ["plan", "-out=tfplan"])
            if plan_result['returncode'] != 0:
                return {
                    "status": "failed",
                    "provider": provider or "terraform",
                    "deployment_type": "terraform",
                    "deployment_id": deployment_id,
                    "environment": environment,
                    "error_details": plan_result['stderr']
                }
            
            # Apply the Terraform plan
            apply_result = self._run_terraform_command(temp_dir, ["apply", "-auto-approve", "tfplan"])
            if apply_result['returncode'] != 0:
                return {
                    "status": "failed",
                    "provider": provider or "terraform",
                    "deployment_type": "terraform",
                    "deployment_id": deployment_id,
                    "environment": environment,
                    "error_details": apply_result['stderr']
                }
            
            # Get the outputs
            output_result = self._run_terraform_command(temp_dir, ["output", "-json"])
            outputs = json.loads(output_result['stdout']) if output_result['stdout'] else {}
            
            # Get the state file for resource tracking
            state_file = os.path.join(temp_dir, "terraform.tfstate")
            resources = self._parse_terraform_state(state_file)
            
            # Store the state file path for future operations
            state_info = {
                "state_dir": temp_dir,
                "state_file": state_file
            }
            
            return {
                "status": "completed",
                "provider": provider or "terraform",
                "deployment_type": "terraform",
                "cloud_deployment_id": deployment_id,  # Using our ID as the cloud ID for Terraform
                "deployment_id": deployment_id,
                "environment": environment,
                "outputs": outputs,
                "cloud_resources": resources,
                "state_info": state_info,
                "logs": apply_result['stdout']
            }
            
        except Exception as e:
            # Clean up the temporary directory on error
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            return {
                "status": "failed",
                "provider": provider or "terraform",
                "deployment_type": "terraform",
                "deployment_id": deployment_id,
                "environment": environment,
                "error_details": str(e)
            }
    
    def get_deployment_status(self, state_info):
        """
        Get the status of a Terraform deployment
        
        Args:
            state_info (dict): Information about the Terraform state
            
        Returns:
            dict: Status and details of the deployment
        """
        if not state_info or 'state_dir' not in state_info or 'state_file' not in state_info:
            return {
                "status": "failed",
                "error_details": "Invalid state information"
            }
            
        state_dir = state_info['state_dir']
        state_file = state_info['state_file']
        
        if not os.path.exists(state_dir) or not os.path.exists(state_file):
            return {
                "status": "failed",
                "error_details": "State directory or file not found"
            }
            
        try:
            # Run terraform show to get the current state
            show_result = self._run_terraform_command(state_dir, ["show", "-json"])
            if show_result['returncode'] != 0:
                return {
                    "status": "failed",
                    "error_details": show_result['stderr']
                }
                
            # Get the outputs
            output_result = self._run_terraform_command(state_dir, ["output", "-json"])
            outputs = json.loads(output_result['stdout']) if output_result['stdout'] else {}
            
            # Parse the state file for resources
            resources = self._parse_terraform_state(state_file)
            
            return {
                "status": "completed",  # Terraform state exists means deployment completed
                "cloud_resources": resources,
                "outputs": outputs
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def update_deployment(self, state_info, template_data=None, parameters=None):
        """
        Update an existing Terraform deployment
        
        Args:
            state_info (dict): Information about the Terraform state
            template_data (dict, optional): New template data
            parameters (dict, optional): New variables for Terraform
            
        Returns:
            dict: Update result with status and details
        """
        if not state_info or 'state_dir' not in state_info or 'state_file' not in state_info:
            return {
                "status": "failed",
                "error_details": "Invalid state information"
            }
            
        state_dir = state_info['state_dir']
        
        if not os.path.exists(state_dir):
            return {
                "status": "failed",
                "error_details": "State directory not found"
            }
            
        try:
            # Update the Terraform files if new template data is provided
            if template_data:
                self._prepare_terraform_files(state_dir, template_data, parameters)
            elif parameters:
                # Just update the variables
                self._write_terraform_variables(state_dir, parameters)
            
            # Run Terraform plan
            plan_result = self._run_terraform_command(state_dir, ["plan", "-out=tfplan"])
            if plan_result['returncode'] != 0:
                return {
                    "status": "failed",
                    "error_details": plan_result['stderr']
                }
            
            # Check if there are any changes
            if "No changes" in plan_result['stdout']:
                return {
                    "status": "completed",
                    "message": "No changes required"
                }
            
            # Apply the Terraform plan
            apply_result = self._run_terraform_command(state_dir, ["apply", "-auto-approve", "tfplan"])
            if apply_result['returncode'] != 0:
                return {
                    "status": "failed",
                    "error_details": apply_result['stderr']
                }
            
            # Get the outputs
            output_result = self._run_terraform_command(state_dir, ["output", "-json"])
            outputs = json.loads(output_result['stdout']) if output_result['stdout'] else {}
            
            # Get the state file for resource tracking
            state_file = os.path.join(state_dir, "terraform.tfstate")
            resources = self._parse_terraform_state(state_file)
            
            return {
                "status": "completed",
                "outputs": outputs,
                "cloud_resources": resources,
                "logs": apply_result['stdout']
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def delete_deployment(self, state_info):
        """
        Delete a Terraform deployment
        
        Args:
            state_info (dict): Information about the Terraform state
            
        Returns:
            dict: Deletion result with status
        """
        if not state_info or 'state_dir' not in state_info:
            return {
                "status": "failed",
                "error_details": "Invalid state information"
            }
            
        state_dir = state_info['state_dir']
        
        if not os.path.exists(state_dir):
            return {
                "status": "failed",
                "error_details": "State directory not found"
            }
            
        try:
            # Run Terraform destroy
            destroy_result = self._run_terraform_command(state_dir, ["destroy", "-auto-approve"])
            if destroy_result['returncode'] != 0:
                return {
                    "status": "failed",
                    "error_details": destroy_result['stderr']
                }
            
            # Clean up the temporary directory
            shutil.rmtree(state_dir, ignore_errors=True)
            
            return {
                "status": "completed",
                "message": "Deployment deleted successfully"
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error_details": str(e)
            }
    
    def _check_terraform_installed(self):
        """Check if Terraform is installed"""
        try:
            result = subprocess.run(["terraform", "--version"], 
                                   capture_output=True, text=True, check=True)
            return True
        except (subprocess.SubprocessError, FileNotFoundError):
            raise RuntimeError("Terraform is not installed or not in PATH")
    
    def _prepare_terraform_files(self, directory, template_data, parameters=None):
        """Prepare Terraform files in the specified directory"""
        # Check if template is a URL or direct template content
        if 'template_url' in template_data:
            # Download the template
            template_content = self._fetch_template_from_url(template_data['template_url'])
            
            # Check if it's a zip file
            if template_data['template_url'].endswith('.zip'):
                # Save the zip file
                zip_path = os.path.join(directory, "template.zip")
                with open(zip_path, 'wb') as f:
                    f.write(template_content)
                
                # Extract the zip file
                import zipfile
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(directory)
                
                # Remove the zip file
                os.remove(zip_path)
            else:
                # Save the template as main.tf
                with open(os.path.join(directory, "main.tf"), 'w') as f:
                    f.write(template_content)
        else:
            # Save the template content as main.tf
            with open(os.path.join(directory, "main.tf"), 'w') as f:
                f.write(template_data['template_content'])
        
        # Write variables if provided
        if parameters:
            self._write_terraform_variables(directory, parameters)
    
    def _write_terraform_variables(self, directory, variables):
        """Write Terraform variables to a file"""
        # Create terraform.tfvars.json file
        with open(os.path.join(directory, "terraform.tfvars.json"), 'w') as f:
            json.dump(variables, f, indent=2)
    
    def _run_terraform_command(self, working_dir, args):
        """Run a Terraform command in the specified directory"""
        command = ["terraform"] + args
        
        process = subprocess.run(
            command,
            cwd=working_dir,
            capture_output=True,
            text=True
        )
        
        return {
            "command": " ".join(command),
            "returncode": process.returncode,
            "stdout": process.stdout,
            "stderr": process.stderr
        }
    
    def _parse_terraform_state(self, state_file):
        """Parse the Terraform state file to extract resources"""
        if not os.path.exists(state_file):
            return []
            
        try:
            with open(state_file, 'r') as f:
                state = json.load(f)
                
            resources = []
            
            # Extract resources from the state file
            for resource in state.get('resources', []):
                for instance in resource.get('instances', []):
                    resources.append({
                        "type": resource.get('type', ''),
                        "name": resource.get('name', ''),
                        "provider": resource.get('provider', ''),
                        "attributes": instance.get('attributes', {})
                    })
                    
            return resources
        except Exception as e:
            print(f"Error parsing Terraform state: {e}")
            return []
    
    def _fetch_template_from_url(self, url):
        """Fetch template content from a URL"""
        response = requests.get(url)
        response.raise_for_status()
        
        # Check if it's a text or binary response
        content_type = response.headers.get('Content-Type', '')
        if 'text' in content_type or 'json' in content_type:
            return response.text
        else:
            return response.content

