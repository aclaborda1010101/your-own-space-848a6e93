import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── AI Provider Callers ──

interface AIResult { content: string; tokens_in: number; tokens_out: number }

async function callAnthropic(system: string, user: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const d = await res.json();
  const text = d.content?.find((b: any) => b.type === "text")?.text || "";
  return { content: text, tokens_in: d.usage?.input_tokens || 0, tokens_out: d.usage?.output_tokens || 0 };
}

async function callOpenAI(system: string, user: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return { content: d.choices?.[0]?.message?.content || "", tokens_in: d.usage?.prompt_tokens || 0, tokens_out: d.usage?.completion_tokens || 0 };
}

async function callGoogle(system: string, user: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  const key = Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GOOGLE_AI_API_KEY not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  const d = await res.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const u = d.usageMetadata || {};
  return { content: text, tokens_in: u.promptTokenCount || 0, tokens_out: u.candidatesTokenCount || 0 };
}

async function callDeepseek(system: string, user: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) throw new Error("DEEPSEEK_API_KEY not set");
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return { content: d.choices?.[0]?.message?.content || "", tokens_in: d.usage?.prompt_tokens || 0, tokens_out: d.usage?.completion_tokens || 0 };
}

function callProvider(provider: string, system: string, user: string, model: string, maxTokens: number, temperature: number): Promise<AIResult> {
  switch (provider) {
    case "anthropic": return callAnthropic(system, user, model, maxTokens, temperature);
    case "openai": return callOpenAI(system, user, model, maxTokens, temperature);
    case "google": return callGoogle(system, user, model, maxTokens, temperature);
    case "deepseek": return callDeepseek(system, user, model, maxTokens, temperature);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── System Prompts ──

const PROMPTS: Record<string, string> = {
  classify: `You are a project classifier. Analyze the idea and return ONLY valid JSON with these fields:
{
  "project_type": "saas|marketplace|api|mobile_app|ai_tool|hardware|content|other",
  "technical_depth": "low|medium|high|expert",
  "needs_code": true/false,
  "complexity_score": 1-10,
  "recommended_pipeline": "fast_validation|standard|deep_technical|research",
  "hallucination_risk": "low|medium|high",
  "market_uncertainty": "low|medium|high",
  "confidence": 0.0-1.0
}`,

  step_1: `You are a world-class technical architect and startup strategist. Given an idea, generate a COMPLETE technical document with these 12 sections:
1. Executive Summary (problem, solution, value prop)
2. Target Market & User Personas (TAM/SAM/SOM with sources)
3. Competitive Analysis (direct, indirect, substitutes)
4. Business Model & Revenue Streams
5. Technical Architecture (stack, infra, diagrams in text)
6. MVP Feature Set (MoSCoW prioritization)
7. Development Roadmap (phases with timelines)
8. Go-to-Market Strategy
9. Financial Projections (18 months, unit economics)
10. Risk Assessment & Mitigation
11. Team Requirements
12. Success Metrics & KPIs
Be thorough, specific, and data-driven. No fluff.`,

  step_2: `You are a ruthless startup critic and technical auditor. Your job is to DESTROY weak ideas and STRENGTHEN good ones. For the document provided:
- Question EVERY number. Where did TAM/SAM/SOM come from? Are they real or hallucinated?
- Detect unvalidated assumptions. Mark each with [ASSUMPTION] tag
- Simplify the MVP brutally. What's the TRUE minimum?
- Assign confidence scores (0-100%) to each section
- Detect "technical smoke" - impressive-sounding but empty technical claims
- Find logical contradictions between sections
- Challenge timelines - are they realistic?
- Rate financial projections credibility
Be direct, uncomfortable, and honest. No diplomatic language. If something is BS, say it.`,

  step_3: `You are a visionary strategist specializing in Blue Ocean Strategy and exponential thinking. Analyze this project and provide:
- Blue Ocean ERIC Grid (Eliminate, Reduce, Increase, Create)
- Hidden opportunities the architect missed
- Network effects potential and how to engineer them
- Growth hacks specific to this type of product
- AI-first reimagination - how would this look if built AI-native?
- Unconventional monetization angles
- Platform/ecosystem evolution path
- Potential pivots if the main thesis fails
Think 10x, not 10%. Be creative but grounded.`,

  step_4: `You are a senior infrastructure engineer with 20+ years experience. Deep-dive into technical viability:
- Real infrastructure costs (AWS/GCP/Azure pricing, not estimates)
- Alternative tech stacks with pros/cons
- Technical debt traps to avoid from day 1
- Minimum viable team (roles, seniority, cost)
- Time-to-market realistic assessment
- Scalability bottlenecks and solutions
- Security considerations and compliance requirements
- CI/CD and DevOps recommendations
- Code architecture patterns recommended
- Third-party dependencies and vendor lock-in risks
Provide actual numbers, not ranges. Include code snippets where relevant.`,

  quality_gate: `You are a quality assurance evaluator for business documents. Evaluate the accumulated analysis and return ONLY valid JSON:
{
  "coherence": { "score": 0-100, "issues": ["..."] },
  "technical_viability": { "score": 0-100, "issues": ["..."] },
  "market_plausibility": { "score": 0-100, "issues": ["..."] },
  "hallucination_risk": { "score": 0-100, "detected": ["..."] },
  "ready_for_consolidation": true/false,
  "recommended_action": "proceed|revise_step_X|abort",
  "overall_score": 0-100
}
Be strict. Only pass if overall_score >= 60 and no critical issues.`,

  step_5: `You are a master document consolidator. Synthesize ALL previous analyses into a single, professional mega-document. Structure:

# [Project Name] - Complete Analysis Report

## Executive Summary (improved with critic feedback)
## 1-12. All original sections, enhanced with:
  - Critic's confidence scores and addressed concerns
  - Visionary's opportunities integrated
  - Engineer's technical reality checks applied
## 13. Blue Ocean Strategy (from visionary)
## 14. Technical Deep-Dive (from engineer)
## 15. Risk Matrix (consolidated from all perspectives)
## 16. Final Recommendation & Next Steps
## 17. Quality Assessment Summary

Make it cohesive, professional, and actionable. Remove contradictions. Keep the best insights from each perspective.`,
};

// ── Default step configs ──
const DEFAULT_STEPS: Record<string, { provider: string; model: string; maxTokens: number; temperature: number }> = {
  classify:     { provider: "google", model: "gemini-2.0-flash", maxTokens: 1000, temperature: 0.3 },
  step_1:       { provider: "anthropic", model: "claude-sonnet-4-20250514", maxTokens: 8000, temperature: 0.7 },
  step_2:       { provider: "anthropic", model: "claude-sonnet-4-20250514", maxTokens: 6000, temperature: 0.8 },
  step_3:       { provider: "google", model: "gemini-2.0-flash", maxTokens: 6000, temperature: 0.9 },
  step_4:       { provider: "openai", model: "gpt-4o", maxTokens: 6000, temperature: 0.6 },
  quality_gate: { provider: "google", model: "gemini-2.0-flash", maxTokens: 2000, temperature: 0.3 },
  step_5:       { provider: "anthropic", model: "claude-sonnet-4-20250514", maxTokens: 12000, temperature: 0.5 },
};

// ── Handlers ──

async function handleCreate(body: any) {
  const { idea, idea_title, config, user_id } = body;
  if (!idea) throw new Error("idea is required");
  const { data, error } = await supabase.from("pipeline_runs").insert({
    idea,
    idea_title: idea_title || idea.substring(0, 80),
    config: config || DEFAULT_STEPS,
    user_id: user_id || null,
    status: "created",
    pipeline_version: "v3",
    step_results: {},
    tokens_used: {},
  }).select("id").single();
  if (error) throw error;
  return { pipeline_id: data.id };
}

async function handleExecuteStep(body: any) {
  const { pipeline_id, step } = body;
  if (!pipeline_id || !step) throw new Error("pipeline_id and step required");

  // Load pipeline
  const { data: run, error: loadErr } = await supabase.from("pipeline_runs").select("*").eq("id", pipeline_id).single();
  if (loadErr || !run) throw new Error("Pipeline not found");

  const config = (run.config as any)?.[step] || DEFAULT_STEPS[step];
  if (!config) throw new Error(`Unknown step: ${step}`);

  const systemPrompt = PROMPTS[step];
  if (!systemPrompt) throw new Error(`No prompt for step: ${step}`);

  // Build user message with context
  let userMessage = `IDEA: ${run.idea}`;
  const results = (run.step_results || {}) as Record<string, any>;

  if (step === "step_2" && results.step_1) userMessage += `\n\nARCHITECT DOCUMENT:\n${results.step_1.content}`;
  if (step === "step_3") {
    if (results.step_1) userMessage += `\n\nARCHITECT:\n${results.step_1.content}`;
    if (results.step_2) userMessage += `\n\nCRITIC:\n${results.step_2.content}`;
  }
  if (step === "step_4") {
    if (results.step_1) userMessage += `\n\nARCHITECT:\n${results.step_1.content}`;
    if (results.step_2) userMessage += `\n\nCRITIC:\n${results.step_2.content}`;
  }
  if (step === "quality_gate") {
    for (const k of ["step_1", "step_2", "step_3", "step_4"]) {
      if (results[k]) userMessage += `\n\n${k.toUpperCase()}:\n${results[k].content}`;
    }
  }
  if (step === "step_5") {
    for (const k of ["step_1", "step_2", "step_3", "step_4", "quality_gate"]) {
      if (results[k]) userMessage += `\n\n${k.toUpperCase()}:\n${results[k].content}`;
    }
  }
  if (run.classification && step !== "classify") {
    userMessage += `\n\nCLASSIFICATION: ${JSON.stringify(run.classification)}`;
  }

  // Update status
  await supabase.from("pipeline_runs").update({ status: `running_${step}`, current_step: stepToNumber(step) }).eq("id", pipeline_id);

  const startTime = Date.now();
  const result = await callProvider(config.provider, systemPrompt, userMessage, config.model, config.maxTokens, config.temperature);
  const elapsed = Date.now() - startTime;

  // Accumulate results
  results[step] = { content: result.content, tokens_in: result.tokens_in, tokens_out: result.tokens_out, model: config.model, provider: config.provider, elapsed_ms: elapsed };

  const tokens = (run.tokens_used || {}) as Record<string, any>;
  tokens[step] = { input: result.tokens_in, output: result.tokens_out };

  const update: Record<string, any> = { step_results: results, tokens_used: tokens, status: `completed_${step}` };

  if (step === "classify") {
    try { update.classification = JSON.parse(cleanJson(result.content)); } catch { update.classification = { raw: result.content }; }
  }
  if (step === "quality_gate") {
    try {
      const qg = JSON.parse(cleanJson(result.content));
      update.quality_gate_result = qg;
      update.quality_gate_passed = qg.ready_for_consolidation === true && (qg.overall_score || 0) >= 60;
    } catch { update.quality_gate_result = { raw: result.content }; update.quality_gate_passed = false; }
  }
  if (step === "step_5") {
    update.final_document = result.content;
    update.status = "completed";
    update.completed_at = new Date().toISOString();
  }

  await supabase.from("pipeline_runs").update(update).eq("id", pipeline_id);

  return { step, status: update.status, tokens_in: result.tokens_in, tokens_out: result.tokens_out, elapsed_ms: elapsed };
}

async function handleStatus(body: any) {
  const { pipeline_id } = body;
  if (!pipeline_id) throw new Error("pipeline_id required");
  const { data, error } = await supabase.from("pipeline_runs").select("*").eq("id", pipeline_id).single();
  if (error) throw error;
  return data;
}

async function handlePresets(body: any) {
  const { user_id } = body;
  let query = supabase.from("pipeline_presets").select("*");
  if (user_id) query = query.or(`is_system.eq.true,user_id.eq.${user_id}`);
  else query = query.eq("is_system", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ── Helpers ──
function stepToNumber(step: string): number {
  const map: Record<string, number> = { classify: 0, step_1: 1, step_2: 2, step_3: 3, step_4: 4, quality_gate: 5, step_5: 6 };
  return map[step] ?? -1;
}

function cleanJson(s: string): string {
  let c = s.trim();
  if (c.startsWith("```json")) c = c.slice(7);
  else if (c.startsWith("```")) c = c.slice(3);
  if (c.endsWith("```")) c = c.slice(0, -3);
  c = c.trim();
  const i = c.indexOf("{"), j = c.lastIndexOf("}");
  if (i !== -1 && j > i) c = c.slice(i, j + 1);
  return c;
}

// ── Main ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;
    let result;

    switch (action) {
      case "create": result = await handleCreate(body); break;
      case "execute_step": result = await handleExecuteStep(body); break;
      case "status": result = await handleStatus(body); break;
      case "presets": result = await handlePresets(body); break;
      default: throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("idea-pipeline-step error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
