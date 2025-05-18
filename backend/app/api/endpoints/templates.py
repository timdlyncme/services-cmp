from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.deployment import Template, Deployment
from app.schemas.deployment import (
    TemplateResponse, TemplateCreate, TemplateUpdate,
    CloudTemplateResponse
)

router = APIRouter()


@router.get("/", response_model=List[CloudTemplateResponse])
def get_templates(
    tenant_id: Optional[str] = None,
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
        # Get templates that are either public or belong to the user's tenant
        query = db.query(Template).filter(
            (Template.is_public == True) | (Template.tenant_id == current_user.tenant_id)
        )
        
        # Filter by tenant if specified
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant with ID {tenant_id} not found"
                )
            query = query.filter(
                (Template.is_public == True) | (Template.tenant_id == tenant.id)
            )
        
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
                tenant = db.query(Tenant).filter(Tenant.id == template.tenant_id).first()
                if tenant:
                    tenant_id = tenant.tenant_id
            
            # Get deployment count
            deployment_count = deployment_counts.get(template.id, 0)
            
            # Convert category to categories list
            categories = []
            if template.category:
                categories = [cat.strip() for cat in template.category.split(",")]
            
            result.append(CloudTemplateResponse(
                id=template.template_id,
                name=template.name,
                description=template.description or "",
                type="terraform",  # Default to terraform, would need to add a type field
                provider=template.provider,
                code="",  # Would need to add a code field or store in a separate table
                deploymentCount=deployment_count,
                uploadedAt=template.created_at.isoformat() if hasattr(template, 'created_at') else "",
                updatedAt=template.updated_at.isoformat() if hasattr(template, 'updated_at') else "",
                categories=categories,
                tenantId=tenant_id
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
            tenant = db.query(Tenant).filter(Tenant.id == template.tenant_id).first()
            if tenant:
                tenant_id = tenant.tenant_id
        
        # Get deployment count
        deployment_count = db.query(func.count(Deployment.id)).filter(
            Deployment.template_id == template.id
        ).scalar()
        
        # Convert category to categories list
        categories = []
        if template.category:
            categories = [cat.strip() for cat in template.category.split(",")]
        
        return CloudTemplateResponse(
            id=template.template_id,
            name=template.name,
            description=template.description or "",
            type="terraform",  # Default to terraform, would need to add a type field
            provider=template.provider,
            code="",  # Would need to add a code field or store in a separate table
            deploymentCount=deployment_count,
            uploadedAt=template.created_at.isoformat() if hasattr(template, 'created_at') else "",
            updatedAt=template.updated_at.isoformat() if hasattr(template, 'updated_at') else "",
            categories=categories,
            tenantId=tenant_id
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
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new template
    """
    # Check if user has permission to create templates
    has_permission = any(p.name == "create:templates" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Create new template
        import uuid
        new_template = Template(
            template_id=str(uuid.uuid4()),
            name=template.name,
            description=template.description,
            category=template.category,
            provider=template.provider,
            is_public=template.is_public,
            tenant_id=None if template.is_public else current_user.tenant_id
        )
        
        db.add(new_template)
        db.commit()
        db.refresh(new_template)
        
        # Get tenant ID for the template
        tenant_id = "public"
        if new_template.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == new_template.tenant_id).first()
            if tenant:
                tenant_id = tenant.tenant_id
        
        # Convert category to categories list
        categories = []
        if new_template.category:
            categories = [cat.strip() for cat in new_template.category.split(",")]
        
        return CloudTemplateResponse(
            id=new_template.template_id,
            name=new_template.name,
            description=new_template.description or "",
            type="terraform",  # Default to terraform
            provider=new_template.provider,
            code="",  # Would need to add a code field
            deploymentCount=0,
            uploadedAt=new_template.created_at.isoformat() if hasattr(new_template, 'created_at') else "",
            updatedAt=new_template.updated_at.isoformat() if hasattr(new_template, 'updated_at') else "",
            categories=categories,
            tenantId=tenant_id
        )
    
    except Exception as e:
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
        # Get the template
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
        
        # Update template
        template.name = template_update.name
        template.description = template_update.description
        template.category = template_update.category
        template.provider = template_update.provider
        template.is_public = template_update.is_public
        
        # Update tenant_id based on is_public
        if template_update.is_public:
            template.tenant_id = None
        elif template.tenant_id is None:
            template.tenant_id = current_user.tenant_id
        
        db.commit()
        db.refresh(template)
        
        # Get tenant ID for the template
        tenant_id = "public"
        if template.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == template.tenant_id).first()
            if tenant:
                tenant_id = tenant.tenant_id
        
        # Get deployment count
        deployment_count = db.query(func.count(Deployment.id)).filter(
            Deployment.template_id == template.id
        ).scalar()
        
        # Convert category to categories list
        categories = []
        if template.category:
            categories = [cat.strip() for cat in template.category.split(",")]
        
        return CloudTemplateResponse(
            id=template.template_id,
            name=template.name,
            description=template.description or "",
            type="terraform",  # Default to terraform
            provider=template.provider,
            code="",  # Would need to add a code field
            deploymentCount=deployment_count,
            uploadedAt=template.created_at.isoformat() if hasattr(template, 'created_at') else "",
            updatedAt=template.updated_at.isoformat() if hasattr(template, 'updated_at') else "",
            categories=categories,
            tenantId=tenant_id
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


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
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

