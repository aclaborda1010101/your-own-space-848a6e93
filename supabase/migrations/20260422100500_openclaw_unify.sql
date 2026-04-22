-- OpenClaw: Unify task system onto openclaw_tasks
-- Add source + description columns and performance indexes

ALTER TABLE openclaw_tasks ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE openclaw_tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE openclaw_tasks ADD COLUMN IF NOT EXISTS result text;
ALTER TABLE openclaw_tasks ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE openclaw_tasks ADD COLUMN IF NOT EXISTS finished_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_openclaw_tasks_status ON openclaw_tasks(status);
CREATE INDEX IF NOT EXISTS idx_openclaw_tasks_node_status ON openclaw_tasks(node_id, status);
