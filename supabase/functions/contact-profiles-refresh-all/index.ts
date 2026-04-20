import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Refresh perfiles de contactos.
// Modos:
//   - User-mode: header Authorization: Bearer <user JWT> → procesa solo ese user
//   - Service-mode: header Authorization: Bearer <SERVICE_ROLE_KEY> y body { mode: "all-users" }
//     → itera todos los usuarios con red activa (cron diario)
//
// SIN cap de 100. Se procesan todos los contactos activos por user en background.
const DELAY_BETWEEN_MS = 1500;

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
        console.log(`[refresh-all-bg] ✅ user=${userId} ${c.name} (${refreshed}/${contacts.length})`);
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

async function fetchActiveContactsForUser(admin: any, userId: string) {
  const { data, error } = await admin
    .from("people_contacts")
    .select("id, name, personality_profile, updated_at")
    .eq("user_id", userId)
    .or("is_favorite.eq.true,in_strategic_network.eq.true")
    .order("updated_at", { ascending: true, nullsFirst: true });
  if (error) throw error;

  const hasProfile = (c: any) => c.personality_profile && Object.keys(c.personality_profile).length > 0;
  const sorted = [...(data || [])].sort((a, b) => {
    const ap = hasProfile(a) ? 1 : 0;
    const bp = hasProfile(b) ? 1 : 0;
    if (ap !== bp) return ap - bp;
    const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return at - bt;
  });
  return sorted;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const body = await req.json().catch(() => ({}));
    const isServiceMode = token === serviceRoleKey || body.mode === "all-users";

    const admin = createClient(supabaseUrl, serviceRoleKey) as any;

    // ---- SERVICE MODE: iterar todos los usuarios con red activa ----
    if (isServiceMode) {
      const { data: usersWithNet, error: uErr } = await admin
        .from("people_contacts")
        .select("user_id")
        .or("is_favorite.eq.true,in_strategic_network.eq.true");
      if (uErr) throw uErr;

      const uniqueUsers = Array.from(new Set((usersWithNet || []).map((r: any) => r.user_id)));
      console.log(`[refresh-all] SERVICE mode: ${uniqueUsers.length} users with active network`);

      let totalQueued = 0;
      const perUser: Array<{ userId: string; queued: number }> = [];

      for (const uid of uniqueUsers) {
        try {
          const contacts = await fetchActiveContactsForUser(admin, uid);
          if (contacts.length === 0) continue;
          totalQueued += contacts.length;
          perUser.push({ userId: uid, queued: contacts.length });

          // @ts-ignore EdgeRuntime exists at runtime
          EdgeRuntime.waitUntil(
            processContactsInBackground(supabaseUrl, serviceRoleKey, uid, contacts)
          );
        } catch (e) {
          console.error(`[refresh-all] user ${uid} failed:`, e);
        }
      }

      return new Response(
        JSON.stringify({
          mode: "all-users",
          users: uniqueUsers.length,
          totalQueued,
          perUser,
          background: true,
        }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- USER MODE ----
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

    const contacts = await fetchActiveContactsForUser(admin, userId);

    if (contacts.length === 0) {
      return new Response(
        JSON.stringify({ queued: 0, total: 0, message: "No hay contactos en la red estratégica" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh-all] User ${userId}: queueing ALL ${contacts.length} contacts in background`);

    // @ts-ignore EdgeRuntime exists at runtime
    EdgeRuntime.waitUntil(
      processContactsInBackground(supabaseUrl, serviceRoleKey, userId, contacts)
    );

    return new Response(
      JSON.stringify({
        queued: contacts.length,
        total: contacts.length,
        message: `Refrescando ${contacts.length} contactos en segundo plano. Vuelve en 2-5 minutos.`,
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
