"""add deployment details table

Revision ID: 20240524_add_deployment_details
Revises: 
Create Date: 2024-05-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20240524_add_deployment_details'
down_revision = None  # Update this to the previous migration
branch_labels = None
depends_on = None


def upgrade():
    # Create deployment_details table
    op.create_table(
        'deployment_details',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('deployment_id', postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('resource_name', sa.String(), nullable=True),
        sa.Column('resource_type', sa.String(), nullable=True),
        sa.Column('region', sa.String(), nullable=True),
        sa.Column('subscription_id', sa.String(), nullable=True),
        sa.Column('resource_group', sa.String(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('logs', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['deployment_id'], ['deployments.deployment_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_deployment_details_id'), 'deployment_details', ['id'], unique=False)


def downgrade():
    # Drop deployment_details table
    op.drop_index(op.f('ix_deployment_details_id'), table_name='deployment_details')
    op.drop_table('deployment_details')

