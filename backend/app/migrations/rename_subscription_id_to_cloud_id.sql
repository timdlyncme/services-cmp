-- Rename subscription_id to cloud_id in cloud_accounts table
ALTER TABLE cloud_accounts ADD COLUMN cloud_id VARCHAR;

-- Copy data from subscription_id to cloud_id
UPDATE cloud_accounts SET cloud_id = subscription_id;

-- Note: We're keeping subscription_id for now to ensure backward compatibility
-- In a future migration, we can remove the subscription_id column
-- ALTER TABLE cloud_accounts DROP COLUMN subscription_id;

