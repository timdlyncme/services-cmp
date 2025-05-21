# Database Migrations

This directory contains database migration scripts for the CMP application.

## Running Migrations

To run the latest migration script, follow these steps:

1. Make sure your virtual environment is activated:
   ```bash
   source venv/bin/activate  # On Linux/Mac
   # or
   .\venv\Scripts\activate  # On Windows
   ```

2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

3. Run the migration script:
   ```bash
   python -m app.db.migrations.update_schema
   ```

## Migration History

### update_schema.py (Latest)

This migration adds the following changes to the database schema:

- Added new fields to the `Environment` model:
  - `update_strategy`: Rolling, blue-green, or canary deployment strategy
  - `scaling_policies`: JSON field for scaling configuration
  - `environment_variables`: JSON field for environment variables
  - `logging_config`: JSON field for logging configuration
  - `monitoring_integration`: JSON field for monitoring integration

- Added many-to-many relationship between `Environment` and `CloudAccount`
  - Created `environment_cloud_account` association table

- Added `TemplateVersion` model for template versioning
  - Tracks version history for templates
  - Stores version number, code, and commit messages

- Added `DeploymentHistory` model for deployment tracking
  - Records deployment events (create, update, delete, status changes)
  - Stores event details and user information

- Added `TemplateFoundry` model for template management
  - Provides a workspace for creating and editing templates
  - Supports draft templates and publishing workflow

## Creating New Migrations

When making changes to the database schema:

1. Update the model definitions in the appropriate files
2. Create a new migration script in this directory
3. Update this README with details about the migration
4. Run the migration script to apply the changes

