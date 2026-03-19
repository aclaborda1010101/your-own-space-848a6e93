import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CONTACTS_PER_RUN = 15;
const DELAY_BETWEEN_MS = 5000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey) as any;

    console.log("[contact-profiles-refresh] Starting weekly refresh...");

    // 1. Find favorite contacts with personality_profile that have new messages since last update
    const { data: favorites, error: favErr } = await supabase
      .from("people_contacts")
      .select("id, name, user_id, updated_at, is_favorite, in_strategic_network")
      .or("is_favorite.eq.true,in_strategic_network.eq.true")
      .not("personality_profile", "is", null)
      .order("updated_at", { ascending: true })
      .limit(50);

    if (favErr) {
      console.error("[contact-profiles-refresh] Error fetching favorites:", favErr);
      throw new Error(`DB error: ${favErr.message}`);
    }

    if (!favorites || favorites.length === 0) {
      console.log("[contact-profiles-refresh] No favorite contacts with profiles found.");
      return new Response(JSON.stringify({ refreshed: 0, message: "No contacts to refresh" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[contact-profiles-refresh] Found ${favorites.length} favorite contacts with profiles`);

    // 2. For each, check if there are newer messages in contact_messages
    const staleContacts: Array<{ id: string; name: string; user_id: string }> = [];

    for (const contact of favorites) {
      if (staleContacts.length >= MAX_CONTACTS_PER_RUN) break;

      const { count, error: msgErr } = await supabase
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contact.id)
        .gt("created_at", contact.updated_at);

      if (msgErr) {
        console.warn(`[contact-profiles-refresh] Error checking messages for ${contact.name}:`, msgErr.message);
        continue;
      }

      if (count && count > 0) {
        staleContacts.push({ id: contact.id, name: contact.name, user_id: contact.user_id });
        console.log(`[contact-profiles-refresh] ${contact.name}: ${count} new messages since last update`);
      }
    }

    if (staleContacts.length === 0) {
      console.log("[contact-profiles-refresh] All profiles are up to date.");
      return new Response(JSON.stringify({ refreshed: 0, message: "All profiles up to date" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[contact-profiles-refresh] ${staleContacts.length} contacts need refresh`);

    // 3. Invoke contact-analysis for each stale contact
    let refreshed = 0;
    const errors: string[] = [];

    for (const contact of staleContacts) {
      try {
        console.log(`[contact-profiles-refresh] Refreshing ${contact.name}...`);

        const response = await fetch(
          `${supabaseUrl}/functions/v1/contact-analysis`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              contact_id: contact.id,
              user_id: contact.user_id,
              scopes: ["professional", "personal", "family"],
              include_historical: false,
            }),
          }
        );

        if (response.ok) {
          refreshed++;
          console.log(`[contact-profiles-refresh] ✅ ${contact.name} refreshed successfully`);
        } else {
          const errText = await response.text();
          console.error(`[contact-profiles-refresh] ❌ ${contact.name} failed: ${response.status} ${errText}`);
          errors.push(`${contact.name}: ${response.status}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[contact-profiles-refresh] ❌ ${contact.name} error: ${msg}`);
        errors.push(`${contact.name}: ${msg}`);
      }

      // Delay between calls to avoid rate limits
      if (staleContacts.indexOf(contact) < staleContacts.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
      }
    }

    const summary = {
      refreshed,
      errors: errors.length,
      errorDetails: errors,
      total_checked: favorites.length,
      stale_found: staleContacts.length,
    };

    console.log(`[contact-profiles-refresh] Done: ${refreshed}/${staleContacts.length} refreshed, ${errors.length} errors`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[contact-profiles-refresh] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
