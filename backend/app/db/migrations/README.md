# Database Migrations

This directory contains database migration scripts for the CMP application.

## Available Scripts

### `update_schema.py`

This script creates all database tables based on the SQLAlchemy models. Run this script before initializing the database with data.

```bash
python -m app.db.migrations.update_schema
```

## Database Initialization

After creating the tables, you can initialize the database with default data using the `init_db.py` script:

```bash
python -m backend.init_db
```

This will create:
- Default roles and permissions
- Default tenants
- Admin users
- Sample data for testing

## Database Schema

The database schema includes the following main tables:

- `users`: User accounts
- `roles`: User roles (admin, user, msp)
- `permissions`: Individual permissions
- `role_permissions`: Association table for roles and permissions
- `tenants`: Multi-tenant support
- `cloud_accounts`: Cloud provider accounts
- `environments`: Deployment environments
- `templates`: Infrastructure templates
- `template_versions`: Version history for templates
- `deployments`: Infrastructure deployments
- `deployment_history`: History of deployment changes
- `integration_configs`: External service integrations
- `template_foundry`: Template development workspace

