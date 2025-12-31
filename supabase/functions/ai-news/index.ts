import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Perplexity no está configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario no válido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action } = await req.json();
    const today = new Date().toISOString().split('T')[0];

    if (action === 'fetch') {
      console.log('Fetching AI news from Perplexity...');

      // Search for AI news
      const newsResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            { 
              role: 'system', 
              content: 'Eres un experto en inteligencia artificial. Responde siempre en español y en formato JSON válido.' 
            },
            { 
              role: 'user', 
              content: `Dame las 10 noticias más relevantes de inteligencia artificial de ayer o de los últimos 2 días. Incluye también videos recientes de divulgadores de IA en español como Jon Hernández, Dot CSV, Carlos Santana, etc.

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "news": [
    {
      "title": "Título de la noticia",
      "summary": "Resumen breve de 2-3 oraciones",
      "source_url": "URL de la fuente",
      "source_name": "Nombre de la fuente",
      "category": "news o video",
      "is_video": false,
      "creator_name": null o "nombre del creador si es video"
    }
  ]
}` 
            }
          ],
          search_recency_filter: 'day',
        }),
      });

      if (!newsResponse.ok) {
        const errorText = await newsResponse.text();
        console.error('Perplexity API error:', errorText);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al buscar noticias' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const perplexityData = await newsResponse.json();
      const content = perplexityData.choices?.[0]?.message?.content || '';
      
      console.log('Perplexity response:', content);

      // Parse the JSON from the response
      let newsItems = [];
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          newsItems = parsed.news || [];
        }
      } catch (parseError) {
        console.error('Error parsing Perplexity response:', parseError);
        // Return the raw content if parsing fails
        return new Response(
          JSON.stringify({ 
            success: true, 
            news: [], 
            raw: content,
            citations: perplexityData.citations || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Save to database
      const newsToInsert = newsItems.map((item: any) => ({
        user_id: user.id,
        date: today,
        title: item.title,
        summary: item.summary,
        source_url: item.source_url,
        source_name: item.source_name,
        category: item.category || 'news',
        is_video: item.is_video || false,
        creator_name: item.creator_name,
      }));

      if (newsToInsert.length > 0) {
        // Delete existing news for today first
        await supabase
          .from('ai_news')
          .delete()
          .eq('user_id', user.id)
          .eq('date', today);

        // Insert new news
        const { error: insertError } = await supabase
          .from('ai_news')
          .insert(newsToInsert);

        if (insertError) {
          console.error('Error inserting news:', insertError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          news: newsItems,
          citations: perplexityData.citations || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get') {
      // Get news from database
      const { data: news, error: fetchError } = await supabase
        .from('ai_news')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100);

      if (fetchError) {
        console.error('Error fetching news:', fetchError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al obtener noticias' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, news: news || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no válida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-news function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
