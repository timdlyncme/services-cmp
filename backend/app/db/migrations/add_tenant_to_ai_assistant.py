"""Add tenant_id to AI Assistant models

Revision ID: add_tenant_to_ai_assistant
Revises: 
Create Date: 2024-12-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_tenant_to_ai_assistant'
down_revision = None  # Update this with the previous migration ID
depends_on = None


def upgrade():
    # Add tenant_id column to ai_assistant_config table
    op.add_column('ai_assistant_config', 
                  sa.Column('tenant_id', postgresql.UUID(as_uuid=False), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key('fk_ai_assistant_config_tenant_id', 
                         'ai_assistant_config', 'tenants', 
                         ['tenant_id'], ['tenant_id'], 
                         ondelete='CASCADE')
    
    # Add tenant_id column to ai_assistant_log table
    op.add_column('ai_assistant_log', 
                  sa.Column('tenant_id', postgresql.UUID(as_uuid=False), nullable=True))
    
    # Add foreign key constraint
    op.create_foreign_key('fk_ai_assistant_log_tenant_id', 
                         'ai_assistant_log', 'tenants', 
                         ['tenant_id'], ['tenant_id'], 
                         ondelete='CASCADE')
    
    # Create index for better query performance
    op.create_index('ix_ai_assistant_config_tenant_id', 'ai_assistant_config', ['tenant_id'])
    op.create_index('ix_ai_assistant_log_tenant_id', 'ai_assistant_log', ['tenant_id'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_ai_assistant_log_tenant_id', table_name='ai_assistant_log')
    op.drop_index('ix_ai_assistant_config_tenant_id', table_name='ai_assistant_config')
    
    # Drop foreign key constraints
    op.drop_constraint('fk_ai_assistant_log_tenant_id', 'ai_assistant_log', type_='foreignkey')
    op.drop_constraint('fk_ai_assistant_config_tenant_id', 'ai_assistant_config', type_='foreignkey')
    
    # Drop columns
    op.drop_column('ai_assistant_log', 'tenant_id')
    op.drop_column('ai_assistant_config', 'tenant_id')

