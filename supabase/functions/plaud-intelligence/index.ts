import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface PlaudTask {
  description: string;
  responsible: string;
  deadline: string | null;
  priority: string;
  origin: string;
  quote: string;
}

interface PlaudEvent {
  description: string;
  date: string | null;
  time: string | null;
  location: string | null;
  participants: string[];
  origin: string;
}

interface PlaudOpportunity {
  description: string;
  client: string;
  need: string;
  estimatedValue: string | null;
  nextStep: string;
  origin: string;
}

interface PlaudContactData {
  name: string;
  role: string;
  newData: string;
  emotionalState: string | null;
}

interface PlaudDecision {
  decision: string;
  between: string;
  context: string;
}

interface PlaudAlert {
  alert: string;
  severity: string;
  suggestedAction: string;
}

interface PlaudReport {
  tasks: PlaudTask[];
  events: PlaudEvent[];
  opportunities: PlaudOpportunity[];
  contacts: PlaudContactData[];
  decisions: PlaudDecision[];
  alerts: PlaudAlert[];
  discardedContent: string[];
  rawSections: Record<string, string>;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

function extractField(text: string, fieldName: string): string {
  // Match patterns like: - **CAMPO:** valor  OR  - CAMPO: valor  OR  **CAMPO:** valor
  const patterns = [
    new RegExp(`-\\s*\\*\\*${fieldName}:?\\*\\*:?\\s*(.+)`, "i"),
    new RegExp(`\\*\\*${fieldName}:?\\*\\*:?\\s*(.+)`, "i"),
    new RegExp(`-\\s*${fieldName}:?\\s*(.+)`, "i"),
    new RegExp(`${fieldName}:?\\s*(.+)`, "i"),
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return m[1].trim();
  }
  return "";
}

function splitSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  // Split by ## HEADER lines
  const parts = text.split(/^##\s+/m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const header = part.substring(0, newlineIdx).trim().toUpperCase();
    const body = part.substring(newlineIdx + 1).trim();
    sections[header] = body;
  }
  return sections;
}

function splitItems(sectionText: string): string[] {
  // Split by numbered items (1., 2., etc.) or by double newlines
  const items: string[] = [];
  const byNumber = sectionText.split(/^\d+\.\s+/m).filter(s => s.trim());
  if (byNumber.length > 1) return byNumber.map(s => s.trim());
  
  // Fallback: split by lines starting with -
  const byDash = sectionText.split(/^(?=\s*-\s*\*\*)/m).filter(s => s.trim());
  if (byDash.length > 1) return byDash.map(s => s.trim());
  
  // Fallback: entire section is one item
  if (sectionText.trim()) items.push(sectionText.trim());
  return items;
}

function mapPriority(raw: string): string {
  const upper = raw.toUpperCase().trim();
  if (upper.includes("URGENTE")) return "urgent";
  if (upper.includes("ALTA")) return "high";
  if (upper.includes("MEDIA")) return "medium";
  if (upper.includes("BAJA")) return "low";
  return "medium";
}

function parseTasks(sectionText: string): PlaudTask[] {
  const items = splitItems(sectionText);
  return items.map(item => ({
    description: extractField(item, "TAREA") || extractField(item, "DESCRIPCI[OÓ]N") || item.split("\n")[0].replace(/^[-*\d.]+\s*/, "").trim(),
    responsible: extractField(item, "RESPONSABLE"),
    deadline: extractField(item, "DEADLINE") || extractField(item, "FECHA L[IÍ]MITE") || extractField(item, "PLAZO") || null,
    priority: mapPriority(extractField(item, "PRIORIDAD")),
    origin: extractField(item, "ORIGEN"),
    quote: extractField(item, "CITA TEXTUAL") || extractField(item, "CITA"),
  })).filter(t => t.description.length > 3);
}

function parseEvents(sectionText: string): PlaudEvent[] {
  const items = splitItems(sectionText);
  return items.map(item => ({
    description: extractField(item, "EVENTO") || extractField(item, "REUNI[OÓ]N") || extractField(item, "CITA") || item.split("\n")[0].replace(/^[-*\d.]+\s*/, "").trim(),
    date: extractField(item, "FECHA") || null,
    time: extractField(item, "HORA") || extractField(item, "HORARIO") || null,
    location: extractField(item, "LUGAR") || extractField(item, "UBICACI[OÓ]N") || null,
    participants: (extractField(item, "PARTICIPANTES") || "").split(/[,y]/).map(s => s.trim()).filter(Boolean),
    origin: extractField(item, "ORIGEN"),
  })).filter(e => e.description.length > 3);
}

function parseOpportunities(sectionText: string): PlaudOpportunity[] {
  const items = splitItems(sectionText);
  return items.map(item => ({
    description: extractField(item, "OPORTUNIDAD") || item.split("\n")[0].replace(/^[-*\d.]+\s*/, "").trim(),
    client: extractField(item, "CLIENTE") || extractField(item, "CONTACTO") || extractField(item, "CLIENTE/CONTACTO"),
    need: extractField(item, "NECESIDAD"),
    estimatedValue: extractField(item, "VALOR ESTIMADO") || extractField(item, "VALOR") || null,
    nextStep: extractField(item, "SIGUIENTE PASO") || extractField(item, "NEXT STEP") || extractField(item, "PR[OÓ]XIMO PASO"),
    origin: extractField(item, "ORIGEN"),
  })).filter(o => o.description.length > 3);
}

function parseContacts(sectionText: string): PlaudContactData[] {
  const items = splitItems(sectionText);
  return items.map(item => ({
    name: extractField(item, "NOMBRE") || item.split("\n")[0].replace(/^[-*\d.]+\s*/, "").trim(),
    role: extractField(item, "ROL") || extractField(item, "ROL/RELACI[OÓ]N") || extractField(item, "RELACI[OÓ]N"),
    newData: extractField(item, "DATO NUEVO") || extractField(item, "DATOS") || extractField(item, "INFORMACI[OÓ]N"),
    emotionalState: extractField(item, "ESTADO EMOCIONAL") || null,
  })).filter(c => c.name.length > 1);
}

function parseDecisions(sectionText: string): PlaudDecision[] {
  const items = splitItems(sectionText);
  return items.map(item => ({
    decision: extractField(item, "DECISI[OÓ]N") || item.split("\n")[0].replace(/^[-*\d.]+\s*/, "").trim(),
    between: extractField(item, "ENTRE QUI[EÉ]NES") || extractField(item, "PARTICIPANTES"),
    context: extractField(item, "CONTEXTO"),
  })).filter(d => d.decision.length > 3);
}

function parseAlerts(sectionText: string): PlaudAlert[] {
  const items = splitItems(sectionText);
  return items.map(item => ({
    alert: extractField(item, "ALERTA") || item.split("\n")[0].replace(/^[-*\d.]+\s*/, "").trim(),
    severity: extractField(item, "GRAVEDAD") || "media",
    suggestedAction: extractField(item, "ACCI[OÓ]N SUGERIDA") || extractField(item, "ACCI[OÓ]N"),
  })).filter(a => a.alert.length > 3);
}

function parsePlaudReport(summaryText: string): PlaudReport {
  const sections = splitSections(summaryText);
  
  const report: PlaudReport = {
    tasks: [],
    events: [],
    opportunities: [],
    contacts: [],
    decisions: [],
    alerts: [],
    discardedContent: [],
    rawSections: sections,
  };

  for (const [header, body] of Object.entries(sections)) {
    if (header.includes("TAREA")) {
      report.tasks = parseTasks(body);
    } else if (header.includes("CITA") || header.includes("REUNI")) {
      report.events = parseEvents(body);
    } else if (header.includes("OPORTUNIDAD")) {
      report.opportunities = parseOpportunities(body);
    } else if (header.includes("DATOS DE CONTACTO") || header.includes("CONTACTOS")) {
      report.contacts = parseContacts(body);
    } else if (header.includes("DECISIO")) {
      report.decisions = parseDecisions(body);
    } else if (header.includes("ALERTA")) {
      report.alerts = parseAlerts(body);
    } else if (header.includes("DESCARTADO")) {
      report.discardedContent = body.split("\n").map(l => l.trim()).filter(Boolean);
    }
  }

  return report;
}

// ─── Date extraction ─────────────────────────────────────────────────────────

function extractRecordingDate(subject: string): { date: string; title: string } {
  const match = subject.match(/\[Plaud-AutoFlow\]\s*(\d{2})-(\d{2})\s*(.*)/i);
  if (match) {
    const month = match[1];
    const day = match[2];
    const year = new Date().getFullYear();
    return {
      date: `${year}-${month}-${day}T00:00:00Z`,
      title: match[3].trim() || "Grabación Plaud",
    };
  }
  // Fallback: use current date
  return {
    date: new Date().toISOString(),
    title: subject.replace(/\[Plaud-AutoFlow\]/gi, "").trim() || "Grabación Plaud",
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email_id, user_id, account } = await req.json();

    // Validate internal call — user_id is required
    if (!user_id) {
      console.error("[plaud-intelligence] Missing user_id");
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[plaud-intelligence] Processing email ${email_id} for user ${user_id.substring(0, 8)}...`);

    // Use service role for internal operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch email from cache
    const { data: email, error: emailError } = await supabase
      .from("jarvis_emails_cache")
      .select("*")
      .eq("message_id", email_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (emailError || !email) {
      console.error("[plaud-intelligence] Email not found:", emailError?.message || "No match");
      return new Response(
        JSON.stringify({ error: "Email not found", email_id }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Extract date and title from subject
    const { date: recordingDate, title } = extractRecordingDate(email.subject || "");

    // 3. Get the structured report from body
    const summaryText = email.body_text || email.body_html || email.snippet || "";
    if (summaryText.length < 50) {
      console.log("[plaud-intelligence] Email body too short, skipping");
      return new Response(
        JSON.stringify({ error: "Email body too short", length: summaryText.length }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Parse the structured report
    console.log(`[plaud-intelligence] Parsing report (${summaryText.length} chars)...`);
    const report = parsePlaudReport(summaryText);
    console.log(`[plaud-intelligence] Parsed: ${report.tasks.length} tasks, ${report.events.length} events, ${report.opportunities.length} opportunities, ${report.contacts.length} contacts`);

    // 5. Extract participants from title
    const participants: string[] = [];
    const titleLower = title.toLowerCase();
    // Extract names after "con" or "y"
    const nameMatch = title.match(/(?:con|with)\s+(.+)/i);
    if (nameMatch) {
      const names = nameMatch[1].split(/\s+y\s+|\s*,\s*/i);
      participants.push(...names.map(n => n.trim()).filter(Boolean));
    }

    // 6. Insert into plaud_transcriptions
    const { data: transcription, error: insertError } = await supabase
      .from("plaud_transcriptions")
      .insert({
        user_id,
        source_email_id: email_id,
        recording_date: recordingDate,
        title,
        transcript_raw: null, // Phase 2: download from attachment
        summary_structured: summaryText,
        participants: participants.length > 0 ? participants : null,
        parsed_data: report,
        ai_processed: true,
        processing_status: "processing",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[plaud-intelligence] Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to insert transcription", detail: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcriptionId = transcription.id;
    console.log(`[plaud-intelligence] Created transcription ${transcriptionId}`);

    // 7. Generate suggestions
    let suggestionsCreated = 0;

    // 7a. Tasks
    for (const task of report.tasks) {
      const { error: sErr } = await supabase.from("suggestions").insert({
        user_id,
        suggestion_type: "task_from_plaud",
        content: {
          description: task.description,
          responsible: task.responsible,
          deadline: task.deadline,
          priority: task.priority,
          origin: task.origin,
          quote: task.quote,
          recording_date: recordingDate,
          title,
        },
        status: "pending",
        source_transcription_id: transcriptionId,
      });
      if (!sErr) suggestionsCreated++;
      else console.error("[plaud-intelligence] Task suggestion error:", sErr.message);
    }

    // 7b. Events
    for (const event of report.events) {
      const { error: sErr } = await supabase.from("suggestions").insert({
        user_id,
        suggestion_type: "event_from_plaud",
        content: {
          description: event.description,
          date: event.date,
          time: event.time,
          location: event.location,
          participants: event.participants,
          origin: event.origin,
          recording_date: recordingDate,
          title,
        },
        status: "pending",
        source_transcription_id: transcriptionId,
      });
      if (!sErr) suggestionsCreated++;
      else console.error("[plaud-intelligence] Event suggestion error:", sErr.message);
    }

    // 7c. Opportunities
    for (const opp of report.opportunities) {
      const { error: sErr } = await supabase.from("suggestions").insert({
        user_id,
        suggestion_type: "opportunity_from_plaud",
        content: {
          description: opp.description,
          client: opp.client,
          need: opp.need,
          estimatedValue: opp.estimatedValue,
          nextStep: opp.nextStep,
          origin: opp.origin,
          recording_date: recordingDate,
          title,
        },
        status: "pending",
        source_transcription_id: transcriptionId,
      });
      if (!sErr) suggestionsCreated++;
      else console.error("[plaud-intelligence] Opportunity suggestion error:", sErr.message);
    }

    // 7d. Contacts
    for (const contact of report.contacts) {
      // Try to match with existing contacts
      let matchedContactId: string | null = null;
      
      if (contact.name) {
        // Search by exact name match first
        const { data: existingContact } = await supabase
          .from("people_contacts")
          .select("id, name")
          .eq("user_id", user_id)
          .ilike("name", `%${contact.name}%`)
          .limit(1)
          .maybeSingle();
        
        if (existingContact) {
          matchedContactId = existingContact.id;
        } else {
          // Search in aliases
          const { data: alias } = await supabase
            .from("contact_aliases")
            .select("contact_id")
            .eq("user_id", user_id)
            .ilike("alias", `%${contact.name}%`)
            .limit(1)
            .maybeSingle();
          
          if (alias) matchedContactId = alias.contact_id;
        }
      }

      const { error: sErr } = await supabase.from("suggestions").insert({
        user_id,
        suggestion_type: "contact_from_plaud",
        content: {
          name: contact.name,
          role: contact.role,
          newData: contact.newData,
          emotionalState: contact.emotionalState,
          matchedContactId,
          recording_date: recordingDate,
          title,
        },
        status: "pending",
        source_transcription_id: transcriptionId,
      });
      if (!sErr) suggestionsCreated++;
      else console.error("[plaud-intelligence] Contact suggestion error:", sErr.message);
    }

    // 8. Mark email as read
    await supabase
      .from("jarvis_emails_cache")
      .update({ is_read: true })
      .eq("message_id", email_id)
      .eq("user_id", user_id);

    // 9. Update processing status
    await supabase
      .from("plaud_transcriptions")
      .update({ processing_status: "completed" })
      .eq("id", transcriptionId);

    const result = {
      success: true,
      transcription_id: transcriptionId,
      recording_date: recordingDate,
      title,
      parsed: {
        tasks: report.tasks.length,
        events: report.events.length,
        opportunities: report.opportunities.length,
        contacts: report.contacts.length,
        decisions: report.decisions.length,
        alerts: report.alerts.length,
      },
      suggestions_created: suggestionsCreated,
    };

    console.log(`[plaud-intelligence] Done: ${JSON.stringify(result)}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[plaud-intelligence] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
