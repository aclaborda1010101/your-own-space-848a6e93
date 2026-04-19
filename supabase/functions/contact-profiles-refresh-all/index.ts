import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Manual "refresh ALL" — invoked from the UI button.
// Queues every contact in the strategic network for the calling user,
// fires contact-analysis with throttling, returns a progress summary.
const DELAY_BETWEEN_MS = 2500;
const MAX_PER_RUN = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify caller from JWT
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    }) as any;
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceRoleKey) as any;

    const { data: contacts, error } = await admin
      .from("people_contacts")
      .select("id, name, personality_profile")
      .eq("user_id", userId)
      .or("is_favorite.eq.true,in_strategic_network.eq.true")
      .order("updated_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) throw error;
    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ refreshed: 0, total: 0, message: "No hay contactos en la red estratégica" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh-all] User ${userId}: ${contacts.length} contacts queued`);

    let refreshed = 0;
    const errors: string[] = [];

    // Fire-and-forget the slow ones; await up to 30s budget per call
    for (const c of contacts) {
      try {
        const hasProfile = c.personality_profile && Object.keys(c.personality_profile).length > 0;
        const resp = await fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            contact_id: c.id,
            user_id: userId,
            scopes: ["profesional", "personal", "familiar"],
            include_historical: !hasProfile,
          }),
        });
        if (resp.ok) {
          refreshed++;
          await admin
            .from("people_contacts")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", c.id);
          console.log(`[refresh-all] ✅ ${c.name}`);
        } else {
          const t = await resp.text();
          console.error(`[refresh-all] ❌ ${c.name}: ${resp.status} ${t.slice(0, 150)}`);
          errors.push(`${c.name}: ${resp.status}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[refresh-all] ❌ ${c.name}: ${msg}`);
        errors.push(`${c.name}: ${msg}`);
      }

      if (contacts.indexOf(c) < contacts.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
      }
    }

    return new Response(
      JSON.stringify({
        refreshed,
        total: contacts.length,
        errors: errors.length,
        errorDetails: errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[refresh-all] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
