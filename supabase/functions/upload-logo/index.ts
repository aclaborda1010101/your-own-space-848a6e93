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

    // ManIAS Lab logo as minimal SVG converted to PNG-like data
    // We'll fetch the logo from a public URL and upload it
    const logoUrl = "https://xfjlwxssxfvhbiytcoar.supabase.co/storage/v1/object/public/project-documents/brand/manias-logo.png";
    
    // Try to check if it already exists
    const { data: existing } = await supabase.storage
      .from("project-documents")
      .list("brand", { search: "manias-logo" });
    
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ status: "already_exists", path: "brand/manias-logo.png" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a simple SVG logo and convert to PNG via canvas-like approach
    // Since we can't do canvas in Deno, let's create the SVG directly
    const svgLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80" viewBox="0 0 400 80">
      <rect width="400" height="80" fill="transparent"/>
      <text x="10" y="55" font-family="Arial, Helvetica, sans-serif" font-size="42" fill="#FFFFFF">
        <tspan font-weight="300">Man</tspan><tspan font-weight="700" fill="#5EEAD4">IAS</tspan><tspan font-weight="300"> Lab.</tspan>
      </text>
    </svg>`;

    const svgBytes = new TextEncoder().encode(svgLogo);

    // Upload as SVG (will work in img tags)
    const { error: uploadError } = await supabase.storage
      .from("project-documents")
      .upload("brand/manias-logo.svg", svgBytes, {
        contentType: "image/svg+xml",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "uploaded", path: "brand/manias-logo.svg" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
