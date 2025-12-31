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
      console.log('Fetching specialized AI news from Perplexity...');

      // Search for specialized AI news (articles)
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
              content: 'Eres un experto en inteligencia artificial. Responde siempre en español y en formato JSON válido. Solo incluyes fuentes especializadas en tecnología e IA, NUNCA medios generalistas.' 
            },
            { 
              role: 'user', 
              content: `Busca las 8 noticias más relevantes de inteligencia artificial de ayer o los últimos 2 días.

IMPORTANTE: Solo de FUENTES ESPECIALIZADAS en IA y tecnología como:
- The Verge AI, Wired AI, MIT Technology Review, TechCrunch AI, VentureBeat AI
- OpenAI Blog, Anthropic Blog, Google AI Blog, Meta AI Blog
- ArXiv, Papers With Code, Hugging Face Blog
- IEEE Spectrum, Nature Machine Intelligence
- The Decoder, AI News, Synced Review
- Blogs y newsletters especializados de IA

EXCLUYE completamente: periódicos generalistas, medios de noticias generales, agencias de noticias tradicionales.

Responde SOLO con un JSON válido:
{
  "news": [
    {
      "title": "Título de la noticia",
      "summary": "Resumen técnico de 2-3 oraciones explicando el avance o novedad",
      "source_url": "URL directa al artículo",
      "source_name": "Nombre del medio especializado",
      "category": "news",
      "is_video": false,
      "creator_name": null,
      "relevance_score": 1-10
    }
  ]
}` 
            }
          ],
          search_recency_filter: 'day',
        }),
      });

      // Search for specialized AI video creators
      const videosResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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
              content: 'Eres un experto en canales de YouTube sobre inteligencia artificial. Responde siempre en español y en formato JSON válido.' 
            },
            { 
              role: 'user', 
              content: `Busca los últimos 5-7 videos de YouTube de DIVULGADORES ESPECIALIZADOS en IA de ayer o los últimos 3 días.

CREADORES A BUSCAR (en español e inglés):
- Jon Hernández (Inteligencia Artificial con Jon)
- Dot CSV (Carlos Santana)  
- Tech with Tim (IA tutorials)
- Two Minute Papers (Károly Zsolnai-Fehér)
- Yannic Kilcher (papers de IA)
- AI Explained
- Matt Wolfe (AI news)
- Fireship (tech/AI)
- The AI Advantage
- Sam Witteveen (AI projects)
- AssemblyAI
- Nicholas Renotte

Busca sus videos MÁS RECIENTES sobre novedades de IA, tutoriales, o análisis de modelos nuevos.

Responde SOLO con un JSON válido:
{
  "videos": [
    {
      "title": "Título del video",
      "summary": "De qué trata el video en 1-2 oraciones",
      "source_url": "URL del video de YouTube",
      "source_name": "YouTube",
      "category": "video",
      "is_video": true,
      "creator_name": "Nombre del creador",
      "relevance_score": 1-10
    }
  ]
}` 
            }
          ],
          search_recency_filter: 'week',
        }),
      });

      let newsItems = [];
      let videoItems = [];

      // Parse news response
      if (newsResponse.ok) {
        const perplexityData = await newsResponse.json();
        const content = perplexityData.choices?.[0]?.message?.content || '';
        console.log('News response:', content);
        
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            newsItems = parsed.news || [];
          }
        } catch (parseError) {
          console.error('Error parsing news response:', parseError);
        }
      } else {
        console.error('News API error:', await newsResponse.text());
      }

      // Parse videos response
      if (videosResponse.ok) {
        const videosData = await videosResponse.json();
        const content = videosData.choices?.[0]?.message?.content || '';
        console.log('Videos response:', content);
        
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            videoItems = parsed.videos || [];
          }
        } catch (parseError) {
          console.error('Error parsing videos response:', parseError);
        }
      } else {
        console.error('Videos API error:', await videosResponse.text());
      }

      const allItems = [...newsItems, ...videoItems];

      const newsToInsert = allItems.map((item: any) => ({
        user_id: user.id,
        date: today,
        title: item.title,
        summary: item.summary,
        source_url: item.source_url,
        source_name: item.source_name,
        category: item.category || 'news',
        is_video: item.is_video || false,
        creator_name: item.creator_name,
        relevance_score: item.relevance_score || 5,
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
          videos: videoItems,
          totalItems: allItems.length,
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
