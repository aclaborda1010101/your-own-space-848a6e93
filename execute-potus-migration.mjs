import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://xfjlwxssxfvhbiytcoar.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY0MjgwNSwiZXhwIjoyMDg1MjE4ODA1fQ.x2tP1uZhU_F2Jr1PPqw5OpeBKiSb80SHpErp17wrcAw',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Execute each table/function separately for better error handling

const statements = [
  // 1. Update whoop_data constraint
  `DO $$ 
BEGIN
  ALTER TABLE public.whoop_data DROP CONSTRAINT IF EXISTS whoop_data_user_id_key;
  ALTER TABLE public.whoop_data ADD CONSTRAINT whoop_data_user_date_unique UNIQUE (user_id, data_date);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint already exists or table structure different';
END $$`,

  // 2. Add raw_data column
  `ALTER TABLE public.whoop_data ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'`,

  // 3. Create user_profile_extended
  `CREATE TABLE IF NOT EXISTS public.user_profile_extended (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferences JSONB DEFAULT '{}',
  goals JSONB DEFAULT '{}',
  coach_notes JSONB DEFAULT '[]',
  nutrition_notes JSONB DEFAULT '[]',
  english_notes JSONB DEFAULT '[]',
  nutrition_preferences JSONB DEFAULT '{}',
  workout_preferences JSONB DEFAULT '{}',
  english_level TEXT DEFAULT 'intermediate',
  english_progress JSONB DEFAULT '{}',
  bosco_child_info JSONB DEFAULT '{}',
  last_coach_session TIMESTAMPTZ,
  total_coach_sessions INT DEFAULT 0,
  potus_insights JSONB DEFAULT '[]',
  last_potus_analysis TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)`,

  // 4. Create coach_sessions
  `CREATE TABLE IF NOT EXISTS public.coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_type TEXT DEFAULT 'daily',
  summary TEXT,
  key_insights JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  emotional_state_start JSONB,
  emotional_state_end JSONB,
  protocol_used TEXT,
  duration_minutes INT,
  transcript JSONB DEFAULT '[]',
  message_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
)`,

  // 5. Create specialist_memory
  `CREATE TABLE IF NOT EXISTS public.specialist_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  specialist TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  importance INT DEFAULT 5,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW()
)`,

  // 6. Create potus_daily_summary
  `CREATE TABLE IF NOT EXISTS public.potus_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  whoop_summary JSONB,
  tasks_summary JSONB,
  sessions_summary JSONB,
  daily_insight TEXT,
  recommendations JSONB DEFAULT '[]',
  correlations JSONB DEFAULT '[]',
  productivity_score INT,
  wellbeing_score INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, summary_date)
)`,

  // 7. Enable RLS
  `ALTER TABLE public.user_profile_extended ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.specialist_memory ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.potus_daily_summary ENABLE ROW LEVEL SECURITY`,

  // 8. Create indices
  `CREATE INDEX IF NOT EXISTS idx_coach_sessions_user_id ON public.coach_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_coach_sessions_date ON public.coach_sessions(session_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_user_profile_extended_user_id ON public.user_profile_extended(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_specialist_memory_user_specialist ON public.specialist_memory(user_id, specialist)`,
  `CREATE INDEX IF NOT EXISTS idx_specialist_memory_importance ON public.specialist_memory(importance DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_potus_daily_user_date ON public.potus_daily_summary(user_id, summary_date DESC)`,

  // 9. RLS Policies for user_profile_extended
  `DROP POLICY IF EXISTS "Users can view their own extended profile" ON public.user_profile_extended`,
  `CREATE POLICY "Users can view their own extended profile" ON public.user_profile_extended FOR SELECT USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can insert their own extended profile" ON public.user_profile_extended`,
  `CREATE POLICY "Users can insert their own extended profile" ON public.user_profile_extended FOR INSERT WITH CHECK (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can update their own extended profile" ON public.user_profile_extended`,
  `CREATE POLICY "Users can update their own extended profile" ON public.user_profile_extended FOR UPDATE USING (auth.uid() = user_id)`,

  // 10. RLS Policies for coach_sessions
  `DROP POLICY IF EXISTS "Users can view their own coach sessions" ON public.coach_sessions`,
  `CREATE POLICY "Users can view their own coach sessions" ON public.coach_sessions FOR SELECT USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can insert their own coach sessions" ON public.coach_sessions`,
  `CREATE POLICY "Users can insert their own coach sessions" ON public.coach_sessions FOR INSERT WITH CHECK (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can update their own coach sessions" ON public.coach_sessions`,
  `CREATE POLICY "Users can update their own coach sessions" ON public.coach_sessions FOR UPDATE USING (auth.uid() = user_id)`,

  // 11. RLS Policies for specialist_memory
  `DROP POLICY IF EXISTS "Users can view their own specialist memory" ON public.specialist_memory`,
  `CREATE POLICY "Users can view their own specialist memory" ON public.specialist_memory FOR SELECT USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can insert their own specialist memory" ON public.specialist_memory`,
  `CREATE POLICY "Users can insert their own specialist memory" ON public.specialist_memory FOR INSERT WITH CHECK (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can update their own specialist memory" ON public.specialist_memory`,
  `CREATE POLICY "Users can update their own specialist memory" ON public.specialist_memory FOR UPDATE USING (auth.uid() = user_id)`,
  `DROP POLICY IF EXISTS "Users can delete their own specialist memory" ON public.specialist_memory`,
  `CREATE POLICY "Users can delete their own specialist memory" ON public.specialist_memory FOR DELETE USING (auth.uid() = user_id)`,

  // 12. RLS Policies for potus_daily_summary
  `DROP POLICY IF EXISTS "Users can view their own POTUS summaries" ON public.potus_daily_summary`,
  `CREATE POLICY "Users can view their own POTUS summaries" ON public.potus_daily_summary FOR SELECT USING (auth.uid() = user_id)`,

  // 13. Helper function: get_specialist_memories
  `CREATE OR REPLACE FUNCTION get_specialist_memories(
  p_user_id UUID,
  p_specialist TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  memory_type TEXT,
  content TEXT,
  context JSONB,
  importance INT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.memory_type,
    sm.content,
    sm.context,
    sm.importance,
    sm.created_at
  FROM specialist_memory sm
  WHERE sm.user_id = p_user_id
    AND sm.specialist = p_specialist
    AND (sm.expires_at IS NULL OR sm.expires_at > NOW())
  ORDER BY sm.importance DESC, sm.last_used DESC
  LIMIT p_limit;
END;
$$`,

  // 14. Helper function: get_recent_whoop_data
  `CREATE OR REPLACE FUNCTION get_recent_whoop_data(
  p_user_id UUID,
  p_days INT DEFAULT 7
)
RETURNS TABLE (
  data_date DATE,
  recovery_score INT,
  hrv INT,
  strain NUMERIC,
  sleep_hours NUMERIC,
  resting_hr INT,
  sleep_performance INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wd.data_date,
    wd.recovery_score,
    wd.hrv,
    wd.strain,
    wd.sleep_hours,
    wd.resting_hr,
    wd.sleep_performance
  FROM whoop_data wd
  WHERE wd.user_id = p_user_id
    AND wd.data_date >= CURRENT_DATE - p_days
  ORDER BY wd.data_date DESC;
END;
$$`,

  // 15. Helper function: get_potus_context
  `CREATE OR REPLACE FUNCTION get_potus_context(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_profile RECORD;
  v_whoop RECORD;
  v_last_session RECORD;
  v_memories JSONB;
BEGIN
  SELECT * INTO v_profile FROM user_profile_extended WHERE user_id = p_user_id;
  SELECT * INTO v_whoop FROM whoop_data WHERE user_id = p_user_id AND data_date = CURRENT_DATE;
  SELECT * INTO v_last_session FROM coach_sessions WHERE user_id = p_user_id ORDER BY session_date DESC LIMIT 1;
  
  SELECT jsonb_agg(row_to_json(m))
  INTO v_memories
  FROM (
    SELECT specialist, memory_type, content, importance
    FROM specialist_memory 
    WHERE user_id = p_user_id
    ORDER BY importance DESC, last_used DESC
    LIMIT 5
  ) m;
  
  result := jsonb_build_object(
    'profile', CASE WHEN v_profile IS NULL THEN '{}'::jsonb 
      ELSE jsonb_build_object(
        'goals', v_profile.goals,
        'preferences', v_profile.preferences,
        'english_level', v_profile.english_level,
        'total_coach_sessions', v_profile.total_coach_sessions
      )
    END,
    'whoop_today', CASE WHEN v_whoop IS NULL THEN NULL
      ELSE jsonb_build_object(
        'recovery', v_whoop.recovery_score,
        'hrv', v_whoop.hrv,
        'strain', v_whoop.strain,
        'sleep_hours', v_whoop.sleep_hours,
        'resting_hr', v_whoop.resting_hr
      )
    END,
    'last_session', CASE WHEN v_last_session IS NULL THEN NULL
      ELSE jsonb_build_object(
        'date', v_last_session.session_date,
        'type', v_last_session.session_type,
        'summary', v_last_session.summary,
        'action_items', v_last_session.action_items
      )
    END,
    'key_memories', COALESCE(v_memories, '[]'::jsonb)
  );
  
  RETURN result;
END;
$$`
];

console.log(`Executing ${statements.length} SQL statements...`);

let success = 0;
let failed = 0;

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.replace(/\s+/g, ' ').substring(0, 80);
  
  console.log(`[${i+1}/${statements.length}] ${preview}...`);
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt });
    
    if (error) {
      // Try direct query if rpc doesn't exist
      const { error: error2 } = await supabase.from('_exec').select().limit(0);
      if (error2) {
        console.log(`  ⚠️ RPC not available, trying alternative...`);
      }
      console.log(`  ❌ ${error.message}`);
      failed++;
    } else {
      console.log(`  ✅`);
      success++;
    }
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
    failed++;
  }
}

console.log(`\n========================================`);
console.log(`Results: ${success} success, ${failed} failed`);
console.log(`========================================\n`);

// Verify tables
console.log('Verifying tables...');

const tables = ['user_profile_extended', 'coach_sessions', 'specialist_memory', 'potus_daily_summary', 'whoop_data'];

for (const table of tables) {
  const { error } = await supabase.from(table).select('count').limit(0);
  console.log(`  ${table}: ${error ? '❌ ' + error.message : '✅ exists'}`);
}

console.log('\nMigration complete!');
