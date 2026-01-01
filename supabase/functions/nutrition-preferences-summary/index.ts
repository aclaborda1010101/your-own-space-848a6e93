import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!chatHistory || chatHistory.length === 0) {
      return new Response(JSON.stringify({ 
        preferences: [],
        summary: null 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Analyzing chat history for preferences, messages:', chatHistory.length);

    const chatText = chatHistory
      .map((m: any) => `${m.role === 'user' ? 'Usuario' : 'Jarvis'}: ${m.content}`)
      .join('\n');

    const systemPrompt = `Eres un experto en análisis de conversaciones sobre nutrición.
Tu tarea es extraer las preferencias alimentarias que el usuario ha mencionado en sus conversaciones.

Busca menciones de:
- Alimentos que le gustan o no le gustan
- Platos favoritos o que quiere evitar
- Preferencias de cocina (rápido, elaborado, etc.)
- Ingredientes preferidos o rechazados
- Horarios de comida preferidos
- Cualquier otra preferencia alimentaria

Responde SOLO con un JSON estructurado. No incluyas preferencias que no estén explícitamente mencionadas.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analiza esta conversación y extrae las preferencias alimentarias:\n\n${chatText}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_preferences',
            description: 'Extrae las preferencias alimentarias del usuario',
            parameters: {
              type: 'object',
              properties: {
                likes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Alimentos o platos que le gustan'
                },
                dislikes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Alimentos o platos que no le gustan'
                },
                favorite_cuisines: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tipos de cocina favoritos'
                },
                cooking_preferences: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Preferencias de cocina (rápido, elaborado, etc.)'
                },
                other_notes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Otras notas importantes'
                },
                summary: {
                  type: 'string',
                  description: 'Resumen breve en 1-2 frases de las preferencias del usuario'
                }
              },
              required: ['likes', 'dislikes', 'summary']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_preferences' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const preferences = JSON.parse(toolCall.function.arguments);
      console.log('Preferences extracted:', preferences);
      return new Response(JSON.stringify(preferences), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      likes: [], 
      dislikes: [], 
      summary: null 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in nutrition-preferences-summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
