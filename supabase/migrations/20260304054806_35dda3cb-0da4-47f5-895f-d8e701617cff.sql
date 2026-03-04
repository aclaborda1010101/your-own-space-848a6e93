
-- Update improvement_proposals status constraint
ALTER TABLE improvement_proposals DROP CONSTRAINT IF EXISTS improvement_proposals_status_check;
ALTER TABLE improvement_proposals ADD CONSTRAINT improvement_proposals_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'trial_active', 'graduated', 'rolled_back'));

-- Add new columns to improvement_proposals
ALTER TABLE improvement_proposals ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE improvement_proposals ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE improvement_proposals ADD COLUMN IF NOT EXISTS version_before INTEGER;
ALTER TABLE improvement_proposals ADD COLUMN IF NOT EXISTS version_after INTEGER;

-- Add proposal_id to model_change_log
ALTER TABLE model_change_log ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES improvement_proposals(id);
