from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
import logging

from app.api import deps
from app.core.security import get_current_user
from app.models.user import User, Tenant
from app.models.deployment import Deployment, Template, Environment, DeploymentHistory
from app.models.deployment_details import DeploymentDetails
from app.schemas.deployment import (
    DeploymentCreate,
    DeploymentUpdate,
    DeploymentResponse,
    CloudDeploymentResponse,
    CloudTemplateResponse
)
