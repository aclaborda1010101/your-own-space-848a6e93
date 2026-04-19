import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Daily refresh — relaxed conditions:
// Refreshes any contact in strategic network OR favorite that hasn't been
// updated in the last 24h. Removes the stale "only if new messages" filter
// that was blocking everything.
const MAX_CONTACTS_PER_RUN = 30;
const DELAY_BETWEEN_MS = 3000;
const STALE_THRESHOLD_HOURS = 20; // re-run anything older than this

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey) as any;

    console.log("[contact-profiles-refresh] Starting daily refresh...");

    const staleCutoff = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();

    // Pick contacts in strategic network OR favorites whose updated_at is stale
    const { data: contacts, error: fetchErr } = await supabase
      .from("people_contacts")
      .select("id, name, user_id, updated_at, is_favorite, in_strategic_network, personality_profile")
      .or("is_favorite.eq.true,in_strategic_network.eq.true")
      .lt("updated_at", staleCutoff)
      .order("updated_at", { ascending: true })
      .limit(MAX_CONTACTS_PER_RUN);

    if (fetchErr) {
      console.error("[contact-profiles-refresh] Fetch error:", fetchErr);
      throw new Error(`DB error: ${fetchErr.message}`);
    }

    if (!contacts || contacts.length === 0) {
      console.log("[contact-profiles-refresh] All profiles fresh.");
      return new Response(
        JSON.stringify({ refreshed: 0, message: "All profiles up to date" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[contact-profiles-refresh] ${contacts.length} stale contacts to refresh`);

    let refreshed = 0;
    const errors: string[] = [];

    for (const contact of contacts) {
      try {
        const hasProfile = contact.personality_profile && Object.keys(contact.personality_profile).length > 0;
        console.log(`[contact-profiles-refresh] Refreshing ${contact.name} (hasProfile=${hasProfile})...`);

        const response = await fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            contact_id: contact.id,
            user_id: contact.user_id,
            scopes: ["profesional", "personal", "familiar"],
            include_historical: !hasProfile, // first time → include historical
          }),
        });

        if (response.ok) {
          refreshed++;
          // bump updated_at so next cron skips it
          await supabase
            .from("people_contacts")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", contact.id);
          console.log(`[contact-profiles-refresh] ✅ ${contact.name}`);
        } else {
          const errText = await response.text();
          console.error(`[contact-profiles-refresh] ❌ ${contact.name}: ${response.status} ${errText.slice(0, 200)}`);
          errors.push(`${contact.name}: ${response.status}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[contact-profiles-refresh] ❌ ${contact.name} error:`, msg);
        errors.push(`${contact.name}: ${msg}`);
      }

      if (contacts.indexOf(contact) < contacts.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
      }
    }

    const summary = {
      refreshed,
      errors: errors.length,
      errorDetails: errors,
      stale_found: contacts.length,
    };

    console.log(`[contact-profiles-refresh] Done: ${refreshed}/${contacts.length}`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[contact-profiles-refresh] Fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
