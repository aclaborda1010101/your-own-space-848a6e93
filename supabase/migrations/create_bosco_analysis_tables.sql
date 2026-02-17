-- Migration: Create Bosco Analysis System Tables
-- Created: 2026-02-17
-- Purpose: Store and track child development analysis sessions

-- Main analysis table
CREATE TABLE IF NOT EXISTS bosco_analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Input: User observation data
  observation_date DATE NOT NULL,
  observation_notes TEXT NOT NULL,
  
  -- Structured input
  behavioral_data JSONB DEFAULT '{}', -- {behaviors: [], mood: "", social_interaction: "", concerns: "", questions: ""}
  
  -- Analysis output
  analysis_result JSONB DEFAULT '{}', -- Full analysis from Edge Function
  
  -- Metadata
  gemini_model_version VARCHAR(50) DEFAULT 'google/gemini-3-pro',
  rag_version VARCHAR(50) DEFAULT '1.0-premium',
  frameworks_applied JSONB DEFAULT '[]', -- Which frameworks matched
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE bosco_analysis_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own analysis sessions"
  ON bosco_analysis_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own analysis sessions"
  ON bosco_analysis_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis sessions"
  ON bosco_analysis_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analysis sessions"
  ON bosco_analysis_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_bosco_analysis_user_date 
  ON bosco_analysis_sessions(user_id, observation_date DESC);

CREATE INDEX idx_bosco_analysis_created 
  ON bosco_analysis_sessions(user_id, created_at DESC);

CREATE INDEX idx_bosco_analysis_frameworks 
  ON bosco_analysis_sessions USING GIN (frameworks_applied);

-- Pattern tracking table (optional, for longitudinal analysis)
CREATE TABLE IF NOT EXISTS bosco_pattern_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Pattern identification
  pattern_name VARCHAR(255) NOT NULL,
  pattern_type VARCHAR(50), -- 'schema', 'emotional_cycle', 'engagement', etc.
  
  -- Tracking
  first_observed DATE,
  last_observed DATE,
  frequency_count INTEGER DEFAULT 1,
  
  -- Context
  observation_contexts JSONB DEFAULT '[]', -- Where/when pattern appears
  confidence_score FLOAT DEFAULT 0.5,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bosco_pattern_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns"
  ON bosco_pattern_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own patterns"
  ON bosco_pattern_tracking FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_bosco_patterns_user 
  ON bosco_pattern_tracking(user_id, pattern_name);

-- Recommendation tracking (to measure if recommendations were helpful)
CREATE TABLE IF NOT EXISTS bosco_recommendation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_session_id UUID REFERENCES bosco_analysis_sessions(id) ON DELETE SET NULL,
  
  -- Recommendation detail
  recommendation_text TEXT NOT NULL,
  priority VARCHAR(20), -- 'high', 'medium', 'low'
  category VARCHAR(100), -- 'activity', 'regulation', 'social', etc.
  
  -- Tracking adoption
  was_attempted BOOLEAN DEFAULT FALSE,
  attempt_date DATE,
  outcome_notes TEXT,
  effectiveness_rating INTEGER, -- 1-5 scale
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bosco_recommendation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations"
  ON bosco_recommendation_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own recommendations"
  ON bosco_recommendation_log FOR ALL
  USING (auth.uid() = user_id);

-- Summary view for quick access to recent analyses
CREATE OR REPLACE VIEW bosco_analysis_summary AS
SELECT
  user_id,
  observation_date,
  observation_notes,
  (analysis_result ->> 'developmental_assessment' ->> 'stage') as development_stage,
  jsonb_array_length(analysis_result -> 'patterns_detected') as patterns_count,
  jsonb_array_length(analysis_result -> 'recommendations') as recommendations_count,
  jsonb_array_length(analysis_result -> 'red_flags') as red_flags_count,
  created_at
FROM bosco_analysis_sessions
ORDER BY created_at DESC;
