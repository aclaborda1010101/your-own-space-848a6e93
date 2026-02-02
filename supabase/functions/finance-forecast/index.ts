import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildAgentPrompt } from "../_shared/rag-loader.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Transaction {
  id: string;
  transaction_type: "income" | "expense";
  category: string;
  subcategory: string | null;
  amount: number;
  transaction_date: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  description: string | null;
  vendor: string | null;
}

interface ForecastRequest {
  transactions: Transaction[];
  monthsToForecast: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactions, monthsToForecast = 3 }: ForecastRequest = await req.json();

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No hay transacciones para analizar",
          forecast: null 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group transactions by category and calculate patterns
    const expensesByCategory: Record<string, { total: number; count: number; recurring: number; transactions: Transaction[] }> = {};
    const incomeByCategory: Record<string, { total: number; count: number; recurring: number }> = {};

    transactions.forEach(t => {
      if (t.transaction_type === "expense") {
        if (!expensesByCategory[t.category]) {
          expensesByCategory[t.category] = { total: 0, count: 0, recurring: 0, transactions: [] };
        }
        expensesByCategory[t.category].total += Number(t.amount);
        expensesByCategory[t.category].count += 1;
        expensesByCategory[t.category].transactions.push(t);
        if (t.is_recurring) {
          expensesByCategory[t.category].recurring += Number(t.amount);
        }
      } else if (t.transaction_type === "income") {
        if (!incomeByCategory[t.category]) {
          incomeByCategory[t.category] = { total: 0, count: 0, recurring: 0 };
        }
        incomeByCategory[t.category].total += Number(t.amount);
        incomeByCategory[t.category].count += 1;
        if (t.is_recurring) {
          incomeByCategory[t.category].recurring += Number(t.amount);
        }
      }
    });

    const totalExpenses = Object.values(expensesByCategory).reduce((sum, cat) => sum + cat.total, 0);
    const totalRecurringExpenses = Object.values(expensesByCategory).reduce((sum, cat) => sum + cat.recurring, 0);
    const totalIncome = Object.values(incomeByCategory).reduce((sum, cat) => sum + cat.total, 0);
    const totalRecurringIncome = Object.values(incomeByCategory).reduce((sum, cat) => sum + cat.recurring, 0);

    // Format data for AI analysis
    const transactionSummary = `
## Resumen de transacciones:
- Total gastos: €${totalExpenses.toFixed(2)}
- Gastos recurrentes: €${totalRecurringExpenses.toFixed(2)}
- Total ingresos: €${totalIncome.toFixed(2)}
- Ingresos recurrentes: €${totalRecurringIncome.toFixed(2)}
- Cashflow: €${(totalIncome - totalExpenses).toFixed(2)}

## Desglose por categoría de gastos:
${Object.entries(expensesByCategory)
  .sort((a, b) => b[1].total - a[1].total)
  .map(([cat, data]) => `- ${cat}: €${data.total.toFixed(2)} (${data.count} transacciones, €${data.recurring.toFixed(2)} recurrente)`)
  .join('\n')}

## Desglose por categoría de ingresos:
${Object.entries(incomeByCategory)
  .map(([cat, data]) => `- ${cat}: €${data.total.toFixed(2)} (${data.count} transacciones, €${data.recurring.toFixed(2)} recurrente)`)
  .join('\n')}

## Muestra de transacciones recientes:
${transactions.slice(0, 20).map(t => 
  `- ${t.transaction_date}: ${t.transaction_type === 'expense' ? '-' : '+'}€${Number(t.amount).toFixed(2)} ${t.category}${t.description ? ` (${t.description})` : ''}${t.is_recurring ? ' [RECURRENTE]' : ''}`
).join('\n')}
`;

    const additionalContext = `Analiza los datos financieros del usuario y proporciona:

1. PREVISIÓN DE GASTOS: Proyección de gastos para los próximos ${monthsToForecast} meses basándote en patrones recurrentes y tendencias
2. ANÁLISIS DE PATRONES: Identifica gastos recurrentes, tendencias y anomalías
3. SUGERENCIAS DE AHORRO: Proporciona 3-5 sugerencias específicas y accionables para reducir gastos basándote en principios de finanzas personales
4. ALERTAS: Señala categorías donde el gasto es alto o preocupante

Aplica conceptos como la regla 50/30/20, behavioral finance, y estrategias de ahorro inteligente.
Responde en español, sé conciso y específico con números concretos.`;

    const systemPrompt = await buildAgentPrompt("finance", additionalContext, 300);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transactionSummary }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_forecast",
              description: "Genera una previsión financiera estructurada",
              parameters: {
                type: "object",
                properties: {
                  monthly_forecast: {
                    type: "array",
                    description: "Previsión mensual de gastos e ingresos",
                    items: {
                      type: "object",
                      properties: {
                        month: { type: "string", description: "Mes (ej: 'Febrero 2026')" },
                        projected_expenses: { type: "number", description: "Gastos proyectados" },
                        projected_income: { type: "number", description: "Ingresos proyectados" },
                        projected_savings: { type: "number", description: "Ahorro proyectado" }
                      },
                      required: ["month", "projected_expenses", "projected_income", "projected_savings"]
                    }
                  },
                  recurring_expenses: {
                    type: "array",
                    description: "Lista de gastos recurrentes identificados",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        amount: { type: "number" },
                        frequency: { type: "string", description: "mensual, semanal, etc." }
                      },
                      required: ["category", "amount", "frequency"]
                    }
                  },
                  savings_suggestions: {
                    type: "array",
                    description: "Sugerencias específicas para ahorrar dinero",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        suggestion: { type: "string" },
                        potential_savings: { type: "number", description: "Ahorro potencial mensual" },
                        priority: { type: "string", enum: ["alta", "media", "baja"] }
                      },
                      required: ["category", "suggestion", "potential_savings", "priority"]
                    }
                  },
                  alerts: {
                    type: "array",
                    description: "Alertas sobre gastos preocupantes",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string" },
                        message: { type: "string" },
                        severity: { type: "string", enum: ["info", "warning", "critical"] }
                      },
                      required: ["category", "message", "severity"]
                    }
                  },
                  summary: {
                    type: "string",
                    description: "Resumen ejecutivo de la situación financiera en 2-3 oraciones"
                  }
                },
                required: ["monthly_forecast", "recurring_expenses", "savings_suggestions", "alerts", "summary"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_forecast" } }
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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "generate_forecast") {
      throw new Error("No se recibió respuesta estructurada del AI");
    }

    const forecast = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ 
        success: true,
        forecast,
        analyzed_transactions: transactions.length,
        total_expenses: totalExpenses,
        total_income: totalIncome
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Finance forecast error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error desconocido",
        forecast: null 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
