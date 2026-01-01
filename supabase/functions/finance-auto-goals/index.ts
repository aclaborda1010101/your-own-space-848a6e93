import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MonthlyComparison {
  month: string;
  monthLabel: string;
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  expensesByCategory: Record<string, number>;
}

interface ExistingGoal {
  name: string;
  target_amount: number;
  current_amount: number;
  status: string;
}

interface RequestBody {
  historyData: MonthlyComparison[];
  existingGoals: ExistingGoal[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { historyData, existingGoals }: RequestBody = await req.json();

    if (!historyData || historyData.length < 2) {
      return new Response(
        JSON.stringify({ error: "Se necesitan al menos 2 meses de datos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate averages and trends
    const avgIncome = historyData.reduce((sum, m) => sum + m.totalIncome, 0) / historyData.length;
    const avgExpenses = historyData.reduce((sum, m) => sum + m.totalExpenses, 0) / historyData.length;
    const avgSavings = avgIncome - avgExpenses;

    // Aggregate expenses by category across all months
    const categoryTotals: Record<string, number> = {};
    historyData.forEach((month) => {
      Object.entries(month.expensesByCategory).forEach(([cat, amount]) => {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
      });
    });

    const analysisPrompt = `
Analiza los siguientes datos financieros y sugiere metas de ahorro personalizadas:

## Historial de ${historyData.length} meses:
${historyData.map((m) => `- ${m.monthLabel}: Ingresos €${m.totalIncome.toFixed(2)}, Gastos €${m.totalExpenses.toFixed(2)}, Ahorro €${m.netCashflow.toFixed(2)}`).join("\n")}

## Promedios mensuales:
- Ingresos promedio: €${avgIncome.toFixed(2)}
- Gastos promedio: €${avgExpenses.toFixed(2)}
- Ahorro promedio: €${avgSavings.toFixed(2)}

## Gastos acumulados por categoría:
${Object.entries(categoryTotals)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, amount]) => `- ${cat}: €${amount.toFixed(2)}`)
  .join("\n")}

## Metas existentes:
${existingGoals.length > 0 
  ? existingGoals.map((g) => `- ${g.name}: €${g.current_amount}/${g.target_amount} (${g.status})`).join("\n")
  : "No hay metas activas"}

Genera sugerencias de metas de ahorro realistas y alcanzables basadas en estos patrones.
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Eres un asesor financiero experto. Analiza patrones de gasto y sugiere metas de ahorro personalizadas, realistas y motivadoras. Las metas deben ser SMART (específicas, medibles, alcanzables, relevantes y temporales).`
          },
          { role: "user", content: analysisPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_savings_goals",
              description: "Genera sugerencias de metas de ahorro basadas en el análisis",
              parameters: {
                type: "object",
                properties: {
                  suggested_goals: {
                    type: "array",
                    description: "Lista de metas de ahorro sugeridas (máximo 4)",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Nombre descriptivo de la meta" },
                        target_amount: { type: "number", description: "Cantidad objetivo en euros" },
                        current_amount: { type: "number", description: "Cantidad inicial (0 para nueva meta)" },
                        deadline: { type: "string", description: "Fecha límite en formato YYYY-MM-DD o null" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        reason: { type: "string", description: "Explicación breve de por qué esta meta" },
                        category: { type: "string", description: "Categoría relacionada (ej: emergency, vacation, debt)" }
                      },
                      required: ["name", "target_amount", "current_amount", "priority", "reason", "category"]
                    }
                  },
                  analysis_summary: {
                    type: "string",
                    description: "Resumen del análisis financiero en 2-3 oraciones"
                  },
                  monthly_savings_potential: {
                    type: "number",
                    description: "Ahorro mensual potencial estimado en euros"
                  }
                },
                required: ["suggested_goals", "analysis_summary", "monthly_savings_potential"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_savings_goals" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de peticiones excedido. Inténtalo más tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Se requiere crédito para usar esta función." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "suggest_savings_goals") {
      throw new Error("No se recibió respuesta estructurada del AI");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Auto goals error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
