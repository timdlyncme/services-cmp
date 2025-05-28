"""
Add resource_group column to deployment_details table
"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    """
    Add resource_group column to deployment_details table
    """
    op.add_column('deployment_details', sa.Column('resource_group', sa.String(), nullable=True))


def downgrade():
    """
    Remove resource_group column from deployment_details table
    """
    op.drop_column('deployment_details', 'resource_group')

