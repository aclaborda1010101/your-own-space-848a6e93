import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RSS Feeds - Extended with more AI video channels
const RSS_FEEDS = [
  // Spanish AI Creators (PRIORITY) - Verified Channel IDs
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCy5znSnfMsDwaLlROnZ7Qbg', name: 'Dot CSV', author: 'Carlos Santana', type: 'video', lang: 'es' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCyFmNGk4hXqleOVQKi2OyjA', name: 'Jon Hernández', author: 'Jon Hernández', type: 'video', lang: 'es' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC8VxZLhHK8S_WR-5Iqm__6g', name: 'Miguel Baena IA', author: 'Miguel Baena', type: 'video', lang: 'es' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCq7R7BMcjlK26sFLi3jMy-A', name: 'Xavier Mitjana', author: 'Xavier Mitjana', type: 'video', lang: 'es' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCKgwLsJXj9LT_zZmRHHPSsg', name: 'Sergio Señor', author: 'Sergio Señor', type: 'video', lang: 'es' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCxp0O4pU2JknH8F4leHFwQA', name: 'Tu Profe de IA', author: 'Tu Profe de IA', type: 'video', lang: 'es' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC3l_jI1mwtxjnT_Y4rz8ohQ', name: 'Romuald Fons', author: 'Romuald Fons', type: 'video', lang: 'es' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCfRoLXxHlBRhq8OWlI3YCJA', name: 'NextGen IA Hub', author: 'NextGen IA', type: 'video', lang: 'es' },
  // International AI Creators - Verified Channel IDs
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCSQ3K8F1vTjHdXlQ9TQvSRw', name: 'Two Minute Papers', author: 'Károly Zsolnai-Fehér', type: 'video', lang: 'en' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNF0LEQ2abMr0PAX3cfkAMg', name: 'AI Explained', author: 'AI Explained', type: 'video', lang: 'en' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCJIfeSCssxSC_Dhc5s7woww', name: 'Matt Wolfe', author: 'Matt Wolfe', type: 'video', lang: 'en' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA', name: 'Fireship', author: 'Jeff Delaney', type: 'video', lang: 'en' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCLXo7UDZvByw2ixzpQCufnA', name: 'Wes Roth', author: 'Wes Roth', type: 'video', lang: 'en' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZHmQk67mSJgfCCTn7xBfew', name: 'Yannic Kilcher', author: 'Yannic Kilcher', type: 'video', lang: 'en' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw', name: 'Google DeepMind', author: 'Google DeepMind', type: 'video', lang: 'en' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXZCJLdBC09xxGZ6gcdrc6A', name: 'OpenAI', author: 'OpenAI', type: 'video', lang: 'en' },
  // News Sources (English)
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch AI', author: null, type: 'news', lang: 'en' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge AI', author: null, type: 'news', lang: 'en' },
  { url: 'https://feeds.feedburner.com/venturebeat/SZYF', name: 'VentureBeat', author: null, type: 'news', lang: 'en' },
  { url: 'https://www.technologyreview.com/feed/', name: 'MIT Tech Review', author: null, type: 'news', lang: 'en' },
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
  lang: string;
}> {
  const items: any[] = [];
  
  try {
    const itemRegex = /<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi;
    const matches = xml.match(itemRegex) || [];
    
    // Get MORE items per feed (15 instead of 10)
    for (const item of matches.slice(0, 15)) {
      const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
      
      const descMatch = item.match(/<(?:description|summary|content|media:description)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content|media:description)>/i);
      let summary = descMatch ? descMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
      if (summary) {
        summary = summary.replace(/<[^>]*>/g, '').substring(0, 500);
      }
      
      const linkMatch = item.match(/<link[^>]*href=["']([^"']+)["']/i) || 
                        item.match(/<link[^>]*>([^<]+)<\/link>/i);
      const url = linkMatch ? linkMatch[1].trim() : null;
      
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
          lang: feedInfo.lang || 'en',
        });
      }
    }
  } catch (error) {
    console.error(`Error parsing feed ${feedInfo.name}:`, error);
  }
  
  return items;
}

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

function filterRecentItems(items: any[]): any[] {
  const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
  
  return items.filter(item => {
    if (!item.published) return true;
    try {
      const itemDate = new Date(item.published).getTime();
      return itemDate > twoDaysAgo;
    } catch {
      return true;
    }
  });
}

// Translate content to Spanish using Claude
async function translateToSpanish(items: any[], anthropicKey: string): Promise<any[]> {
  if (!anthropicKey) return items;
  
  // Only translate English items
  const englishItems = items.filter(i => i.lang === 'en');
  const spanishItems = items.filter(i => i.lang === 'es');
  
  if (englishItems.length === 0) return items;
  
  try {
    const textsToTranslate = englishItems.slice(0, 30).map((item, i) => 
      `${i}|||${item.title}|||${item.summary || ''}`
    ).join('\n---\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: 'Eres un traductor profesional. Traduce títulos y resúmenes de noticias de IA del inglés al español. Mantén los nombres propios, marcas y términos técnicos. Responde SOLO con el JSON, sin explicaciones.',
        messages: [
          {
            role: 'user',
            content: `Traduce estos títulos y resúmenes al español. Formato: cada línea tiene índice|||título|||resumen. Responde con un JSON array: [{"i": 0, "title": "título traducido", "summary": "resumen traducido"}, ...]

${textsToTranslate}`
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error('Translation API error:', response.status);
      return items;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    // Parse translations
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const translations = JSON.parse(jsonMatch[0]);
        
        // Apply translations
        for (const t of translations) {
          if (typeof t.i === 'number' && t.i < englishItems.length) {
            englishItems[t.i].title = t.title || englishItems[t.i].title;
            englishItems[t.i].summary = t.summary || englishItems[t.i].summary;
            englishItems[t.i].lang = 'es'; // Mark as translated
          }
        }
      }
    } catch (parseError) {
      console.error('Error parsing translations:', parseError);
    }

    return [...spanishItems, ...englishItems, ...items.slice(30)];
  } catch (error) {
    console.error('Translation error:', error);
    return items;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario no válido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;
    const today = new Date().toISOString().split('T')[0];

    if (action === 'fetch') {
      console.log('Fetching AI news from RSS feeds...');

      const feedPromises = RSS_FEEDS.map(feed => fetchRSSFeed(feed));
      const feedResults = await Promise.all(feedPromises);
      
      let allItems = feedResults.flat();
      allItems = filterRecentItems(allItems);
      
      console.log(`Found ${allItems.length} recent items from RSS feeds`);

      // Translate English content to Spanish using Claude
      if (ANTHROPIC_API_KEY) {
        allItems = await translateToSpanish(allItems, ANTHROPIC_API_KEY);
        console.log('Content translated to Spanish');
      }

      // Score relevance with AI
      let processedItems = allItems.map(item => ({
        ...item,
        relevance_score: 5,
      }));

      if (LOVABLE_API_KEY && allItems.length > 0) {
        try {
          const itemsForAI = allItems.slice(0, 40).map((item, i) => 
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
                  content: 'Eres un experto en IA. Puntúa la relevancia de noticias del 1 al 10. Prioriza: modelos nuevos (GPT, Gemini, Claude), herramientas prácticas, actualizaciones importantes. Solo JSON.' 
                },
                { 
                  role: 'user', 
                  content: `Puntúa estas noticias del 1 al 10:\n${itemsForAI}\n\nResponde SOLO: { "scores": [7, 5, 8, ...] }` 
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
                
                processedItems = allItems.slice(0, 40).map((item, i) => ({
                  ...item,
                  relevance_score: scores[i] || 5,
                }));
                
                if (allItems.length > 40) {
                  processedItems = [
                    ...processedItems,
                    ...allItems.slice(40).map(item => ({ ...item, relevance_score: 5 }))
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

      processedItems.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

      // Insert MORE items (80 instead of 50)
      const newsToInsert = processedItems.slice(0, 80).map((item: any) => ({
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
        await supabase
          .from('ai_news')
          .delete()
          .eq('user_id', user.id)
          .eq('date', today);

        const { error: insertError } = await supabase
          .from('ai_news')
          .insert(newsToInsert);

        if (insertError) {
          console.error('Error inserting news:', insertError);
        }
      }

      const videos = processedItems.filter(item => item.isVideo);
      const news = processedItems.filter(item => !item.isVideo);

      return new Response(
        JSON.stringify({ 
          success: true, 
          news: news.slice(0, 30),
          videos: videos.slice(0, 20), // More videos
          totalItems: processedItems.length,
          sources: RSS_FEEDS.map(f => f.name),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get') {
      const { data: news, error: fetchError } = await supabase
        .from('ai_news')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('relevance_score', { ascending: false })
        .limit(150); // More items

      const { data: favorites } = await supabase
        .from('ai_news_favorites')
        .select('news_id')
        .eq('user_id', user.id);

      const favoriteIds = new Set((favorites || []).map(f => f.news_id));

      const { data: summary } = await supabase
        .from('ai_daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

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

      const { data: existing } = await supabase
        .from('ai_news_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('news_id', newsId)
        .single();

      if (existing) {
        await supabase
          .from('ai_news_favorites')
          .delete()
          .eq('id', existing.id);
        
        return new Response(
          JSON.stringify({ success: true, isFavorite: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
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
      // Get today's top news for enhanced summary
      const { data: todayNews } = await supabase
        .from('ai_news')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .eq('is_video', false) // Only articles for summary
        .order('relevance_score', { ascending: false })
        .limit(15);

      if (!todayNews || todayNews.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No hay noticias de hoy para resumir' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use Claude for enriched summary
      const apiKey = ANTHROPIC_API_KEY || LOVABLE_API_KEY;
      const isAnthropic = !!ANTHROPIC_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'API key no configurada' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newsForSummary = todayNews.map((n, i) => 
        `${i + 1}. [${n.source_name}] ${n.title}\n   ${n.summary || ''}`
      ).join('\n\n');

      let summaryContent = '';

      if (isAnthropic) {
        // Use Claude for enriched summary
        const summaryResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: `Eres un experto periodista especializado en Inteligencia Artificial. Tu tarea es crear un resumen ejecutivo de las noticias más importantes del día.

Estilo:
- Párrafos bien redactados, NO listas
- Lenguaje profesional pero accesible
- Conecta las noticias entre sí cuando tenga sentido
- Destaca las implicaciones prácticas
- Máximo 3-4 párrafos principales
- Incluye 5 puntos clave al final

Responde en español.`,
            messages: [
              {
                role: 'user',
                content: `Genera un resumen ENRIQUECIDO de estas noticias de IA de hoy:

${newsForSummary}

Responde con un JSON:
{
  "summary": "Resumen narrativo de 3-4 párrafos bien redactados que sintetizan las tendencias y novedades más importantes del día en IA. Conecta los temas cuando sea relevante.",
  "key_insights": ["Insight 1 completo", "Insight 2 completo", "Insight 3 completo", "Insight 4 completo", "Insight 5 completo"],
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
        summaryContent = summaryData.content?.[0]?.text || '';
      } else {
        // Fallback to Lovable AI
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
                content: 'Eres un experto en IA que resume noticias. Genera resúmenes narrativos en párrafos, no listas. Responde en español.' 
              },
              { 
                role: 'user', 
                content: `Genera un resumen enriquecido de estas noticias de IA:

${newsForSummary}

Responde con JSON: { "summary": "3-4 párrafos narrativos bien redactados", "key_insights": ["insight1", "insight2", ...], "top_news_indices": [0, 1, 2] }` 
              }
            ],
          }),
        });

        if (!summaryResponse.ok) {
          return new Response(
            JSON.stringify({ success: false, error: 'Error al generar resumen' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const summaryData = await summaryResponse.json();
        summaryContent = summaryData.choices?.[0]?.message?.content || '';
      }
      
      let parsedSummary = { summary: summaryContent, key_insights: [], top_news_indices: [] };
      try {
        const jsonMatch = summaryContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedSummary = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Error parsing summary:', e);
      }

      const topNewsIds = (parsedSummary.top_news_indices || [])
        .filter((i: number) => i < todayNews.length)
        .map((i: number) => todayNews[i].id);

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
