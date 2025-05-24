-- Rename subscription_id to cloud_ids in cloud_accounts table
ALTER TABLE cloud_accounts ADD COLUMN cloud_ids JSONB;

-- Copy data from subscription_id to cloud_ids
UPDATE cloud_accounts 
SET cloud_ids = jsonb_build_array(subscription_id) 
WHERE subscription_id IS NOT NULL AND (subscription_ids IS NULL OR subscription_ids = '[]'::jsonb);

-- Copy data from subscription_ids to cloud_ids
UPDATE cloud_accounts 
SET cloud_ids = subscription_ids 
WHERE subscription_ids IS NOT NULL AND subscription_ids != '[]'::jsonb;

-- Note: We're keeping subscription_id for now to ensure backward compatibility
-- In a future migration, we can remove the subscription_id and subscription_ids columns
-- ALTER TABLE cloud_accounts DROP COLUMN subscription_id;
-- ALTER TABLE cloud_accounts DROP COLUMN subscription_ids;
