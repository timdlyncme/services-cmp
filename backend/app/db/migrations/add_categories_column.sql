-- Migration to add categories column and migrate data from category column
-- Run this SQL script against your database

-- Step 1: Add the new categories column if it doesn't exist
ALTER TABLE templates ADD COLUMN IF NOT EXISTS categories JSON DEFAULT '[]';

-- Step 2: Migrate data from category column to categories column
UPDATE templates 
SET categories = CASE 
    WHEN category IS NULL OR category = '' THEN '[]'
    ELSE JSON_ARRAY(TRIM(category))
END
WHERE categories = '[]' OR categories IS NULL;

-- Step 3: For comma-separated categories, split them into JSON array
-- This is a more complex operation that might need to be done programmatically
-- For now, we'll handle single categories

-- Optional Step 4: After verifying the migration worked, you can drop the old column
-- ALTER TABLE templates DROP COLUMN category;

