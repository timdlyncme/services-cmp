"""
Migration script to add new fields to the Deployment and Template models.
"""
from sqlalchemy import Column, String, JSON
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add parameters, resources, and region columns to deployments table
    op.add_column('deployments', Column('parameters', JSON, nullable=True))
    op.add_column('deployments', Column('resources', JSON, nullable=True))
    op.add_column('deployments', Column('region', String, nullable=True))
    
    # Add code column to templates table
    op.add_column('templates', Column('code', String, nullable=True))

def downgrade():
    # Remove the columns if needed to rollback
    op.drop_column('deployments', 'parameters')
    op.drop_column('deployments', 'resources')
    op.drop_column('deployments', 'region')
    op.drop_column('templates', 'code')

