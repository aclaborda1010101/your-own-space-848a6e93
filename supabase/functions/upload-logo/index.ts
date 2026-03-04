import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch logo from the app's preview/published URL
    const logoUrl = "https://pure-logic-flow.lovable.app/manias-logo.png";
    const res = await fetch(logoUrl);
    if (!res.ok) throw new Error(`Failed to fetch logo: ${res.status}`);
    
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from("project-documents")
      .upload("assets/manias-logo.png", uint8, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
