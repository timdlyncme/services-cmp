from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
import logging
from datetime import datetime

from app.api.deps import get_db, get_current_user
from app.models.user import User, Tenant
from app.models.deployment import Template, Deployment, TemplateVersion
from app.schemas.deployment import (
    TemplateResponse, TemplateCreate, TemplateUpdate,
    CloudTemplateResponse, TemplateVersionCreate, TemplateVersionResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/categories", response_model=Dict[str, int])
def get_template_categories(
    tenant_id: Optional[str] = Query(None, description="Filter by tenant ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all available template categories with their template counts
    """
    try:
        # Check if user has permission to view templates
        has_permission = any(p.name == "view:templates" for p in current_user.role.permissions)
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view templates"
            )

        # Get templates that the user has access to
        query = db.query(Template)

        # Handle tenant filtering
        if tenant_id:
            # Check if user has access to the specified tenant
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant with ID {tenant_id} not found"
                )

            # Check if user has access to this tenant
            user_tenant = db.query(Tenant).filter(Tenant.tenant_id == current_user.tenant_id).first()
            if not user_tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User tenant not found"
                )

            # Admin and MSP users can view all tenants
            if current_user.role.name not in ["admin", "msp"]:
                if tenant.tenant_id != user_tenant.tenant_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view templates for this tenant"
                    )

            # Only return templates that belong to the specified tenant
            query = query.filter(Template.tenant_id == tenant.tenant_id)
        else:
            # No tenant specified, show templates from all tenants the user has access to
            user_tenant = db.query(Tenant).filter(Tenant.tenant_id == current_user.tenant_id).first()
            # Admin and MSP users can see all templates
            if current_user.role.name not in ["admin", "msp"]:
                # Regular users can only see templates from their tenant
                if user_tenant:
                    query = query.filter(Template.tenant_id == user_tenant.tenant_id)

        templates = query.all()

        # Aggregate categories and count templates
        category_counts = {}
        for template in templates:
            if template.categories and isinstance(template.categories, list):
                for category in template.categories:
                    if category.strip():  # Only count non-empty categories
                        category_counts[category.strip()] = category_counts.get(category.strip(), 0) + 1

        return category_counts

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving template categories: {str(e)}"
        )

@router.get("/", response_model=List[CloudTemplateResponse])
def get_templates(
    tenant_id: Optional[str] = Query(None, description="Filter by tenant ID"),
    group_by_category: Optional[bool] = Query(False, description="Group templates by categories"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all templates for the current user's tenant or a specific tenant
    """
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # Check if user has permission to view templates
    has_permission = any(p.name == "view:templates" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get templates that the user has access to
        query = db.query(Template)
        
        # Get the user's tenant
        user_tenant = db.query(Tenant).filter(Tenant.tenant_id == current_user.tenant_id).first()
        
        # Filter by tenant if specified
        if tenant_id:
            # Handle different tenant ID formats
            try:
                # Remove 'tenant-' prefix if present
                if tenant_id.startswith('tenant-'):
                    tenant_id = tenant_id[7:]
                
                # Try to parse as UUID
                try:
                    uuid_obj = uuid.UUID(tenant_id)
                    tenant = db.query(Tenant).filter(Tenant.tenant_id == str(uuid_obj)).first()
                except ValueError:
                    # Not a valid UUID, try to find by numeric ID
                    try:
                        id_value = int(tenant_id)
                        tenant = db.query(Tenant).filter(Tenant.id == id_value).first()
                    except (ValueError, TypeError):
                        tenant = None
                
                if not tenant:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Tenant with ID {tenant_id} not found"
                    )
                
                # Check if user has access to this tenant
                if tenant.tenant_id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view templates for this tenant"
                    )
                
                # Only return templates that belong to the specified tenant
                query = query.filter(Template.tenant_id == tenant.tenant_id)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid tenant ID format: {str(e)}"
                )
        else:
            # No tenant specified, show templates from all tenants the user has access to
            if current_user.role.name == "admin" or current_user.role.name == "msp":
                # Admin and MSP users can see all templates
                pass
            else:
                # Regular users can only see templates from their tenant
                if user_tenant:
                    query = query.filter(Template.tenant_id == user_tenant.tenant_id)
        
        templates = query.all()
        
        # Get deployment counts for each template
        template_ids = [template.id for template in templates]
        deployment_counts = {}
        if template_ids:
            counts = db.query(
                Deployment.template_id,
                func.count(Deployment.id).label("count")
            ).filter(
                Deployment.template_id.in_(template_ids)
            ).group_by(
                Deployment.template_id
            ).all()
            
            deployment_counts = {template_id: count for template_id, count in counts}
        
        # Convert to frontend-compatible format
        result = []
        for template in templates:
            # Get tenant ID for the template
            tenant_id = "public"
            if template.tenant_id:
                tenant = db.query(Tenant).filter(Tenant.tenant_id == template.tenant_id).first()
                if tenant:
                    tenant_id = tenant.tenant_id
            
            # Get the template's code
            template_code = template.code or ""
            
            # Get deployment count
            deployment_count = deployment_counts.get(template.id, 0)
            
            # Convert category to categories list
            categories = []
            if template.categories:
                categories = template.categories if isinstance(template.categories, list) else []
            
            # Get the last user who updated the template
            last_updated_by = current_user.full_name or current_user.username
            
            # Debug log for parameters and variables
            print(f"Template parameters: {template.parameters}")
            print(f"Template variables: {template.variables}")
            
            result.append(CloudTemplateResponse(
                id=template.template_id,
                template_id=template.template_id,  # Explicitly include template_id
                name=template.name,
                description=template.description or "",
                type=template.type,  # Use the actual template type from the database
                provider=template.provider,
                code=template_code,
                deploymentCount=deployment_count,
                uploadedAt=template.created_at.isoformat() if hasattr(template, 'created_at') else "",
                updatedAt=template.updated_at.isoformat() if hasattr(template, 'updated_at') else "",
                categories=categories,
                isPublic=template.is_public,
                currentVersion=template.current_version,
                parameters=template.parameters,
                variables=template.variables,
                tenantId=tenant_id,
                lastUpdatedBy=last_updated_by
            ))
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving templates: {str(e)}"
        )


@router.get("/{template_id}", response_model=CloudTemplateResponse)
def get_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific template by ID
    """
    # Check if user has permission to view templates
    has_permission = any(p.name == "view:templates" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        template = db.query(Template).filter(Template.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to this template
        if not template.is_public and template.tenant_id != current_user.tenant_id:
            # Admin users can view all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this template"
                )
        
        # Get tenant ID for the template
        tenant_id = "public"
        if template.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == template.tenant_id).first()
            if tenant:
                tenant_id = tenant.tenant_id
        
        # Get deployment count
        deployment_count = db.query(func.count(Deployment.id)).filter(
            Deployment.template_id == template.id
        ).scalar()
        
        # Convert category to categories list
        categories = []
        if template.categories:
            categories = template.categories if isinstance(template.categories, list) else []
        
        # Use the template's code field directly
        code = template.code or ""
        
        # If no code in the template, try to get it from the latest version
        if not code and template.versions:
            # Sort versions by created_at in descending order
            sorted_versions = sorted(template.versions, key=lambda v: v.created_at, reverse=True)
            if sorted_versions:
                latest_version = sorted_versions[0]
                code = latest_version.code or ""
        
        # Get the last user who updated the template
        last_updated_by = current_user.full_name or current_user.username
        
        # Debug log for parameters and variables
        print(f"Template parameters: {template.parameters}")
        print(f"Template variables: {template.variables}")
        
        return CloudTemplateResponse(
            id=template.template_id,
            template_id=template.template_id,  # Explicitly include template_id
            name=template.name,
            description=template.description or "",
            type=template.type,  # Use the actual template type from the database
            provider=template.provider,
            code=code,
            deploymentCount=deployment_count,
            uploadedAt=template.created_at.isoformat() if hasattr(template, 'created_at') else "",
            updatedAt=template.updated_at.isoformat() if hasattr(template, 'updated_at') else "",
            categories=categories,
            isPublic=template.is_public,
            currentVersion=template.current_version,
            parameters=template.parameters,
            variables=template.variables,
            tenantId=tenant_id,
            lastUpdatedBy=last_updated_by
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving template: {str(e)}"
        )


@router.post("/", response_model=CloudTemplateResponse)
def create_template(
    template: TemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tenant_id: Optional[str] = None
) -> Any:
    """
    Create a new template
    
    If tenant_id is provided, it will be used to create the template in that tenant.
    Otherwise, the current user's tenant ID will be used.
    """
    # Set up logging for this endpoint
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)
    
    logger.debug(f"Creating new template: {template.name}")
    logger.debug(f"Template type: {template.type}")
    logger.debug(f"Template category: {template.categories}")
    logger.debug(f"Template code length: {len(template.code) if template.code else 0}")
    logger.debug(f"Requested tenant_id: {tenant_id}")
    
    # Check if user has permission to create templates
    has_permission = any(p.name == "create:templates" for p in current_user.role.permissions)
    if not has_permission:
        logger.warning(f"User {current_user.username} does not have permission to create templates")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Use the provided tenant_id if it exists, otherwise use the current user's tenant
        template_tenant_id = tenant_id if tenant_id else current_user.tenant_id
        logger.debug(f"Using tenant_id: {template_tenant_id}")
        
        # Get the tenant
        template_tenant = db.query(Tenant).filter(Tenant.tenant_id == template_tenant_id).first()
        if not template_tenant and not template.is_public:
            logger.warning(f"Tenant not found: {template_tenant_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tenant with ID {template_tenant_id} not found"
            )
        
        # Check if user has permission to create for this tenant
        if template_tenant_id != current_user.tenant_id:
            # Only admin or MSP users can create for other tenants
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                logger.warning(f"User {current_user.username} not authorized to create templates for tenant {template_tenant_id}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to create templates for other tenants"
                )
        
        # Debug: Print the template data
        logger.debug(f"Template data received: {template.dict()}")
        logger.debug(f"Template type: {template.type}")
        logger.debug(f"Template category: {template.categories}")
        
        # Create new template
        new_template = Template(
            template_id=str(uuid.uuid4()),
            name=template.name,
            description=template.description,
            categories=template.categories,  # Use only the new categories field
            provider=template.provider,
            type=template.type,  # Always use the provided type
            is_public=template.is_public,
            code=template.code,  # Store the code directly in the template
            parameters=template.parameters,  # Store parameters
            variables=template.variables,  # Store variables
            tenant_id=tenant.tenant_id,
            created_by=current_user.id,
            updated_by=current_user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Debug: Print the new template object
        logger.debug(f"New template object: type={new_template.type}, categories={new_template.categories}")
        
        db.add(new_template)
        db.commit()
        db.refresh(new_template)
        
        # Verify the template was created correctly
        created_template = db.query(Template).filter(Template.id == new_template.id).first()
        logger.debug(f"Created template: type={created_template.type}, categories={created_template.categories}")
        
        # Create initial version
        initial_version = TemplateVersion(
            template_id=new_template.id,
            version="1.0.0",
            code=template.code,
            changes="Initial version",
            created_at=datetime.utcnow(),
            created_by_id=current_user.id
        )
        
        db.add(initial_version)
        db.commit()
        
        # Get tenant ID for the template
        tenant_id = "public"
        if new_template.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == new_template.tenant_id).first()
            if tenant:
                tenant_id = tenant.tenant_id
        
        # Convert category to categories list
        categories = []
        if new_template.categories:
            categories = new_template.categories if isinstance(new_template.categories, list) else []
        
        return CloudTemplateResponse(
            id=new_template.template_id,
            template_id=new_template.template_id,  # Explicitly include template_id
            name=new_template.name,
            description=new_template.description or "",
            type=new_template.type,  # Use the actual template type from the database
            provider=new_template.provider,
            code=new_template.code or "",
            deploymentCount=0,
            uploadedAt=new_template.created_at.isoformat(),
            updatedAt=new_template.updated_at.isoformat(),
            categories=categories,
            isPublic=new_template.is_public,
            currentVersion=new_template.current_version,
            parameters=new_template.parameters,
            variables=new_template.variables,
            tenantId=tenant_id,
            lastUpdatedBy=current_user.full_name or current_user.username
        )
    
    except Exception as e:
        logger.error(f"Error creating template: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating template: {str(e)}"
        )


@router.put("/{template_id}", response_model=CloudTemplateResponse)
def update_template(
    template_id: str,
    template_update: TemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update a template
    """
    # Check if user has permission to update templates
    has_permission = any(p.name == "update:templates" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        template = db.query(Template).filter(Template.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to update this template
        if not template.is_public and template.tenant_id != current_user.tenant_id:
            # Admin users can update all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this template"
                )
        
        # Update template fields
        if template_update.name is not None:
            template.name = template_update.name
        
        if template_update.description is not None:
            template.description = template_update.description
        
        if template_update.provider is not None:
            template.provider = template_update.provider
        
        if template_update.type is not None:
            template.type = template_update.type
        
        if template_update.is_public is not None:
            template.is_public = template_update.is_public
        
        if template_update.categories is not None:
            template.categories = template_update.categories
        
        if template_update.parameters is not None:
            template.parameters = template_update.parameters
        
        if template_update.variables is not None:
            template.variables = template_update.variables
        
        # Only update code if it's provided
        if template_update.code is not None:
            template.code = template_update.code
            
            # Only create a new version if create_new_version flag is True
            if template_update.create_new_version:
                # Determine the new version number
                current_version = template.current_version or "1.0.0"
                
                # Split version into major, minor, patch
                try:
                    major, minor, patch = map(int, current_version.split('.'))
                    # Increment patch version
                    patch += 1
                    new_version_number = f"{major}.{minor}.{patch}"
                except ValueError:
                    # If current version is not in the expected format, default to incrementing
                    new_version_number = f"{current_version}.1"
                
                print(f"Creating new version in update: {new_version_number} (previous: {current_version})")
                
                # Create new version
                new_version = TemplateVersion(
                    template_id=template.id,
                    version=new_version_number,
                    code=template_update.code,
                    changes="Updated template code",
                    created_at=datetime.utcnow(),
                    created_by_id=current_user.id
                )
                
                db.add(new_version)
                
                # Update template with new version number
                template.current_version = new_version_number
        
        template.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(template)
        
        # Get tenant ID for the template
        tenant_id = "public"
        if template.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == template.tenant_id).first()
            if tenant:
                tenant_id = tenant.tenant_id
        
        # Get deployment count
        deployment_count = db.query(func.count(Deployment.id)).filter(
            Deployment.template_id == template.id
        ).scalar()
        
        # Convert category to categories list
        categories = []
        if template.categories:
            categories = template.categories if isinstance(template.categories, list) else []
        
        # Get the last user who updated the template
        last_updated_by = current_user.full_name or current_user.username
        
        return CloudTemplateResponse(
            id=template.template_id,
            template_id=template.template_id,  # Explicitly include template_id
            name=template.name,
            description=template.description or "",
            type=template.type,  # Use the actual template type from the database
            provider=template.provider,
            code=template.code or "",
            deploymentCount=deployment_count,
            uploadedAt=template.created_at.isoformat() if hasattr(template, 'created_at') else "",
            updatedAt=template.updated_at.isoformat() if hasattr(template, 'updated_at') else "",
            categories=categories,
            isPublic=template.is_public,
            currentVersion=template.current_version,
            parameters=template.parameters,
            variables=template.variables,
            tenantId=tenant_id,
            lastUpdatedBy=last_updated_by
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating template: {str(e)}"
        )


@router.delete("/{template_id}")
def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete a template
    """
    # Check if user has permission to delete templates
    has_permission = any(p.name == "delete:templates" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the template
        template = db.query(Template).filter(Template.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to delete this template
        if not template.is_public and template.tenant_id != current_user.tenant_id:
            # Admin users can delete all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete this template"
                )
        
        # Check if template is used by any deployments
        deployments = db.query(Deployment).filter(Deployment.template_id == template.id).first()
        if deployments:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete template that is used by deployments"
            )
        
        # Delete template versions first
        db.query(TemplateVersion).filter(TemplateVersion.template_id == template.id).delete()
        
        # Delete template
        db.delete(template)
        db.commit()
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting template: {str(e)}"
        )


@router.get("/{template_id}/versions", response_model=List[dict])
def get_template_versions(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all versions of a template
    """
    # Check if user has permission to view templates
    has_permission = any(p.name == "view:templates" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        template = db.query(Template).filter(Template.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to this template
        if not template.is_public and template.tenant_id != current_user.tenant_id:
            # Admin users can view all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this template"
                )
        
        # Get all versions
        versions = db.query(TemplateVersion).filter(TemplateVersion.template_id == template.id).all()
        
        # Sort versions by created_at in descending order
        versions = sorted(versions, key=lambda v: v.created_at, reverse=True)
        
        # Convert to response format
        result = []
        for version in versions:
            created_by = db.query(User).filter(User.id == version.created_by_id).first()
            result.append({
                "id": version.id,
                "version": version.version,
                "changes": version.changes,
                "created_at": version.created_at.isoformat(),
                "created_by": created_by.username if created_by else "Unknown",
                "is_current": version.version == template.current_version
            })
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving template versions: {str(e)}"
        )


@router.post("/{template_id}/versions", response_model=TemplateVersionResponse)
def create_template_version(
    template_id: str,
    version: TemplateVersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new version of a template
    """
    # Check if user has permission to update templates
    has_permission = any(p.name == "update:templates" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        template = db.query(Template).filter(Template.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to update this template
        if not template.is_public and template.tenant_id != current_user.tenant_id:
            # Admin users can update all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this template"
                )
        
        # Determine the new version number
        new_version_number = version.version
        
        # If no specific version is provided or it's the same as the current version,
        # increment the current version
        if not new_version_number or new_version_number == template.current_version:
            # Parse current version (default to 1.0.0 if not set)
            current_version = template.current_version or "1.0.0"
            
            # Split version into major, minor, patch
            try:
                major, minor, patch = map(int, current_version.split('.'))
                # Increment patch version
                patch += 1
                new_version_number = f"{major}.{minor}.{patch}"
            except ValueError:
                # If current version is not in the expected format, default to incrementing
                new_version_number = f"{current_version}.1"
        
        print(f"Creating new version: {new_version_number} (previous: {template.current_version})")
        
        # Create new version
        new_version = TemplateVersion(
            template_id=template.id,
            version=new_version_number,
            code=version.code,
            changes=version.commit_message or f"Updated to version {new_version_number}",
            created_at=datetime.utcnow(),
            created_by_id=current_user.id
        )
        
        db.add(new_version)
        
        # Update template with new code and version
        template.code = version.code
        template.current_version = new_version_number
        template.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(new_version)
        
        # Get created_by user
        created_by = db.query(User).filter(User.id == new_version.created_by_id).first()
        created_by_name = created_by.full_name if created_by else "Unknown"
        
        # Check if this is the current version
        is_current = template.current_version == new_version.version
        
        return TemplateVersionResponse(
            id=new_version.id,
            version=new_version.version,
            changes=new_version.changes,
            created_at=new_version.created_at.isoformat(),
            created_by=created_by_name,
            is_current=is_current
        )
    except Exception as e:
        db.rollback()
        print(f"Error creating template version: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating template version: {str(e)}"
        )


@router.get("/{template_id}/versions/{version_id}", response_model=dict)
def get_template_version(
    template_id: str,
    version_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific version of a template
    """
    # Check if user has permission to view templates
    has_permission = any(p.name == "view:templates" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        template = db.query(Template).filter(Template.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to this template
        if not template.is_public and template.tenant_id != current_user.tenant_id:
            # Admin users can view all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this template"
                )
        
        # Get the specific version
        version = db.query(TemplateVersion).filter(
            TemplateVersion.template_id == template.id,
            TemplateVersion.id == version_id
        ).first()
        
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template version with ID {version_id} not found"
            )
        
        # Get created_by user
        created_by = db.query(User).filter(User.id == version.created_by_id).first()
        
        return {
            "id": version.id,
            "version": version.version,
            "changes": version.changes,
            "code": version.code,
            "created_at": version.created_at.isoformat(),
            "created_by": created_by.username if created_by else "Unknown",
            "is_current": version.version == template.current_version
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving template version: {str(e)}"
        )


@router.options("/")
def options_templates():
    """
    Handle preflight requests for templates
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@router.options("/{template_id}")
def options_template_by_id():
    """
    Handle preflight requests for specific template
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response
