-- Admin script to clear all buildings from the database
-- Run with: npx wrangler d1 execute gallax-db --remote --file=admin-clear-buildings.sql

DELETE FROM buildings;

-- Verify deletion
SELECT COUNT(*) as remaining_buildings FROM buildings;

