"""add deployment details

Revision ID: 20240524_add_deployment_details
Revises: 
Create Date: 2024-05-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20240524_add_deployment_details'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create deployment_details table
    op.create_table(
        'deployment_details',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('provider', sa.String(), nullable=True),
        sa.Column('cloud_account_id', sa.Integer(), nullable=True),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('template_url', sa.String(), nullable=True),
        sa.Column('template_code', sa.Text(), nullable=True),
        sa.Column('template_type', sa.String(), nullable=True),
        sa.Column('environment_id', sa.Integer(), nullable=True),
        sa.Column('parameters', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('variables', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('outputs', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('resources', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('logs', sa.Text(), nullable=True),
        sa.Column('tenant_id', postgresql.UUID(), nullable=True),
        sa.Column('created_by', postgresql.UUID(), nullable=True),
        sa.Column('updated_by', postgresql.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('container_id', sa.String(), nullable=True),
        sa.Column('container_logs', sa.Text(), nullable=True),
        sa.Column('is_dry_run', sa.Boolean(), nullable=True),
        sa.Column('auto_approve', sa.Boolean(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('error_details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['cloud_account_id'], ['cloud_accounts.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.user_id'], ),
        sa.ForeignKeyConstraint(['environment_id'], ['environments.id'], ),
        sa.ForeignKeyConstraint(['template_id'], ['templates.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.tenant_id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.user_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_deployment_details_deployment_id'), 'deployment_details', ['deployment_id'], unique=True)
    op.create_index(op.f('ix_deployment_details_id'), 'deployment_details', ['id'], unique=False)
    op.create_index(op.f('ix_deployment_details_name'), 'deployment_details', ['name'], unique=False)


def downgrade():
    # Drop indexes
    op.drop_index(op.f('ix_deployment_details_name'), table_name='deployment_details')
    op.drop_index(op.f('ix_deployment_details_id'), table_name='deployment_details')
    op.drop_index(op.f('ix_deployment_details_deployment_id'), table_name='deployment_details')
    
    # Drop table
    op.drop_table('deployment_details')

