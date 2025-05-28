"""
Add is_service_account field to users table
"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    """
    Add is_service_account field to users table
    """
    op.add_column('users', sa.Column('is_service_account', sa.Boolean(), nullable=True, server_default='false'))


def downgrade():
    """
    Remove is_service_account field from users table
    """
    op.drop_column('users', 'is_service_account')

