-- Add status column to cloud_accounts table
-- This migration adds the missing 'status' field to fix the CloudAccount creation error

-- Add the status column with a default value
ALTER TABLE cloud_accounts ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'connected';

-- Update existing records to have the default status
UPDATE cloud_accounts SET status = 'connected' WHERE status IS NULL;

