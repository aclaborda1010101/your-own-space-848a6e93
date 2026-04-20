import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimelinePoint {
  date: string;
  sentiment: number;
  title: string;
  description?: string;
  kind: "relationship" | "personal";
  source: string;
  category?: string;
  total?: number;
}

const CACHE_TTL_DAYS = 7;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function extractHitosWithAI(
  contactName: string,
  messages: Array<{ message_date: string; direction: string; content: string }>
): Promise<TimelinePoint[]> {
  if (!LOVABLE_API_KEY || messages.length < 5) return [];

  // Build a representative sample: first 30, last 30, and 30 from peak months
  const sorted = [...messages].sort(
    (a, b) => new Date(a.message_date).getTime() - new Date(b.message_date).getTime()
  );
  const first = sorted.slice(0, 30);
  const last = sorted.slice(-30);
  const middle = sorted.slice(Math.floor(sorted.length / 2) - 15, Math.floor(sorted.length / 2) + 15);
  const sample = [...first, ...middle, ...last];

  const conversationText = sample
    .map((m) => {
      const d = new Date(m.message_date).toISOString().slice(0, 10);
      const who = m.direction === "incoming" ? contactName : "Yo";
      const content = (m.content || "").slice(0, 200);
      return `[${d}] ${who}: ${content}`;
    })
    .join("\n");

  const systemPrompt = `Eres un analista que extrae HITOS (momentos importantes) de una conversación de WhatsApp entre dos personas.

Devuelve SOLO un JSON válido con esta forma exacta:
{
  "hitos": [
    {
      "date": "YYYY-MM-DD",
      "title": "Título corto del hito (max 60 chars)",
      "description": "Qué pasó realmente, en 1-2 frases",
      "sentiment": -3,
      "category": "viaje|celebracion|conflicto|logro|perdida|reencuentro|cotidiano|salud|familia|trabajo"
    }
  ]
}

Reglas:
- sentiment: -3 (muy negativo) a +3 (muy positivo). 0 = neutro.
- Sólo hitos REALES detectables en los mensajes (viajes mencionados, celebraciones, conflictos, noticias importantes, reencuentros, pérdidas, logros).
- NO inventes. Si no hay hitos claros, devuelve {"hitos": []}.
- Máximo 12 hitos. Prioriza los más significativos.
- date debe coincidir aproximadamente con la fecha del mensaje donde se menciona el hito.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Conversación con ${contactName}:\n\n${conversationText}\n\nExtrae los hitos.` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("[timeline] AI error", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const hitos = Array.isArray(parsed?.hitos) ? parsed.hitos : [];

    return hitos
      .map((h: any): TimelinePoint | null => {
        const date = h?.date;
        if (!date || typeof date !== "string") return null;
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) return null;
        const sentRaw = Number(h?.sentiment ?? 0);
        const sentiment = Math.max(-3, Math.min(3, isNaN(sentRaw) ? 0 : sentRaw));
        return {
          date: parsedDate.toISOString().slice(0, 10),
          sentiment,
          title: String(h?.title || "Hito").slice(0, 80),
          description: String(h?.description || "").slice(0, 300),
          kind: "relationship",
          source: "ai_extracted",
          category: String(h?.category || "cotidiano"),
        };
      })
      .filter((h: TimelinePoint | null): h is TimelinePoint => h !== null);
  } catch (e) {
    console.error("[timeline] AI extract failed", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    }) as any;

    const { data: userData, error: uErr } = await supabase.auth.getUser();
    if (uErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { contact_id, force_refresh } = await req.json();
    if (!contact_id) {
      return new Response(JSON.stringify({ error: "contact_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Load contact
    const { data: contact } = await supabase
      .from("people_contacts")
      .select("id, name, personality_profile")
      .eq("id", contact_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = contact.personality_profile || {};
    const cache = profile?._timeline_cache;
    const cacheValid =
      !force_refresh &&
      cache?.generated_at &&
      Date.now() - new Date(cache.generated_at).getTime() < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

    // 2. Load all messages (for frequency + sample for AI)
    const { data: msgsAgg } = await supabase
      .from("contact_messages")
      .select("message_date, direction, content")
      .eq("contact_id", contact_id)
      .eq("user_id", userId)
      .order("message_date", { ascending: true })
      .limit(3000);

    const messages = msgsAgg || [];

    // 3. Frequency line (monthly)
    const monthly: Record<string, { in: number; out: number }> = {};
    for (const m of messages) {
      const d = new Date(m.message_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = monthly[key] || { in: 0, out: 0 };
      if (m.direction === "incoming") monthly[key].in++;
      else monthly[key].out++;
    }
    const monthlyKeys = Object.keys(monthly).sort();
    const monthlyTotals = monthlyKeys.map((k) => monthly[k].in + monthly[k].out);
    const maxMonthly = Math.max(1, ...monthlyTotals);

    const frequency: TimelinePoint[] = monthlyKeys.map((k) => {
      const total = monthly[k].in + monthly[k].out;
      const norm = (total / maxMonthly) * 5 - 1;
      return {
        date: `${k}-15`,
        sentiment: Math.round(norm * 10) / 10,
        title: `${total} mensajes`,
        description: `↓${monthly[k].in} · ↑${monthly[k].out}`,
        kind: "relationship",
        source: "msg_frequency",
        total,
      };
    });

    // 4. Hitos: from cache or extract with AI
    let relationshipEvents: TimelinePoint[] = [];

    if (cacheValid && Array.isArray(cache?.hitos)) {
      relationshipEvents = cache.hitos as TimelinePoint[];
      console.log("[timeline] using cached hitos", relationshipEvents.length);
    } else {
      // Try AI extraction
      const aiHitos = await extractHitosWithAI(contact.name, messages);

      // Also pull legacy hitos from profile (fallback)
      const historical = profile?._historical_analysis;
      const legacyHitos: TimelinePoint[] = [];
      const candidates: any[] = [];
      if (Array.isArray(historical?.hitos)) candidates.push(...historical.hitos);
      for (const scope of ["profesional", "personal", "familiar"]) {
        const hp = profile?.[scope]?.hitos;
        if (Array.isArray(hp)) candidates.push(...hp);
      }
      for (const h of candidates) {
        const date = h?.fecha || h?.date;
        if (!date || typeof date !== "string") continue;
        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) continue;
        const desc = String(h?.descripcion || h?.description || "");
        legacyHitos.push({
          date: parsed.toISOString().slice(0, 10),
          sentiment: 1,
          title: desc.slice(0, 80) || "Hito",
          description: desc,
          kind: "relationship",
          source: "profile_hitos",
          category: "cotidiano",
        });
      }

      relationshipEvents = [...aiHitos, ...legacyHitos];

      // Save cache
      try {
        const newProfile = {
          ...profile,
          _timeline_cache: {
            generated_at: new Date().toISOString(),
            hitos: relationshipEvents,
          },
        };
        await supabase
          .from("people_contacts")
          .update({ personality_profile: newProfile })
          .eq("id", contact_id)
          .eq("user_id", userId);
      } catch (e) {
        console.error("[timeline] cache save failed", e);
      }
    }

    // 5. Personal events
    const earliest = monthlyKeys[0]
      ? new Date(`${monthlyKeys[0]}-01`).toISOString()
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data: personal } = await supabase
      .from("personal_timeline_events")
      .select("event_date, title, description, sentiment, source")
      .eq("user_id", userId)
      .gte("event_date", earliest)
      .order("event_date", { ascending: true })
      .limit(500);

    const personalPoints: TimelinePoint[] = (personal || []).map((p: any) => ({
      date: new Date(p.event_date).toISOString().slice(0, 10),
      sentiment: p.sentiment ?? 0,
      title: p.title,
      description: p.description || undefined,
      kind: "personal",
      source: p.source || "manual",
    }));

    return new Response(
      JSON.stringify({
        contact_id,
        contact_name: contact.name,
        relationship_events: relationshipEvents,
        relationship_frequency: frequency,
        personal_events: personalPoints,
        cached: cacheValid,
        range: {
          start: monthlyKeys[0] ? `${monthlyKeys[0]}-01` : null,
          end: monthlyKeys[monthlyKeys.length - 1] ? `${monthlyKeys[monthlyKeys.length - 1]}-28` : null,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[build-relationship-timeline] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
