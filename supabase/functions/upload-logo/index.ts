import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch logo from the app's public folder
    const logoUrl = "https://pure-logic-flow.lovable.app/manias-logo.png";
    const resp = await fetch(logoUrl);
    if (!resp.ok) {
      // Try preview URL
      const previewResp = await fetch("https://id-preview--9316b930-9872-45b1-a9f0-afee0f7368f7.lovable.app/manias-logo.png");
      if (!previewResp.ok) throw new Error("Could not fetch logo from any URL");
      const blob = await previewResp.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const { error } = await supabase.storage.from("project-documents").upload("assets/manias-logo.png", new Uint8Array(arrayBuffer), { contentType: "image/png", upsert: true });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, source: "preview" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    const blob = await resp.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const { error } = await supabase.storage.from("project-documents").upload("assets/manias-logo.png", new Uint8Array(arrayBuffer), { contentType: "image/png", upsert: true });
    if (error) throw error;
    
    return new Response(JSON.stringify({ ok: true, source: "published" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
