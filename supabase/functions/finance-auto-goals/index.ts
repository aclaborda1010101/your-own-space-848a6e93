import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

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
    // Using direct AI APIs
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

    const systemPrompt = `Eres un asesor financiero experto. Analiza patrones de gasto y sugiere metas de ahorro personalizadas, realistas y motivadoras. Las metas deben ser SMART.

Responde SIEMPRE con un JSON con esta estructura exacta:
{
  "suggested_goals": [
    {
      "name": "Nombre de la meta",
      "target_amount": 1000,
      "current_amount": 0,
      "deadline": "2026-12-31",
      "priority": "high|medium|low",
      "reason": "Por qué esta meta",
      "category": "emergency|vacation|debt|other"
    }
  ],
  "analysis_summary": "Resumen del análisis en 2-3 oraciones",
  "monthly_savings_potential": 200
}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: analysisPrompt }
    ];

    let content: string;
    try {
      content = await chat(messages, {
        model: "gemini-flash",
        responseFormat: "json",
        temperature: 0.7,
      });
    } catch (err) {
      console.error("AI error:", err);
      const errorMessage = err instanceof Error ? err.message : "AI error";
      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        return new Response(
          JSON.stringify({ error: "Límite de peticiones excedido. Inténtalo más tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      throw new Error("No se recibió respuesta estructurada del AI");
    }

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
