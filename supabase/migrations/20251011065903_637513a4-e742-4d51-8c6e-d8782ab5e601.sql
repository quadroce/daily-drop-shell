-- Add columns for scheduling and comment content
ALTER TABLE social_comment_jobs
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS text_variant text,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Add indexes for efficient queries (removed immutable function from WHERE)
CREATE INDEX IF NOT EXISTS idx_scj_scheduled_for 
  ON social_comment_jobs(scheduled_for, status);

CREATE INDEX IF NOT EXISTS idx_scj_posted_at 
  ON social_comment_jobs(posted_at, status);

CREATE INDEX IF NOT EXISTS idx_scj_status_platform 
  ON social_comment_jobs(status, platform, created_at);

-- Add index for deduplication (removed NOW() from WHERE)
CREATE INDEX IF NOT EXISTS idx_scj_text_hash 
  ON social_comment_jobs(text_hash, channel_id, posted_at);

COMMENT ON COLUMN social_comment_jobs.scheduled_for IS 'When this job should be processed (for 24h distribution)';
COMMENT ON COLUMN social_comment_jobs.text_variant IS 'Raw GPT-5 output before cleanup/truncation';
COMMENT ON COLUMN social_comment_jobs.text_hash IS 'SHA-256 hash for deduplication';
COMMENT ON COLUMN social_comment_jobs.next_retry_at IS 'Next retry time with exponential backoff';