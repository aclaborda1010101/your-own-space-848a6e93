// contact-headlines-refresh
// Bulk-refreshes contact headlines for the user's favorite / strategic-network
// contacts by invoking get-contact-headlines with force=true for each.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_CONTACTS = 25;
const DELAY_MS = 1500;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let userId: string | undefined;
    if (token) {
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id;
    }
    if (!userId) {
      return jsonResp({ error: "unauthorized" }, 401);
    }

    // Pick favorites / strategic network, oldest headline first
    const { data: contacts, error: cErr } = await admin
      .from("people_contacts")
      .select("id, name, is_favorite, in_strategic_network")
      .eq("user_id", userId)
      .or("is_favorite.eq.true,in_strategic_network.eq.true")
      .limit(500);

    if (cErr) throw cErr;
    const list = contacts || [];
    if (list.length === 0) {
      return jsonResp({ ok: true, total: 0, refreshed: 0, errors: 0, processed: [] });
    }

    // Sort by oldest cached headline so we refresh stale ones first
    const ids = list.map((c) => c.id);
    const { data: headlines } = await admin
      .from("contact_headlines")
      .select("contact_id, generated_at")
      .in("contact_id", ids);

    const lastGen = new Map<string, number>();
    (headlines || []).forEach((h) => {
      lastGen.set(
        h.contact_id as string,
        h.generated_at ? new Date(h.generated_at as string).getTime() : 0,
      );
    });

    const sorted = [...list].sort(
      (a, b) => (lastGen.get(a.id) ?? 0) - (lastGen.get(b.id) ?? 0),
    );
    const toProcess = sorted.slice(0, MAX_CONTACTS);

    let refreshed = 0;
    let errors = 0;
    const processed: { id: string; name: string; ok: boolean; error?: string }[] = [];

    for (const c of toProcess) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/get-contact-headlines`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: ANON_KEY,
          },
          body: JSON.stringify({ contactId: c.id, force: true }),
        });
        if (!r.ok) {
          const t = await r.text();
          throw new Error(`HTTP ${r.status}: ${t.slice(0, 120)}`);
        }
        refreshed++;
        processed.push({ id: c.id, name: c.name, ok: true });
      } catch (e) {
        errors++;
        processed.push({
          id: c.id,
          name: c.name,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
        console.error("refresh failed", c.id, e);
      }
      // Small delay to avoid hammering the LLM gateway
      await new Promise((res) => setTimeout(res, DELAY_MS));
    }

    return jsonResp({
      ok: true,
      total: list.length,
      processed_count: toProcess.length,
      refreshed,
      errors,
      truncated: list.length > MAX_CONTACTS,
      processed,
    });
  } catch (err) {
    console.error("contact-headlines-refresh error:", err);
    return jsonResp({ error: String(err) }, 500);
  }
});

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
