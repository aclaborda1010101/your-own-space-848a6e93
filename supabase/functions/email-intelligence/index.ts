import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_ANALYSIS_PROMPT = `Eres el motor de inteligencia de emails de JARVIS, un asistente personal de IA. 
Analizas emails y extraes información estructurada útil para el usuario.

Para cada email, extrae:

1. **intent**: La intención principal del email. Valores posibles:
   - "action_required": el remitente pide algo concreto al usuario
   - "fyi": informativo, no requiere acción
   - "meeting_request": propuesta de reunión o cita
   - "follow_up": seguimiento de algo previo
   - "introduction": presentación de persona o proyecto
   - "negotiation": negociación comercial o de condiciones
   - "social": mensaje social (felicitación, agradecimiento, etc.)
   - "support": soporte técnico o consulta

2. **urgency**: "high" | "medium" | "low" — basado en el tono, deadline mencionado, o contexto

3. **summary**: Resumen ejecutivo de 1-2 frases del email (en español)

4. **action_items**: Array de acciones que el usuario debería tomar. Cada una con:
   - text: descripción de la acción
   - deadline: fecha límite si se menciona (formato YYYY-MM-DD o null)
   - priority: "high" | "medium" | "low"

5. **people**: Personas mencionadas o relevantes (NO incluir al propio usuario). Cada una con:
   - name: nombre completo
   - email: email si aparece
   - role: cargo/rol si se detecta
   - company: empresa si se detecta
   - relationship: "colleague" | "client" | "vendor" | "friend" | "recruiter" | "unknown"

6. **topics**: Array de temas/keywords relevantes (max 5)

7. **sentiment**: "positive" | "neutral" | "negative" | "mixed"

8. **suggested_reply**: Si el email requiere respuesta, sugiere un borrador breve (1-3 frases) en el idioma del email. Si no requiere respuesta, null.

9. **events**: Eventos o citas mencionados. Cada uno con:
   - title: título del evento
   - date: fecha si se menciona (YYYY-MM-DD o null)
   - time: hora si se menciona (HH:MM o null)
   - location: lugar si se menciona

10. **commitments**: Compromisos detectados (del remitente hacia el usuario o viceversa). Cada uno con:
    - description: qué se comprometió
    - who: quién se comprometió
    - deadline: fecha si existe

Responde SOLO con JSON válido. Sin explicaciones ni markdown.`;

const BATCH_SIZE = 5; // Process 5 emails per invocation to stay within timeout

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Optional: process a specific email by id
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const specificEmailId = body.email_id;

    console.log(`[email-intelligence] Starting for user ${userId.substring(0, 8)}...`);

    // Fetch unprocessed personal emails (skip newsletters, notifications, auto-replies)
    let query = supabase
      .from("jarvis_emails_cache")
      .select("id, subject, from_address, to_addr, body_text, body_html, snippet, preview, email_type, direction, received_at, has_attachments, attachments_meta, thread_id")
      .eq("user_id", userId)
      .eq("ai_processed", false)
      .in("email_type", ["personal", "calendar_invite", null])
      .order("received_at", { ascending: false });

    if (specificEmailId) {
      query = query.eq("id", specificEmailId);
    } else {
      query = query.limit(BATCH_SIZE);
    }

    const { data: emails, error: emailError } = await query;

    if (emailError) {
      console.error("[email-intelligence] Query error:", emailError);
      return new Response(JSON.stringify({ error: "Error querying emails" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No unprocessed personal emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[email-intelligence] Found ${emails.length} email(s) to analyze`);

    const results = [];

    for (const email of emails) {
      const emailContent = email.body_text || email.body_html || email.snippet || email.preview || "";

      if (emailContent.trim().length < 30) {
        // Too short to analyze, mark as processed with minimal data
        await supabase
          .from("jarvis_emails_cache")
          .update({
            ai_processed: true,
            ai_extracted: { skipped: true, reason: "too_short" },
          })
          .eq("id", email.id);

        results.push({ email_id: email.id, status: "skipped", reason: "too_short" });
        continue;
      }

      try {
        // Build context for AI
        const emailContext = [
          `De: ${email.from_address || "unknown"}`,
          email.to_addr ? `Para: ${email.to_addr}` : null,
          `Asunto: ${email.subject || "(sin asunto)"}`,
          email.direction ? `Dirección: ${email.direction}` : null,
          email.received_at ? `Fecha: ${email.received_at}` : null,
          email.has_attachments ? `Adjuntos: ${JSON.stringify(email.attachments_meta || [])}` : null,
          `\n--- CONTENIDO ---\n${emailContent.substring(0, 15000)}`, // Cap at 15k chars for AI
        ].filter(Boolean).join("\n");

        const aiResult = await chat(
          [
            { role: "system", content: EMAIL_ANALYSIS_PROMPT },
            { role: "user", content: emailContext },
          ],
          { model: "gemini-flash", temperature: 0.2, responseFormat: "json", maxTokens: 4096 }
        );

        let extracted;
        try {
          extracted = JSON.parse(aiResult);
        } catch {
          console.error(`[email-intelligence] Failed to parse AI response for email ${email.id}`);
          extracted = { parse_error: true, raw: aiResult.substring(0, 500) };
        }

        // Save AI analysis
        await supabase
          .from("jarvis_emails_cache")
          .update({
            ai_processed: true,
            ai_extracted: extracted,
          })
          .eq("id", email.id);

        // Action items detectados → Bandeja de inteligencia (NO se crean como tareas directas)
        if (extracted.action_items?.length > 0) {
          for (const action of extracted.action_items.slice(0, 3)) {
            const actionTitle = String(action.text || "").substring(0, 200);
            if (!actionTitle) continue;
            await supabase.from("suggestions").insert({
              user_id: userId,
              suggestion_type: "task_from_plaud",
              status: "pending",
              content: {
                title: actionTitle,
                description: actionTitle,
                type: "work",
                priority: action.priority === "high" ? "high" : action.priority === "medium" ? "medium" : "low",
                duration: 30,
                source: "email-intelligence",
                email_id: email.id,
                email_from: email.from_address,
                email_subject: email.subject,
                deadline: action.deadline || null,
              },
              confidence: 0.7,
              reasoning: `Acción detectada en email de ${email.from_address} · ${email.subject}`,
            }).then(({ error }) => {
              if (error) console.warn(`[email-intelligence] Could not queue suggestion: ${error.message}`);
            });
          }
        }

        // If people were found, upsert to people_contacts
        if (extracted.people?.length > 0) {
          for (const person of extracted.people) {
            if (!person.name || person.name.length < 2) continue;

            // Check if contact already exists (by name similarity)
            const { data: existing } = await supabase
              .from("people_contacts")
              .select("id, name")
              .eq("user_id", userId)
              .ilike("name", `%${person.name}%`)
              .limit(1);

            if (!existing || existing.length === 0) {
              // Create new contact
              await supabase.from("people_contacts").insert({
                user_id: userId,
                name: person.name,
                email: person.email || null,
                company: person.company || null,
                role: person.role || null,
                relationship_type: person.relationship || "unknown",
                source: "email_intelligence",
                brain: "professional",
                last_contact_date: email.received_at || new Date().toISOString(),
              }).then(({ error }) => {
                if (error) console.warn(`[email-intelligence] Could not create contact ${person.name}: ${error.message}`);
              });
            }
          }
        }

        // If events were found, could create calendar entries (future)
        // For now, store them in ai_extracted

        results.push({
          email_id: email.id,
          subject: email.subject,
          status: "analyzed",
          intent: extracted.intent,
          urgency: extracted.urgency,
          action_items: extracted.action_items?.length || 0,
          people: extracted.people?.length || 0,
        });

        console.log(`[email-intelligence] ✅ Analyzed: "${email.subject}" → intent=${extracted.intent}, urgency=${extracted.urgency}`);

      } catch (e) {
        console.error(`[email-intelligence] Error analyzing email ${email.id}:`, e);

        // Mark as processed with error to avoid retrying infinitely
        await supabase
          .from("jarvis_emails_cache")
          .update({
            ai_processed: true,
            ai_extracted: { error: true, message: e instanceof Error ? e.message : "Unknown" },
          })
          .eq("id", email.id);

        results.push({
          email_id: email.id,
          subject: email.subject,
          status: "error",
          error: e instanceof Error ? e.message : "Unknown",
        });
      }
    }

    const analyzed = results.filter(r => r.status === "analyzed").length;
    console.log(`[email-intelligence] Done: ${analyzed}/${emails.length} analyzed`);

    // ── Auto-trigger contact-analysis for contacts with ≥2 emails processed ──
    if (analyzed >= 2) {
      // Collect unique contact IDs from analyzed emails' people
      const contactNamesProcessed = new Set<string>();
      for (const email of emails) {
        const extracted = (email as any).ai_extracted;
        if (extracted?.people) {
          for (const p of extracted.people) {
            if (p.name) contactNamesProcessed.add(p.name.toLowerCase().trim());
          }
        }
      }

      // Also find contacts by from_address matching
      const fromAddresses = emails
        .filter(e => e.from_address)
        .map(e => (e.from_address as string).toLowerCase());

      if (fromAddresses.length > 0) {
        const orFilters = fromAddresses.map(a => `email.ilike.%${a}%`).join(',');
        const { data: matchedContacts } = await supabase
          .from('people_contacts')
          .select('id, name, categories')
          .eq('user_id', userId)
          .or(orFilters)
          .limit(10);

        if (matchedContacts && matchedContacts.length > 0) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          for (const c of matchedContacts.slice(0, 5)) {
            const scopes = (c as any).categories || ['profesional'];

            // Bio-refresh gate: trigger only if ≥20 emails since last refresh
            const { data: contactRow } = await supabase
              .from("people_contacts")
              .select("last_bio_refresh_at")
              .eq("id", c.id)
              .maybeSingle();
            const lastRefreshIso = (contactRow as any)?.last_bio_refresh_at as string | null;
            const lastRefresh = lastRefreshIso ? new Date(lastRefreshIso).getTime() : 0;

            // Count emails for this contact since last refresh
            // (proxy: count emails in `emails` table whose from_address matches contact email or whose ai_extracted.people contains its name since lastRefresh)
            const sinceIso = lastRefreshIso || new Date(0).toISOString();
            const { count: emailsSince } = await supabase
              .from("emails")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .gte("received_at", sinceIso);

            // Use a coarse threshold: ≥20 new emails in inbox since last refresh
            // AND >1h since last refresh (throttle)
            const sinceRefreshMs = Date.now() - lastRefresh;
            if ((emailsSince || 0) < 20 || sinceRefreshMs < 60 * 60 * 1000) {
              continue;
            }

            console.log(`[bio-refresh] Triggering for ${c.name} (${c.id}) — ${emailsSince} emails since last refresh`);
            await supabase
              .from("people_contacts")
              .update({ last_bio_refresh_at: new Date().toISOString() })
              .eq("id", c.id);

            fetch(`${supabaseUrl}/functions/v1/contact-analysis`, {
              method: "POST",
              headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contact_id: c.id,
                scopes,
              }),
            }).catch((err) => console.error(`[email-intelligence] contact-analysis fire error for ${c.name}:`, err));

            // Invalidate headlines cache
            await supabase
              .from("contact_headlines")
              .delete()
              .eq("contact_id", c.id)
              .eq("user_id", userId);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      processed: emails.length,
      analyzed,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[email-intelligence] Fatal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
