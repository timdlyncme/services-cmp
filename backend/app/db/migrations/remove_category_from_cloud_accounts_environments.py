from alembic import op
import sqlalchemy as sa

def upgrade():
    """
    Remove category and categories columns from cloud_accounts and environments tables
    """
    # Remove category and categories columns from cloud_accounts table
    try:
        op.drop_column('cloud_accounts', 'category')
    except Exception:
        pass  # Column might not exist
    
    try:
        op.drop_column('cloud_accounts', 'categories')
    except Exception:
        pass  # Column might not exist
    
    # Remove category and categories columns from environments table
    try:
        op.drop_column('environments', 'category')
    except Exception:
        pass  # Column might not exist
    
    try:
        op.drop_column('environments', 'categories')
    except Exception:
        pass  # Column might not exist

def downgrade():
    """
    Add back category and categories columns to cloud_accounts and environments tables
    """
    # Add category and categories columns back to cloud_accounts table
    op.add_column('cloud_accounts', sa.Column('category', sa.JSON(), nullable=True))
    op.add_column('cloud_accounts', sa.Column('categories', sa.JSON(), nullable=True, server_default='[]'))
    
    # Add category and categories columns back to environments table
    op.add_column('environments', sa.Column('category', sa.JSON(), nullable=True))
    op.add_column('environments', sa.Column('categories', sa.JSON(), nullable=True, server_default='[]'))

