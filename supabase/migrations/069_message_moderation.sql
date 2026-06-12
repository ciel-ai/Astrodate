-- Migration: 069_message_moderation
-- Adds moderation_status to messages table for App Store Guideline 1.2 compliance.
-- SAFE     → passes through normally (default)
-- SPAM     → stored and flagged for review
-- HARASSMENT → stored and flagged for review queue
-- ILLEGAL  → blocked entirely by the edge function before insert

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'SAFE'
    CHECK (moderation_status IN ('SAFE', 'SPAM', 'HARASSMENT', 'ILLEGAL'));

-- Index for the moderation review queue (admin dashboard or cron cleanup)
CREATE INDEX IF NOT EXISTS idx_messages_moderation_status
  ON messages (moderation_status)
  WHERE moderation_status != 'SAFE';

COMMENT ON COLUMN messages.moderation_status IS
  'Content moderation classification. SAFE = clean; SPAM/HARASSMENT = stored but flagged; ILLEGAL = blocked before insert.';
