// seed-brand-logo — One-time utility to upload the brand logo PNG to Storage
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try multiple URLs for the logo
    const urls = [
      "https://id-preview--9316b930-9872-45b1-a9f0-afee0f7368f7.lovable.app/manias-logo.png",
      "https://pure-logic-flow.lovable.app/manias-logo.png",
    ];

    let bytes: Uint8Array | null = null;
    let usedUrl = "";

    for (const url of urls) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const ct = resp.headers.get("content-type") || "";
          const buf = await resp.arrayBuffer();
          if (buf.byteLength > 1000) { // sanity check — real PNG > 1KB
            bytes = new Uint8Array(buf);
            usedUrl = url;
            console.log(`Got logo from ${url}: ${bytes.length} bytes, content-type: ${ct}`);
            break;
          }
        }
      } catch (e) {
        console.warn(`Failed ${url}:`, e);
      }
    }

    if (!bytes) throw new Error("Could not fetch logo from any URL");

    // Upload to Storage bucket
    const { error } = await supabase.storage
      .from("project-documents")
      .upload("brand/manias-logo.png", bytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) throw error;

    // Verify
    const { data: verifyData } = await supabase.storage
      .from("project-documents")
      .download("brand/manias-logo.png");
    
    const verifySize = verifyData ? (await verifyData.arrayBuffer()).byteLength : 0;

    return new Response(JSON.stringify({ 
      success: true, 
      source_url: usedUrl,
      uploaded_bytes: bytes.length,
      verified_bytes: verifySize,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Seed logo error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
