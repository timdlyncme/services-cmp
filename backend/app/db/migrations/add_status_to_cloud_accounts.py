from sqlalchemy import Column, String
from alembic import op
import sqlalchemy as sa

def upgrade():
    """
    Add status field to cloud_accounts table
    """
    # Add status column with default value 'connected'
    op.add_column('cloud_accounts', sa.Column('status', sa.String(), nullable=True, server_default='connected'))
    
    # Set existing records to 'connected'
    op.execute("UPDATE cloud_accounts SET status = 'connected' WHERE status IS NULL")

def downgrade():
    """
    Remove status field from cloud_accounts table
    """
    op.drop_column('cloud_accounts', 'status')

