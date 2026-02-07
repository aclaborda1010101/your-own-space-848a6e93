// Script to generate OpenAI embeddings for knowledge base
// Usage: npx tsx scripts/generate-embeddings.ts

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  
  return response.data[0].embedding;
}

async function updateEmbeddings() {
  console.log('🔄 Fetching knowledge entries without embeddings...');
  
  // Get all knowledge without embeddings
  const { data: knowledge, error } = await supabase
    .from('knowledge_embeddings')
    .select('*')
    .is('embedding', null);

  if (error) {
    console.error('❌ Error fetching knowledge:', error);
    return;
  }

  if (!knowledge || knowledge.length === 0) {
    console.log('✅ All knowledge entries have embeddings!');
    return;
  }

  console.log(`📝 Found ${knowledge.length} entries to process`);

  let processed = 0;
  let failed = 0;

  for (const item of knowledge) {
    try {
      console.log(`Processing: ${item.content.slice(0, 50)}...`);
      
      const embedding = await generateEmbedding(item.content);
      
      const { error: updateError } = await supabase
        .from('knowledge_embeddings')
        .update({ embedding })
        .eq('id', item.id);

      if (updateError) {
        console.error(`❌ Failed to update ${item.id}:`, updateError);
        failed++;
      } else {
        processed++;
        console.log(`✅ ${processed}/${knowledge.length}`);
      }

      // Rate limit: OpenAI allows 3,000 RPM for embeddings
      // Sleep 200ms between requests = ~300 requests/min (safe)
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`❌ Error processing ${item.id}:`, error);
      failed++;
    }
  }

  console.log(`\n🎉 Done! Processed: ${processed}, Failed: ${failed}`);
}

// Test semantic search
async function testSearch(query: string) {
  console.log(`\n🔍 Testing search: "${query}"`);
  
  const embedding = await generateEmbedding(query);
  
  const { data, error } = await supabase.rpc('search_knowledge', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 3
  });

  if (error) {
    console.error('❌ Search error:', error);
    return;
  }

  console.log('\n📚 Results:');
  data?.forEach((result: any, i: number) => {
    console.log(`\n${i + 1}. [${(result.similarity * 100).toFixed(1)}%] ${result.content}`);
    console.log(`   Source: ${result.source} | Category: ${result.category}`);
  });
}

// Main
async function main() {
  const command = process.argv[2];

  if (command === 'generate') {
    await updateEmbeddings();
  } else if (command === 'test') {
    const query = process.argv[3] || 'cómo organizar mi día';
    await testSearch(query);
  } else {
    console.log(`
Usage:
  npx tsx scripts/generate-embeddings.ts generate  # Generate embeddings
  npx tsx scripts/generate-embeddings.ts test "query"  # Test search
    `);
  }
}

main().catch(console.error);
