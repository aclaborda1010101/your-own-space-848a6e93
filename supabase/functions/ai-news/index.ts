import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RSS Feeds de divulgadores españoles y fuentes de IA
const RSS_FEEDS = [
  // Divulgadores españoles
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCrBzBOMcUVV8ryyAU_c6P5g', name: 'Dot CSV', author: 'Carlos Santana', type: 'video' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXTb9k3vUzRXW5Lk5mJN0Fg', name: 'Jon Hernández', author: 'Jon Hernández', type: 'video' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCggHoFBwZdNAhz6eBn3qwHA', name: 'Romuald Fons', author: 'Romuald Fons', type: 'video' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCnDAXfhnL2Fau3oCmY4WPog', name: 'Two Minute Papers', author: 'Károly Zsolnai-Fehér', type: 'video' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNF0LEQ2abMr0PAX3cfkAMg', name: 'AI Explained', author: 'AI Explained', type: 'video' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCYpBgT4riB-VpsBBBQkblqg', name: 'Matt Wolfe', author: 'Matt Wolfe', type: 'video' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA', name: 'Fireship', author: 'Jeff Delaney', type: 'video' },
  // Fuentes de noticias de IA en inglés
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch AI', author: null, type: 'news' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge AI', author: null, type: 'news' },
  { url: 'https://feeds.feedburner.com/venturebeat/SZYF', name: 'VentureBeat', author: null, type: 'news' },
  { url: 'https://www.technologyreview.com/feed/', name: 'MIT Tech Review', author: null, type: 'news' },
];

// Parse simple XML - extract items from RSS/Atom feed
function parseRSSFeed(xml: string, feedInfo: typeof RSS_FEEDS[0]): Array<{
  title: string;
  summary: string | null;
  url: string | null;
  published: string | null;
  source: string;
  author: string | null;
  isVideo: boolean;
}> {
  const items: any[] = [];
  
  try {
    // Try to extract items (RSS) or entries (Atom)
    const itemRegex = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
    const matches = xml.match(itemRegex) || [];
    
    for (const item of matches.slice(0, 10)) { // Limit to 10 items per feed
      // Extract title
      const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
      
      // Extract description/summary
      const descMatch = item.match(/<(?:description|summary|content|media:description)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content|media:description)>/i);
      let summary = descMatch ? descMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
      // Strip HTML tags from summary
      if (summary) {
        summary = summary.replace(/<[^>]*>/g, '').substring(0, 500);
      }
      
      // Extract link
      const linkMatch = item.match(/<link[^>]*href=["']([^"']+)["']/i) || 
                        item.match(/<link[^>]*>([^<]+)<\/link>/i);
      const url = linkMatch ? linkMatch[1].trim() : null;
      
      // Extract publication date
      const dateMatch = item.match(/<(?:pubDate|published|updated)[^>]*>([^<]+)<\/(?:pubDate|published|updated)>/i);
      const published = dateMatch ? dateMatch[1].trim() : null;
      
      if (title) {
        items.push({
          title,
          summary,
          url,
          published,
          source: feedInfo.name,
          author: feedInfo.author,
          isVideo: feedInfo.type === 'video',
        });
      }
    }
  } catch (error) {
    console.error(`Error parsing feed ${feedInfo.name}:`, error);
  }
  
  return items;
}

// Fetch RSS feed with timeout
async function fetchRSSFeed(feed: typeof RSS_FEEDS[0]): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JARVIS/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml',
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.error(`Failed to fetch ${feed.name}: ${response.status}`);
      return [];
    }
    
    const xml = await response.text();
    return parseRSSFeed(xml, feed);
  } catch (error) {
    console.error(`Error fetching ${feed.name}:`, error);
    return [];
  }
}

// Filter items from last 48 hours
function filterRecentItems(items: any[]): any[] {
  const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
  
  return items.filter(item => {
    if (!item.published) return true; // Keep items without date
    try {
      const itemDate = new Date(item.published).getTime();
      return itemDate > twoDaysAgo;
    } catch {
      return true;
    }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
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

    // Parse body once and reuse
    const body = await req.json();
    const { action } = body;
    const today = new Date().toISOString().split('T')[0];

    if (action === 'fetch') {
      console.log('Fetching AI news from RSS feeds...');

      // Fetch all RSS feeds in parallel
      const feedPromises = RSS_FEEDS.map(feed => fetchRSSFeed(feed));
      const feedResults = await Promise.all(feedPromises);
      
      // Flatten and filter recent items
      let allItems = feedResults.flat();
      allItems = filterRecentItems(allItems);
      
      console.log(`Found ${allItems.length} recent items from RSS feeds`);

      // Use AI to summarize and score relevance (only if we have API key)
      let processedItems = allItems.map(item => ({
        ...item,
        relevance_score: 5, // Default score
      }));

      if (LOVABLE_API_KEY && allItems.length > 0) {
        try {
          // Create a summary request for AI
          const itemsForAI = allItems.slice(0, 30).map((item, i) => 
            `${i + 1}. [${item.source}] ${item.title}`
          ).join('\n');

          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [
                { 
                  role: 'system', 
                  content: 'Eres un experto en IA. Tu tarea es puntuar la relevancia de noticias de IA del 1 al 10. Prioriza: modelos nuevos (GPT, Gemini, Claude), herramientas prácticas, y actualizaciones importantes. Devuelve SOLO un JSON con un array de números en el mismo orden que las noticias.' 
                },
                { 
                  role: 'user', 
                  content: `Puntúa estas noticias del 1 al 10:\n${itemsForAI}\n\nResponde SOLO con un JSON: { "scores": [7, 5, 8, ...] }` 
                }
              ],
            }),
          });

          if (response.ok) {
            const aiData = await response.json();
            const content = aiData.choices?.[0]?.message?.content || '';
            
            try {
              const jsonMatch = content.match(/\{[\s\S]*"scores"[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const scores = parsed.scores || [];
                
                processedItems = allItems.slice(0, 30).map((item, i) => ({
                  ...item,
                  relevance_score: scores[i] || 5,
                }));
                
                // Add remaining items with default score
                if (allItems.length > 30) {
                  processedItems = [
                    ...processedItems,
                    ...allItems.slice(30).map(item => ({ ...item, relevance_score: 5 }))
                  ];
                }
              }
            } catch (parseError) {
              console.error('Error parsing AI scores:', parseError);
            }
          }
        } catch (aiError) {
          console.error('AI scoring error:', aiError);
        }
      }

      // Sort by relevance
      processedItems.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

      // Prepare for database insertion
      const newsToInsert = processedItems.slice(0, 50).map((item: any) => ({
        user_id: user.id,
        date: today,
        title: item.title,
        summary: item.summary,
        source_url: item.url,
        source_name: item.source,
        category: item.isVideo ? 'video' : 'news',
        is_video: item.isVideo || false,
        creator_name: item.author,
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

      // Separate videos and news for response
      const videos = processedItems.filter(item => item.isVideo);
      const news = processedItems.filter(item => !item.isVideo);

      return new Response(
        JSON.stringify({ 
          success: true, 
          news: news.slice(0, 20),
          videos: videos.slice(0, 15),
          totalItems: processedItems.length,
          sources: RSS_FEEDS.map(f => f.name),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get') {
      // Get news from database with favorites
      const { data: news, error: fetchError } = await supabase
        .from('ai_news')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('relevance_score', { ascending: false })
        .limit(100);

      // Get favorites
      const { data: favorites } = await supabase
        .from('ai_news_favorites')
        .select('news_id')
        .eq('user_id', user.id);

      const favoriteIds = new Set((favorites || []).map(f => f.news_id));

      // Get today's summary
      const { data: summary } = await supabase
        .from('ai_daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      // Get video alerts
      const { data: videoAlerts } = await supabase
        .from('ai_video_alerts')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) {
        console.error('Error fetching news:', fetchError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al obtener noticias' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add isFavorite flag to news
      const newsWithFavorites = (news || []).map(item => ({
        ...item,
        isFavorite: favoriteIds.has(item.id),
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          news: newsWithFavorites,
          summary: summary || null,
          videoAlerts: videoAlerts || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'toggle-favorite') {
      const { newsId } = body;
      
      if (!newsId) {
        return new Response(
          JSON.stringify({ success: false, error: 'newsId requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already favorited
      const { data: existing } = await supabase
        .from('ai_news_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('news_id', newsId)
        .single();

      if (existing) {
        // Remove favorite
        await supabase
          .from('ai_news_favorites')
          .delete()
          .eq('id', existing.id);
        
        return new Response(
          JSON.stringify({ success: true, isFavorite: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Add favorite
        await supabase
          .from('ai_news_favorites')
          .insert({ user_id: user.id, news_id: newsId });
        
        return new Response(
          JSON.stringify({ success: true, isFavorite: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    } else if (action === 'get-favorites') {
      const { data: favorites, error } = await supabase
        .from('ai_news_favorites')
        .select(`
          id,
          created_at,
          ai_news (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching favorites:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al obtener favoritos' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, favorites: favorites || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'generate-summary') {
      // Get today's news
      const { data: todayNews } = await supabase
        .from('ai_news')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('relevance_score', { ascending: false })
        .limit(20);

      if (!todayNews || todayNews.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No hay noticias de hoy para resumir' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: 'API key no configurada' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate summary with AI
      const newsForSummary = todayNews.map(n => `- [${n.source_name}] ${n.title}: ${n.summary || ''}`).join('\n');
      
      const summaryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { 
              role: 'system', 
              content: 'Eres un experto en IA que resume las noticias más importantes del día. Responde en español de forma clara y concisa.' 
            },
            { 
              role: 'user', 
              content: `Genera un resumen ejecutivo de las siguientes noticias de IA de hoy. Incluye los 3-5 puntos clave más importantes.

Noticias:
${newsForSummary}

Responde con un JSON:
{
  "summary": "Resumen ejecutivo de 2-3 párrafos sobre las tendencias y novedades más importantes",
  "key_insights": ["Insight 1", "Insight 2", "Insight 3", "Insight 4", "Insight 5"],
  "top_news_indices": [0, 1, 2]
}` 
            }
          ],
        }),
      });

      if (!summaryResponse.ok) {
        const errText = await summaryResponse.text();
        console.error('Summary API error:', errText);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al generar resumen' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const summaryData = await summaryResponse.json();
      const content = summaryData.choices?.[0]?.message?.content || '';
      
      let parsedSummary = { summary: content, key_insights: [], top_news_indices: [] };
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedSummary = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Error parsing summary:', e);
      }

      // Get top news IDs
      const topNewsIds = (parsedSummary.top_news_indices || [])
        .filter((i: number) => i < todayNews.length)
        .map((i: number) => todayNews[i].id);

      // Upsert summary
      await supabase
        .from('ai_daily_summaries')
        .upsert({
          user_id: user.id,
          date: today,
          summary: parsedSummary.summary,
          key_insights: parsedSummary.key_insights,
          top_news_ids: topNewsIds,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date' });

      return new Response(
        JSON.stringify({ 
          success: true, 
          summary: parsedSummary.summary,
          key_insights: parsedSummary.key_insights,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'toggle-video-alert') {
      const { creatorName, enabled } = body;
      
      if (!creatorName) {
        return new Response(
          JSON.stringify({ success: false, error: 'creatorName requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Upsert video alert
      await supabase
        .from('ai_video_alerts')
        .upsert({
          user_id: user.id,
          creator_name: creatorName,
          enabled: enabled !== false,
        }, { onConflict: 'user_id,creator_name' });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get-video-alerts') {
      const { data: alerts } = await supabase
        .from('ai_video_alerts')
        .select('*')
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ success: true, alerts: alerts || [] }),
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
