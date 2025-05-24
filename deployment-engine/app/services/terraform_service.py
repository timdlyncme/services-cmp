import os
import subprocess
import json
import tempfile
from typing import Dict, Any, List, Optional
import asyncio

class TerraformService:
    def __init__(self, terraform_binary: str = None):
        self.terraform_binary = terraform_binary or os.environ.get("TERRAFORM_BINARY_PATH", "terraform")
    
    async def deploy(
        self,
        template_dir: str,
        variables: Dict[str, Any],
        credentials: Dict[str, Any],
        is_dry_run: bool = False,
        auto_approve: bool = False
    ) -> Dict[str, Any]:
        """
        Deploy Terraform template
        """
        try:
            # Create variables file
            variables_file = os.path.join(template_dir, "terraform.tfvars.json")
            with open(variables_file, "w") as f:
                json.dump(variables, f)
            
            # Set environment variables for credentials
            env = os.environ.copy()
            if "aws_access_key_id" in credentials:
                env["AWS_ACCESS_KEY_ID"] = credentials["aws_access_key_id"]
                env["AWS_SECRET_ACCESS_KEY"] = credentials["aws_secret_access_key"]
                env["AWS_REGION"] = credentials.get("aws_region", "us-east-1")
            elif "client_id" in credentials:
                env["ARM_CLIENT_ID"] = credentials["client_id"]
                env["ARM_CLIENT_SECRET"] = credentials["client_secret"]
                env["ARM_TENANT_ID"] = credentials["tenant_id"]
                env["ARM_SUBSCRIPTION_ID"] = credentials["subscription_id"]
            elif "credentials_json" in credentials:
                # Write GCP credentials to file
                gcp_credentials_file = os.path.join(template_dir, "gcp-credentials.json")
                with open(gcp_credentials_file, "w") as f:
                    f.write(credentials["credentials_json"])
                env["GOOGLE_APPLICATION_CREDENTIALS"] = gcp_credentials_file
                env["GOOGLE_PROJECT"] = credentials.get("project_id", "")
            
            # Initialize Terraform
            init_result = await self._run_command(
                [self.terraform_binary, "init"],
                cwd=template_dir,
                env=env
            )
            
            if init_result["return_code"] != 0:
                return {
                    "success": False,
                    "error_message": "Terraform initialization failed",
                    "error_details": {
                        "stdout": init_result["stdout"],
                        "stderr": init_result["stderr"],
                        "return_code": init_result["return_code"]
                    },
                    "logs": init_result["stdout"] + "\n" + init_result["stderr"]
                }
            
            # Plan Terraform
            plan_cmd = [self.terraform_binary, "plan", "-detailed-exitcode", "-var-file=terraform.tfvars.json"]
            if is_dry_run:
                plan_cmd.append("-no-color")
            
            plan_result = await self._run_command(
                plan_cmd,
                cwd=template_dir,
                env=env
            )
            
            # Return code 0 means no changes, 1 means error, 2 means changes
            if plan_result["return_code"] == 1:
                return {
                    "success": False,
                    "error_message": "Terraform plan failed",
                    "error_details": {
                        "stdout": plan_result["stdout"],
                        "stderr": plan_result["stderr"],
                        "return_code": plan_result["return_code"]
                    },
                    "logs": init_result["stdout"] + "\n" + init_result["stderr"] + "\n" + plan_result["stdout"] + "\n" + plan_result["stderr"]
                }
            
            # If dry run, return plan results
            if is_dry_run:
                return {
                    "success": True,
                    "outputs": {},
                    "resources": self._parse_resources_from_plan(plan_result["stdout"]),
                    "logs": init_result["stdout"] + "\n" + init_result["stderr"] + "\n" + plan_result["stdout"] + "\n" + plan_result["stderr"]
                }
            
            # Apply Terraform
            apply_cmd = [self.terraform_binary, "apply", "-var-file=terraform.tfvars.json"]
            if auto_approve:
                apply_cmd.append("-auto-approve")
            
            apply_result = await self._run_command(
                apply_cmd,
                cwd=template_dir,
                env=env
            )
            
            if apply_result["return_code"] != 0:
                return {
                    "success": False,
                    "error_message": "Terraform apply failed",
                    "error_details": {
                        "stdout": apply_result["stdout"],
                        "stderr": apply_result["stderr"],
                        "return_code": apply_result["return_code"]
                    },
                    "logs": init_result["stdout"] + "\n" + init_result["stderr"] + "\n" + plan_result["stdout"] + "\n" + plan_result["stderr"] + "\n" + apply_result["stdout"] + "\n" + apply_result["stderr"]
                }
            
            # Get outputs
            output_result = await self._run_command(
                [self.terraform_binary, "output", "-json"],
                cwd=template_dir,
                env=env
            )
            
            outputs = {}
            if output_result["return_code"] == 0 and output_result["stdout"]:
                try:
                    outputs = json.loads(output_result["stdout"])
                    # Convert complex output structure to simple key-value pairs
                    for key, value in outputs.items():
                        if isinstance(value, dict) and "value" in value:
                            outputs[key] = value["value"]
                except json.JSONDecodeError:
                    pass
            
            # Get state
            state_result = await self._run_command(
                [self.terraform_binary, "state", "list"],
                cwd=template_dir,
                env=env
            )
            
            resources = []
            if state_result["return_code"] == 0:
                resources = state_result["stdout"].strip().split("\n")
                resources = [r for r in resources if r]
            
            return {
                "success": True,
                "outputs": outputs,
                "resources": resources,
                "logs": init_result["stdout"] + "\n" + init_result["stderr"] + "\n" + plan_result["stdout"] + "\n" + plan_result["stderr"] + "\n" + apply_result["stdout"] + "\n" + apply_result["stderr"]
            }
        
        except Exception as e:
            return {
                "success": False,
                "error_message": str(e),
                "error_details": {"exception": str(e)},
                "logs": f"Exception: {str(e)}"
            }
    
    async def destroy(
        self,
        template_dir: str,
        variables: Dict[str, Any],
        credentials: Dict[str, Any],
        auto_approve: bool = False
    ) -> Dict[str, Any]:
        """
        Destroy Terraform resources
        """
        try:
            # Create variables file
            variables_file = os.path.join(template_dir, "terraform.tfvars.json")
            with open(variables_file, "w") as f:
                json.dump(variables, f)
            
            # Set environment variables for credentials
            env = os.environ.copy()
            if "aws_access_key_id" in credentials:
                env["AWS_ACCESS_KEY_ID"] = credentials["aws_access_key_id"]
                env["AWS_SECRET_ACCESS_KEY"] = credentials["aws_secret_access_key"]
                env["AWS_REGION"] = credentials.get("aws_region", "us-east-1")
            elif "client_id" in credentials:
                env["ARM_CLIENT_ID"] = credentials["client_id"]
                env["ARM_CLIENT_SECRET"] = credentials["client_secret"]
                env["ARM_TENANT_ID"] = credentials["tenant_id"]
                env["ARM_SUBSCRIPTION_ID"] = credentials["subscription_id"]
            elif "credentials_json" in credentials:
                # Write GCP credentials to file
                gcp_credentials_file = os.path.join(template_dir, "gcp-credentials.json")
                with open(gcp_credentials_file, "w") as f:
                    f.write(credentials["credentials_json"])
                env["GOOGLE_APPLICATION_CREDENTIALS"] = gcp_credentials_file
                env["GOOGLE_PROJECT"] = credentials.get("project_id", "")
            
            # Initialize Terraform
            init_result = await self._run_command(
                [self.terraform_binary, "init"],
                cwd=template_dir,
                env=env
            )
            
            if init_result["return_code"] != 0:
                return {
                    "success": False,
                    "error_message": "Terraform initialization failed",
                    "error_details": {
                        "stdout": init_result["stdout"],
                        "stderr": init_result["stderr"],
                        "return_code": init_result["return_code"]
                    },
                    "logs": init_result["stdout"] + "\n" + init_result["stderr"]
                }
            
            # Destroy Terraform
            destroy_cmd = [self.terraform_binary, "destroy", "-var-file=terraform.tfvars.json"]
            if auto_approve:
                destroy_cmd.append("-auto-approve")
            
            destroy_result = await self._run_command(
                destroy_cmd,
                cwd=template_dir,
                env=env
            )
            
            if destroy_result["return_code"] != 0:
                return {
                    "success": False,
                    "error_message": "Terraform destroy failed",
                    "error_details": {
                        "stdout": destroy_result["stdout"],
                        "stderr": destroy_result["stderr"],
                        "return_code": destroy_result["return_code"]
                    },
                    "logs": init_result["stdout"] + "\n" + init_result["stderr"] + "\n" + destroy_result["stdout"] + "\n" + destroy_result["stderr"]
                }
            
            return {
                "success": True,
                "logs": init_result["stdout"] + "\n" + init_result["stderr"] + "\n" + destroy_result["stdout"] + "\n" + destroy_result["stderr"]
            }
        
        except Exception as e:
            return {
                "success": False,
                "error_message": str(e),
                "error_details": {"exception": str(e)},
                "logs": f"Exception: {str(e)}"
            }
    
    async def _run_command(
        self,
        command: List[str],
        cwd: str,
        env: Dict[str, str] = None,
        timeout: int = 600
    ) -> Dict[str, Any]:
        """
        Run command and return stdout, stderr, and return code
        """
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
                env=env
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
                return {
                    "stdout": stdout.decode(),
                    "stderr": stderr.decode(),
                    "return_code": process.returncode
                }
            except asyncio.TimeoutError:
                process.kill()
                return {
                    "stdout": "",
                    "stderr": f"Command timed out after {timeout} seconds",
                    "return_code": -1
                }
        
        except Exception as e:
            return {
                "stdout": "",
                "stderr": f"Error running command: {str(e)}",
                "return_code": -1
            }
    
    def _parse_resources_from_plan(self, plan_output: str) -> List[str]:
        """
        Parse resources from Terraform plan output
        """
        resources = []
        lines = plan_output.split("\n")
        
        for line in lines:
            line = line.strip()
            if line.startswith("+ resource ") or line.startswith("- resource ") or line.startswith("~ resource "):
                parts = line.split(" ")
                if len(parts) >= 3:
                    resource_type = parts[2].strip('"')
                    if len(parts) >= 5:
                        resource_name = parts[4].strip('"')
                        resources.append(f"{resource_type}.{resource_name}")
        
        return resources

