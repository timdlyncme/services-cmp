from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.template_foundry import TemplateFoundry
from app.models.template_foundry_versions import TemplateFoundryVersion
from app.schemas.template_foundry import (
    TemplateFoundryResponse, TemplateFoundryCreate, TemplateFoundryUpdate,
    TemplateFoundryVersionCreate, TemplateFoundryVersionResponse
)

router = APIRouter()


@router.get("/", response_model=List[TemplateFoundryResponse])
def get_templates(
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all templates from the template foundry
    """
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # Check if user has permission to view template foundry
    has_permission = any(p.name == "view:template-foundry" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        query = db.query(TemplateFoundry)
        
        # Filter by tenant
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant with ID {tenant_id} not found"
                )
            
            # Check if user has access to this tenant
            if tenant.id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view templates for this tenant"
                )
            
            query = query.filter(TemplateFoundry.tenant_id == tenant.id)
        else:
            # Default to current user's tenant
            query = query.filter(TemplateFoundry.tenant_id == current_user.tenant_id)
        
        templates = query.all()
        
        return templates
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving templates: {str(e)}"
        )


@router.get("/{template_id}", response_model=TemplateFoundryResponse)
def get_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific template from the template foundry
    """
    # Check if user has permission to view template foundry
    has_permission = any(p.name == "view:template-foundry" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        template = db.query(TemplateFoundry).filter(TemplateFoundry.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to this template's tenant
        if template.tenant_id != current_user.tenant_id:
            # Admin users can view all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this template"
                )
        
        return template
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving template: {str(e)}"
        )


@router.post("/", response_model=TemplateFoundryResponse)
def create_template(
    template: TemplateFoundryCreate,
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new template in the template foundry
    """
    # Check if user has permission to create templates
    has_permission = any(p.name == "create:template-foundry" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Determine which tenant to use
        target_tenant_id = current_user.tenant_id
        
        # If tenant_id is provided, use that instead
        if tenant_id:
            # Check if tenant exists
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant with ID {tenant_id} not found"
                )
            
            # Check if user has access to this tenant
            if tenant.id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to create templates for this tenant"
                )
            
            target_tenant_id = tenant.id
        
        # Create new template
        import uuid
        new_template = TemplateFoundry(
            template_id=str(uuid.uuid4()),
            name=template.name,
            description=template.description,
            type=template.type,
            provider=template.provider,
            code=template.code,
            version=template.version,
            categories=template.categories,
            is_published=template.is_published,
            author=template.author or current_user.username,
            commit_id=template.commit_id,
            tenant_id=target_tenant_id,
            created_by_id=current_user.id
        )
        
        db.add(new_template)
        db.commit()
        db.refresh(new_template)
        
        # Create initial version
        initial_version = TemplateFoundryVersion(
            version=template.version,
            changes="Initial version",
            code=template.code,
            template_id=new_template.id,
            created_by_id=current_user.id
        )
        
        db.add(initial_version)
        db.commit()
        
        # Refresh template to include the version
        db.refresh(new_template)
        
        return new_template
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating template: {str(e)}"
        )


@router.put("/{template_id}", response_model=TemplateFoundryResponse)
def update_template(
    template_id: str,
    template_update: TemplateFoundryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update a template in the template foundry
    """
    # Check if user has permission to update templates
    has_permission = any(p.name == "update:template-foundry" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the template
        template = db.query(TemplateFoundry).filter(TemplateFoundry.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to this template's tenant
        if template.tenant_id != current_user.tenant_id:
            # Admin users can update all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this template"
                )
        
        # Check if code has changed
        code_changed = template_update.code is not None and template_update.code != template.code
        version_changed = template_update.version is not None and template_update.version != template.version
        
        # Update template fields
        if template_update.name is not None:
            template.name = template_update.name
        
        if template_update.description is not None:
            template.description = template_update.description
        
        if template_update.type is not None:
            template.type = template_update.type
        
        if template_update.provider is not None:
            template.provider = template_update.provider
        
        if template_update.code is not None:
            template.code = template_update.code
        
        if template_update.version is not None:
            template.version = template_update.version
        
        if template_update.categories is not None:
            template.categories = template_update.categories
        
        if template_update.is_published is not None:
            template.is_published = template_update.is_published
        
        if template_update.author is not None:
            template.author = template_update.author
        
        if template_update.commit_id is not None:
            template.commit_id = template_update.commit_id
        
        # Create a new version if code or version has changed
        if code_changed or version_changed:
            new_version = TemplateFoundryVersion(
                version=template.version,
                changes=f"Updated to version {template.version}",
                code=template.code,
                template_id=template.id,
                created_by_id=current_user.id
            )
            
            db.add(new_version)
        
        db.commit()
        db.refresh(template)
        
        return template
    
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
    Delete a template from the template foundry
    """
    # Check if user has permission to delete templates
    has_permission = any(p.name == "delete:template-foundry" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the template
        template = db.query(TemplateFoundry).filter(TemplateFoundry.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to this template's tenant
        if template.tenant_id != current_user.tenant_id:
            # Admin users can delete all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete this template"
                )
        
        # Delete template (versions will be deleted automatically due to cascade)
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


@router.post("/{template_id}/versions", response_model=TemplateFoundryVersionResponse)
def create_template_version(
    template_id: str,
    version: TemplateFoundryVersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new version for a template
    """
    # Check if user has permission to update templates
    has_permission = any(p.name == "update:template-foundry" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the template
        template = db.query(TemplateFoundry).filter(TemplateFoundry.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to this template's tenant
        if template.tenant_id != current_user.tenant_id:
            # Admin users can update all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this template"
                )
        
        # Create new version
        new_version = TemplateFoundryVersion(
            version=version.version,
            changes=version.changes,
            code=version.code,
            template_id=template.id,
            created_by_id=current_user.id
        )
        
        db.add(new_version)
        
        # Update template with new version
        template.version = version.version
        template.code = version.code
        
        db.commit()
        db.refresh(new_version)
        
        return new_version
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating template version: {str(e)}"
        )


@router.get("/{template_id}/versions", response_model=List[TemplateFoundryVersionResponse])
def get_template_versions(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all versions for a template
    """
    # Check if user has permission to view templates
    has_permission = any(p.name == "view:template-foundry" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the template
        template = db.query(TemplateFoundry).filter(TemplateFoundry.template_id == template_id).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found"
            )
        
        # Check if user has access to this template's tenant
        if template.tenant_id != current_user.tenant_id:
            # Admin users can view all templates
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this template"
                )
        
        # Get versions
        versions = db.query(TemplateFoundryVersion).filter(
            TemplateFoundryVersion.template_id == template.id
        ).order_by(
            TemplateFoundryVersion.created_at.desc()
        ).all()
        
        return versions
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving template versions: {str(e)}"
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
