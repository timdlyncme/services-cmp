-- Rename organization_tenant_id to tenant_id in cloud_settings table
-- This migration ensures consistency across all tables by using tenant_id as the standard column name

-- Step 1: Add the new tenant_id column
ALTER TABLE cloud_settings ADD COLUMN tenant_id UUID;

-- Step 2: Copy data from organization_tenant_id to tenant_id
UPDATE cloud_settings SET tenant_id = organization_tenant_id;

-- Step 3: Drop the foreign key constraint on organization_tenant_id
ALTER TABLE cloud_settings DROP CONSTRAINT IF EXISTS cloud_settings_organization_tenant_id_fkey;

-- Step 4: Create a new foreign key constraint on tenant_id
ALTER TABLE cloud_settings ADD CONSTRAINT cloud_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id);

-- Step 5: Make tenant_id NOT NULL if organization_tenant_id was NOT NULL
ALTER TABLE cloud_settings ALTER COLUMN tenant_id SET NOT NULL;

-- Step 6: Drop the old organization_tenant_id column
ALTER TABLE cloud_settings DROP COLUMN organization_tenant_id;

-- Step 7: Create an index on tenant_id for better query performance
CREATE INDEX IF NOT EXISTS ix_cloud_settings_tenant_id ON cloud_settings(tenant_id);

