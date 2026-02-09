#!/usr/bin/env tsx
/**
 * Generate OpenAI embeddings for RAG content
 * Reads markdown RAG files and stores embeddings in knowledge_embeddings table
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = 'https://xfjlwxssxfvhbiytcoar.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY0MjgwNSwiZXhwIjoyMDg1MjE4ODA1fQ.x2tP1uZhU_F2Jr1PPqw5OpeBKiSb80SHpErp17wrcAw';
const OPENAI_API_KEY = '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';

const RAG_DIR = path.join(__dirname, '../supabase/functions/_shared/rags');

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface RAGContent {
  content: string;
  source: string;
  category: string;
}

/**
 * Split markdown into chunks by headings
 */
function splitMarkdownIntoChunks(markdown: string, source: string): RAGContent[] {
  const chunks: RAGContent[] = [];
  const lines = markdown.split('\n');
  
  let currentChunk = '';
  let currentCategory = source;
  
  for (const line of lines) {
    // Detect headings for categories
    if (line.startsWith('##')) {
      // Save previous chunk
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          source,
          category: currentCategory,
        });
      }
      // Start new chunk
      currentCategory = line.replace(/^#+\s*/, '').trim();
      currentChunk = '';
    } else {
      currentChunk += line + '\n';
    }
  }
  
  // Save last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      source,
      category: currentCategory,
    });
  }
  
  return chunks;
}

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Read all RAG files
 */
function readRAGFiles(): RAGContent[] {
  const allChunks: RAGContent[] = [];
  
  const files = fs.readdirSync(RAG_DIR).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const filePath = path.join(RAG_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const source = file.replace('.md', '').replace(/-/g, ' ');
    
    const chunks = splitMarkdownIntoChunks(content, source);
    allChunks.push(...chunks);
  }
  
  return allChunks;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting embeddings generation...\n');
  
  // Read RAG files
  console.log(`📖 Reading RAG files from: ${RAG_DIR}`);
  const chunks = readRAGFiles();
  console.log(`✅ Found ${chunks.length} chunks across all RAG files\n`);
  
  // Generate embeddings and insert
  let processed = 0;
  let failed = 0;
  
  for (const chunk of chunks) {
    try {
      // Generate embedding
      const embedding = await generateEmbedding(chunk.content);
      
      // Insert into database
      const { error } = await supabase
        .from('knowledge_embeddings')
        .insert({
          content: chunk.content,
          source: chunk.source,
          category: chunk.category,
          embedding,
        });
      
      if (error) {
        console.error(`❌ Error inserting chunk from ${chunk.source}:`, error.message);
        failed++;
      } else {
        processed++;
        console.log(`✅ [${processed}/${chunks.length}] ${chunk.source} → ${chunk.category}`);
      }
      
      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error processing chunk from ${chunk.source}:`, error);
      failed++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`✅ Successfully processed: ${processed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📦 Total chunks: ${chunks.length}`);
  
  // Verify in database
  const { count } = await supabase
    .from('knowledge_embeddings')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n🔍 Total embeddings in database: ${count}`);
  console.log('\n🎉 Done!');
}

main().catch(console.error);
