import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    console.log(`[plaud-email-check] Checking for Plaud emails for user ${userId.substring(0, 8)}...`);

    // Search for unprocessed Plaud emails in jarvis_emails_cache
    const { data: plaudEmails, error: emailError } = await supabase
      .from("jarvis_emails_cache")
      .select("*")
      .eq("user_id", userId)
      .eq("is_read", false)
      .or("from_address.ilike.%plaud%,subject.ilike.%plaud%,from_address.ilike.%notepin%,subject.ilike.%notepin%,subject.ilike.%transcription%,subject.ilike.%recording%")
      .order("received_at", { ascending: false })
      .limit(10);

    if (emailError) {
      console.error("[plaud-email-check] Email query error:", emailError);
      return new Response(JSON.stringify({ error: "Error querying emails" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!plaudEmails || plaudEmails.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No new Plaud emails found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[plaud-email-check] Found ${plaudEmails.length} Plaud email(s)`);

    const results = [];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    for (const email of plaudEmails) {
      const textContent = email.body_text || email.body_html || email.snippet || "";

      if (textContent.trim().length < 20) {
        console.log(`[plaud-email-check] Skipping email ${email.id} - too short`);
        continue;
      }

      try {
        // Call process-transcription
        const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-transcription`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: textContent,
            source: "plaud",
          }),
        });

        const processResult = await processResponse.json();

        if (processResponse.ok) {
          // Mark email as processed
          await supabase
            .from("jarvis_emails_cache")
            .update({ is_read: true })
            .eq("id", email.id);

          results.push({
            email_id: email.id,
            subject: email.subject,
            status: "processed",
            brain: processResult.extracted?.brain,
            title: processResult.extracted?.title,
          });
        } else {
          results.push({
            email_id: email.id,
            subject: email.subject,
            status: "error",
            error: processResult.error,
          });
        }
      } catch (e) {
        console.error(`[plaud-email-check] Error processing email ${email.id}:`, e);
        results.push({
          email_id: email.id,
          subject: email.subject,
          status: "error",
          error: e instanceof Error ? e.message : "Unknown",
        });
      }
    }

    const processed = results.filter(r => r.status === "processed").length;
    console.log(`[plaud-email-check] Processed ${processed}/${plaudEmails.length} emails`);

    return new Response(JSON.stringify({ processed, total: plaudEmails.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[plaud-email-check] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
