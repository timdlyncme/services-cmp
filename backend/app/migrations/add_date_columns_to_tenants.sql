-- Add date_created and date_modified columns to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS date_created TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS date_modified TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

-- Update existing records to have date values
UPDATE tenants SET date_created = NOW(), date_modified = NOW() WHERE date_created IS NULL;

