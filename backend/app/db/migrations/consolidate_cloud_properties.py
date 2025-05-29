"""
Consolidate cloud_region and resource_group into cloud_properties column
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import json

# revision identifiers, used by Alembic.
revision = 'consolidate_cloud_properties'
down_revision = None  # Set this to the previous migration
depends_on = None

def upgrade():
    """
    Consolidate cloud_region and resource_group columns into cloud_properties JSON column
    """
    # Add the new cloud_properties column
    op.add_column('deployment_details', sa.Column('cloud_properties', sa.JSON(), nullable=True))
    
    # Migrate existing data
    connection = op.get_bind()
    
    # Get all existing records with cloud_region or resource_group data
    result = connection.execute(
        sa.text("SELECT id, cloud_region, resource_group FROM deployment_details WHERE cloud_region IS NOT NULL OR resource_group IS NOT NULL")
    )
    
    for row in result:
        cloud_properties = {}
        if row.cloud_region:
            cloud_properties['location'] = row.cloud_region
        if row.resource_group:
            cloud_properties['resource_group'] = row.resource_group
        
        if cloud_properties:
            connection.execute(
                sa.text("UPDATE deployment_details SET cloud_properties = :cloud_properties WHERE id = :id"),
                {"cloud_properties": json.dumps(cloud_properties), "id": row.id}
            )
    
    # Drop the old columns
    op.drop_column('deployment_details', 'cloud_region')
    op.drop_column('deployment_details', 'resource_group')

def downgrade():
    """
    Restore cloud_region and resource_group columns from cloud_properties
    """
    # Add back the old columns
    op.add_column('deployment_details', sa.Column('cloud_region', sa.String(), nullable=True))
    op.add_column('deployment_details', sa.Column('resource_group', sa.String(), nullable=True))
    
    # Migrate data back
    connection = op.get_bind()
    
    # Get all existing records with cloud_properties data
    result = connection.execute(
        sa.text("SELECT id, cloud_properties FROM deployment_details WHERE cloud_properties IS NOT NULL")
    )
    
    for row in result:
        if row.cloud_properties:
            try:
                cloud_properties = json.loads(row.cloud_properties) if isinstance(row.cloud_properties, str) else row.cloud_properties
                
                cloud_region = cloud_properties.get('location')
                resource_group = cloud_properties.get('resource_group')
                
                if cloud_region or resource_group:
                    connection.execute(
                        sa.text("UPDATE deployment_details SET cloud_region = :cloud_region, resource_group = :resource_group WHERE id = :id"),
                        {"cloud_region": cloud_region, "resource_group": resource_group, "id": row.id}
                    )
            except (json.JSONDecodeError, TypeError):
                # Skip invalid JSON data
                continue
    
    # Drop the cloud_properties column
    op.drop_column('deployment_details', 'cloud_properties')

