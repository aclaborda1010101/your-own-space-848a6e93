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
    if (!sql) throw new Error('SQL is required')

    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts")
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
    if (!dbUrl) throw new Error('No SUPABASE_DB_URL configured')
    
    const client = new Client(dbUrl)
    await client.connect()
    try {
      const result = await client.queryArray(sql)
      await client.end()
      return new Response(
        JSON.stringify({ success: true, rowCount: result.rowCount, rows: result.rows }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (e) {
      await client.end()
      throw e
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
