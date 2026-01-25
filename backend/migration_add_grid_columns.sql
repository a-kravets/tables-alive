-- Migration: Add grid_columns and grid_rows to dashboards table
-- Run this SQL directly in your PostgreSQL database if you prefer manual migration

-- Add grid_columns column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dashboards' AND column_name = 'grid_columns'
    ) THEN
        ALTER TABLE dashboards ADD COLUMN grid_columns INTEGER DEFAULT 12;
    END IF;
END $$;

-- Add grid_rows column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dashboards' AND column_name = 'grid_rows'
    ) THEN
        ALTER TABLE dashboards ADD COLUMN grid_rows INTEGER DEFAULT 10;
    END IF;
END $$;
