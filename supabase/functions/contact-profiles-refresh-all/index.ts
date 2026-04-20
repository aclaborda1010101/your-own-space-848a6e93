import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Manual "refresh ALL" — invoked from the UI button.
// Returns immediately and processes contacts in the background via EdgeRuntime.waitUntil
// to avoid the 150s edge function timeout.
const DELAY_BETWEEN_MS = 1500;
const MAX_PER_RUN = 100;

async function processContactsInBackground(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  contacts: Array<{ id: string; name: string; personality_profile: any }>,
) {
  const admin = createClient(supabaseUrl, serviceRoleKey) as any;
  let refreshed = 0;
  const errors: string[] = [];

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
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
        console.log(`[refresh-all-bg] ✅ ${c.name} (${refreshed}/${contacts.length})`);
      } else {
        const t = await resp.text();
        console.error(`[refresh-all-bg] ❌ ${c.name}: ${resp.status} ${t.slice(0, 150)}`);
        errors.push(`${c.name}: ${resp.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[refresh-all-bg] ❌ ${c.name}: ${msg}`);
      errors.push(`${c.name}: ${msg}`);
    }

    if (i < contacts.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
    }
  }

  console.log(`[refresh-all-bg] DONE user=${userId} refreshed=${refreshed}/${contacts.length} errors=${errors.length}`);
}

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

    // PRIORITIZACIÓN: traemos TODOS los favoritos/estratégicos del usuario y
    // ordenamos en memoria — primero los que no tienen perfil, después los más
    // antiguos por updated_at. Evitamos el bug de supabase-js donde dos .or()
    // consecutivos se sobrescriben.
    const { data: allActive, error: eAll } = await admin
      .from("people_contacts")
      .select("id, name, personality_profile, updated_at")
      .eq("user_id", userId)
      .or("is_favorite.eq.true,in_strategic_network.eq.true")
      .order("updated_at", { ascending: true, nullsFirst: true })
      .limit(MAX_PER_RUN * 2);

    if (eAll) throw eAll;

    const hasProfile = (c: any) => c.personality_profile && Object.keys(c.personality_profile).length > 0;
    const sorted = [...(allActive || [])].sort((a, b) => {
      const ap = hasProfile(a) ? 1 : 0;
      const bp = hasProfile(b) ? 1 : 0;
      if (ap !== bp) return ap - bp; // sin perfil primero
      const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return at - bt; // más antiguos primero
    });
    const noProfile = sorted.filter((c) => !hasProfile(c));
    const withProfile = sorted.filter(hasProfile);
    const e1 = null, e2 = null;

    if (e1) throw e1;
    if (e2) throw e2;

    const seen = new Set<string>();
    const merged: Array<{ id: string; name: string; personality_profile: any }> = [];
    for (const c of [...(noProfile || []), ...(withProfile || [])]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
      if (merged.length >= MAX_PER_RUN) break;
    }

    if (merged.length === 0) {
      return new Response(
        JSON.stringify({ queued: 0, total: 0, message: "No hay contactos en la red estratégica" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh-all] User ${userId}: queueing ${merged.length} contacts in background (sin perfil: ${(noProfile || []).length})`);

    // Fire and forget — runs after response is returned, up to the function's max duration.
    // @ts-ignore - EdgeRuntime is provided by Supabase Edge runtime
    EdgeRuntime.waitUntil(
      processContactsInBackground(supabaseUrl, serviceRoleKey, userId, merged)
    );

    return new Response(
      JSON.stringify({
        queued: merged.length,
        total: merged.length,
        message: `Refrescando ${merged.length} contactos en segundo plano. Vuelve en 1-2 minutos.`,
        background: true,
      }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[refresh-all] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
