-- Remove category and categories columns from cloud_accounts and environments tables
-- These fields are not relevant for Cloud Accounts and Environments

-- Remove category and categories columns from cloud_accounts table
ALTER TABLE cloud_accounts DROP COLUMN IF EXISTS category;
ALTER TABLE cloud_accounts DROP COLUMN IF EXISTS categories;

-- Remove category and categories columns from environments table
ALTER TABLE environments DROP COLUMN IF EXISTS category;
ALTER TABLE environments DROP COLUMN IF EXISTS categories;

