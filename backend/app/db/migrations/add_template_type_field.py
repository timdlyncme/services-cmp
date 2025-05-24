from sqlalchemy import Column, String
from alembic import op
import sqlalchemy as sa

def upgrade():
    """
    Add type field to templates table
    """
    # Add type column with default value 'terraform'
    op.add_column('templates', sa.Column('type', sa.String(), nullable=True, server_default='terraform'))
    
    # Set existing records to 'terraform'
    op.execute("UPDATE templates SET type = 'terraform' WHERE type IS NULL")

def downgrade():
    """
    Remove type field from templates table
    """
    op.drop_column('templates', 'type')

