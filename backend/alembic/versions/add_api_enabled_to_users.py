"""Add api_enabled field to users table

Revision ID: add_api_enabled_to_users
Revises: [previous_revision]
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_api_enabled_to_users'
down_revision = None  # Replace with actual previous revision
branch_labels = None
depends_on = None


def upgrade():
    """Add api_enabled column to users table."""
    # Add the api_enabled column with default value False
    op.add_column('users', sa.Column('api_enabled', sa.Boolean(), nullable=False, server_default='false'))
    
    # Update existing admin and MSP users to have API enabled by default
    op.execute("""
        UPDATE users 
        SET api_enabled = true 
        WHERE id IN (
            SELECT DISTINCT u.id 
            FROM users u
            JOIN user_tenant_assignments uta ON u.id = uta.user_id
            JOIN roles r ON uta.role_id = r.id
            WHERE r.name IN ('admin', 'msp')
        )
    """)


def downgrade():
    """Remove api_enabled column from users table."""
    op.drop_column('users', 'api_enabled')

