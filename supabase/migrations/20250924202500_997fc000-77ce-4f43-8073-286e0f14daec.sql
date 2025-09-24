-- Add missing foreign key constraint between source_health and sources
-- This will enable optimized nested queries in fetch-rss function

-- First, ensure all existing source_health records have valid source_id references
DELETE FROM source_health 
WHERE source_id NOT IN (SELECT id FROM sources);

-- Add the foreign key constraint
ALTER TABLE source_health 
ADD CONSTRAINT fk_source_health_source_id 
FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE;

-- Add an index to improve performance of queries joining these tables
CREATE INDEX IF NOT EXISTS idx_source_health_source_id ON source_health(source_id);