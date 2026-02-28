import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { trackAICost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipes } = await req.json();
    // Using direct AI APIs

    console.log('Generating shopping list for recipes:', recipes);

    const recipesList = recipes.map((r: any) => {
      if (r.ingredients && r.ingredients.length > 0) {
        return `${r.name}: ${r.ingredients.join(', ')}`;
      }
      return r.name;
    }).join('\n');

    const systemPrompt = `Eres un asistente de cocina experto. Tu tarea es generar una lista de compra consolidada basada en las recetas proporcionadas.

REGLAS:
1. Agrupa ingredientes similares (ej: si hay pollo en dos recetas, súmalos)
2. Categoriza los ingredientes en grupos: Carnes, Pescados, Lácteos, Verduras, Frutas, Cereales, Condimentos, Otros
3. Estima cantidades razonables para cada ingrediente
4. No incluyas ingredientes básicos de despensa (sal, aceite, pimienta) a menos que se necesiten en grandes cantidades
5. Responde SIEMPRE en español`;

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
          { role: 'user', content: `Genera una lista de compra para estas recetas:\n\n${recipesList}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_shopping_list',
            description: 'Genera una lista de compra organizada por categorías',
            parameters: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Nombre del ingrediente' },
                      quantity: { type: 'string', description: 'Cantidad estimada (ej: 500g, 2 unidades)' },
                      category: { type: 'string', description: 'Categoría: Carnes, Pescados, Lácteos, Verduras, Frutas, Cereales, Condimentos, Otros' },
                      fromMeal: { type: 'string', description: 'De qué receta viene este ingrediente' }
                    },
                    required: ['name', 'quantity', 'category']
                  }
                }
              },
              required: ['items']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_shopping_list' } }
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
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();

    // Track cost (Lovable gateway uses gemini-2.5-flash)
    const usage = data.usage;
    if (usage) {
      const { recordCost, calculateCost } = await import("../_shared/cost-tracker.ts");
      recordCost(null, {
        service: "gemini-flash",
        operation: "shopping-list-generator",
        tokensInput: usage.prompt_tokens || 0,
        tokensOutput: usage.completion_tokens || 0,
        costUsd: calculateCost("gemini-flash", usage.prompt_tokens || 0, usage.completion_tokens || 0),
      }).catch(() => {});
    }

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const shoppingList = JSON.parse(toolCall.function.arguments);
      console.log('Generated shopping list:', shoppingList);
      return new Response(JSON.stringify(shoppingList), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('No shopping list received');

  } catch (error) {
    console.error('Error in shopping-list-generator:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
