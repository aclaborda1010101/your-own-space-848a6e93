import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...body } = await req.json();

    // Action: send - User sends a message, notify external webhook
    if (action === 'send') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'No autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuario no válido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { message } = body;
      if (!message) {
        return new Response(
          JSON.stringify({ success: false, error: 'Mensaje requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Save user message to potus_chat
      const { data: chatMessage, error: insertError } = await supabase
        .from('potus_chat')
        .insert({
          user_id: user.id,
          message,
          role: 'user',
          processed: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting message:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al guardar mensaje' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's webhook URL
      const { data: integration } = await supabase
        .from('user_integrations')
        .select('potus_webhook_url')
        .eq('user_id', user.id)
        .single();

      if (integration?.potus_webhook_url) {
        // Notify external webhook (async, don't wait)
        try {
          await fetch(integration.potus_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'new_message',
              message_id: chatMessage.id,
              user_id: user.id,
              message: message,
              created_at: chatMessage.created_at,
            }),
          });

          // Mark as webhook sent
          await supabase
            .from('potus_chat')
            .update({ webhook_sent_at: new Date().toISOString() })
            .eq('id', chatMessage.id);
        } catch (webhookError) {
          console.error('Webhook notification failed:', webhookError);
          // Don't fail the request if webhook fails
        }
      }

      return new Response(
        JSON.stringify({ success: true, messageId: chatMessage.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: receive - External system sends a response
    if (action === 'receive') {
      // Verify webhook secret (optional but recommended)
      const webhookSecret = req.headers.get('x-webhook-secret');
      const expectedSecret = Deno.env.get('POTUS_WEBHOOK_SECRET');
      
      if (expectedSecret && webhookSecret !== expectedSecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid webhook secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { user_id, message, reply_to_message_id } = body;
      
      if (!user_id || !message) {
        return new Response(
          JSON.stringify({ success: false, error: 'user_id y message requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Save assistant response
      const { data: chatMessage, error: insertError } = await supabase
        .from('potus_chat')
        .insert({
          user_id,
          message,
          role: 'assistant',
          processed: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting response:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al guardar respuesta' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark original message as processed if reply_to_message_id provided
      if (reply_to_message_id) {
        await supabase
          .from('potus_chat')
          .update({ processed: true })
          .eq('id', reply_to_message_id);
      }

      return new Response(
        JSON.stringify({ success: true, messageId: chatMessage.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: history - Get chat history
    if (action === 'history') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'No autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuario no válido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: messages, error: fetchError } = await supabase
        .from('potus_chat')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (fetchError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Error al obtener historial' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, messages: messages || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: configure - Set webhook URL
    if (action === 'configure') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'No autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuario no válido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { webhook_url } = body;

      // Upsert integration settings
      const { error: upsertError } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: user.id,
          potus_webhook_url: webhook_url,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Error updating webhook URL:', upsertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al guardar configuración' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Acción no válida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('POTUS webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
