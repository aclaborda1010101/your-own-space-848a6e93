import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RawTransaction {
  description: string;
  amount: number;
  transaction_type: "income" | "expense";
  transaction_date: string;
  vendor?: string;
  currency?: string;
}

interface CategorizedTransaction extends RawTransaction {
  category: string;
  subcategory?: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactions } = await req.json() as { transactions: RawTransaction[] };

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No transactions provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Prepare transaction list for AI
    const transactionList = transactions.map((t, i) => 
      `${i + 1}. "${t.description}" - ${t.amount}€ (${t.transaction_type})`
    ).join("\n");

    const systemPrompt = `Eres un experto en finanzas personales. Tu tarea es categorizar transacciones bancarias.

CATEGORÍAS DE GASTOS disponibles:
- housing: Vivienda (alquiler, hipoteca, comunidad, seguro hogar, mantenimiento)
- utilities: Suministros (luz, gas, agua, internet, teléfono)
- transport: Transporte (combustible, transporte público, seguro coche, mantenimiento, parking, taxi)
- food: Alimentación (supermercado, restaurantes, delivery, cafés)
- subscriptions: Suscripciones (streaming, música, software, gimnasio)
- loans: Préstamos (préstamo personal, préstamo coche, tarjeta crédito)
- health: Salud (farmacia, médico, dentista, seguro médico)
- education: Educación (cursos, libros, colegio)
- entertainment: Ocio (cine, eventos, viajes, hobbies)
- shopping: Compras (ropa, electrónica, hogar)
- family: Familia (guardería, actividades niños, mascotas)
- business: Negocio (material, marketing, servicios profesionales)
- taxes: Impuestos (IRPF, IVA, IBI, Seguridad Social)
- transfer: Transferencias
- other: Otros

CATEGORÍAS DE INGRESOS disponibles:
- salary: Nómina (salario principal, bonus, paga extra)
- freelance: Freelance (proyecto, consultoría, comisión)
- business: Negocio (ventas, servicios)
- investments: Inversiones (dividendos, plusvalías, intereses)
- rental: Alquileres (alquiler inmueble, habitación)
- refunds: Reembolsos
- other: Otros ingresos

Responde SOLO con un JSON array con el siguiente formato:
[{"index": 1, "category": "food", "subcategory": "restaurants", "confidence": 0.95}, ...]

El campo "confidence" es un número entre 0 y 1 indicando la confianza en la categorización.`;

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
          { role: "user", content: `Categoriza estas transacciones:\n\n${transactionList}` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de peticiones excedido. Intenta de nuevo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados. Añade fondos a tu workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse AI response
    let categorizations: Array<{ index: number; category: string; subcategory?: string; confidence: number }> = [];
    
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        categorizations = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
    }

    // Merge categorizations with original transactions
    const categorizedTransactions: CategorizedTransaction[] = transactions.map((t, i) => {
      const cat = categorizations.find(c => c.index === i + 1);
      return {
        ...t,
        category: cat?.category || (t.transaction_type === "income" ? "other" : "other"),
        subcategory: cat?.subcategory,
        confidence: cat?.confidence || 0.5,
      };
    });

    return new Response(
      JSON.stringify({ 
        transactions: categorizedTransactions,
        categorized: categorizations.length,
        total: transactions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("categorize-transactions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
