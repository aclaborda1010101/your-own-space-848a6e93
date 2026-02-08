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

const sql = readFileSync('supabase/migrations/20260208000000_knowledge_embeddings.sql', 'utf8');

// Split SQL into individual statements (rough split)
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && s !== '');

console.log(`Executing ${statements.length} SQL statements...`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i] + ';';
  
  if (stmt.includes('COMMENT ON')) {
    console.log(`[${i+1}/${statements.length}] Skipping COMMENT statement`);
    continue;
  }
  
  console.log(`[${i+1}/${statements.length}] Executing: ${stmt.substring(0, 60)}...`);
  
  try {
    // Use rpc if available, otherwise try via REST
    const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });
    
    if (error) {
      console.error(`❌ Error:`, error.message);
      // Try to continue with next statement
    } else {
      console.log(`✅ Success`);
    }
  } catch (err) {
    console.error(`❌ Exception:`, err.message);
  }
}

console.log('\\nDone! Verifying...');

const { data, error } = await supabase
  .from('knowledge_embeddings')
  .select('count');

console.log('Table exists:', !error);
console.log('Error:', error);
console.log('Data:', data);
