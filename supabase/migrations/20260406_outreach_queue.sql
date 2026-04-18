-- =====================================================
-- AppRabbit AI Outreach Queue
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard → SQL Editor → New query
-- =====================================================

CREATE TABLE IF NOT EXISTS outreach_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Contact info
  contact_name TEXT NOT NULL,
  phone TEXT,
  ghl_contact_id TEXT,

  -- Lead classification
  temperature TEXT DEFAULT 'cold' CHECK (temperature IN ('hot', 'warm', 'cold')),
  pipeline_stage TEXT,
  days_since INTEGER,
  last_contact_date DATE,

  -- Messages
  draft_message TEXT NOT NULL,
  edited_message TEXT,            -- if rep edited the AI draft
  last_message TEXT,              -- last message from their conversation
  last_sender TEXT,               -- 'You' or 'Them'

  -- Status
  status TEXT DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'sent', 'skipped')),
  assigned_to UUID REFERENCES salespeople(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'import'    -- 'import', 'ghl_webhook', 'manual'
    CHECK (source IN ('import', 'ghl_webhook', 'manual')),
  sent_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_queue(status);
CREATE INDEX IF NOT EXISTS idx_outreach_temperature ON outreach_queue(temperature);
CREATE INDEX IF NOT EXISTS idx_outreach_assigned ON outreach_queue(assigned_to);

-- Unique constraint to prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_unique_lead
  ON outreach_queue(contact_name, COALESCE(phone, ''));

-- Row Level Security (RLS) — allow all authenticated users to read/write
ALTER TABLE outreach_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users"
  ON outreach_queue
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also allow service role (for API routes)
CREATE POLICY "Allow service role"
  ON outreach_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
