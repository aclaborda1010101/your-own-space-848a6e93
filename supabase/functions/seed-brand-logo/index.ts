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

    // Fetch the logo from the published app's public folder
    const logoUrl = "https://pure-logic-flow.lovable.app/manias-logo.png";
    const resp = await fetch(logoUrl);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    
    const blob = await resp.blob();
    const arrayBuf = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    
    console.log(`Downloaded logo: ${bytes.length} bytes, type: ${blob.type}`);

    // Upload to Storage bucket
    const { error } = await supabase.storage
      .from("project-documents")
      .upload("brand/manias-logo.png", bytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) throw error;

    // Verify it was uploaded
    const { data: verifyData, error: verifyErr } = await supabase.storage
      .from("project-documents")
      .download("brand/manias-logo.png");
    
    const verifySize = verifyData ? (await verifyData.arrayBuffer()).byteLength : 0;

    return new Response(JSON.stringify({ 
      success: true, 
      uploaded_bytes: bytes.length,
      verified_bytes: verifySize,
      path: "project-documents/brand/manias-logo.png"
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
