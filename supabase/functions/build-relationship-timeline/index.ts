import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimelinePoint {
  date: string;          // ISO yyyy-mm-dd
  sentiment: number;     // -5..+5
  title: string;
  description?: string;
  kind: "relationship" | "personal";
  source: string;
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

    const { contact_id } = await req.json();
    if (!contact_id) {
      return new Response(JSON.stringify({ error: "contact_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Load contact profile
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

    const points: TimelinePoint[] = [];

    // 2. Extract hitos from profile (multi-scope or flat)
    const profile = contact.personality_profile || {};
    const historical = profile?._historical_analysis;
    const hitosCandidates: any[] = [];

    if (Array.isArray(historical?.hitos)) hitosCandidates.push(...historical.hitos);
    for (const scope of ["profesional", "personal", "familiar"]) {
      const hp = profile?.[scope]?.hitos;
      if (Array.isArray(hp)) hitosCandidates.push(...hp);
    }

    for (const h of hitosCandidates) {
      const date = h?.fecha || h?.date;
      if (!date || typeof date !== "string") continue;
      // Normalize: try parsing
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) continue;

      // Heuristic sentiment: if the description contains negative cues → -, else +
      const desc = String(h?.descripcion || h?.description || "");
      const positive = /(éxito|logro|celebra|cumple|boda|nacimiento|firma|cierre|gana|alegr|reunión|aniversa|positiv|fuerte|estable)/i.test(desc);
      const negative = /(problem|conflict|ruptur|enfad|crisis|pérdida|murió|fallec|enferm|despid|tris|negativ|rota|rompiste)/i.test(desc);
      const sentiment = negative ? -3 : positive ? 3 : 1;

      points.push({
        date: parsed.toISOString().slice(0, 10),
        sentiment,
        title: desc.slice(0, 80) || "Hito",
        description: desc,
        kind: "relationship",
        source: "profile_hitos",
      });
    }

    // 3. Monthly aggregates from contact_messages → frequency wave
    const { data: msgsAgg } = await supabase
      .from("contact_messages")
      .select("message_date, direction")
      .eq("contact_id", contact_id)
      .eq("user_id", userId)
      .order("message_date", { ascending: true })
      .limit(2000);

    const monthly: Record<string, { in: number; out: number }> = {};
    for (const m of msgsAgg || []) {
      const d = new Date(m.message_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = monthly[key] || { in: 0, out: 0 };
      if (m.direction === "incoming") monthly[key].in++;
      else monthly[key].out++;
    }
    const monthlyKeys = Object.keys(monthly).sort();
    const monthlyTotals = monthlyKeys.map((k) => monthly[k].in + monthly[k].out);
    const maxMonthly = Math.max(1, ...monthlyTotals);

    const frequency = monthlyKeys.map((k) => {
      const total = monthly[k].in + monthly[k].out;
      // Map to -2..+3 by intensity
      const norm = (total / maxMonthly) * 5 - 1;
      return {
        date: `${k}-15`,
        sentiment: Math.round(norm * 10) / 10,
        title: `${total} mensajes`,
        description: `↓${monthly[k].in} · ↑${monthly[k].out}`,
        kind: "relationship" as const,
        source: "msg_frequency",
        total,
      };
    });

    // 4. Personal timeline events
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
        relationship_events: points,
        relationship_frequency: frequency,
        personal_events: personalPoints,
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
