"""
Create service_accounts table
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


def upgrade():
    """
    Create service_accounts table
    """
    op.create_table(
        'service_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_account_id', UUID(as_uuid=False), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('username', sa.String(), nullable=True),
        sa.Column('hashed_password', sa.String(), nullable=True),
        sa.Column('scope', sa.String(), nullable=True, server_default='system'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('tenant_id', UUID(as_uuid=False), nullable=True),
        sa.Column('role_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.tenant_id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_service_accounts_id'), 'service_accounts', ['id'], unique=False)
    op.create_index(op.f('ix_service_accounts_name'), 'service_accounts', ['name'], unique=False)
    op.create_index(op.f('ix_service_accounts_service_account_id'), 'service_accounts', ['service_account_id'], unique=True)
    op.create_index(op.f('ix_service_accounts_username'), 'service_accounts', ['username'], unique=True)


def downgrade():
    """
    Drop service_accounts table
    """
    op.drop_index(op.f('ix_service_accounts_username'), table_name='service_accounts')
    op.drop_index(op.f('ix_service_accounts_service_account_id'), table_name='service_accounts')
    op.drop_index(op.f('ix_service_accounts_name'), table_name='service_accounts')
    op.drop_index(op.f('ix_service_accounts_id'), table_name='service_accounts')
    op.drop_table('service_accounts')

