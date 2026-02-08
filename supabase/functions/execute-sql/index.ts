// Temporary Edge Function to execute SQL migrations
// DELETE after migrations complete

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sql } = await req.json()
    
    if (!sql) {
      throw new Error('SQL is required')
    }

    // Execute SQL using Deno's PostgreSQL client
    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    
    const client = new Client({
      hostname: "db.xfjlwxssxfvhbiytcoar.supabase.co",
      port: 5432,
      database: "postgres",
      user: "postgres.xfjlwxssxfvhbiytcoar",
      password: Deno.env.get('DB_PASSWORD') || "",
    });

    await client.connect();
    
    try {
      const result = await client.queryArray(sql);
      await client.end();
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'SQL executed successfully',
          rowCount: result.rowCount,
          rows: result.rows
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } catch (sqlError) {
      await client.end();
      throw sqlError;
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
