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
    const { meal, preferences } = await req.json();
    // Using direct AI APIs

    console.log('Generating recipe for:', meal.name);

    const systemPrompt = `Eres un chef experto en cocina saludable y en Thermomix. 
Tu tarea es generar recetas detalladas con dos versiones: tradicional y Thermomix.

Preferencias del usuario:
- Tipo de dieta: ${preferences?.diet_type || 'balanceada'}
- Restricciones: ${preferences?.restrictions?.join(', ') || 'ninguna'}
- Alergias: ${preferences?.allergies?.join(', ') || 'ninguna'}
- Objetivo: ${preferences?.goals || 'mantener peso'}

IMPORTANTE:
- Responde SIEMPRE en español
- Adapta la receta a las restricciones y alergias del usuario
- Sé muy específico con las cantidades y tiempos
- Para Thermomix, usa los pasos con velocidad, temperatura y tiempo exactos`;

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
          { role: 'user', content: `Genera una receta detallada para: "${meal.name}" - ${meal.description}. Incluye versión tradicional y versión Thermomix.` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_recipe',
            description: 'Genera una receta detallada con ingredientes y pasos',
            parameters: {
              type: 'object',
              properties: {
                recipe_name: { type: 'string', description: 'Nombre de la receta' },
                servings: { type: 'number', description: 'Número de raciones' },
                prep_time: { type: 'string', description: 'Tiempo de preparación' },
                cook_time: { type: 'string', description: 'Tiempo de cocción' },
                calories_per_serving: { type: 'number', description: 'Calorías por ración' },
                difficulty: { type: 'string', enum: ['fácil', 'media', 'difícil'], description: 'Dificultad' },
                ingredients: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      quantity: { type: 'string' },
                      notes: { type: 'string' }
                    },
                    required: ['name', 'quantity']
                  }
                },
                traditional_steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      step_number: { type: 'number' },
                      instruction: { type: 'string' },
                      time: { type: 'string' },
                      tip: { type: 'string' }
                    },
                    required: ['step_number', 'instruction']
                  }
                },
                thermomix_steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      step_number: { type: 'number' },
                      instruction: { type: 'string' },
                      speed: { type: 'string' },
                      temperature: { type: 'string' },
                      time: { type: 'string' },
                      tip: { type: 'string' }
                    },
                    required: ['step_number', 'instruction']
                  }
                },
                nutrition_info: {
                  type: 'object',
                  properties: {
                    proteins: { type: 'string' },
                    carbs: { type: 'string' },
                    fats: { type: 'string' },
                    fiber: { type: 'string' }
                  }
                },
                tips: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['recipe_name', 'servings', 'ingredients', 'traditional_steps', 'thermomix_steps']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_recipe' } }
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
      const recipe = JSON.parse(toolCall.function.arguments);
      console.log('Recipe generated successfully:', recipe.recipe_name);
      return new Response(JSON.stringify(recipe), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('No recipe generated');

  } catch (error) {
    console.error('Error in nutrition-recipe:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
