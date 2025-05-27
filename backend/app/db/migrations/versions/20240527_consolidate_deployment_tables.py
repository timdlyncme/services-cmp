"""Consolidate deployment tables

Revision ID: 20240527_consolidate
Revises: 
Create Date: 2024-05-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20240527_consolidate'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to deployments table
    op.add_column('deployments', sa.Column('provider', sa.String(), nullable=True))
    op.add_column('deployments', sa.Column('template_source', sa.String(), nullable=True))
    op.add_column('deployments', sa.Column('template_url', sa.String(), nullable=True))
    op.add_column('deployments', sa.Column('cloud_resources', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('deployments', sa.Column('logs', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('deployments', sa.Column('outputs', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('deployments', sa.Column('error_details', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('deployments', sa.Column('completed_at', sa.DateTime(), nullable=True))
    
    # Migrate data from deployment_details to deployments
    op.execute("""
    UPDATE deployments d
    SET 
        provider = dd.provider,
        template_source = dd.template_source,
        template_url = dd.template_url,
        cloud_resources = dd.cloud_resources,
        logs = dd.logs,
        outputs = dd.outputs,
        error_details = dd.error_details,
        completed_at = dd.completed_at
    FROM deployment_details dd
    WHERE dd.deployment_id = d.id
    """)
    
    # Drop deployment_details table
    # Note: Uncomment this after verifying the migration works correctly
    # op.drop_table('deployment_details')


def downgrade():
    # Re-create deployment_details table if needed
    # This is a simplified version, you may need to adjust based on your actual schema
    op.create_table('deployment_details',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('detail_id', postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('provider', sa.String(), nullable=True),
        sa.Column('deployment_type', sa.String(), nullable=True),
        sa.Column('template_source', sa.String(), nullable=True),
        sa.Column('template_url', sa.String(), nullable=True),
        sa.Column('cloud_deployment_id', sa.String(), nullable=True),
        sa.Column('cloud_region', sa.String(), nullable=True),
        sa.Column('cloud_resources', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('logs', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('outputs', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('error_details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('deployment_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['deployment_id'], ['deployments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Migrate data back from deployments to deployment_details
    op.execute("""
    INSERT INTO deployment_details (
        deployment_id, status, provider, template_source, template_url,
        cloud_deployment_id, cloud_region, cloud_resources, logs, outputs,
        error_details, created_at, updated_at, completed_at
    )
    SELECT 
        id, status, provider, template_source, template_url,
        cloud_deployment_id, region, cloud_resources, logs, outputs,
        error_details, created_at, updated_at, completed_at
    FROM deployments
    """)
    
    # Drop added columns from deployments table
    op.drop_column('deployments', 'completed_at')
    op.drop_column('deployments', 'error_details')
    op.drop_column('deployments', 'outputs')
    op.drop_column('deployments', 'logs')
    op.drop_column('deployments', 'cloud_resources')
    op.drop_column('deployments', 'template_url')
    op.drop_column('deployments', 'template_source')
    op.drop_column('deployments', 'provider')

