// ═══════════════════════════════════════════════════════════════════════════════
// JARVIS UNIFIED BRAIN — Merges jarvis-gateway + jarvis-agent into one endpoint
// Capabilities: RAGs + semantic search + WHOOP + tools + specialist routing
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { chat, ChatMessage } from "../_shared/ai-client.ts";
import { buildAgentPrompt, loadRAG } from "../_shared/rag-loader.ts";
import { JARVIS_ORCHESTRATION_RULES } from "../_shared/jarvis-orchestration-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Timeout utility ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number }, label: string): Promise<Response> {
  const ms = options.timeout || 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .then(r => { clearTimeout(timer); return r; })
    .catch(e => { clearTimeout(timer); throw new Error(`[timeout] ${label}: ${e.message}`); });
}

const MAX_TOOL_CALLS = 5;

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnifiedRequest {
  mode: "chat" | "proactive";
  message?: string;
  history?: Array<{ role: string; content: string }>;
  platform?: "web" | "telegram" | "whatsapp";
  // Gateway-style call (from webhooks — no JWT, uses user_id + service role)
  user_id?: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

// ── Specialist definitions ────────────────────────────────────────────────────

interface Specialist {
  name: string;
  triggers: string[];
  description: string;
}

const SPECIALISTS: Specialist[] = [
  { name: "coach", triggers: ["productividad", "motivación", "bloqueo", "energía", "objetivos", "foco", "procrastinar", "hábitos", "objetivo", "rendimiento", "miedo", "decisión", "meta", "disciplina"], description: "Coach de alto rendimiento" },
  { name: "nutrition", triggers: ["comida", "dieta", "proteína", "calorías", "receta", "nutrición", "hambre", "peso", "alimentación", "comer", "desayuno", "almuerzo", "cena", "cocinar", "pollo", "arroz", "verdura", "fruta", "snack", "suplemento", "vitamina", "macros", "carbohidratos", "grasa", "ayuno", "creatina"], description: "Nutricionista" },
  { name: "english", triggers: ["inglés", "english", "vocabulario", "gramática", "pronunciación", "speaking", "idioma", "traducir", "phrasal", "chunks", "shadowing", "CEFR"], description: "Profesor de inglés" },
  { name: "bosco", triggers: ["bosco", "hijo", "niño", "actividad infantil", "juego infantil", "padre", "paternidad", "rabieta", "crianza", "desarrollo infantil"], description: "Desarrollo infantil" },
  { name: "ia-kids", triggers: ["scratch", "programar niños", "coding kids", "robot niños", "tecnología niños", "enseñar programar", "pensamiento computacional"], description: "IA para niños" },
  { name: "secretaria", triggers: ["agenda", "reunión", "calendario", "email", "organizar", "priorizar", "briefing", "seguimiento", "pendientes", "inbox", "cita", "recordatorio"], description: "Secretaria ejecutiva" },
  { name: "psychologist", triggers: ["terapeuta", "terapia", "ansiedad profunda", "ansiedad", "depresión", "autoestima", "trauma", "diario emocional", "journaling", "estrés crónico", "estrés", "burnout", "psicólogo", "emocional", "vulnerabilidad", "asertividad", "límites", "ansioso", "ansiosa", "angustia", "pánico", "panico"], description: "Psicólogo" },
];

function detectSpecialist(message: string): string | null {
  const lower = message.toLowerCase();
  let best: { name: string; score: number } | null = null;

  for (const spec of SPECIALISTS) {
    let score = 0;
    for (const trigger of spec.triggers) {
      if (!lower.includes(trigger)) continue;
      // Weighted by trigger length (longer = more specific = more weight)
      let weight = trigger.length;
      // Bonus for whole-word match (not substring)
      const regex = new RegExp(`\\b${trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(lower)) weight *= 2;
      score += weight;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { name: spec.name, score };
    }
  }
  return best?.name || null;
}

// ── Family alias map for contact resolution (from jarvis-agent) ───────────────

const FAMILY_ALIASES: Record<string, string[]> = {
  "madre": ["mama", "mamá", "mami", "madre"],
  "mi madre": ["mama", "mamá", "mami", "madre"],
  "padre": ["papa", "papá", "papi", "padre"],
  "mi padre": ["papa", "papá", "papi", "padre"],
  "abuela": ["abuela", "yaya", "abu"],
  "abuelo": ["abuelo", "abu"],
  "hermano": ["hermano"], "hermana": ["hermana"],
  "hijo": ["hijo"], "hija": ["hija"],
  "tio": ["tio", "tío"], "tia": ["tia", "tía"],
};

async function resolveContactName(
  sb: any, userId: string, rawName: string
): Promise<{ contacts: { id: string; name: string }[]; resolution_note: string }> {
  const term = `%${rawName}%`;
  let { data: contacts } = await sb.from("people_contacts")
    .select("id, name").eq("user_id", userId).ilike("name", term).limit(5);
  if (contacts && contacts.length > 0) return { contacts, resolution_note: "" };

  const normalized = rawName.toLowerCase().trim();
  const aliases = FAMILY_ALIASES[normalized];
  if (aliases) {
    for (const alias of aliases) {
      const { data: ac } = await sb.from("people_contacts")
        .select("id, name").eq("user_id", userId).ilike("name", `%${alias}%`).limit(5);
      if (ac && ac.length > 0) return { contacts: ac, resolution_note: `Asumí "${ac[0].name}" por "${rawName}".` };
    }
  }

  const parts = rawName.trim().split(/\s+/);
  if (parts.length > 1) {
    for (const part of parts) {
      if (part.length < 3) continue;
      const { data: pc } = await sb.from("people_contacts")
        .select("id, name").eq("user_id", userId).ilike("name", `%${part}%`).limit(5);
      if (pc && pc.length > 0) return { contacts: pc, resolution_note: `Encontré "${pc.map((c: any) => c.name).join(", ")}" buscando por "${part}".` };
    }
  }

  const { data: fuzzy } = await sb.rpc("search_contacts_fuzzy", { p_user_id: userId, p_search_term: rawName, p_limit: 5 });
  if (fuzzy && fuzzy.length > 0) return { contacts: fuzzy, resolution_note: `Encontré "${fuzzy[0].name}" por similitud con "${rawName}".` };

  return { contacts: [], resolution_note: `No se encontró ningún contacto con nombre "${rawName}".` };
}

// ── Context assembly (from jarvis-gateway + jarvis-agent merged) ──────────────

async function getUserContext(supabase: any, userId: string, authHeader: string | null) {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const safeQuery = async (label: string, fn: () => Promise<any>) => {
    try {
      const { data, error } = await withTimeout(fn(), 5000, label);
      if (error) { console.warn(`[unified] ${label} error:`, error.message); return []; }
      return data || [];
    } catch (e) { console.warn(`[unified] ${label} exception:`, e); return []; }
  };

  // Calendar fetch
  const fetchCalendar = async (): Promise<any[]> => {
    if (!authHeader) return [];
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
      const res = await fetchWithTimeout(`${supabaseUrl}/functions/v1/icloud-calendar`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({ action: "fetch", startDate: now.toISOString(), endDate: endOfDay.toISOString() }),
        timeout: 5000,
      }, "fetchCalendar");
      if (!res.ok) return [];
      const data = await res.json();
      return data?.events || [];
    } catch (e) { console.warn("[unified] fetchCalendar error:", e); return []; }
  };

  const [memories, whoop, tasks, checkIn, unreadEmails, followUps, commitments, learnings, projects, todayEvents] = await Promise.all([
    safeQuery("memories", () => supabase.rpc("get_jarvis_context", { p_user_id: userId, p_limit: 15 })),
    supabase.from("whoop_data").select("recovery_score, hrv, strain, sleep_hours, resting_hr").eq("user_id", userId).eq("data_date", today).single().then((r: any) => r.data || null).catch(() => null),
    safeQuery("tasks", () => supabase.from("tasks").select("id, title, priority, completed, due_date, type, source, description").eq("user_id", userId).or("completed.is.null,completed.eq.false").order("created_at", { ascending: false }).limit(20)),
    supabase.from("check_ins").select("energy, mood, focus, day_mode").eq("user_id", userId).eq("date", today).order("created_at", { ascending: false }).limit(1).single().then((r: any) => r.data || null).catch(() => null),
    safeQuery("emails", () => supabase.from("jarvis_emails_cache").select("id, from_addr, subject, preview, is_read, received_at").eq("user_id", userId).eq("is_read", false).order("received_at", { ascending: false }).limit(10)),
    safeQuery("follow_ups", () => supabase.from("follow_ups").select("id, topic, status, resolve_by, last_mention, notes").eq("user_id", userId).neq("status", "resolved").order("created_at", { ascending: false }).limit(10)),
    safeQuery("commitments", () => supabase.from("commitments").select("id, description, commitment_type, person_name, deadline, status").eq("user_id", userId).neq("status", "completed").order("deadline", { ascending: true }).limit(10)),
    safeQuery("learnings", () => supabase.from("agent_learnings").select("trigger_text, learning_text, category").eq("user_id", userId).order("created_at", { ascending: false }).limit(10)),
    safeQuery("projects", () => supabase.from("business_projects").select("id, name, status, company, updated_at, estimated_value").eq("user_id", userId).in("status", ["active", "in_progress", "new", "proposal"]).order("updated_at", { ascending: false }).limit(10)),
    fetchCalendar(),
  ]);

  // Build context string
  let ctx = `📅 ${dayNames[now.getDay()]} ${now.toLocaleDateString("es-ES")} — ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}\n\n`;

  if (whoop) {
    const w = whoop as any;
    ctx += `📊 WHOOP HOY: Recovery ${w.recovery_score}%, HRV ${w.hrv}ms, Sueño ${w.sleep_hours?.toFixed(1) || "?"}h, Strain ${w.strain?.toFixed(1) || "?"}\n`;
  }
  if (checkIn) {
    const c = checkIn as any;
    ctx += `🎯 CHECK-IN: Energía ${c.energy}/10, Ánimo ${c.mood}/10, Foco ${c.focus}/10, Modo: ${c.day_mode}\n`;
  }

  if (todayEvents.length > 0) {
    ctx += `\n🗓️ AGENDA HOY (${todayEvents.length}):\n`;
    for (const ev of todayEvents) ctx += `- ${ev.time || "todo el día"}: ${ev.title}${ev.location ? ` (${ev.location})` : ""}\n`;
  }

  if (tasks.length > 0) {
    ctx += `\n📋 TAREAS PENDIENTES (${tasks.length}):\n`;
    for (const t of tasks) {
      const overdue = t.due_date && new Date(t.due_date) < now ? " ⚠️ VENCIDA" : "";
      const dueStr = t.due_date ? ` (vence: ${new Date(t.due_date).toLocaleDateString("es-ES")})` : "";
      ctx += `- [id:${t.id}] [${t.priority || "normal"}] ${t.title}${dueStr}${overdue}\n`;
    }
  }

  if (followUps.length > 0) {
    ctx += `\n🔄 FOLLOW-UPS (${followUps.length}):\n`;
    for (const f of followUps) {
      const overdue = f.resolve_by && new Date(f.resolve_by) < now ? " ⚠️ VENCIDO" : "";
      ctx += `- ${f.topic} [${f.status}]${f.resolve_by ? ` — resolver antes: ${new Date(f.resolve_by).toLocaleDateString("es-ES")}` : ""}${overdue}\n`;
    }
  }

  if (commitments.length > 0) {
    ctx += `\n🤝 COMPROMISOS (${commitments.length}):\n`;
    for (const c of commitments) {
      const overdue = c.deadline && new Date(c.deadline) < now ? " ⚠️ VENCIDO" : "";
      ctx += `- [${c.commitment_type}]${c.person_name ? ` (${c.person_name})` : ""} ${c.description}${c.deadline ? ` — deadline: ${new Date(c.deadline).toLocaleDateString("es-ES")}` : ""}${overdue}\n`;
    }
  }

  if (unreadEmails.length > 0) {
    ctx += `\n📧 CORREOS NO LEÍDOS (${unreadEmails.length}):\n`;
    for (const e of unreadEmails.slice(0, 5)) ctx += `- De: ${e.from_addr || "desconocido"} — "${e.subject}"\n`;
  }

  if (projects.length > 0) {
    ctx += `\n🏗️ PROYECTOS ACTIVOS (${projects.length}):\n`;
    for (const p of projects) {
      const daysSince = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / 86400000);
      const stale = daysSince > 7 ? ` ⏳ ${daysSince} días sin actividad` : "";
      ctx += `- ${p.name} (${p.company || "sin empresa"}) — ${p.status}${p.estimated_value ? ` — €${p.estimated_value.toLocaleString()}` : ""}${stale}\n`;
    }
  }

  if (memories && memories.length > 0) {
    ctx += `\n🧠 MEMORIAS: ${memories.map((m: any) => m.content).join(" | ")}\n`;
  }

  if (learnings.length > 0) {
    ctx += `\n🧠 CORRECCIONES RECIENTES:\n`;
    for (const l of learnings.slice(0, 5)) ctx += `- [${l.category}] "${l.trigger_text}" → ${l.learning_text}\n`;
  }

  return {
    contextStr: ctx,
    taskCount: tasks.length,
    projectCount: projects.length,
    followUpCount: followUps.length,
    commitmentCount: commitments.length,
    emailCount: unreadEmails.length,
    calendarCount: todayEvents.length,
  };
}

// ── Semantic history search (from jarvis-gateway) ─────────────────────────────

async function getSemanticHistory(supabase: any, userId: string, message: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return "";
  try {
    const embRes = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: message.slice(0, 8000), dimensions: 1024 }),
      timeout: 10000,
    }, "embedding-semantic");
    if (!embRes.ok) return "";
    const embJson = await embRes.json();
    const embedding = embJson.data?.[0]?.embedding;
    if (!embedding) return "";

    const { data: hits } = await supabase.rpc("search_history_hybrid", {
      p_user_id: userId, query_embedding: embedding, query_text: message.slice(0, 500), match_count: 8,
    });
    if (!hits || hits.length === 0) return "";

    const lines = hits.map((h: any) => {
      const date = h.occurred_at ? new Date(h.occurred_at).toISOString().split("T")[0] : "";
      return `[${h.source_type} ${date}] ${h.content_summary || h.content?.slice(0, 200) || ""}`;
    });
    return "\n📚 HISTÓRICO RELEVANTE:\n" + lines.join("\n");
  } catch (e) {
    console.warn("[unified] semantic retrieval error:", e);
    return "";
  }
}

// ── Cross-specialist memory search (Phase 2 — enabled when table has embedding column) ──

async function getCrossSpecialistMemories(supabase: any, userId: string, message: string): Promise<string> {
  try { // wrapped with 5s timeout at call site
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return "";

    // Check if embedding column exists (Phase 2 migration)
    const { data: memTest } = await supabase.rpc("search_memories_semantic", {
      p_user_id: userId,
      p_query_embedding: new Array(1024).fill(0),
      p_limit: 1,
    }).catch(() => ({ data: null }));

    // If RPC doesn't exist yet, fall back to simple text search
    if (memTest === null) {
      const { data: memories } = await supabase.from("specialist_memory")
        .select("specialist, content, memory_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!memories || memories.length === 0) return "";
      return "\n🧠 MEMORIAS CROSS-SPECIALIST:\n" + memories.map((m: any) =>
        `[${m.specialist}] ${m.content}`
      ).join("\n");
    }

    // Semantic search available — embed query
    const embRes = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: message.slice(0, 2000), dimensions: 1024 }),
      timeout: 10000,
    }, "embedding-crossmem");
    if (!embRes.ok) return "";
    const embedding = (await embRes.json()).data?.[0]?.embedding;
    if (!embedding) return "";

    const { data: memories } = await supabase.rpc("search_memories_semantic", {
      p_user_id: userId, p_query_embedding: embedding, p_limit: 10,
    });
    if (!memories || memories.length === 0) return "";

    return "\n🧠 MEMORIAS CROSS-SPECIALIST:\n" + memories.map((m: any) =>
      `[${m.source_specialist || m.specialist}] ${m.content}`
    ).join("\n");
  } catch (e) {
    console.warn("[unified] getCrossSpecialistMemories error:", e);
    return "";
  }
}

// ── Bosco context (Phase 3 — enabled when bosco tables exist) ─────────────────

async function getBoscoContext(supabase: any, userId: string): Promise<string> {
  try {
    const [vocabRes, milestonesRes, recentActivityRes] = await Promise.all([
      supabase.from("bosco_vocabulary").select("id, word_es, word_en, mastery_level, next_review_at, category").eq("user_id", userId).then((r: any) => r.data || []).catch(() => []),
      supabase.from("bosco_milestones").select("milestone_name, category, status, first_observed_at").eq("user_id", userId).order("first_observed_at", { ascending: false }).limit(10).then((r: any) => r.data || []).catch(() => []),
      supabase.from("bosco_activity_log").select("title, development_areas, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5).then((r: any) => r.data || []).catch(() => []),
    ]);

    if (vocabRes.length === 0 && milestonesRes.length === 0) return "";

    let ctx = "\n👶 CONTEXTO BOSCO:\n";
    if (vocabRes.length > 0) {
      const total = vocabRes.length;
      const mastered = vocabRes.filter((v: any) => v.mastery_level === "mastered").length;
      const dueReview = vocabRes.filter((v: any) => v.next_review_at && new Date(v.next_review_at) <= new Date()).length;
      const categories = [...new Set(vocabRes.map((v: any) => v.category).filter(Boolean))];
      ctx += `- Vocabulario: ${total} palabras (${mastered} dominadas, ${dueReview} pendientes de repaso). Categorías: ${categories.join(", ") || "varias"}\n`;
    }
    if (milestonesRes.length > 0) {
      const recent = milestonesRes.filter((m: any) => m.status === "observed").slice(0, 3);
      const emerging = milestonesRes.filter((m: any) => m.status === "emerging").slice(0, 3);
      if (recent.length > 0) ctx += `- Hitos recientes: ${recent.map((m: any) => m.milestone_name).join(", ")}\n`;
      if (emerging.length > 0) ctx += `- Emergentes: ${emerging.map((m: any) => m.milestone_name).join(", ")}\n`;
    }
    if (recentActivityRes.length > 0) {
      ctx += `- Últimas actividades: ${recentActivityRes.map((a: any) => a.title).join(", ")}\n`;
    }
    return ctx;
  } catch (e) {
    console.warn("[unified] getBoscoContext error:", e);
    return "";
  }
}

// ── Tool definitions (from jarvis-agent — all 9 tools) ────────────────────────

const TOOLS = [
  { type: "function", function: { name: "create_calendar_event", description: "Crea un evento en el calendario iCloud.", parameters: { type: "object", properties: { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h" }, duration_minutes: { type: "number" }, location: { type: "string" }, description: { type: "string" } }, required: ["title", "date", "time"], additionalProperties: false } } },
  { type: "function", function: { name: "create_task", description: "Crea una tarea pendiente.", parameters: { type: "object", properties: { title: { type: "string" }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] }, due_date: { type: "string", description: "YYYY-MM-DD" }, description: { type: "string" } }, required: ["title"], additionalProperties: false } } },
  { type: "function", function: { name: "complete_task", description: "Marca una tarea como completada.", parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"], additionalProperties: false } } },
  { type: "function", function: { name: "list_today_events", description: "Consulta eventos del calendario.", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD (default: hoy)" } }, additionalProperties: false } } },
  { type: "function", function: { name: "search_project_data", description: "Busca información de un proyecto de negocio: docs, timeline, resumen.", parameters: { type: "object", properties: { query: { type: "string" }, project_name: { type: "string" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "search_whatsapp_messages", description: "Busca en mensajes de WhatsApp almacenados.", parameters: { type: "object", properties: { query: { type: "string" }, contact_name: { type: "string" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "search_plaud_transcriptions", description: "Busca en transcripciones Plaud (reuniones, llamadas).", parameters: { type: "object", properties: { query: { type: "string" }, contact_name: { type: "string" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "search_emails", description: "Busca en correos electrónicos almacenados.", parameters: { type: "object", properties: { query: { type: "string" }, contact_name: { type: "string" }, from_address: { type: "string" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "get_contact_profile", description: "Obtiene perfil completo de un contacto: personalidad, tags IA, mensajes recientes.", parameters: { type: "object", properties: { contact_name: { type: "string" } }, required: ["contact_name"], additionalProperties: false } } },
  { type: "function", function: { name: "get_entity_profile", description: "Busca todo lo que JARVIS sabe de una persona, empresa, proyecto o tema: relaciones, menciones, historial cruzado.", parameters: { type: "object", properties: { entity_name: { type: "string", description: "Nombre de la persona, empresa, proyecto o tema" } }, required: ["entity_name"], additionalProperties: false } } },
  { type: "function", function: { name: "delegate_to_openclaw", description: "Delega una tarea a un nodo físico de OpenClaw (POTUS, TITAN, JARVIS, ATLAS). Usar cuando el usuario pida ejecutar algo en un nodo.", parameters: { type: "object", properties: { title: { type: "string", description: "Título de la tarea" }, description: { type: "string", description: "Descripción detallada" }, priority: { type: "string", enum: ["critical", "high", "normal", "low"] }, node_hint: { type: "string", description: "Nodo sugerido: GPU→ATLAS, audio→JARVIS, compute→TITAN, default→POTUS" } }, required: ["title"], additionalProperties: false } } },
  { type: "function", function: { name: "check_openclaw_task", description: "Consulta el estado de una tarea delegada a OpenClaw por id o título parcial.", parameters: { type: "object", properties: { task_id: { type: "string" }, title_query: { type: "string" } }, additionalProperties: false } } },
];

// ── Tool execution (from jarvis-agent — all implementations) ──────────────────

async function executeCreateCalendarEvent(args: any, userId: string, authHeader: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const startISO = new Date(`${args.date}T${args.time}:00`).toISOString();
  const durationMs = (args.duration_minutes || 60) * 60 * 1000;
  const endISO = new Date(new Date(startISO).getTime() + durationMs).toISOString();
  const res = await fetch(`${supabaseUrl}/functions/v1/icloud-calendar`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ action: "create", title: args.title, start: startISO, end: endISO, location: args.location, description: args.description }),
  });
  const data = await res.json();
  if (!res.ok || data.error) return JSON.stringify({ success: false, error: data.error || data.message || "Error al crear evento" });
  if (data.connected === false) return JSON.stringify({ success: false, error: data.message || "iCloud no configurado" });
  return JSON.stringify({ success: true, title: args.title, date: args.date, time: args.time });
}

async function executeCreateTask(args: any, userId: string): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await sb.from("tasks").insert({ user_id: userId, title: args.title, priority: args.priority || "normal", due_date: args.due_date || null, description: args.description || null, completed: false });
  if (error) return JSON.stringify({ success: false, error: error.message });
  return JSON.stringify({ success: true, title: args.title, priority: args.priority || "normal", due_date: args.due_date || null });
}

async function executeCompleteTask(args: any, userId: string): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await sb.from("tasks").update({ completed: true }).eq("id", args.task_id).eq("user_id", userId);
  if (error) return JSON.stringify({ success: false, error: error.message });
  return JSON.stringify({ success: true, task_id: args.task_id });
}

async function executeListTodayEvents(args: any, authHeader: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const date = args.date || new Date().toISOString().split("T")[0];
  const res = await fetch(`${supabaseUrl}/functions/v1/icloud-calendar`, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ action: "fetch", startDate: new Date(`${date}T00:00:00`).toISOString(), endDate: new Date(`${date}T23:59:59`).toISOString() }),
  });
  const data = await res.json();
  if (!res.ok || data.connected === false) return JSON.stringify({ success: false, error: data.message || "No se pudo consultar calendario" });
  return JSON.stringify({ success: true, events: data.events || [], date });
}

async function executeSearchProjectData(args: any, userId: string): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    let pq = sb.from("business_projects").select("id, name, company, status, estimated_value, need_summary, need_why, need_budget, need_deadline, sector, business_type, business_size, notes").eq("user_id", userId);
    if (args.project_name) { const t = `%${args.project_name}%`; pq = pq.or(`name.ilike.${t},company.ilike.${t}`); }
    const { data: projects } = await pq.limit(3);
    if (!projects || projects.length === 0) return JSON.stringify({ success: false, error: "No se encontró ningún proyecto con ese nombre." });
    const p = projects[0];
    let r = `## Proyecto: ${p.name}\nEmpresa: ${p.company || "N/A"}\nEstado: ${p.status}\nValor: €${p.estimated_value || 0}\n`;
    if (p.need_summary) r += `Resumen: ${p.need_summary}\n`;
    if (p.notes) r += `Notas: ${p.notes}\n`;

    const { data: docs } = await sb.from("project_documents").select("step_number, content").eq("project_id", p.id).order("step_number");
    if (docs && docs.length > 0) {
      const names: Record<number, string> = { 1: "Briefing", 2: "Scope", 3: "Auditoría", 4: "Diagnóstico", 5: "PRD" };
      r += `\n--- DOCUMENTOS (${docs.length}) ---\n`;
      for (const d of docs) r += `### ${names[d.step_number] || `Paso ${d.step_number}`}\n${(d.content || "").slice(0, 3000)}\n`;
    }
    const { data: summary } = await sb.from("business_project_live_summary").select("summary_markdown").eq("project_id", p.id).maybeSingle();
    if (summary?.summary_markdown) r += `\n--- RESUMEN VIVO ---\n${summary.summary_markdown.slice(0, 2000)}\n`;
    const { data: timeline } = await sb.from("business_project_timeline").select("event_date, channel, title, description").eq("project_id", p.id).order("event_date", { ascending: false }).limit(10);
    if (timeline && timeline.length > 0) { r += `\n--- TIMELINE ---\n`; for (const t of timeline) r += `- ${t.event_date} [${t.channel}] ${t.title}\n`; }
    return JSON.stringify({ success: true, data: r.length > 8000 ? r.slice(0, 8000) + "\n[...truncado...]" : r });
  } catch (e) { return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }); }
}

async function executeSearchWhatsAppMessages(args: any, userId: string): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    let contactIds: string[] = []; let contactNames: Record<string, string> = {}; let note = "";
    if (args.contact_name) {
      const resolved = await resolveContactName(sb, userId, args.contact_name);
      note = resolved.resolution_note;
      if (resolved.contacts.length > 0) { contactIds = resolved.contacts.map((c: any) => c.id); for (const c of resolved.contacts) contactNames[c.id] = c.name; }
      else return JSON.stringify({ success: false, error: resolved.resolution_note || `No se encontró contacto "${args.contact_name}".` });
    }
    const terms = args.query.split(/\s+/).filter((t: string) => t.length > 2);
    let mq = sb.from("contact_messages").select("contact_id, content, direction, created_at").eq("user_id", userId).order("created_at", { ascending: false });
    if (contactIds.length > 0) mq = mq.in("contact_id", contactIds);
    if (terms.length > 1) mq = mq.or(terms.map((t: string) => `content.ilike.%${t}%`).join(","));
    else if (terms.length === 1) mq = mq.ilike("content", `%${terms[0]}%`);
    const { data: messages } = await mq.limit(50);
    if (!messages || messages.length === 0) return JSON.stringify({ success: true, data: "No se encontraron mensajes.", count: 0 });
    if (Object.keys(contactNames).length === 0) {
      const uids = [...new Set(messages.map((m: any) => m.contact_id))];
      const { data: contacts } = await sb.from("people_contacts").select("id, name").in("id", uids);
      if (contacts) for (const c of contacts) contactNames[c.id] = c.name;
    }
    let r = note ? `${note}\n\n` : "";
    r += `Encontrados ${messages.length} mensajes:\n\n`;
    for (const msg of messages) {
      const name = contactNames[msg.contact_id] || "Desconocido";
      const dir = msg.direction === "incoming" ? `${name} →` : "Tú →";
      const date = new Date(msg.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
      r += `[${date}] ${dir} ${(msg.content || "").slice(0, 500)}\n\n`;
    }
    return JSON.stringify({ success: true, data: r.length > 8000 ? r.slice(0, 8000) + "\n[...truncado...]" : r, count: messages.length });
  } catch (e) { return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }); }
}

async function executeSearchPlaudTranscriptions(args: any, userId: string): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    let contactIds: string[] = []; let note = "";
    if (args.contact_name) {
      const resolved = await resolveContactName(sb, userId, args.contact_name);
      note = resolved.resolution_note;
      contactIds = resolved.contacts.map((c: any) => c.id);
    }
    const st = `%${args.query}%`;
    const { data: transcriptions } = await sb.from("plaud_transcriptions")
      .select("id, title, recording_date, summary_structured, transcript_raw, linked_contact_ids, duration_minutes")
      .eq("user_id", userId).in("processing_status", ["completed", "pending_review"])
      .or(`summary_structured.ilike.${st},transcript_raw.ilike.${st},title.ilike.${st}`)
      .order("recording_date", { ascending: false }).limit(10);
    let filtered = transcriptions || [];
    if (contactIds.length > 0 && filtered.length > 0) {
      const cf = filtered.filter((t: any) => t.linked_contact_ids?.some((id: string) => contactIds.includes(id)));
      if (cf.length > 0) filtered = cf;
    }
    if (filtered.length === 0) {
      const { data: emb } = await sb.from("conversation_embeddings").select("date, brain, people, summary, content").eq("user_id", userId).or(`content.ilike.${st},summary.ilike.${st}`).order("date", { ascending: false }).limit(10);
      if (emb && emb.length > 0) {
        let r = note ? `${note}\n\n` : "";
        r += `Encontradas ${emb.length} conversaciones:\n\n`;
        for (const e of emb) { const d = e.date ? new Date(e.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "?"; r += `[${d}] ${e.brain || ""} ${Array.isArray(e.people) ? `(${e.people.join(", ")})` : ""}\n${(e.content || e.summary || "").slice(0, 500)}\n\n`; }
        return JSON.stringify({ success: true, data: r.length > 6000 ? r.slice(0, 6000) + "\n[...truncado...]" : r, count: emb.length });
      }
    }
    if (filtered.length === 0) return JSON.stringify({ success: true, data: `${note ? note + "\n" : ""}No se encontraron transcripciones para "${args.query}".`, count: 0 });
    let r = note ? `${note}\n\n` : "";
    r += `Encontradas ${filtered.length} transcripciones:\n\n`;
    for (const t of filtered) {
      const d = t.recording_date ? new Date(t.recording_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "?";
      r += `### ${t.title || "Grabación"} — ${d}${t.duration_minutes ? ` (${t.duration_minutes} min)` : ""}\n${(t.transcript_raw || t.summary_structured || "").slice(0, 800)}\n\n`;
    }
    return JSON.stringify({ success: true, data: r.length > 6000 ? r.slice(0, 6000) + "\n[...truncado...]" : r, count: filtered.length });
  } catch (e) { return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }); }
}

async function executeSearchEmails(args: any, userId: string): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const st = `%${args.query}%`;
    let eq = sb.from("jarvis_emails_cache").select("id, from_addr, to_addr, subject, body_text, preview, received_at, is_read").eq("user_id", userId).or(`subject.ilike.${st},body_text.ilike.${st}`).order("received_at", { ascending: false }).limit(10);
    if (args.from_address) eq = eq.ilike("from_addr", `%${args.from_address}%`);
    const { data: emails } = await eq;
    if (args.contact_name && (!emails || emails.length === 0)) {
      const resolved = await resolveContactName(sb, userId, args.contact_name);
      if (resolved.contacts.length > 0) {
        const { data: cd } = await sb.from("people_contacts").select("name, metadata").in("id", resolved.contacts.map((c: any) => c.id));
        if (cd) {
          for (const contact of cd) {
            const meta = contact.metadata as any;
            const el = meta?.emails || meta?.email ? [meta.email, ...(meta.emails || [])] : [];
            for (const email of el) {
              if (!email) continue;
              const { data: ce } = await sb.from("jarvis_emails_cache").select("id, from_addr, to_addr, subject, body_text, preview, received_at, is_read").eq("user_id", userId).or(`from_addr.ilike.%${email}%,to_addr.ilike.%${email}%`).order("received_at", { ascending: false }).limit(10);
              if (ce && ce.length > 0) {
                let r = resolved.resolution_note ? `${resolved.resolution_note}\n\n` : "";
                r += `Encontrados ${ce.length} emails de/para ${contact.name}:\n\n`;
                for (const e of ce) { const d = new Date(e.received_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); r += `[${d}] De: ${e.from_addr}\nAsunto: ${e.subject}\n${(e.body_text || e.preview || "").slice(0, 800)}\n\n`; }
                return JSON.stringify({ success: true, data: r.length > 8000 ? r.slice(0, 8000) + "\n[...truncado...]" : r, count: ce.length });
              }
            }
          }
        }
      }
    }
    if (!emails || emails.length === 0) return JSON.stringify({ success: true, data: `No se encontraron emails para "${args.query}".`, count: 0 });
    let r = `Encontrados ${emails.length} emails:\n\n`;
    for (const e of emails) { const d = new Date(e.received_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); r += `[${d}]${e.is_read ? "" : " 🆕"} De: ${e.from_addr}\nAsunto: ${e.subject}\n${(e.body_text || e.preview || "").slice(0, 800)}\n\n`; }
    return JSON.stringify({ success: true, data: r.length > 8000 ? r.slice(0, 8000) + "\n[...truncado...]" : r, count: emails.length });
  } catch (e) { return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }); }
}

async function executeGetContactProfile(args: any, userId: string): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const resolved = await resolveContactName(sb, userId, args.contact_name);
    if (resolved.contacts.length === 0) return JSON.stringify({ success: false, error: resolved.resolution_note || `No se encontró contacto "${args.contact_name}".` });
    const cid = resolved.contacts[0].id;
    const { data: contact } = await sb.from("people_contacts").select("id, name, role, notes, ai_tags, personality_profile, metadata, phone_numbers, wa_id").eq("id", cid).maybeSingle();
    if (!contact) return JSON.stringify({ success: false, error: "No se encontró el perfil." });
    let r = resolved.resolution_note ? `${resolved.resolution_note}\n\n` : "";
    r += `## Perfil: ${contact.name}\n`;
    if (contact.role) r += `Rol: ${contact.role}\n`;
    if (contact.notes) r += `Notas: ${contact.notes}\n`;
    if (contact.ai_tags?.length > 0) r += `Tags IA: ${contact.ai_tags.join(", ")}\n`;
    if (contact.personality_profile) {
      const pp = contact.personality_profile as any;
      r += `\n--- PERSONALIDAD ---\n`;
      if (pp.resumen || pp.summary) r += `${pp.resumen || pp.summary}\n`;
      if (pp.estilo_comunicacion || pp.communication_style) r += `Estilo: ${pp.estilo_comunicacion || pp.communication_style}\n`;
    }
    if (contact.metadata) { const m = contact.metadata as any; if (m.company) r += `Empresa: ${m.company}\n`; if (m.position) r += `Cargo: ${m.position}\n`; }
    const { data: msgs } = await sb.from("contact_messages").select("content, direction, created_at").eq("user_id", userId).eq("contact_id", cid).order("created_at", { ascending: false }).limit(5);
    if (msgs && msgs.length > 0) {
      r += `\n--- MENSAJES RECIENTES ---\n`;
      for (const m of msgs) { const d = new Date(m.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }); r += `[${d}] ${m.direction === "incoming" ? `${contact.name} →` : "Tú →"} ${(m.content || "").slice(0, 300)}\n`; }
    }
    const { count } = await sb.from("contact_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("contact_id", cid);
    if (count !== null) r += `\nTotal mensajes: ${count}\n`;
    return JSON.stringify({ success: true, data: r.length > 8000 ? r.slice(0, 8000) + "\n[...truncado...]" : r });
  } catch (e) { return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }); }
}

async function executeGetEntityProfile(args: any, userId: string): Promise<string> {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb.rpc("get_entity_profile", { p_user_id: userId, p_entity_name: args.entity_name });
    if (error) throw error;
    if (!data || data.found === false) {
      // Fallback: search in people_contacts, emails, whatsapp for a broader picture
      const name = args.entity_name;
      const [contacts, whatsapp, emails] = await Promise.all([
        sb.from("people_contacts").select("name, category, last_contact, phone_numbers").eq("user_id", userId).ilike("name", `%${name}%`).limit(3),
        sb.from("contact_messages").select("content, direction, message_date, sender").eq("user_id", userId).or(`sender.ilike.%${name}%,content.ilike.%${name}%`).order("message_date", { ascending: false }).limit(5),
        sb.from("emails").select("subject, from_address, snippet, date").eq("user_id", userId).or(`from_address.ilike.%${name}%,subject.ilike.%${name}%`).order("date", { ascending: false }).limit(5),
      ]);
      let r = `No hay perfil de entidad para "${name}" en el knowledge graph.\n`;
      if (contacts.data?.length) r += `\nContactos encontrados:\n${contacts.data.map((c: any) => `- ${c.name} (${c.category || "sin cat"}, último contacto: ${c.last_contact || "?"})`).join("\n")}`;
      if (whatsapp.data?.length) r += `\n\nMensajes WhatsApp recientes:\n${whatsapp.data.map((m: any) => `- [${m.message_date}] ${m.sender}: ${(m.content || "").substring(0, 100)}`).join("\n")}`;
      if (emails.data?.length) r += `\n\nEmails recientes:\n${emails.data.map((e: any) => `- [${e.date}] ${e.from_address}: ${e.subject}`).join("\n")}`;
      return JSON.stringify({ success: true, data: r });
    }
    return JSON.stringify({ success: true, data });
  } catch (e) { return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }); }
}

async function executeDelegateToOpenClaw(args: any, userId: string): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    // Auto-assign node based on hint or task type
    const hint = (args.node_hint || "").toLowerCase();
    let nodeName = "POTUS"; // default
    if (hint.includes("gpu") || hint.includes("atlas") || hint.includes("render")) nodeName = "ATLAS";
    else if (hint.includes("audio") || hint.includes("jarvis") || hint.includes("voz")) nodeName = "JARVIS";
    else if (hint.includes("compute") || hint.includes("titan") || hint.includes("build") || hint.includes("compil")) nodeName = "TITAN";
    else if (hint.includes("potus") || hint.includes("coord")) nodeName = "POTUS";

    const { data: node } = await sb.from("openclaw_nodes").select("id").ilike("name", nodeName).eq("user_id", userId).maybeSingle();
    const nodeId = node?.id || null;

    const { data: task, error } = await sb.from("openclaw_tasks").insert({
      title: args.title,
      description: args.description || null,
      priority: args.priority || "normal",
      node_id: nodeId,
      status: "pending",
      source: "jarvis",
      user_id: userId,
    }).select("id").maybeSingle();
    if (error) return JSON.stringify({ success: false, error: error.message });
    return JSON.stringify({ success: true, task_id: task?.id, node: nodeName, title: args.title });
  } catch (e) { return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }); }
}

async function executeCheckOpenClawTask(args: any, userId: string): Promise<string> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    let task: any = null;
    if (args.task_id) {
      const { data } = await sb.from("openclaw_tasks").select("id, title, status, priority, result, created_at, started_at, finished_at").eq("id", args.task_id).maybeSingle();
      task = data;
    } else if (args.title_query) {
      const { data } = await sb.from("openclaw_tasks").select("id, title, status, priority, result, created_at, started_at, finished_at").ilike("title", `%${args.title_query}%`).order("created_at", { ascending: false }).limit(1).maybeSingle();
      task = data;
    }
    if (!task) return JSON.stringify({ success: false, error: "No se encontró la tarea." });
    return JSON.stringify({ success: true, ...task });
  } catch (e) { return JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Error" }); }
}

async function executeTool(name: string, args: any, userId: string, authHeader: string): Promise<string> {
  switch (name) {
    case "create_calendar_event": return executeCreateCalendarEvent(args, userId, authHeader);
    case "create_task": return executeCreateTask(args, userId);
    case "complete_task": return executeCompleteTask(args, userId);
    case "list_today_events": return executeListTodayEvents(args, authHeader);
    case "search_project_data": return executeSearchProjectData(args, userId);
    case "search_whatsapp_messages": return executeSearchWhatsAppMessages(args, userId);
    case "search_plaud_transcriptions": return executeSearchPlaudTranscriptions(args, userId);
    case "search_emails": return executeSearchEmails(args, userId);
    case "get_contact_profile": return executeGetContactProfile(args, userId);
    case "get_entity_profile": return executeGetEntityProfile(args, userId);
    case "delegate_to_openclaw": return executeDelegateToOpenClaw(args, userId);
    case "check_openclaw_task": return executeCheckOpenClawTask(args, userId);
    default: return JSON.stringify({ success: false, error: `Herramienta desconocida: ${name}` });
  }
}

// ── Correction detection (from jarvis-agent) ──────────────────────────────────

function detectCorrection(message: string): boolean {
  return [/\bno\b.*\beso\b/i, /\bte equivocas\b/i, /\bno es así\b/i, /\bestás mal\b/i, /\bincorrecto\b/i, /\bno,?\s+es\b/i, /\bcorregir\b/i].some(p => p.test(message));
}

function needsProModel(message: string): boolean {
  return [/\bpor qu[eé]\b/i, /\banaliz[ao]\b/i, /\bcompar[ao]\b/i, /\bexpl[ií]ca\b/i, /\beval[uú]a\b/i, /\bestrategi/i, /\bqu[eé] opinas\b/i, /\bqu[eé] piensas\b/i, /\bqu[eé] recomiendas\b/i, /\bresume todo\b/i, /\bcómo deber[ií]a\b/i, /\bpros y contras\b/i].some(p => p.test(message));
}

// ── Memory persistence (fire-and-forget after response) ───────────────────────

async function persistMemory(supabase: any, userId: string, specialist: string, message: string) {
  try {
    if (message.length < 30) return;
    const importantKeywords = ["quiero", "objetivo", "preocupa", "siempre", "nunca", "importante", "problema", "necesito"];
    if (!importantKeywords.some(k => message.toLowerCase().includes(k))) return;
    await supabase.from("specialist_memory").insert({
      user_id: userId,
      specialist,
      memory_type: "interaction",
      content: message.substring(0, 2000),
      importance: 5,
      is_shared: true,
      source_specialist: specialist,
    });
  } catch (e) {
    console.warn("[unified] memory persist error:", e);
  }
}

// ── Entity extraction pipeline (Phase 6 — fire-and-forget) ──────────────────

async function extractAndPersistEntities(
  userId: string,
  userMessage: string,
  assistantResponse: string,
  conversationId: string | null
) {
  try {
    const text = `Usuario: ${userMessage}\nAsistente: ${assistantResponse}`;
    if (text.length < 50) return;

    const extractionResult = await chat(
      [{
        role: "user",
        content: `Extrae entidades mencionadas en esta conversación. Devuelve SOLO JSON valido.

CONVERSACION:
${text.substring(0, 2000)}

FORMATO JSON (sin markdown):
{
  "entities": [
    {"name": "nombre canonico", "type": "person|project|company|topic|place", "aliases": [], "context": "breve contexto de mencion"}
  ],
  "relations": [
    {"entity_a": "nombre A", "entity_b": "nombre B", "relation": "works_at|works_on|knows|related_to|part_of"}
  ]
}

REGLAS:
- Solo entidades especificas (nombres propios, proyectos concretos). NO extraer conceptos genericos.
- Tipo "person" para personas, "project" para proyectos/productos, "company" para empresas, "topic" para temas recurrentes, "place" para lugares.
- Si no hay entidades relevantes, devolver {"entities":[],"relations":[]}
- Maximo 5 entidades por turno.`,
      }],
      { model: "gemini-flash", temperature: 0.1, responseFormat: "json", maxTokens: 512 }
    );

    const parsed = JSON.parse(extractionResult);
    if (!parsed.entities || parsed.entities.length === 0) return;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    for (const ent of parsed.entities.slice(0, 5)) {
      if (!ent.name || !ent.type) continue;

      const { data: existing } = await sb
        .from("jarvis_entities")
        .select("id, aliases, mention_count")
        .eq("user_id", userId)
        .eq("entity_type", ent.type)
        .ilike("canonical_name", ent.name)
        .maybeSingle();

      let entityId: string;
      if (existing) {
        entityId = existing.id;
        const newAliases = [...new Set([...(existing.aliases || []), ...(ent.aliases || [])])];
        await sb.from("jarvis_entities").update({
          mention_count: (existing.mention_count || 0) + 1,
          last_mentioned_at: new Date().toISOString(),
          aliases: newAliases,
        }).eq("id", entityId);
      } else {
        let contactId = null;
        if (ent.type === "person") {
          const { data: contact } = await sb
            .from("people_contacts").select("id")
            .eq("user_id", userId).ilike("name", `%${ent.name}%`).maybeSingle();
          contactId = contact?.id || null;
        }
        let projectId = null;
        if (ent.type === "project") {
          const { data: proj } = await sb
            .from("business_projects").select("id")
            .eq("user_id", userId).ilike("name", `%${ent.name}%`).maybeSingle();
          projectId = proj?.id || null;
        }

        const { data: newEnt } = await sb.from("jarvis_entities")
          .insert({
            user_id: userId,
            entity_type: ent.type,
            canonical_name: ent.name,
            aliases: ent.aliases || [],
            contact_id: contactId,
            project_id: projectId,
          })
          .select("id").maybeSingle();
        if (!newEnt) continue;
        entityId = newEnt.id;
      }

      await sb.from("jarvis_entity_mentions").insert({
        entity_id: entityId,
        source_type: "conversation",
        source_id: conversationId,
        mention_context: (ent.context || userMessage).substring(0, 300),
      }).catch(() => {});
    }

    if (parsed.relations && parsed.relations.length > 0) {
      for (const rel of parsed.relations.slice(0, 5)) {
        if (!rel.entity_a || !rel.entity_b || !rel.relation) continue;
        const { data: entA } = await sb.from("jarvis_entities").select("id").eq("user_id", userId).ilike("canonical_name", rel.entity_a).maybeSingle();
        const { data: entB } = await sb.from("jarvis_entities").select("id").eq("user_id", userId).ilike("canonical_name", rel.entity_b).maybeSingle();
        if (!entA || !entB) continue;

        const { data: existingRel } = await sb.from("jarvis_entity_relations")
          .select("id, evidence_count, strength")
          .eq("user_id", userId).eq("entity_a_id", entA.id).eq("entity_b_id", entB.id).eq("relation_type", rel.relation)
          .maybeSingle();

        if (existingRel) {
          await sb.from("jarvis_entity_relations").update({
            evidence_count: (existingRel.evidence_count || 0) + 1,
            strength: Math.min(1.0, (existingRel.strength || 0.5) + 0.1),
            last_seen_at: new Date().toISOString(),
          }).eq("id", existingRel.id);
        } else {
          await sb.from("jarvis_entity_relations").insert({
            user_id: userId, entity_a_id: entA.id, entity_b_id: entB.id, relation_type: rel.relation,
          }).catch(() => {});
        }
      }
    }

    console.log(`[unified] Entity extraction: ${parsed.entities.length} entities, ${(parsed.relations || []).length} relations`);
  } catch (e) {
    console.warn("[unified] Entity extraction error:", e);
  }
}

// ── Streaming helper ──────────────────────────────────────────────────────────

function streamAndSave(
  llmResponse: Response,
  userId: string,
  mode: string,
  specialist: string,
  toolsUsed: string[],
  conversationId: string | null,
  supabaseUrl: string,
  model: string,
): Response {
  const reader = llmResponse.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          controller.enqueue(new TextEncoder().encode(chunk));
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try { const p = JSON.parse(jsonStr); const d = p.choices?.[0]?.delta?.content; if (d) fullContent += d; } catch { /* partial */ }
          }
        }
        controller.close();
        if (fullContent && conversationId) {
          const sc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          await sc.from("jarvis_messages").insert({
            conversation_id: conversationId,
            user_id: userId,
            role: mode === "proactive" ? "proactive" : "assistant",
            content: fullContent,
            specialist,
            tools_used: toolsUsed,
            meta: { model },
          });
          // Also persist to agent_chat_messages for backwards compatibility
          await sc.from("agent_chat_messages").insert({
            user_id: userId,
            role: mode === "proactive" ? "proactive" : "assistant",
            content: fullContent,
            model_used: model,
          }).catch(() => {});
        }
      } catch (e) { console.error("[unified] Stream error:", e); controller.error(e); }
    },
  });

  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as UnifiedRequest;
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Resolve user ID ──
    let userId: string;
    let effectiveAuthHeader = authHeader;
    const platform = body.platform || "web";

    if (body.user_id) {
      // Webhook/service-role path (telegram, whatsapp)
      userId = body.user_id;
      effectiveAuthHeader = `Bearer ${supabaseServiceKey}`;
    } else {
      // JWT path (web app)
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = claimsData.claims.sub as string;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const message = body.message || "";
    const mode = body.mode || "chat";
    const history = body.history || body.conversation_history || [];

    console.log(`[unified] ${platform}/${mode} from ${userId}: ${message.substring(0, 80)}`);

    // ── Parallel context assembly ──
    const tCtx = Date.now();
    const [ctx, semanticHistory, crossMemories, boscoCtx] = await Promise.all([
      getUserContext(supabase, userId, platform === "web" ? authHeader : null),
      message ? getSemanticHistory(supabase, userId, message) : Promise.resolve(""),
      message ? getCrossSpecialistMemories(supabase, userId, message) : Promise.resolve(""),
      getBoscoContext(supabase, userId),
    ]);

    console.log(`[unified] Context assembly: ${Date.now() - tCtx}ms`);

    // ── Detect specialist ──
    const specialist = message ? detectSpecialist(message) : null;
    const agentType = specialist || "general";

    // ── Build system prompt (RAG + orchestration + context) ──
    let dynamicKnowledge = "";
    try {
      const { data: kd } = await withTimeout(
        supabase.from("specialist_knowledge").select("title, content").eq("user_id", userId).eq("specialist", agentType).eq("is_active", true).order("importance", { ascending: false }).limit(5),
        5000, "specialist_knowledge"
      );
      if (kd && kd.length > 0) dynamicKnowledge = kd.map((k: any) => `### ${k.title}\n${k.content}`).join("\n\n");
    } catch (e) { console.warn("[unified] specialist knowledge error:", e); }

    // Dual-RAG: Load english-kids RAG when relevant (Phase 4)
    let extraRagContent = "";
    const lowerMsg = (message || "").toLowerCase();
    const needsEnglishKids =
      specialist === "bosco" || specialist === "ia-kids" ||
      (specialist === "english" && /\b(bosco|hijo|niño|niña|kids?|child|children|peque)\b/.test(lowerMsg)) ||
      (/\b(ingl[eé]s|english)\b/.test(lowerMsg) && /\b(bosco|hijo|niño|niña|kids?|child|peque)\b/.test(lowerMsg));
    if (needsEnglishKids) {
      try { extraRagContent = await loadRAG("english-kids") || ""; } catch (e) { console.warn("[unified] english-kids RAG error:", e); }
    }

    const additionalContext = `
${JARVIS_ORCHESTRATION_RULES}

PLATAFORMA: ${platform.toUpperCase()}
${platform !== "web" ? "El usuario escribe desde " + platform + ". Mantén respuestas concisas (2-3 frases)." : ""}

--- CONTEXTO ACTUAL ---
${ctx.contextStr}
${semanticHistory}
${crossMemories}
${boscoCtx}

ESPECIALISTA INTERNO ACTIVO: ${specialist || "general"}
DISPONIBLES: ${SPECIALISTS.map(s => s.name).join(", ")}

HERRAMIENTAS REALES: Tienes herramientas para buscar en WhatsApp, emails, Plaud, proyectos, contactos, crear eventos y tareas. SIEMPRE usa las herramientas cuando te pidan datos. NUNCA digas "no tengo esa información" sin haber buscado primero.
DELEGACIÓN OPENCLAW: Cuando el usuario pida ejecutar algo en un nodo físico (compilar, renderizar, procesar audio, etc.), usa delegate_to_openclaw. Nodos: GPU/render→ATLAS, audio/voz→JARVIS, build/compile→TITAN, coordinación→POTUS.

REGLAS DE ESTILO:
1. Eres JARVIS — única identidad visible.
2. Respuestas 2-4 frases por defecto.
3. Tono cercano, firme, humano. Sin clichés.
4. Valida antes de proponer. Cierra con próximo paso si aplica.
5. Aplica tolerancia semántica: nunca falles por un typo.
${extraRagContent ? "\n--- CONOCIMIENTO ADICIONAL (English for Kids) ---\n" + extraRagContent.slice(0, 3000) : ""}
`;

    const systemPrompt = await buildAgentPrompt(agentType, additionalContext, 400, import.meta.url, dynamicKnowledge);

    // ── Get or create conversation ──
    let conversationId: string | null = null;
    try {
      const { data: existingConv } = await supabase.from("jarvis_conversations")
        .select("id").eq("user_id", userId).eq("platform", platform)
        .order("updated_at", { ascending: false }).limit(1).single();
      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv } = await supabase.from("jarvis_conversations")
          .insert({ user_id: userId, platform, active_specialist: agentType })
          .select("id").single();
        conversationId = newConv?.id || null;
      }
    } catch (e) {
      console.warn("[unified] conversation tracking error:", e);
    }

    // ── Build messages array ──
    const messages: any[] = [{ role: "system", content: systemPrompt }];
    for (const h of history.slice(-10)) {
      messages.push({ role: h.role === "proactive" ? "assistant" : h.role, content: h.content });
    }
    if (mode === "proactive") {
      // Build richer proactive context
      const now = new Date();
      const hour = now.getHours();
      const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
      const isFirstOfDay = history.filter(h => {
        const hDate = new Date(h.created_at || "");
        return hDate.toDateString() === now.toDateString() && h.role === "proactive";
      }).length === 0;

      const overdueTasks = ctx.tasks?.filter((t: any) => t.due_date && new Date(t.due_date) < now && t.status !== "done") || [];
      const todayTasks = ctx.tasks?.filter((t: any) => {
        if (!t.due_date) return false;
        return new Date(t.due_date).toDateString() === now.toDateString();
      }) || [];

      let proactivePrompt = "";
      if (isFirstOfDay) {
        proactivePrompt = `${greeting}. Esta es la primera interacción del día. Genera un BRIEFING MATUTINO completo:

1. AGENDA: Resume los eventos de hoy del calendario (${ctx.calendarCount} eventos cargados)
2. TAREAS URGENTES: ${overdueTasks.length} tareas vencidas${overdueTasks.length > 0 ? `: ${overdueTasks.slice(0, 3).map((t: any) => t.title).join(", ")}` : ""}
3. TAREAS DE HOY: ${todayTasks.length} tareas para hoy
4. SEGUIMIENTOS: ${ctx.followUpCount} follow-ups pendientes
5. COMPROMISOS: ${ctx.commitmentCount} compromisos activos
${ctx.emailCount > 0 ? `6. EMAILS: ${ctx.emailCount} emails pendientes de revisar` : ""}

Háblame como mi secretaria de confianza. Sé directa, prioriza lo urgente, y proponme un plan para hoy. No hagas listas — háblame como una persona real. Si hay tareas vencidas, dímelo con urgencia pero sin dramatizar.`;
      } else {
        proactivePrompt = `Háblame como mi secretaria de confianza. Dime qué es lo más urgente, qué debería hacer primero, avísame de problemas que veas venir, y proponme acciones concretas. No hagas listas — háblame como una persona real.${overdueTasks.length > 0 ? ` URGENTE: Hay ${overdueTasks.length} tareas vencidas.` : ""}`;
      }
      messages.push({ role: "user", content: proactivePrompt });
    } else if (message) {
      messages.push({ role: "user", content: message });
    }

    // ── Save user message ──
    if (mode === "chat" && message) {
      if (conversationId) {
        supabase.from("jarvis_messages").insert({
          conversation_id: conversationId, user_id: userId, role: "user",
          content: message, specialist: agentType,
        }).then(() => {});
      }
      // Backwards compat
      supabase.from("agent_chat_messages").insert({
        user_id: userId, role: "user", content: message,
        context_used: { tasks: ctx.taskCount, projects: ctx.projectCount, follow_ups: ctx.followUpCount, commitments: ctx.commitmentCount, emails: ctx.emailCount, calendar: ctx.calendarCount },
      }).then(() => {});
      // Also save to potus_chat for legacy
      supabase.from("potus_chat").insert({ user_id: userId, message, role: "user", platform }).then(() => {});

      if (detectCorrection(message)) {
        supabase.from("agent_learnings").insert({
          user_id: userId, category: "correction", trigger_text: message.slice(0, 500),
          learning_text: "Corrección del usuario — pendiente de procesar", confidence: 0.70,
        }).then(() => {});
      }
    }

    // ── Select model ──
    const useProModel = (platform === "web" && message && (needsProModel(message) || message.length > 80));
    const model = useProModel ? "google/gemini-3.1-pro-preview" : "google/gemini-3-flash-preview";
    console.log(`[unified] Model: ${model}, specialist: ${agentType}`);

    // ── LLM call with tools ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const llmTimeout = useProModel ? 60000 : 30000;
    const t0 = Date.now();
    const firstResponse = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, tools: TOOLS, stream: false }),
      timeout: llmTimeout,
    }, "LLM-first-call");
    console.log(`[unified] LLM first call: ${Date.now() - t0}ms`);

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Intenta en unos segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (firstResponse.status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errText = await firstResponse.text();
      console.error("[unified] LLM error:", firstResponse.status, errText);
      throw new Error(`LLM error: ${firstResponse.status}`);
    }

    const firstResult = await firstResponse.json();
    const firstChoice = firstResult.choices?.[0];

    // ── Tool execution loop ──
    const toolsUsed: string[] = [];

    if (firstChoice?.message?.tool_calls?.length > 0) {
      const toolCallsToExec = firstChoice.message.tool_calls.slice(0, MAX_TOOL_CALLS);
      console.log(`[unified] Tool calls: ${firstChoice.message.tool_calls.length} (executing ${toolCallsToExec.length})`);
      messages.push(firstChoice.message);

      for (const tc of toolCallsToExec) {
        const fnName = tc.function.name;
        toolsUsed.push(fnName);
        let fnArgs: any;
        try { fnArgs = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments; } catch { fnArgs = {}; }
        const tTool = Date.now();
        console.log(`[unified] Tool: ${fnName}`, fnArgs);
        const result = await withTimeout(executeTool(fnName, fnArgs, userId, effectiveAuthHeader), 15000, `tool:${fnName}`).catch(e => JSON.stringify({ success: false, error: `Tool timeout: ${e.message}` }));
        console.log(`[unified] Tool ${fnName}: ${Date.now() - tTool}ms, result: ${result.slice(0, 200)}`);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }

      // Second call — stream response after tool execution
      const t1 = Date.now();
      const secondResponse = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
        timeout: llmTimeout,
      }, "LLM-second-call");
      console.log(`[unified] LLM second call start: ${Date.now() - t1}ms`);
      if (!secondResponse.ok) throw new Error(`LLM error on second call: ${secondResponse.status}`);

      // Fire-and-forget: memory persistence + entity extraction
      persistMemory(supabase, userId, agentType, message).catch(() => {});

      // For webhook callers (telegram/whatsapp), return JSON instead of SSE
      if (body.user_id && platform !== "web") {
        const jsonResult = await collectAndReturnJSON(secondResponse, userId, mode, agentType, toolsUsed, conversationId, supabase, model);
        // Entity extraction (fire-and-forget after response collected)
        try {
          const cloned = jsonResult.clone();
          cloned.json().then((d: any) => {
            if (d.response) extractAndPersistEntities(userId, message, d.response, conversationId).catch(() => {});
          }).catch(() => {});
        } catch {}
        return jsonResult;
      }

      return streamAndSave(secondResponse, userId, mode, agentType, toolsUsed, conversationId, supabaseUrl, model);
    }

    // ── No tool calls — direct text response ──
    if (firstChoice?.message?.content) {
      const fullContent = firstChoice.message.content;

      // Save to jarvis_messages
      if (conversationId) {
        supabase.from("jarvis_messages").insert({
          conversation_id: conversationId, user_id: userId,
          role: mode === "proactive" ? "proactive" : "assistant",
          content: fullContent, specialist: agentType, tools_used: toolsUsed, meta: { model },
        }).then(() => {});
      }
      // Backwards compat
      supabase.from("agent_chat_messages").insert({
        user_id: userId, role: mode === "proactive" ? "proactive" : "assistant",
        content: fullContent, model_used: model,
      }).then(() => {});
      // Legacy potus_chat
      supabase.from("potus_chat").insert({ user_id: userId, message: fullContent, role: "assistant", platform }).then(() => {});

      // Memory persistence + entity extraction
      persistMemory(supabase, userId, agentType, message).catch(() => {});
      extractAndPersistEntities(userId, message, fullContent, conversationId).catch(() => {});

      // Ingest jobs
      supabase.from("jarvis_ingestion_jobs").insert([
        { user_id: userId, source_type: "jarvis_chat", source_table: "jarvis_messages", status: "pending" },
      ]).then(() => {}).catch((e: any) => console.warn("[unified] ingestion job error:", e));

      // Webhook callers get JSON
      if (body.user_id && platform !== "web") {
        return new Response(JSON.stringify({ success: true, response: fullContent, specialist: agentType, platform }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Web callers get SSE
      const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: fullContent } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sseData, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    throw new Error("No response from LLM");
  } catch (e) {
    console.error("[unified] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper: collect streamed response and return as JSON (for webhook callers)
async function collectAndReturnJSON(
  llmResponse: Response, userId: string, mode: string, specialist: string,
  toolsUsed: string[], conversationId: string | null, supabase: any, model: string,
): Promise<Response> {
  const reader = llmResponse.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (const line of buffer.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try { const p = JSON.parse(jsonStr); const d = p.choices?.[0]?.delta?.content; if (d) fullContent += d; } catch { /* partial */ }
    }
    buffer = "";
  }

  if (fullContent) {
    if (conversationId) {
      await supabase.from("jarvis_messages").insert({
        conversation_id: conversationId, user_id: userId,
        role: mode === "proactive" ? "proactive" : "assistant",
        content: fullContent, specialist, tools_used: toolsUsed, meta: { model },
      }).catch(() => {});
    }
    await supabase.from("agent_chat_messages").insert({
      user_id: userId, role: mode === "proactive" ? "proactive" : "assistant",
      content: fullContent, model_used: model,
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ success: true, response: fullContent, specialist, platform: "webhook" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
