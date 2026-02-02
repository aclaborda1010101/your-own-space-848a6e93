import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, messages, preferences, checkIn, whoopsSummary } = await req.json();
    // Using direct AI APIs

    if (action === 'generate-meals') {
      // Generate meal suggestions based on preferences, energy level, and chat history context
      const chatContext = messages && messages.length > 0 
        ? `\n\nHistorial de conversación reciente (usa esto para personalizar las sugerencias):
${messages.slice(-10).map((m: any) => `${m.role === 'user' ? 'Usuario' : 'Jarvis'}: ${m.content}`).join('\n')}`
        : '';

      const systemPrompt = `Eres Jarvis Nutrición, un asistente experto en nutrición personalizada. 
Tu objetivo es sugerir comidas saludables y deliciosas basándote en:
- Las preferencias dietéticas del usuario
- Su nivel de energía actual
- Los datos de su wearable (si están disponibles)
- El contexto de conversaciones previas (gustos, preferencias mencionadas, platos que le gustaron o no)

Responde SIEMPRE en español. Sé conciso y práctico.
Genera exactamente 4 opciones de comida y 4 opciones de cena.

Preferencias del usuario:
- Tipo de dieta: ${preferences?.diet_type || 'balanceada'}
- Restricciones: ${preferences?.restrictions?.join(', ') || 'ninguna'}
- Alergias: ${preferences?.allergies?.join(', ') || 'ninguna'}
- Objetivo: ${preferences?.goals || 'mantener peso'}
- Calorías objetivo: ${preferences?.calories_target || 2000} kcal/día
- Notas adicionales: ${preferences?.preferences_notes || 'ninguna'}

Estado actual:
- Energía: ${checkIn?.energy || 3}/5
- Ánimo: ${checkIn?.mood || 3}/5
- Datos Whoop: ${whoopsSummary || 'No disponible'}
${chatContext}

Si la energía es baja, sugiere comidas más energéticas y fáciles de preparar.
Si la energía es alta, puedes sugerir recetas más elaboradas.
IMPORTANTE: Ten en cuenta cualquier preferencia o disgusto mencionado en conversaciones anteriores.`;

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
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
            { role: 'user', content: 'Genera las opciones de comida y cena para hoy.' }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'suggest_meals',
              description: 'Sugiere opciones de comida y cena',
              parameters: {
                type: 'object',
                properties: {
                  lunch_options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        calories: { type: 'number' },
                        prep_time: { type: 'string' }
                      },
                      required: ['name', 'description', 'calories', 'prep_time']
                    }
                  },
                  dinner_options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        calories: { type: 'number' },
                        prep_time: { type: 'string' }
                      },
                      required: ['name', 'description', 'calories', 'prep_time']
                    }
                  }
                },
                required: ['lunch_options', 'dinner_options']
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'suggest_meals' } }
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
        const meals = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(meals), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error('No meal suggestions received');

    } else if (action === 'chat') {
      // Chat with Jarvis Nutrition - with memory context
      const systemPrompt = `Eres Jarvis Nutrición, un asistente experto en nutrición personalizada integrado en el sistema JARVIS.
Tu rol es:
- Responder preguntas sobre nutrición y dieta
- Ayudar a planificar comidas saludables
- Dar consejos sobre alimentación según los objetivos del usuario
- Explicar los beneficios nutricionales de diferentes alimentos
- RECORDAR las preferencias y gustos que el usuario menciona en la conversación

Preferencias guardadas del usuario:
- Tipo de dieta: ${preferences?.diet_type || 'balanceada'}
- Restricciones: ${preferences?.restrictions?.join(', ') || 'ninguna'}
- Alergias: ${preferences?.allergies?.join(', ') || 'ninguna'}
- Objetivo: ${preferences?.goals || 'mantener peso'}
- Notas: ${preferences?.preferences_notes || 'ninguna'}

IMPORTANTE:
- Responde SIEMPRE en español. Sé amable, conciso y práctico.
- No des consejos médicos específicos, sugiere consultar con un profesional si es necesario.
- Recuerda las preferencias y gustos que el usuario mencione (ej: "no me gusta el brócoli", "me encanta el pollo") para tenerlos en cuenta en futuras sugerencias de comidas.
- Cuando el usuario mencione algo importante sobre sus preferencias, confírmalo para que sepa que lo has registrado.`;

      const LOVABLE_API_KEY_CHAT = Deno.env.get('LOVABLE_API_KEY');
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY_CHAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          stream: true,
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

      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in jarvis-nutrition:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
