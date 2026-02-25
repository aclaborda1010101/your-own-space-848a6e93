import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chat, ChatMessage } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

async function updateRag(ragId: string, updates: Record<string, unknown>) {
  const { error } = await supabase
    .from("rag_projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", ragId);
  if (error) console.error("updateRag error:", error);
}

function cleanJson(text: string): string {
  let c = text.trim();
  if (c.startsWith("```json")) c = c.slice(7);
  else if (c.startsWith("```")) c = c.slice(3);
  if (c.endsWith("```")) c = c.slice(0, -3);
  c = c.trim();
  const s = c.indexOf("{");
  const e = c.lastIndexOf("}");
  if (s !== -1 && e > s) c = c.slice(s, e + 1);
  c = c.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
  c = c.replace(/[\x00-\x1F\x7F]/g, " ");
  return c.trim();
}

function safeParseJson(text: string): unknown {
  const cleaned = cleanJson(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    let repaired = cleaned;
    const ob = (repaired.match(/{/g) || []).length;
    const cb = (repaired.match(/}/g) || []).length;
    const oq = (repaired.match(/\[/g) || []).length;
    const cq = (repaired.match(/]/g) || []).length;
    repaired = repaired.replace(/,\s*"[^"]*$/, "").replace(/,\s*$/, "");
    for (let i = 0; i < oq - cq; i++) repaired += "]";
    for (let i = 0; i < ob - cb; i++) repaired += "}";
    return JSON.parse(repaired);
  }
}

async function chatWithTimeout(
  messages: ChatMessage[],
  options: Record<string, unknown>,
  timeoutMs = 50000
): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`LLM timeout after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([chat(messages, options), timeoutPromise]);
}

// ═══════════════════════════════════════
// REAL RAG HELPERS
// ═══════════════════════════════════════

/** Search real sources via Perplexity sonar-pro */
async function searchWithPerplexity(query: string, level: string): Promise<{ content: string; citations: string[] }> {
  if (!PERPLEXITY_API_KEY) {
    console.warn("PERPLEXITY_API_KEY not set, skipping real search");
    return { content: "", citations: [] };
  }

  const levelHints: Record<string, string> = {
    surface: "overview introductory guide",
    academic: "peer-reviewed research papers studies",
    datasets: "datasets statistics data reports",
    multimedia: "video tutorials educational resources",
    community: "forums discussions community experiences",
    frontier: "latest research preprints cutting-edge",
    lateral: "interdisciplinary cross-domain perspectives",
  };

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: `Eres un investigador académico. Busca las fuentes más relevantes y fiables. Nivel de búsqueda: ${level} (${levelHints[level] || level}). Proporciona información detallada y cita todas las fuentes.`,
        },
        { role: "user", content: query },
      ],
      return_citations: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Perplexity error:", response.status, errText);
    return { content: "", citations: [] };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const citations: string[] = data.citations || [];
  return { content, citations };
}

/** Scrape a URL via Firecrawl, returns markdown */
async function scrapeUrl(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) {
    return await directFetch(url);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Firecrawl failed for ${url}: ${response.status}`);
      return await directFetch(url);
    }

    const data = await response.json();
    return data.data?.markdown || data.markdown || "";
  } catch (err) {
    console.warn(`Firecrawl error for ${url}:`, err);
    return await directFetch(url);
  }
}

/** Direct fetch fallback with basic HTML stripping */
async function directFetch(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { "User-Agent": "JarvisRAGBot/1.0 (research)" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return "";
    const html = await response.text();
    return stripHtmlBasic(html);
  } catch {
    return "";
  }
}

/** Basic HTML stripping — improved */
function stripHtmlBasic(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/\s(class|id|style|data-[\w-]+)="[^"]*"/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(/\s+/);
  if (words.length > 5000) text = words.slice(0, 5000).join(" ");
  return text;
}

/** Generate specific academic queries for a subdomain */
function getAcademicQueries(subdomain: string, domain: string, level: string): string[] {
  const academicSuffix = level === "frontier" ? "recent advances" : "peer-reviewed";
  const baseQuery = `${subdomain} ${domain} ${academicSuffix}`;
  
  const specificQueries: Record<string, string[]> = {
    'emotional_regulation': [
      'emotional regulation preschool children strategies',
      'self-regulation development early childhood',
      'emotion coaching Gottman children outcomes',
      'Shanker self-reg model young children',
    ],
    'regulacion_emocional': [
      'emotional regulation preschool children strategies',
      'emotion coaching Gottman children outcomes',
      'self-regulation development early childhood',
    ],
    'attachment_theory': [
      'attachment security preschool behavior outcomes',
      'Bowlby attachment theory longitudinal study',
      'parent-child attachment emotional development',
    ],
    'apego': [
      'attachment security preschool behavior outcomes',
      'Bowlby attachment theory longitudinal study',
    ],
    'developmental_psychology': [
      'cognitive development 4-5 years milestones',
      'executive function preschool children development',
      'theory of mind development age 5',
    ],
    'desarrollo_cognitivo': [
      'cognitive development 4-5 years milestones',
      'executive function preschool children',
    ],
    'therapeutic_approaches': [
      'play therapy effectiveness children meta-analysis',
      'cognitive behavioral therapy preschool anxiety',
      'Floortime DIR model autism development',
    ],
    'estrategias_terapeuticas': [
      'play therapy effectiveness children meta-analysis',
      'cognitive behavioral therapy preschool anxiety',
    ],
    'educational_methodologies': [
      'Montessori vs traditional preschool outcomes',
      'play-based learning executive function development',
      'positive discipline effectiveness children',
    ],
    'metodologias_educativas': [
      'Montessori vs traditional preschool outcomes',
      'play-based learning executive function',
    ],
    'neurociencia_infantil': [
      'brain development preschool children neuroscience',
      'Daniel Siegel whole brain child neuroscience',
      'prefrontal cortex development emotion regulation children',
    ],
    'temperamento': [
      'child temperament emotional regulation interaction',
      'temperament preschool behavior adjustment',
    ],
    'conducta': [
      'challenging behavior preschool children interventions',
      'tantrums frequency normal development preschool',
      'positive behavior support early childhood',
    ],
    'rabietas': [
      'tantrums frequency normal development preschool',
      'tantrum duration intensity age children Potegal',
    ],
    'crianza_positiva': [
      'positive parenting preschool children outcomes',
      'authoritative parenting emotional development',
      'Laura Markham peaceful parenting research',
    ],
  };

  const subLower = subdomain.toLowerCase().replace(/\s+/g, '_');
  const queries = specificQueries[subLower] ? [...specificQueries[subLower]] : [baseQuery];
  
  if (!queries.includes(baseQuery)) queries.push(baseQuery);

  return queries;
}

/** Key authors for child development / psychology domains */
const KEY_AUTHOR_QUERIES = [
  'Daniel Siegel whole brain child',
  'John Gottman emotion coaching children',
  'Stuart Shanker self-reg',
  'Bruce Perry developmental trauma children',
  'Jane Nelsen positive discipline',
  'Adele Faber how talk children listen',
  'Ross Greene explosive child',
];

/** Search academic papers via Semantic Scholar API — EXPANDED with dynamic queries + domain map */
async function searchWithSemanticScholar(
  subdomain: string,
  domain: string,
  level: string,
  domainMap?: Record<string, unknown>
): Promise<{ papers: Array<{ title: string; abstract: string; url: string; year: number; citations: number; doi?: string; pubmedUrl?: string; pdfUrl?: string }>; urls: string[] }> {
  const queries = getAcademicQueries(subdomain, domain, level);
  const allPapers: Array<{ title: string; abstract: string; url: string; year: number; citations: number; doi?: string; pubmedUrl?: string; pdfUrl?: string }> = [];
  const seenTitles = new Set<string>();

  // Dynamic queries from domain map
  if (domainMap) {
    const subdomains = (domainMap as Record<string, unknown>).subdomains as Array<Record<string, unknown>> || [];
    for (const sub of subdomains) {
      const keyAuthors = (sub.key_authors as string[]) || [];
      for (const author of keyAuthors.slice(0, 3)) {
        const authorQuery = `${author} ${subdomain}`;
        if (!queries.includes(authorQuery)) queries.push(authorQuery);
      }
      const works = (sub.fundamental_works as string[]) || [];
      for (const work of works.slice(0, 2)) {
        if (!queries.includes(work)) queries.push(work);
      }
    }
  }

  // Add technical variation queries
  const technicalSuffixes = ["systematic review", "meta-analysis", "longitudinal study", "intervention effectiveness"];
  for (const suffix of technicalSuffixes) {
    const techQuery = `${subdomain} ${domain} ${suffix}`;
    if (!queries.includes(techQuery)) queries.push(techQuery);
  }

  // Frontier: add recency queries
  if (level === "frontier") {
    queries.push(`${subdomain} 2024 2025 recent advances`);
    queries.push(`${subdomain} preprint emerging research`);
  }

  // Cap at 10 queries max
  const finalQueries = queries.slice(0, 10);

  for (const query of finalQueries) {
    console.log(`[SemanticScholar] Searching: "${query}"`);
    const result = await searchSemanticScholarSingle(query);
    for (const paper of result.papers) {
      const titleKey = paper.title.toLowerCase().trim();
      if (!seenTitles.has(titleKey)) {
        seenTitles.add(titleKey);
        allPapers.push(paper);
      }
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  // Author queries for child dev domains
  const domainLower = domain.toLowerCase();
  if (domainLower.includes('emocional') || domainLower.includes('hijo') || domainLower.includes('niño') || 
      domainLower.includes('child') || domainLower.includes('parent') || domainLower.includes('crianza') ||
      domainLower.includes('desarrollo') || domainLower.includes('psicolog')) {
    for (const authorQuery of KEY_AUTHOR_QUERIES) {
      console.log(`[SemanticScholar] Author search: "${authorQuery}"`);
      const result = await searchSemanticScholarSingle(authorQuery);
      for (const paper of result.papers) {
        const titleKey = paper.title.toLowerCase().trim();
        if (!seenTitles.has(titleKey)) {
          seenTitles.add(titleKey);
          allPapers.push(paper);
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  allPapers.sort((a, b) => {
    const aScore = a.citations * (1 + (a.year - 2010) * 0.1);
    const bScore = b.citations * (1 + (b.year - 2010) * 0.1);
    return bScore - aScore;
  });

  const topPapers = allPapers.slice(0, 30);
  const urls = topPapers.map((p) => p.url).filter(Boolean);
  console.log(`[SemanticScholar] Total unique papers: ${allPapers.length}, returning top ${topPapers.length}`);

  return { papers: topPapers, urls };
}

/** Single Semantic Scholar query with pagination (up to 3 pages) */
async function searchSemanticScholarSingle(
  query: string
): Promise<{ papers: Array<{ title: string; abstract: string; url: string; year: number; citations: number; doi?: string; pubmedUrl?: string; pdfUrl?: string }>; urls: string[] }> {
  const allResults: Array<{ title: string; abstract: string; url: string; year: number; citations: number; doi?: string; pubmedUrl?: string; pdfUrl?: string }> = [];
  const maxPages = 3;

  for (let page = 0; page < maxPages; page++) {
    const offset = page * 20;
    const params = new URLSearchParams({
      query,
      limit: "20",
      offset: String(offset),
      fields: "title,abstract,url,year,citationCount,externalIds,openAccessPdf",
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (response.status === 429) {
        console.warn("[SemanticScholar] Rate limited, waiting 5s and retrying...");
        await new Promise((r) => setTimeout(r, 5000));
        const retry = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`);
        if (!retry.ok) {
          console.error("[SemanticScholar] Retry failed:", retry.status);
          break;
        }
        const retryData = await retry.json();
        const pageResult = processSemanticScholarResults(retryData);
        allResults.push(...pageResult.papers);
        if (pageResult.papers.length < 20) break;
      } else if (!response.ok) {
        const errText = await response.text();
        console.error("[SemanticScholar] Error:", response.status, errText);
        break;
      } else {
        const data = await response.json();
        const pageResult = processSemanticScholarResults(data);
        allResults.push(...pageResult.papers);
        if (pageResult.papers.length < 20) break;
      }

      // Delay between pages
      if (page < maxPages - 1) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    } catch (err) {
      console.error("[SemanticScholar] Fetch error:", err);
      break;
    }
  }

  const urls = allResults.map((p) => p.url).filter(Boolean);
  return { papers: allResults, urls };
}

function processSemanticScholarResults(data: Record<string, unknown>): {
  papers: Array<{ title: string; abstract: string; url: string; year: number; citations: number; doi?: string; pubmedUrl?: string; pdfUrl?: string }>;
  urls: string[];
} {
  const rawPapers = (data.data as Array<Record<string, unknown>>) || [];

  const filtered = rawPapers
    .filter((p) => {
      const citations = (p.citationCount as number) || 0;
      const year = (p.year as number) || 0;
      return citations > 3 && year > 2010 && p.abstract;
    })
    .sort((a, b) => {
      const aCit = (a.citationCount as number) || 0;
      const bCit = (b.citationCount as number) || 0;
      const aYear = (a.year as number) || 2010;
      const bYear = (b.year as number) || 2010;
      const aScore = aCit * (1 + (aYear - 2010) * 0.1);
      const bScore = bCit * (1 + (bYear - 2010) * 0.1);
      return bScore - aScore;
    })
    .slice(0, 20);

  const papers = filtered.map((p) => {
    const externalIds = (p.externalIds as Record<string, string>) || {};
    const doi = externalIds.DOI ? `https://doi.org/${externalIds.DOI}` : undefined;
    const pubmedId = externalIds.PubMed;
    const pubmedUrl = pubmedId ? `https://pubmed.ncbi.nlm.nih.gov/${pubmedId}/` : undefined;
    const bestUrl = doi || pubmedUrl || (p.url as string) || "";
    const openAccessPdf = p.openAccessPdf as Record<string, string> | null;
    const pdfUrl = openAccessPdf?.url || undefined;

    return {
      title: (p.title as string) || "",
      abstract: (p.abstract as string) || "",
      url: bestUrl,
      year: (p.year as number) || 0,
      citations: (p.citationCount as number) || 0,
      doi,
      pubmedUrl,
      pdfUrl,
    };
  });

  const urls = papers.map((p) => p.url).filter(Boolean);
  console.log(`[SemanticScholar] Found ${rawPapers.length} total, ${filtered.length} after filter, returning ${papers.length} papers`);

  return { papers, urls };
}

// ═══════════════════════════════════════
// UPGRADE 3: Fetch full paper PDF text
// ═══════════════════════════════════════

async function fetchFullPaperText(pdfUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    
    const response = await fetch(pdfUrl, {
      headers: { "User-Agent": "JarvisRAGBot/1.0 (academic-research)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (!response.ok) return "";
    
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("pdf")) {
      // Use Gemini to extract text from PDF via URL description
      // Since we can't process binary PDF in edge functions easily,
      // we'll use the text from the response if it's not binary
      console.log(`[PDF] Got PDF response from ${pdfUrl}, attempting text extraction`);
      // For now, try to get any text content
      const text = await response.text();
      // If it looks like actual text (not binary), use it
      if (text.length > 100 && !text.includes('\x00') && text.length < 500000) {
        return text.slice(0, 50000);
      }
      return "";
    }
    
    // If it redirected to an HTML page, strip HTML
    const html = await response.text();
    if (html.length > 500) {
      return stripHtmlBasic(html).slice(0, 50000);
    }
    return "";
  } catch (err) {
    console.warn(`[PDF] Failed to fetch ${pdfUrl}:`, err);
    return "";
  }
}

/** Clean scraped/markdown content before chunking — AGGRESSIVE version */
function cleanScrapedContent(text: string): string {
  let cleaned = text;

  const junkBlockPatterns = [
    /(?:menu|nav|footer|sidebar|header|cookie|newsletter|subscribe|advertisement|share this|related posts|te puede interesar|artículos relacionados|categorías|etiquetas|tags|comments|deja un comentario|leave a reply|related articles|more from|popular posts|trending|most read|también te puede interesar|publicidad|anuncio|sponsored)[\s\S]{0,500}/gi,
    /(?:follow us|síguenos|redes sociales|facebook|twitter|instagram|linkedin|youtube|pinterest|whatsapp|compartir en|share on|tweet this|pin it|send email)[\s\S]{0,200}/gi,
    /(?:privacy policy|política de privacidad|terms of service|aviso legal|cookies?|GDPR|protección de datos|data protection)[\s\S]{0,300}/gi,
    /(?:you will receive|suscríbete|subscribe|sign up|regístrate|join our|get updates|stay informed|don't miss|no te pierdas)[\s\S]{0,200}/gi,
    /(?:skip to content|saltar al contenido|breadcrumb|tabla de contenidos|table of contents|search\.\.\.|buscar\.\.\.)[\s\S]{0,100}/gi,
    /(?:copyright|©|all rights reserved|todos los derechos|designed by|powered by|built with)[\s\S]{0,200}/gi,
  ];

  for (const pattern of junkBlockPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  cleaned = cleaned.replace(/(?<!\(|Source:\s|Fuente:\s|DOI:\s|PubMed:\s)https?:\/\/\S+(?!\))/g, '');

  let lines = cleaned.split("\n");

  lines = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return true;
    if (trimmed.length < 40 && !trimmed.includes('.') && !trimmed.includes(':')) return false;
    return true;
  });

  lines = lines.filter((line) => !/^#{4,}\s*$/.test(line.trim()));
  lines = lines.filter((line) => !/^[\s\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}•·→←↑↓★☆✓✗✔✕▪▫●○◆◇|_\-=~*]+$/u.test(line.trim()));
  lines = lines.filter((line) => !/^\s*\|.*\|.*\|\s*$/.test(line.trim()) || line.trim().length > 100);

  let result = lines.join("\n");
  result = result.replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, ' ').trim();

  if (result.length < 200) return '';

  return result;
}

/** Generate embedding via OpenAI text-embedding-3-small */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const truncated = text.slice(0, 32000);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncated,
      dimensions: 1024,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI embedding error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/** Chunk real content using Gemini (organize, NOT invent) */
async function chunkRealContent(
  content: string,
  subdomain: string,
  level: string
): Promise<Array<{ content: string; summary: string; concepts: string[]; title?: string; age_range?: string; source_type?: string }>> {
  if (!content || content.trim().length < 100) return [];

  const cleaned = cleanScrapedContent(content);
  if (cleaned.length < 100) return [];

  const truncated = cleaned.slice(0, 30000);

  let chunks: Array<{ content: string; summary: string; concepts: string[]; title?: string; age_range?: string; source_type?: string }> = [];

  try {
    const result = await chatWithTimeout(
      [
        {
          role: "system",
          content: `Eres un organizador de conocimiento experto.

REGLAS ABSOLUTAS:
1. SOLO usa la información del contenido proporcionado. NO inventes NADA.
2. Cada chunk = UN concepto, UNA idea, UNA recomendación. NO mezclar temas diferentes en un chunk.
3. Tamaño: 150-400 palabras por chunk. Si un concepto necesita más, divídelo en sub-chunks.
4. DEBES generar entre 5 y 15 chunks. NUNCA devuelvas solo 1 chunk.
5. Si el contenido no tiene información útil, devuelve un array vacío [].
6. NUNCA generes conocimiento que no esté en el texto proporcionado.
7. Mantén datos, cifras, nombres y referencias exactos del texto original.
8. Cada chunk debe ser autocontenido (comprensible sin leer otros chunks).

IDIOMA: Genera TODOS los chunks en ESPAÑOL.
- Si el contenido original está en inglés u otro idioma, tradúcelo al español.
- Mantén los términos técnicos originales entre paréntesis. Ejemplo: "La regulación emocional (emotional regulation) es..."
- Mantén las citas de autores en su idioma original: "(Gottman, 1997)", "(Siegel & Bryson, 2011)"
- Los nombres de teorías o modelos se mantienen en su idioma original entre paréntesis si no tienen traducción estándar.

ESTRUCTURA OBLIGATORIA por chunk:
- title: Título descriptivo del concepto (máx 10 palabras, en español)
- content: Texto del chunk (150-400 palabras, en español)
- concepts: Array de conceptos clave extraídos
- age_range: Rango de edad si aplica (ej: "4-6 años"), o null
- source_type: "academic" | "clinical_guide" | "practical" | "divulgation"

Devuelve SOLO un JSON array (sin wrapper):
[{"title": "Título descriptivo", "content": "texto del chunk en español", "summary": "resumen de 1 línea", "concepts": ["concepto1", "concepto2"], "age_range": "4-6 años", "source_type": "academic"}]`,
        },
        {
          role: "user",
          content: `Subdominio: ${subdomain}\nNivel: ${level}\n\nContenido descargado:\n\n${truncated}`,
        },
      ],
      { model: "gemini-pro", maxTokens: 8192, temperature: 0.1, responseFormat: "json" },
      50000
    );

    let cleanedResult = result.trim();
    if (cleanedResult.startsWith("```json")) cleanedResult = cleanedResult.slice(7);
    if (cleanedResult.startsWith("```")) cleanedResult = cleanedResult.slice(3);
    if (cleanedResult.endsWith("```")) cleanedResult = cleanedResult.slice(0, -3);
    cleanedResult = cleanedResult.trim();

    let parsed: unknown;
    if (cleanedResult.startsWith("[")) {
      parsed = JSON.parse(cleanedResult);
    } else {
      const obj = safeParseJson(cleanedResult) as Record<string, unknown>;
      parsed = obj.chunks || obj.data || Object.values(obj)[0];
    }

    if (Array.isArray(parsed)) {
      chunks = parsed.map((c: Record<string, unknown>) => ({
        content: (c.content as string) || "",
        summary: (c.summary as string) || (c.title as string) || "",
        concepts: (c.concepts as string[]) || [],
        title: (c.title as string) || undefined,
        age_range: (c.age_range as string) || undefined,
        source_type: (c.source_type as string) || undefined,
      }));
    }
  } catch (err) {
    console.error("chunkRealContent parse error:", err);
  }

  console.log(`[chunkRealContent] Gemini returned ${chunks.length} chunks for ${subdomain}/${level} (content length: ${truncated.length})`);

  if (chunks.length < 3 && truncated.length > 1000) {
    console.log(`[chunkRealContent] Applying mechanical fallback for ${subdomain}/${level}`);
    chunks = mechanicalChunk(truncated, subdomain);
  }

  return chunks;
}

/** Mechanical chunking fallback: split by paragraphs, group to ~400 words */
function mechanicalChunk(text: string, subdomain: string): Array<{ content: string; summary: string; concepts: string[] }> {
  const paragraphs = text.split(/\n{2,}|---+/).filter((p) => p.trim().length > 30);

  const chunks: Array<{ content: string; summary: string; concepts: string[] }> = [];
  let currentGroup: string[] = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).length;
    currentGroup.push(para.trim());
    currentWordCount += words;

    if (currentWordCount >= 350) {
      const content = currentGroup.join("\n\n");
      const firstSentence = content.match(/^[^.!?]+[.!?]/)?.[0] || content.slice(0, 100);
      chunks.push({
        content,
        summary: firstSentence.trim(),
        concepts: [subdomain],
      });
      currentGroup = [];
      currentWordCount = 0;
    }
  }

  if (currentGroup.length > 0) {
    const content = currentGroup.join("\n\n");
    if (content.trim().length > 50) {
      const firstSentence = content.match(/^[^.!?]+[.!?]/)?.[0] || content.slice(0, 100);
      chunks.push({
        content,
        summary: firstSentence.trim(),
        concepts: [subdomain],
      });
    }
  }

  console.log(`[mechanicalChunk] Produced ${chunks.length} chunks from ${text.length} chars`);
  return chunks.length > 0 ? chunks : [{ content: text.slice(0, 2000), summary: `${subdomain} content`, concepts: [subdomain] }];
}

// ═══════════════════════════════════════
// UPGRADE 1: RERANKING WITH GEMINI
// ═══════════════════════════════════════

async function rerankChunks(
  question: string,
  chunks: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (chunks.length <= 5) return chunks;

  try {
    const chunkSummaries = chunks.map((c, i) => 
      `[${i}] ${(c.content as string).slice(0, 300)}`
    ).join("\n\n");

    const result = await chatWithTimeout(
      [
        {
          role: "system",
          content: `Eres un evaluador de relevancia. Dada una pregunta y una lista de fragmentos de texto, puntúa la relevancia de cada fragmento para responder la pregunta.

Devuelve SOLO un JSON array con los índices y puntuaciones:
[{"index": 0, "score": 8}, {"index": 1, "score": 3}, ...]

Puntuación 0-10 donde:
- 10 = directamente responde la pregunta con datos concretos
- 7-9 = muy relevante, contiene información clave
- 4-6 = parcialmente relevante
- 1-3 = tangencialmente relacionado
- 0 = irrelevante`,
        },
        {
          role: "user",
          content: `Pregunta: ${question}\n\nFragmentos:\n${chunkSummaries}`,
        },
      ],
      { model: "gemini-flash", maxTokens: 2048, temperature: 0, responseFormat: "json" },
      15000
    );

    let parsed: unknown;
    const cleaned = result.trim();
    if (cleaned.startsWith("[")) {
      parsed = JSON.parse(cleaned);
    } else {
      const obj = safeParseJson(cleaned) as Record<string, unknown>;
      parsed = obj.scores || obj.rankings || obj.results || Object.values(obj)[0];
    }

    if (Array.isArray(parsed)) {
      const scored = parsed as Array<{ index: number; score: number }>;
      scored.sort((a, b) => (b.score || 0) - (a.score || 0));
      const topIndices = scored.slice(0, 5).map(s => s.index);
      return topIndices
        .filter(i => i >= 0 && i < chunks.length)
        .map(i => chunks[i]);
    }
  } catch (err) {
    console.warn("[Reranking] Failed, using original order:", err);
  }

  return chunks.slice(0, 5);
}

// ═══════════════════════════════════════
// MORAL MODE PROMPTS
// ═══════════════════════════════════════

function getMoralPrompt(mode: string): string {
  switch (mode) {
    case "estandar":
      return "Usa SOLO fuentes legales, públicas, con licencia.";
    case "profundo":
      return "Busca con profundidad máxima: preprints, patentes, tesis doctorales, datos gubernamentales.";
    case "total":
    default:
      return "EXHAUSTIVIDAD ABSOLUTA. Busca en TODAS las fuentes legales disponibles.";
  }
}

function getBudgetConfig(mode: string): { maxSources: number; maxHours: string; marginalGainThreshold: number } {
  switch (mode) {
    case "estandar":
      return { maxSources: 500, maxHours: "2-3", marginalGainThreshold: 0.05 };
    case "profundo":
      return { maxSources: 2000, maxHours: "3-5", marginalGainThreshold: 0.02 };
    case "total":
    default:
      return { maxSources: 5000, maxHours: "4-8", marginalGainThreshold: 0 };
  }
}

// ═══════════════════════════════════════
// RESEARCH LEVELS
// ═══════════════════════════════════════

const RESEARCH_LEVELS = [
  "surface",
  "academic",
  "datasets",
  "multimedia",
  "community",
  "frontier",
  "lateral",
];

// ═══════════════════════════════════════
// ACTION: CREATE
// ═══════════════════════════════════════

async function handleCreate(userId: string, body: Record<string, unknown>) {
  const { domainDescription, moralMode = "total", projectId } = body;
  if (!domainDescription) throw new Error("domainDescription is required");

  const profileGuess = "general";

  const { data: rag, error } = await supabase
    .from("rag_projects")
    .insert({
      user_id: userId,
      project_id: projectId || null,
      domain_description: domainDescription,
      moral_mode: moralMode,
      build_profile: profileGuess,
      status: "domain_analysis",
    })
    .select()
    .single();

  if (error) throw error;

  // Enqueue DOMAIN_ANALYSIS job instead of running synchronously
  const { error: jobError } = await supabase.from("rag_jobs").insert({
    rag_id: rag.id,
    job_type: "DOMAIN_ANALYSIS",
    payload: {
      domain_description: domainDescription,
      moral_mode: moralMode,
    },
  });
  if (jobError) console.error("Failed to enqueue DOMAIN_ANALYSIS job:", jobError);

  // Fire-and-forget: trigger job runner immediately
  fetch(`${SUPABASE_URL}/functions/v1/rag-job-runner`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ maxJobs: 20, rag_id: rag.id }),
  }).catch(() => {});

  return { ragId: rag.id, status: "domain_analysis", message: `Analizando dominio en modo ${(moralMode as string).toUpperCase()}` };
}

// ═══════════════════════════════════════
// ACTION: ANALYZE_DOMAIN (background)
// ═══════════════════════════════════════

async function analyzeDomain(ragId: string, domain: string, moralMode: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 380_000);

  try {
    await updateRag(ragId, { status: "domain_analysis" });

    const budget = getBudgetConfig(moralMode);
    const moralPrompt = getMoralPrompt(moralMode);

    const systemPrompt = `Eres un equipo de 50 investigadores doctorales obsesivos. Tu misión: analizar un dominio de conocimiento con profundidad EXTREMA.

${moralPrompt}

PRESUPUESTO: ${budget.maxSources} fuentes máx, ${budget.maxHours} horas estimadas.

Debes generar un análisis doctoral completo en formato JSON con EXACTAMENTE esta estructura:
{
  "interpreted_intent": {
    "real_need": "string - qué necesita realmente el usuario",
    "consumer_profile": "string - perfil del consumidor del RAG",
    "primary_questions": ["array de 5-10 preguntas clave que el RAG debe responder"]
  },
  "subdomains": [
    {
      "name_technical": "string",
      "name_colloquial": "string",
      "relevance": "critical|high|medium|low",
      "relevance_note": "string - por qué es relevante",
      "key_authors": ["autor1", "autor2"],
      "fundamental_works": [{"title": "string", "year": 2020, "why": "string"}],
      "estimated_sources": 50
    }
  ],
  "critical_variables": [
    {
      "name": "string",
      "type": "quantitative|qualitative|binary|temporal|categorical",
      "description": "string",
      "importance": "critical|high|medium"
    }
  ],
  "source_categories": [
    {
      "category": "string",
      "tier": "tier1_gold|tier2_silver|tier3_bronze",
      "examples": ["fuente1", "fuente2"],
      "accessibility": "open|restricted|paywalled|underground"
    }
  ],
  "validation_queries": {
    "factual": ["pregunta factual 1", "pregunta factual 2"],
    "analytical": ["pregunta analítica 1"],
    "comparative": ["pregunta comparativa 1"]
  },
  "known_debates": [
    {
      "topic": "string",
      "positions": ["posición A", "posición B"],
      "current_consensus": "string"
    }
  ],
  "recommended_config": {
    "build_profile": "medical|legal|business|creative|general",
    "estimated_chunks": 5000,
    "estimated_time_hours": 4,
    "priority_subdomains": ["subdominio1", "subdominio2"]
  }
}

GENERA entre 10-20 subdominios y 30-50 variables críticas. Sé EXHAUSTIVO y OBSESIVO.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Dominio a analizar: "${domain}"\n\nGenera el análisis doctoral completo en JSON.` },
    ];

    const result = await chatWithTimeout(messages, {
      model: "gemini-pro",
      maxTokens: 8192,
      temperature: 0.3,
      responseFormat: "json",
    }, 120000);

    const domainMap = safeParseJson(result);

    const recommended = (domainMap as Record<string, unknown>)?.recommended_config as Record<string, unknown>;
    const buildProfile = recommended?.build_profile as string || "general";

    await updateRag(ragId, {
      domain_map: domainMap,
      build_profile: buildProfile,
      status: "waiting_confirmation",
    });

    // Persist to rag_domain_intelligence table
    const dm = domainMap as Record<string, unknown>;
    try {
      await supabase.from("rag_domain_intelligence").upsert({
        rag_id: ragId,
        user_input: domain,
        interpreted_intent: dm.interpreted_intent || {},
        subdomains: dm.subdomains || [],
        source_categories: dm.source_categories || [],
        critical_variables: dm.critical_variables || [],
        validation_queries: dm.validation_queries || {},
        known_debates: dm.known_debates || [],
        recommended_config: dm.recommended_config || {},
        user_confirmed: false,
      }, { onConflict: "rag_id" });
    } catch (diErr) {
      console.warn("Failed to persist domain intelligence:", diErr);
    }

    await supabase.from("rag_traces").insert({
      rag_id: ragId,
      trace_type: "domain_analysis_complete",
      phase: "domain_analysis",
      message: `Análisis completado: ${((domainMap as Record<string, unknown>)?.subdomains as unknown[])?.length || 0} subdominios`,
      metadata: { moral_mode: moralMode },
    });
  } catch (err) {
    console.error("analyzeDomain error:", err);
    await updateRag(ragId, {
      status: "failed",
      error_log: err instanceof Error ? err.message : "Unknown error in domain analysis",
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ═══════════════════════════════════════
// ACTION: CONFIRM
// ═══════════════════════════════════════

async function handleConfirm(userId: string, body: Record<string, unknown>) {
  const { ragId, adjustments } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (rag.status !== "waiting_confirmation") throw new Error("RAG is not waiting for confirmation");

  await updateRag(ragId as string, {
    domain_confirmed: true,
    domain_adjustments: adjustments || null,
    status: "researching",
  });

  EdgeRuntime.waitUntil(triggerBatch(ragId as string, 0));

  return { ragId, status: "researching", message: "Construcción iniciada (por lotes)" };
}

// ═══════════════════════════════════════
// BATCH BUILD ARCHITECTURE
// ═══════════════════════════════════════

async function triggerBatch(ragId: string, batchIndex: number) {
  try {
    const url = `${SUPABASE_URL}/functions/v1/rag-architect`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ action: "build-batch", ragId, batchIndex }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`triggerBatch failed (batch ${batchIndex}):`, errText);
    } else {
      await res.text();
    }
  } catch (err) {
    console.error(`triggerBatch error (batch ${batchIndex}):`, err);
  }
}

/** Trigger post-build processing via self-invocation */
async function triggerPostBuild(ragId: string, step: string) {
  try {
    const url = `${SUPABASE_URL}/functions/v1/rag-architect`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ action: "post-build", ragId, step }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`triggerPostBuild failed (${step}):`, errText);
    } else {
      await res.text();
    }
  } catch (err) {
    console.error(`triggerPostBuild error (${step}):`, err);
  }
}

function getActiveSubdomains(rag: Record<string, unknown>): Array<Record<string, unknown>> {
  const domainMap = rag.domain_map as Record<string, unknown>;
  if (!domainMap) return [];
  const subdomains = (domainMap.subdomains as Array<Record<string, unknown>>) || [];
  const adjustments = rag.domain_adjustments as Record<string, unknown> | null;
  return subdomains.filter((sub) => {
    const adj = adjustments?.[sub.name_technical as string] as Record<string, unknown>;
    return adj?.include !== false;
  });
}

// ═══════════════════════════════════════
// HANDLE RESUME BUILD — Restart from where it left off
// ═══════════════════════════════════════

async function handleResumeBuild(body: Record<string, unknown>) {
  const { ragId } = body;
  if (!ragId) throw new Error("ragId required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .single();
  if (!rag) throw new Error("RAG project not found");

  const activeSubdomains = getActiveSubdomains(rag);
  const totalBatches = activeSubdomains.length * RESEARCH_LEVELS.length;

  // Find which batches already have completed runs
  const { data: existingRuns } = await supabase
    .from("rag_research_runs")
    .select("subdomain, research_level, status")
    .eq("rag_id", ragId);

  const completedSet = new Set(
    (existingRuns || [])
      .filter((r: Record<string, unknown>) => r.status === "completed")
      .map((r: Record<string, unknown>) => `${r.subdomain}::${r.research_level}`)
  );

  // Find first missing batch
  let nextBatchIndex = totalBatches; // default: all done
  for (let i = 0; i < totalBatches; i++) {
    const subIdx = Math.floor(i / RESEARCH_LEVELS.length);
    const lvlIdx = i % RESEARCH_LEVELS.length;
    const subName = activeSubdomains[subIdx]?.name_technical as string;
    const level = RESEARCH_LEVELS[lvlIdx];
    if (!completedSet.has(`${subName}::${level}`)) {
      nextBatchIndex = i;
      break;
    }
  }

  if (nextBatchIndex >= totalBatches) {
    // All batches done, just trigger post-build
    console.log(`[Resume] RAG ${ragId}: All ${totalBatches} batches already completed. Triggering post-build.`);
    await updateRag(ragId as string, { status: "post_processing" });
    EdgeRuntime.waitUntil(triggerPostBuild(ragId as string, "knowledge_graph"));
    return { ragId, status: "post_build_triggered", completedBatches: totalBatches, totalBatches };
  }

  console.log(`[Resume] RAG ${ragId}: Resuming from batch ${nextBatchIndex}/${totalBatches}`);
  await updateRag(ragId as string, { status: "building" });
  EdgeRuntime.waitUntil(triggerBatch(ragId as string, nextBatchIndex));

  return { ragId, status: "resumed", nextBatchIndex, totalBatches, completedBatches: completedSet.size };
}

async function handleResumeRequest(userId: string, body: Record<string, unknown>) {
  const ragId = body.ragId as string;
  if (!ragId) throw new Error("ragId is required");

  // Verify ownership
  const { data: rag } = await supabase
    .from("rag_projects")
    .select("id, user_id, status")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();
  if (!rag) throw new Error("RAG not found or unauthorized");

  // Insert a RESUME_BUILD job
  const { error: jobErr } = await supabase.from("rag_jobs").insert({
    rag_id: ragId,
    job_type: "RESUME_BUILD",
    payload: {},
  });
  if (jobErr) throw jobErr;

  // Fire-and-forget the job runner
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  EdgeRuntime.waitUntil(
    fetch(`${SUPABASE_URL}/functions/v1/rag-job-runner`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ maxJobs: 20, rag_id: ragId }),
    }).catch((e) => console.error("Fire-and-forget job runner failed:", e))
  );

  return { ok: true, ragId, message: "Resume job enqueued" };
}

// ═══════════════════════════════════════
// HANDLE BUILD BATCH — REAL RAG PIPELINE
// ═══════════════════════════════════════

async function handleBuildBatch(body: Record<string, unknown>) {
  const { ragId, batchIndex } = body;
  if (!ragId || batchIndex === undefined) throw new Error("ragId and batchIndex required");

  const idx = batchIndex as number;

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (rag.status === "failed" || rag.status === "cancelled") {
    console.log(`Batch ${idx} skipped: RAG is ${rag.status}`);
    return { skipped: true };
  }

  const activeSubdomains = getActiveSubdomains(rag);
  const totalBatches = activeSubdomains.length * RESEARCH_LEVELS.length;

  if (idx >= totalBatches) {
    console.log(`Batch ${idx} out of range (${totalBatches} total batches)`);
    return { skipped: true };
  }

  const subdomainIndex = Math.floor(idx / RESEARCH_LEVELS.length);
  const levelIndex = idx % RESEARCH_LEVELS.length;

  const subdomain = activeSubdomains[subdomainIndex];
  const subdomainName = subdomain.name_technical as string;
  const subdomainColloquial = subdomain.name_colloquial as string || subdomainName;
  const domain = rag.domain_description as string;
  const level = RESEARCH_LEVELS[levelIndex];

  await updateRag(ragId as string, { current_phase: subdomainIndex + 1, status: "building" });

  console.log(`[Batch ${idx}/${totalBatches}] Processing ${subdomainName}/${level}`);

  let batchSources = 0;
  let batchChunks = 0;

  const levelStartTime = Date.now();

  const { data: run } = await supabase
    .from("rag_research_runs")
    .insert({
      rag_id: ragId,
      subdomain: subdomainName,
      research_level: level,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  try {
    // ═══ STEP 1: Search real sources ═══
    const useSemanticScholar = level === "academic" || level === "frontier";
    const sourceIds: string[] = [];
    let allScrapedContent = "";
    let perplexityContent = "";

    if (useSemanticScholar) {
      console.log(`[${subdomainName}/${level}] Using Semantic Scholar (primary) + Perplexity (supplement)`);

      const { papers, urls: scholarUrls } = await searchWithSemanticScholar(subdomainName, domain, level);

      for (const paper of papers.slice(0, 30)) {
        try {
          const { data: src } = await supabase
            .from("rag_sources")
            .insert({
              rag_id: ragId,
              run_id: run?.id,
              subdomain: subdomainName,
              source_name: `${paper.title.slice(0, 80)} (${paper.year})`,
              source_url: paper.url,
              source_type: level,
              tier: "tier1_gold",
              quality_score: Math.min(1, 0.7 + (paper.citations / 500)),
              relevance_score: 0.9,
            })
            .select("id")
            .single();
          if (src) sourceIds.push(src.id);
        } catch (urlErr) {
          console.warn(`Semantic Scholar source save error:`, urlErr);
        }
      }

      // Abstract content for LLM chunking
      const abstractContent = papers
        .map((p) => `## ${p.title} (${p.year}, ${p.citations} citations)\n\n${p.abstract}\n\nSource: ${p.url}${p.doi ? `\nDOI: ${p.doi}` : ""}${p.pubmedUrl ? `\nPubMed: ${p.pubmedUrl}` : ""}`)
        .join("\n\n---\n\n");

      allScrapedContent = abstractContent;

      // A4: Insert top abstracts as direct chunks (skip LLM chunking for speed)
      const topAbstractPapers = papers.filter(p => p.abstract && p.abstract.length > 200).slice(0, 15);
      for (const paper of topAbstractPapers) {
        try {
          const chunkContent = `${paper.title}\n\nYear: ${paper.year}\nCitations: ${paper.citations}\n\n${paper.abstract}`;
          const contentHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chunkContent.toLowerCase().trim()))))
            .map(b => b.toString(16).padStart(2, "0")).join("");

          // Generate embedding for direct chunk
          const embRes = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "text-embedding-3-small", input: chunkContent.slice(0, 8000), dimensions: 1024 }),
          });
          if (embRes.ok) {
            const embJson = await embRes.json();
            const embedding = embJson.data[0].embedding;
            // Find the source we just inserted for this paper
            const matchSource = sourceIds.length > 0 ? sourceIds[0] : null;
            await supabase.from("rag_chunks").insert({
              rag_id: ragId,
              source_id: matchSource,
              subdomain: subdomainName,
              title: paper.title.slice(0, 200),
              content: chunkContent,
              lang: "es",
              content_hash: contentHash,
              embedding,
              metadata: { year: paper.year, citations: paper.citations, type: "direct_abstract" },
              quality: { score: 90, verdict: "KEEP", length_words: chunkContent.split(/\s+/).length, noise_ratio: 0 },
            });
          }
        } catch (absErr) {
          console.warn(`Abstract chunk insert error:`, absErr);
        }
      }

      // A5: Insert PDF URLs as separate sources for FETCH pipeline
      const papersWithPdfUrl = papers.filter(p => p.pdfUrl).slice(0, 10);
      for (const paper of papersWithPdfUrl) {
        try {
          await supabase.from("rag_sources").insert({
            rag_id: ragId,
            run_id: run?.id,
            subdomain: subdomainName,
            source_name: `[PDF] ${paper.title.slice(0, 70)} (${paper.year})`,
            source_url: paper.pdfUrl!,
            source_type: level,
            tier: "tier1_gold",
            quality_score: 0.85,
            relevance_score: 0.9,
          });
          // Enqueue FETCH job for this PDF
          await supabase.from("rag_jobs").insert({
            rag_id: ragId,
            job_type: "FETCH",
            source_id: null, // will be linked via URL
            payload: { url: paper.pdfUrl },
          });
        } catch (pdfErr) {
          console.warn(`PDF source insert error:`, pdfErr);
        }
      }

      // UPGRADE 3: Try to fetch full paper PDF for top papers

      // Try fetching full PDFs for top 3 papers with open access PDFs
      const papersWithPdf = papers.filter(p => (p as Record<string, unknown>).pdfUrl);
      for (const paper of papersWithPdf.slice(0, 3)) {
        if (Date.now() - levelStartTime > 25000) break;
        const pdfUrl = (paper as Record<string, unknown>).pdfUrl as string;
        console.log(`[${subdomainName}/${level}] Attempting full PDF: ${pdfUrl}`);
        const fullText = await fetchFullPaperText(pdfUrl);
        if (fullText && fullText.length > 1000) {
          allScrapedContent += `\n\n--- FULL PAPER: ${paper.title} ---\n\n${fullText}`;
          console.log(`[${subdomainName}/${level}] Got full paper text: ${fullText.length} chars`);
        }
      }

      // Try scraping top 2 papers for full content (existing behavior)
      for (const url of scholarUrls.slice(0, 2)) {
        if (Date.now() - levelStartTime > 30000) break;
        const scraped = await scrapeUrl(url);
        if (scraped && scraped.length > 500) {
          allScrapedContent += `\n\n--- FULL SOURCE: ${url} ---\n\n${scraped}`;
        }
      }

      const searchQuery = `${subdomainColloquial} ${domain} systematic review meta-analysis`;
      const perplexityResult = await searchWithPerplexity(searchQuery, level);
      perplexityContent = perplexityResult.content;

      for (const citationUrl of perplexityResult.citations.slice(0, 3)) {
        try {
          const { data: src } = await supabase
            .from("rag_sources")
            .insert({
              rag_id: ragId,
              run_id: run?.id,
              subdomain: subdomainName,
              source_name: new URL(citationUrl).hostname,
              source_url: citationUrl,
              source_type: level,
              tier: "tier2_silver",
              quality_score: 0.7,
              relevance_score: 0.7,
            })
            .select("id")
            .single();
          if (src) sourceIds.push(src.id);
        } catch (urlErr) {
          console.warn(`Invalid URL skipped: ${citationUrl}`);
        }
      }

      if (perplexityContent) {
        allScrapedContent += `\n\n--- PERPLEXITY SUPPLEMENT ---\n\n${perplexityContent}`;
      }
    } else {
      // A6: Expanded Perplexity — 3 varied queries for non-academic levels
      const queryVariations = [
        `${subdomainColloquial} ${domain} ${level === "datasets" ? "statistics data reports" : ""}`,
        `${subdomainColloquial} ${domain} best practices guides ${level === "frontier" ? "2024 2025" : ""}`,
        `${subdomainColloquial} ${domain} expert recommendations resources`,
      ];
      let combinedContent = "";
      let allCitations: string[] = [];

      for (const searchQuery of queryVariations) {
        console.log(`[${subdomainName}/${level}] Searching with Perplexity: ${searchQuery.slice(0, 80)}...`);
        const { content: qContent, citations: qCitations } = await searchWithPerplexity(searchQuery, level);
        if (qContent) combinedContent += `\n\n${qContent}`;
        allCitations = [...allCitations, ...qCitations];
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Deduplicate citations
      const uniqueCitations = [...new Set(allCitations)];
      perplexityContent = combinedContent;

      for (const citationUrl of uniqueCitations.slice(0, 8)) {
        try {
          const { data: src } = await supabase
            .from("rag_sources")
            .insert({
              rag_id: ragId,
              run_id: run?.id,
              subdomain: subdomainName,
              source_name: new URL(citationUrl).hostname,
              source_url: citationUrl,
              source_type: level,
              tier: "tier2_silver",
              quality_score: 0.8,
              relevance_score: 0.8,
            })
            .select("id")
            .single();
          if (src) sourceIds.push(src.id);
        } catch (urlErr) {
          console.warn(`Invalid URL skipped: ${citationUrl}`);
        }
      }

      const urlsToScrape = uniqueCitations.slice(0, 5);
      for (const url of urlsToScrape) {
        if (Date.now() - levelStartTime > 40000) {
          console.warn(`[${subdomainName}/${level}] Time budget exceeded, stopping scrape`);
          break;
        }
        const scraped = await scrapeUrl(url);
        if (scraped) {
          allScrapedContent += `\n\n--- SOURCE: ${url} ---\n\n${scraped}`;
        }
      }

      if (allScrapedContent.length < 500 && perplexityContent) {
        console.log(`[${subdomainName}/${level}] Using Perplexity response as fallback content`);
        allScrapedContent = perplexityContent;
      }
    }

    batchSources = sourceIds.length;

    if (!allScrapedContent || allScrapedContent.trim().length < 100) {
      console.warn(`[${subdomainName}/${level}] No real content obtained, skipping chunk generation`);
      await supabase
        .from("rag_research_runs")
        .update({ status: "completed", sources_found: sourceIds.length, chunks_generated: 0, completed_at: new Date().toISOString() })
        .eq("id", run?.id);
    } else {
      const chunks = await chunkRealContent(allScrapedContent, subdomainName, level);

      let chunksInserted = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.content || chunk.content.length < 50) continue;

        try {
          const embedding = await generateEmbedding(chunk.content);
          if (i > 0) await new Promise((r) => setTimeout(r, 200));

          // Dedup check
          try {
            const { data: dupData } = await supabase.rpc('check_chunk_duplicate', {
              query_embedding: `[${embedding.join(",")}]`,
              match_rag_id: ragId,
              similarity_threshold: 0.92,
            });
            if (dupData && dupData.length > 0) {
              console.log(`[${subdomainName}/${level}] Duplicate chunk detected (similarity: ${dupData[0].similarity?.toFixed(3)}), skipping`);
              continue;
            }
          } catch (dupErr) {
            console.warn(`[${subdomainName}/${level}] Dedup check failed, inserting anyway:`, dupErr);
          }

          await supabase.from("rag_chunks").insert({
            rag_id: ragId,
            source_id: sourceIds[0] || null,
            subdomain: subdomainName,
            content: chunk.content,
            chunk_index: i,
            metadata: {
              summary: chunk.summary,
              concepts: chunk.concepts,
              level,
              ...(chunk.title ? { title: chunk.title } : {}),
              ...(chunk.age_range ? { age_range: chunk.age_range } : {}),
              ...(chunk.source_type ? { source_type: chunk.source_type } : {}),
            },
            embedding: `[${embedding.join(",")}]`,
          });

          chunksInserted++;
        } catch (embErr) {
          console.error(`[${subdomainName}/${level}] Embedding error for chunk ${i}:`, embErr);
          await supabase.from("rag_chunks").insert({
            rag_id: ragId,
            source_id: sourceIds[0] || null,
            subdomain: subdomainName,
            content: chunk.content,
            chunk_index: i,
            metadata: { summary: chunk.summary, concepts: chunk.concepts, level, embedding_failed: true },
          });
          chunksInserted++;
        }
      }

      batchChunks = chunksInserted;

      await supabase
        .from("rag_research_runs")
        .update({
          status: "completed",
          sources_found: sourceIds.length,
          chunks_generated: chunksInserted,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run?.id);

      console.log(`[${subdomainName}/${level}] Done: ${sourceIds.length} sources, ${chunksInserted} chunks, ${Date.now() - levelStartTime}ms`);
    }
  } catch (levelErr) {
    console.error(`Error in ${subdomainName}/${level}:`, levelErr);
    if (run?.id) {
      await supabase
        .from("rag_research_runs")
        .update({ status: "failed", error_log: String(levelErr) })
        .eq("id", run.id);
    }
  }

  // Update cumulative metrics
  const newTotalSources = (rag.total_sources as number || 0) + batchSources;
  const newTotalChunks = (rag.total_chunks as number || 0) + batchChunks;

  // Coverage based on completed runs vs total batches
  const { count: completedRunsCount } = await supabase
    .from("rag_research_runs")
    .select("*", { count: "exact", head: true })
    .eq("rag_id", ragId)
    .eq("status", "completed");
  const coverage = Math.min(100, Math.round(((completedRunsCount || 0) / Math.max(1, totalBatches)) * 100));

  await updateRag(ragId as string, {
    total_sources: newTotalSources,
    total_chunks: newTotalChunks,
    coverage_pct: coverage,
  });

  // Trigger next batch
  const nextBatch = idx + 1;
  if (nextBatch < totalBatches) {
    EdgeRuntime.waitUntil(triggerBatch(ragId as string, nextBatch));
    return { ragId, batchIndex: idx, status: "next_batch_triggered", nextBatch, totalBatches };
  }

  // Last batch — Trigger post-build processing instead of just saving verdict
  console.log(`[RAG ${ragId}] BUILD COMPLETED: ${newTotalChunks} chunks. Starting post-build processing...`);

  await updateRag(ragId as string, {
    status: "post_processing",
    current_phase: activeSubdomains.length,
  });

  // Start post-build chain: knowledge_graph → taxonomy → contradictions → quality_gate
  EdgeRuntime.waitUntil(triggerPostBuild(ragId as string, "knowledge_graph"));

  return { ragId, batchIndex: idx, status: "post_build_started", totalBatches };
}

// ═══════════════════════════════════════
// POST-BUILD PROCESSING (Upgrades 2, 5, 6, 4)
// ═══════════════════════════════════════

async function handlePostBuild(body: Record<string, unknown>) {
  const { ragId, step } = body;
  if (!ragId || !step) throw new Error("ragId and step required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .single();

  if (!rag) throw new Error("RAG not found");

  console.log(`[PostBuild] RAG ${ragId}: step=${step}`);

  try {
    switch (step) {
      case "knowledge_graph": {
        // ── FAN-OUT: enqueue 1 POST_BUILD_KG job per subdomain ──
        const subdomains = getActiveSubdomains(rag);
        console.log(`[PostBuild] Fan-out KG: ${subdomains.length} subdomain jobs to enqueue`);
        let enqueuedCount = 0;
        let skippedCount = 0;
        for (const sub of subdomains) {
          const { count } = await supabase
            .from("rag_chunks")
            .select("*", { count: "exact", head: true })
            .eq("rag_id", ragId)
            .eq("subdomain", sub.name_technical);
          if ((count || 0) === 0) {
            console.log(`[PostBuild] Skipping subdomain ${sub.name_technical}: 0 chunks`);
            skippedCount++;
            continue;
          }
          await supabase.from("rag_jobs").insert({
            rag_id: ragId,
            job_type: "POST_BUILD_KG",
            payload: { subdomain: sub.name_technical },
          });
          enqueuedCount++;
        }
        console.log(`[PostBuild] KG fan-out: ${enqueuedCount} enqueued, ${skippedCount} skipped`);
        // Kick job runner to start processing KG jobs
        const SUPABASE_ANON_KEY_KG = Deno.env.get("SUPABASE_ANON_KEY") || "";
        EdgeRuntime.waitUntil(
          fetch(`${SUPABASE_URL}/functions/v1/rag-job-runner`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY_KG,
            },
            body: JSON.stringify({ maxJobs: 20, rag_id: ragId }),
          }).catch((e) => console.error("[PostBuild] KG fan-out kick error:", e))
        );
        // Return immediately — cascade handled by rag-job-runner
        break;
      }

      case "taxonomy":
        await buildTaxonomy(ragId as string, rag);
        // No cascade — rag-job-runner handles the next step
        break;

      case "contradictions":
        await detectContradictions(ragId as string, rag);
        // No cascade — rag-job-runner handles the next step
        break;

      case "quality_gate": {
        await runQualityGate(ragId as string, rag);
        // Final step — mark as completed with real coverage
        const { count: chunkCount } = await supabase
          .from("rag_chunks")
          .select("*", { count: "exact", head: true })
          .eq("rag_id", ragId);

        const { count: totalRunsCount } = await supabase
          .from("rag_research_runs")
          .select("*", { count: "exact", head: true })
          .eq("rag_id", ragId);

        const { count: completedRunsFinal } = await supabase
          .from("rag_research_runs")
          .select("*", { count: "exact", head: true })
          .eq("rag_id", ragId)
          .eq("status", "completed");

        // ── FIX: Check KG nodes before computing verdict ──
        const { count: kgNodeCount } = await supabase
          .from("rag_knowledge_graph_nodes")
          .select("*", { count: "exact", head: true })
          .eq("rag_id", ragId);

        const realCoverage = Math.round(((completedRunsFinal || 0) / Math.max(1, totalRunsCount || 1)) * 100);

        let qualityVerdict: string;
        if ((kgNodeCount || 0) === 0) {
          qualityVerdict = "DEGRADED";
          console.warn(`[PostBuild] RAG ${ragId}: 0 KG nodes → forced DEGRADED verdict`);
        } else if (realCoverage >= 90 && (chunkCount || 0) >= 50) {
          qualityVerdict = "PRODUCTION_READY";
        } else if (realCoverage >= 70 && (chunkCount || 0) >= 20) {
          qualityVerdict = "GOOD_ENOUGH";
        } else {
          qualityVerdict = "INCOMPLETE";
        }

        await updateRag(ragId as string, {
          status: "completed",
          quality_verdict: qualityVerdict,
          coverage_pct: realCoverage,
        });
        console.log(`[PostBuild] RAG ${ragId} COMPLETED with verdict: ${qualityVerdict}, coverage: ${realCoverage}%`);

        // ── AUTO-PATTERNS HOOK ──
        // If this RAG is linked to a business project with auto_patterns=true, launch pattern detection
        try {
          const { data: ragForProject } = await supabase
            .from("rag_projects")
            .select("project_id")
            .eq("id", ragId)
            .single();

          if (ragForProject?.project_id) {
            const { data: bizProject } = await supabase
              .from("business_projects")
              .select("id, auto_patterns, user_id")
              .eq("id", ragForProject.project_id)
              .single();

            if (bizProject?.auto_patterns) {
              console.log(`[PostBuild] auto_patterns=true for project ${bizProject.id}, launching pattern detection`);
              
              // Insert pattern_detection_runs
              const { data: run, error: runErr } = await supabase
                .from("pattern_detection_runs")
                .insert({
                  project_id: bizProject.id,
                  rag_id: ragId,
                  user_id: bizProject.user_id,
                  status: "PENDING",
                  started_at: new Date().toISOString(),
                })
                .select("id")
                .single();

              if (runErr) {
                console.error("[PostBuild] Error creating pattern run:", runErr);
              } else {
                // Enqueue DETECT_PATTERNS job
                await supabase.from("rag_jobs").insert({
                  rag_id: ragId,
                  job_type: "DETECT_PATTERNS",
                  payload: { run_id: run.id, project_id: bizProject.id },
                });

                // Fire-and-forget to job-runner
                const SUPABASE_ANON_KEY_VAL = Deno.env.get("SUPABASE_ANON_KEY") || "";
                EdgeRuntime.waitUntil(
                  fetch(`${SUPABASE_URL}/functions/v1/rag-job-runner`, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                      "Content-Type": "application/json",
                      apikey: SUPABASE_ANON_KEY_VAL,
                    },
                    body: JSON.stringify({ maxJobs: 20, rag_id: ragId }),
                  }).catch((e) => console.error("[PostBuild] Fire-and-forget job-runner error:", e))
                );
              }
            }
          }
        } catch (autoPatErr) {
          console.error("[PostBuild] Auto-patterns hook error:", autoPatErr);
        }

        break;
      }

      default:
        console.warn(`[PostBuild] Unknown step: ${step}`);
    }
  } catch (err) {
    console.error(`[PostBuild] Error in step ${step}:`, err);
    // Log error but don't cascade — rag-job-runner handles cascade.
    // If this is the final step (quality_gate), still complete the RAG as DEGRADED.
    if (step === "quality_gate") {
      await updateRag(ragId as string, { status: "completed", quality_verdict: "DEGRADED" });
    }
    // For non-final steps, the job will be marked as RETRY/DLQ by the runner.
  }

  return { ragId, step, status: "done" };
}

// ═══════════════════════════════════════
// UPGRADE 2: Knowledge Graph
// ═══════════════════════════════════════

async function buildKnowledgeGraph(ragId: string, rag: Record<string, unknown>) {
  const activeSubdomains = getActiveSubdomains(rag);
  
  for (let _subIdx = 0; _subIdx < activeSubdomains.length; _subIdx++) {
    const sub = activeSubdomains[_subIdx];
    // Rate limit: 5s delay between subdomains to avoid Gemini 429
    if (_subIdx > 0) {
      await new Promise(r => setTimeout(r, 5000));
    }
    const subName = sub.name_technical as string;

    const { data: chunks } = await supabase
      .from("rag_chunks")
      .select("content, metadata")
      .eq("rag_id", ragId)
      .eq("subdomain", subName)
      .limit(15);

    if (!chunks || chunks.length < 3) continue;

    const chunksText = chunks.map((c, i) => `[${i}] ${(c.content as string).slice(0, 500)}`).join("\n\n");

    try {
      // Retry with backoff for rate limit errors
      let result: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await chatWithTimeout(
        [
          {
            role: "system",
            content: `Extrae entidades y relaciones del contenido para un knowledge graph.

Devuelve JSON:
{
  "nodes": [{"label": "nombre", "type": "concept|person|theory|method|condition", "description": "breve"}],
  "edges": [{"source": "label1", "target": "label2", "relation": "tipo_relación", "weight": 0.8}]
}

Máximo 20 nodos y 30 edges. Solo entidades importantes y bien documentadas.`,
          },
          { role: "user", content: `Subdominio: ${subName}\n\n${chunksText}` },
        ],
        { model: "gemini-flash", maxTokens: 4096, temperature: 0.1, responseFormat: "json" },
        30000
          );
          break; // Success, exit retry loop
        } catch (retryErr) {
          const errMsg = String(retryErr);
          if ((errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("RESOURCE_EXHAUSTED")) && attempt < 2) {
            console.warn(`[KG] Rate limit on subdomain ${subName}, attempt ${attempt + 1}, waiting ${(attempt + 1) * 10}s...`);
            await new Promise(r => setTimeout(r, (attempt + 1) * 10000));
          } else {
            throw retryErr;
          }
        }
      }
      if (!result) continue;

      const parsed = safeParseJson(result) as { nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> };
      const nodes = parsed.nodes || [];
      const edges = parsed.edges || [];

      // Insert nodes, dedup by label
      const nodeMap = new Map<string, string>(); // label -> id
      for (const node of nodes) {
        const label = (node.label as string || "").toLowerCase().trim();
        if (!label || nodeMap.has(label)) continue;

        // Check if node already exists
        const { data: existing } = await supabase
          .from("rag_knowledge_graph_nodes")
          .select("id")
          .eq("rag_id", ragId)
          .ilike("label", label)
          .limit(1);

        if (existing && existing.length > 0) {
          nodeMap.set(label, existing[0].id);
          await supabase.rpc("increment_node_source_count", { node_id: existing[0].id });
        } else {
          try {
            const embedding = await generateEmbedding(label + " " + (node.description || ""));
            const { data: newNode } = await supabase
              .from("rag_knowledge_graph_nodes")
              .insert({
                rag_id: ragId,
                label: node.label as string,
                node_type: (node.type as string) || "concept",
                description: (node.description as string) || "",
                embedding: `[${embedding.join(",")}]`,
                source_count: 1,
              })
              .select("id")
              .single();
            if (newNode) nodeMap.set(label, newNode.id);
            await new Promise((r) => setTimeout(r, 200));
          } catch (nodeErr) {
            console.warn(`[KG] Node insert error:`, nodeErr);
          }
        }
      }

      // Insert edges
      for (const edge of edges) {
        const srcLabel = ((edge.source as string) || "").toLowerCase().trim();
        const tgtLabel = ((edge.target as string) || "").toLowerCase().trim();
        const srcId = nodeMap.get(srcLabel);
        const tgtId = nodeMap.get(tgtLabel);
        if (!srcId || !tgtId || srcId === tgtId) continue;

        await supabase.from("rag_knowledge_graph_edges").insert({
          rag_id: ragId,
          source_node_id: srcId,
          target_node_id: tgtId,
          relation: (edge.relation as string) || "related_to",
          weight: (edge.weight as number) || 0.5,
        }).then(() => {}).catch(() => {}); // ignore duplicates
      }

      console.log(`[KG] ${subName}: ${nodes.length} nodes, ${edges.length} edges`);
    } catch (err) {
      console.warn(`[KG] Error for ${subName}:`, err);
    }
  }
}

// ═══════════════════════════════════════
// UPGRADE 2b: Single-subdomain KG (called from rag-job-runner)
// ═══════════════════════════════════════

async function buildKGForSubdomain(ragId: string, subName: string) {
  console.log(`[KG-Sub] Processing subdomain: ${subName} for RAG ${ragId}`);

  const { data: chunks } = await supabase
    .from("rag_chunks")
    .select("content, metadata")
    .eq("rag_id", ragId)
    .eq("subdomain", subName)
    .limit(15);

  if (!chunks || chunks.length < 3) {
    console.log(`[KG-Sub] ${subName}: only ${chunks?.length || 0} chunks, skipping`);
    return { nodes: 0, edges: 0 };
  }

  const chunksText = chunks.map((c, i) => `[${i}] ${(c.content as string).slice(0, 500)}`).join("\n\n");

  let result: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await chatWithTimeout(
        [
          {
            role: "system",
            content: `Extrae entidades y relaciones del contenido para un knowledge graph.

Devuelve JSON:
{
  "nodes": [{"label": "nombre", "type": "concept|person|theory|method|condition", "description": "breve"}],
  "edges": [{"source": "label1", "target": "label2", "relation": "tipo_relación", "weight": 0.8}]
}

Máximo 20 nodos y 30 edges. Solo entidades importantes y bien documentadas.`,
          },
          { role: "user", content: `Subdominio: ${subName}\n\n${chunksText}` },
        ],
        { model: "gemini-flash", maxTokens: 4096, temperature: 0.1, responseFormat: "json" },
        30000
      );
      break;
    } catch (retryErr) {
      const errMsg = String(retryErr);
      if ((errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("RESOURCE_EXHAUSTED")) && attempt < 2) {
        console.warn(`[KG-Sub] Rate limit on ${subName}, attempt ${attempt + 1}, waiting ${(attempt + 1) * 10}s...`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 10000));
      } else {
        throw retryErr;
      }
    }
  }
  if (!result) return { nodes: 0, edges: 0 };

  const parsed = safeParseJson(result) as { nodes?: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> };
  const nodes = parsed.nodes || [];
  const edges = parsed.edges || [];

  // Insert nodes, dedup by label (no artificial delays)
  const nodeMap = new Map<string, string>();
  for (const node of nodes) {
    const label = (node.label as string || "").toLowerCase().trim();
    if (!label || nodeMap.has(label)) continue;

    const { data: existing } = await supabase
      .from("rag_knowledge_graph_nodes")
      .select("id")
      .eq("rag_id", ragId)
      .ilike("label", label)
      .limit(1);

    if (existing && existing.length > 0) {
      nodeMap.set(label, existing[0].id);
      await supabase.rpc("increment_node_source_count", { node_id: existing[0].id });
    } else {
      try {
        const embedding = await generateEmbedding(label + " " + (node.description || ""));
        const { data: newNode } = await supabase
          .from("rag_knowledge_graph_nodes")
          .insert({
            rag_id: ragId,
            label: node.label as string,
            node_type: (node.type as string) || "concept",
            description: (node.description as string) || "",
            embedding: `[${embedding.join(",")}]`,
            source_count: 1,
          })
          .select("id")
          .single();
        if (newNode) nodeMap.set(label, newNode.id);
      } catch (nodeErr) {
        console.warn(`[KG-Sub] Node insert error:`, nodeErr);
      }
    }
  }

  // Insert edges (no delays)
  for (const edge of edges) {
    const srcLabel = ((edge.source as string) || "").toLowerCase().trim();
    const tgtLabel = ((edge.target as string) || "").toLowerCase().trim();
    const srcId = nodeMap.get(srcLabel);
    const tgtId = nodeMap.get(tgtLabel);
    if (!srcId || !tgtId || srcId === tgtId) continue;

    await supabase.from("rag_knowledge_graph_edges").insert({
      rag_id: ragId,
      source_node: srcId,
      target_node: tgtId,
      edge_type: (edge.relation as string) || "related_to",
      weight: (edge.weight as number) || 0.5,
    }).then(() => {}).catch(() => {});
  }

  console.log(`[KG-Sub] ${subName}: ${nodes.length} nodes, ${edges.length} edges`);
  return { nodes: nodes.length, edges: edges.length };
}

// ═══════════════════════════════════════
// UPGRADE 5: Taxonomy
// ═══════════════════════════════════════

async function buildTaxonomy(ragId: string, rag: Record<string, unknown>) {
  const { data: chunks } = await supabase
    .from("rag_chunks")
    .select("subdomain, metadata, content")
    .eq("rag_id", ragId);

  if (!chunks || chunks.length < 3) return;

  // Collect all concepts from metadata
  const conceptsBySubdomain: Record<string, Set<string>> = {};
  for (const chunk of chunks) {
    const sd = (chunk.subdomain as string) || "general";
    if (!conceptsBySubdomain[sd]) conceptsBySubdomain[sd] = new Set();
    const meta = chunk.metadata as Record<string, unknown>;
    const concepts = (meta?.concepts as string[]) || [];
    for (const c of concepts) {
      conceptsBySubdomain[sd].add(c);
    }
  }

  let conceptsSummary = Object.entries(conceptsBySubdomain)
    .map(([sd, concepts]) => `${sd}: ${[...concepts].join(", ")}`)
    .join("\n");

  // FALLBACK: if concepts are empty, build context from chunk content samples
  const totalConcepts = Object.values(conceptsBySubdomain).reduce((sum, s) => sum + s.size, 0);
  if (totalConcepts < 5) {
    console.log(`[Taxonomy] Only ${totalConcepts} concepts found in metadata, using chunk content fallback`);
    const sampleChunks = chunks.slice(0, 30);
    const contentSamples = sampleChunks
      .map((c) => `[${(c.subdomain as string) || "general"}] ${(c.content as string).slice(0, 300)}`)
      .join("\n---\n");
    conceptsSummary = `NOTA: Los conceptos fueron extraídos directamente del contenido de los chunks (no había metadata de conceptos).\n\nMuestras de contenido por subdominio:\n${contentSamples}`;
  }

  try {
    const result = await chatWithTimeout(
      [
        {
          role: "system",
          content: `Organiza los conceptos en una taxonomía jerárquica.

Devuelve JSON:
{
  "taxonomy": [
    {
      "category": "nombre_categoría",
      "parent": null,
      "description": "breve descripción",
      "concepts": ["concepto1", "concepto2"]
    }
  ],
  "variables": [
    {
      "name": "nombre_variable",
      "type": "quantitative|qualitative|binary|temporal|categorical",
      "description": "qué mide",
      "importance": "critical|high|medium"
    }
  ]
}`,
        },
        { role: "user", content: `Conceptos por subdominio:\n\n${conceptsSummary}` },
      ],
      { model: "gemini-flash", maxTokens: 4096, temperature: 0.1, responseFormat: "json" },
      30000
    );

    const parsed = safeParseJson(result) as { taxonomy?: unknown[]; variables?: unknown[] };

    // Insert taxonomy entries
    for (const taxEntry of (parsed.taxonomy || []) as Array<Record<string, unknown>>) {
      await supabase.from("rag_taxonomy").insert({
        rag_id: ragId,
        category: (taxEntry.category as string) || "uncategorized",
        parent_category: (taxEntry.parent as string) || null,
        description: (taxEntry.description as string) || "",
      }).then(() => {}).catch(() => {});
    }

    // Insert variables
    let insertedVars = (parsed.variables || []) as Array<Record<string, unknown>>;

    // FALLBACK: if LLM returned 0 variables, use domain_map.critical_variables
    if (insertedVars.length === 0) {
      console.log("[Taxonomy] LLM returned 0 variables, trying domain_map fallback");
      const domainMap = rag.domain_map as Record<string, unknown> | null;
      const criticalVars = (domainMap?.critical_variables as Array<Record<string, unknown>>) || [];
      if (criticalVars.length > 0) {
        insertedVars = criticalVars.map((cv) => ({
          name: (cv.name as string) || (cv.nombre as string) || "",
          type: (cv.type as string) || (cv.tipo as string) || "qualitative",
          description: (cv.description as string) || (cv.descripcion as string) || "",
          importance: (cv.importance as string) || "high",
        }));
        console.log(`[Taxonomy] Using ${insertedVars.length} variables from domain_map.critical_variables`);
      }
    }

    for (const v of insertedVars) {
      await supabase.from("rag_variables").insert({
        rag_id: ragId,
        name: (v.name as string) || "",
        variable_type: (v.type as string) || "qualitative",
        description: (v.description as string) || "",
      }).then(() => {}).catch(() => {});
    }

    // Always recount and persist total_variables
    const { count } = await supabase
      .from("rag_variables")
      .select("*", { count: "exact", head: true })
      .eq("rag_id", ragId);

    await updateRag(ragId, { total_variables: count || 0 });

    console.log(`[Taxonomy] ${(parsed.taxonomy || []).length} categories, ${insertedVars.length} variables, total_variables=${count || 0}`);
  } catch (err) {
    console.warn("[Taxonomy] Error:", err);
    // Even on error, try domain_map fallback for variables
    try {
      const domainMap = rag.domain_map as Record<string, unknown> | null;
      const criticalVars = (domainMap?.critical_variables as Array<Record<string, unknown>>) || [];
      if (criticalVars.length > 0) {
        console.log(`[Taxonomy] Error recovery: inserting ${criticalVars.length} variables from domain_map`);
        for (const cv of criticalVars) {
          await supabase.from("rag_variables").insert({
            rag_id: ragId,
            name: (cv.name as string) || (cv.nombre as string) || "",
            variable_type: (cv.type as string) || (cv.tipo as string) || "qualitative",
            description: (cv.description as string) || (cv.descripcion as string) || "",
          }).then(() => {}).catch(() => {});
        }
        const { count } = await supabase
          .from("rag_variables")
          .select("*", { count: "exact", head: true })
          .eq("rag_id", ragId);
        await updateRag(ragId, { total_variables: count || 0 });
      }
    } catch (fallbackErr) {
      console.error("[Taxonomy] Fallback also failed:", fallbackErr);
    }
  }
}

// ═══════════════════════════════════════
// UPGRADE 6: Contradiction Detection
// ═══════════════════════════════════════

async function detectContradictions(ragId: string, rag: Record<string, unknown>) {
  const activeSubdomains = getActiveSubdomains(rag);

  for (let _subIdx2 = 0; _subIdx2 < activeSubdomains.length; _subIdx2++) {
    const sub = activeSubdomains[_subIdx2];
    // Rate limit: 5s delay between subdomains to avoid Gemini 429
    if (_subIdx2 > 0) {
      await new Promise(r => setTimeout(r, 5000));
    }
    const subName = sub.name_technical as string;

    const { data: chunks } = await supabase
      .from("rag_chunks")
      .select("id, content")
      .eq("rag_id", ragId)
      .eq("subdomain", subName)
      .limit(20);

    if (!chunks || chunks.length < 3) continue;

    const chunksText = chunks.map((c, i) => `[${i}] ${(c.content as string).slice(0, 400)}`).join("\n\n");

    try {
      const result = await chatWithTimeout(
        [
          {
            role: "system",
            content: `Analiza los fragmentos y detecta contradicciones entre ellos.

Una contradicción es cuando dos fragmentos afirman cosas opuestas o incompatibles sobre el mismo tema.

Devuelve JSON:
{
  "contradictions": [
    {
      "chunk_a": 0,
      "chunk_b": 3,
      "claim_a": "Afirmación del fragmento A",
      "claim_b": "Afirmación contradictoria del fragmento B",
      "severity": "high|medium|low",
      "topic": "tema del conflicto"
    }
  ]
}

Si no hay contradicciones, devuelve {"contradictions": []}`,
          },
          { role: "user", content: `Subdominio: ${subName}\n\nFragmentos:\n${chunksText}` },
        ],
        { model: "gemini-flash", maxTokens: 2048, temperature: 0.1, responseFormat: "json" },
        20000
      );

      const parsed = safeParseJson(result) as { contradictions?: Array<Record<string, unknown>> };

      for (const contra of (parsed.contradictions || [])) {
        const chunkAIdx = contra.chunk_a as number;
        const chunkBIdx = contra.chunk_b as number;
        const chunkA = chunks[chunkAIdx];
        const chunkB = chunks[chunkBIdx];
        if (!chunkA || !chunkB) continue;

        await supabase.from("rag_contradictions").insert({
          rag_id: ragId,
          chunk_a_id: chunkA.id,
          chunk_b_id: chunkB.id,
          claim_a: (contra.claim_a as string) || "",
          claim_b: (contra.claim_b as string) || "",
          severity: (contra.severity as string) || "medium",
          subdomain: subName,
        }).then(() => {}).catch(() => {});
      }

      if ((parsed.contradictions || []).length > 0) {
        console.log(`[Contradictions] ${subName}: ${parsed.contradictions!.length} found`);
      }
    } catch (err) {
      console.warn(`[Contradictions] Error for ${subName}:`, err);
    }
  }
}

// ═══════════════════════════════════════
// UPGRADE 4: Quality Gate (Real)
// ═══════════════════════════════════════

async function runQualityGate(ragId: string, rag: Record<string, unknown>) {
  const domainMap = rag.domain_map as Record<string, unknown>;
  const validationQueries = domainMap?.validation_queries as Record<string, string[]>;
  if (!validationQueries) {
    console.log("[QualityGate] No validation queries found, inserting SKIPPED check");
    await supabase.from("rag_quality_checks").insert({
      rag_id: ragId,
      check_type: "quality_gate",
      verdict: "SKIPPED",
      score: 0,
      details: { reason: "No validation_queries in domain_map" },
    });
    return;
  }

  const allQueries = Object.values(validationQueries).flat().slice(0, 5); // Limit to 5 for speed
  if (allQueries.length === 0) return;

  const scores: number[] = [];

  for (const query of allQueries) {
    try {
      // Generate embedding for the query
      const embedding = await generateEmbedding(query);

      // Search using hybrid search
      const { data: chunks } = await supabase.rpc("search_rag_hybrid", {
        query_embedding: `[${embedding.join(",")}]`,
        query_text: query,
        match_rag_id: ragId,
        match_count: 5,
      });

      if (!chunks || chunks.length === 0) {
        scores.push(0);
        continue;
      }

      // Generate answer
      const context = (chunks as Array<Record<string, unknown>>)
        .map((c, i) => `[${i}] ${(c.content as string).slice(0, 500)}`)
        .join("\n\n");

      const evalResult = await chatWithTimeout(
        [
          {
            role: "system",
            content: `Evalúa si el contexto proporcionado puede responder adecuadamente la pregunta.

Puntúa de 0 a 10 en cada dimensión:
- faithfulness: ¿la respuesta se basa en los documentos?
- relevancy: ¿los documentos son relevantes para la pregunta?
- completeness: ¿se puede dar una respuesta completa?
- sources: ¿hay fuentes citables de calidad?

Devuelve SOLO JSON: {"faithfulness": X, "relevancy": X, "completeness": X, "sources": X}`,
          },
          { role: "user", content: `Pregunta: ${query}\n\nContexto:\n${context}` },
        ],
        { model: "gemini-flash", maxTokens: 512, temperature: 0, responseFormat: "json" },
        15000
      );

      const evalParsed = safeParseJson(evalResult) as Record<string, number>;
      const avgScore = (
        (evalParsed.faithfulness || 0) +
        (evalParsed.relevancy || 0) +
        (evalParsed.completeness || 0) +
        (evalParsed.sources || 0)
      ) / 4;

      scores.push(avgScore);
      console.log(`[QualityGate] "${query.slice(0, 50)}..." → ${avgScore.toFixed(1)}/10`);
    } catch (err) {
      console.warn(`[QualityGate] Error evaluating query:`, err);
      scores.push(0);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  const avgOverall = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const fitnessScore = Math.round(avgOverall * 10); // 0-100

  const verdict = fitnessScore >= 70 ? "PRODUCTION_READY" : fitnessScore >= 50 ? "GOOD_ENOUGH" : "INCOMPLETE";

  await supabase.from("rag_quality_checks").insert({
    rag_id: ragId,
    check_type: "quality_gate",
    verdict,
    score: fitnessScore / 100,
    details: {
      queries_evaluated: allQueries.length,
      individual_scores: scores,
      fitness_score: fitnessScore,
    },
  });

  await updateRag(ragId, { quality_verdict: verdict });

  console.log(`[QualityGate] Fitness: ${fitnessScore}/100, Verdict: ${verdict}`);
}

// ═══════════════════════════════════════
// ACTION: REBUILD
// ═══════════════════════════════════════

async function handleRebuild(userId: string, body: Record<string, unknown>) {
  const { ragId } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (!["failed", "completed", "cancelled"].includes(rag.status)) {
    throw new Error("Solo se puede regenerar un RAG en estado terminal (failed/completed/cancelled)");
  }
  if (!rag.domain_map) throw new Error("No hay domain_map para regenerar. Crea un nuevo RAG.");

  // Delete old data
  await supabase.from("rag_research_runs").delete().eq("rag_id", ragId);
  await supabase.from("rag_chunks").delete().eq("rag_id", ragId);
  await supabase.from("rag_sources").delete().eq("rag_id", ragId);
  await supabase.from("rag_variables").delete().eq("rag_id", ragId);
  await supabase.from("rag_taxonomy").delete().eq("rag_id", ragId);
  await supabase.from("rag_knowledge_graph_edges").delete().eq("rag_id", ragId);
  await supabase.from("rag_knowledge_graph_nodes").delete().eq("rag_id", ragId);
  await supabase.from("rag_contradictions").delete().eq("rag_id", ragId);
  await supabase.from("rag_quality_checks").delete().eq("rag_id", ragId);

  await updateRag(ragId as string, {
    status: "researching",
    total_sources: 0,
    total_chunks: 0,
    total_variables: 0,
    coverage_pct: 0,
    quality_verdict: null,
    error_log: null,
    current_phase: 0,
  });

  EdgeRuntime.waitUntil(triggerBatch(ragId as string, 0));

  return { ragId, status: "researching", message: "Regeneración iniciada con pipeline REAL" };
}

// ═══════════════════════════════════════
// ACTION: STATUS
// ═══════════════════════════════════════

async function handleStatus(userId: string, body: Record<string, unknown>) {
  const { ragId } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");

  const { data: runs } = await supabase
    .from("rag_research_runs")
    .select("*")
    .eq("rag_id", ragId)
    .order("created_at", { ascending: true });

  // Auto-heal stuck runs + stuck batches
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const now = Date.now();
  if (runs) {
    for (const run of runs) {
      if (run.status === "running" && run.started_at) {
        const startedAt = new Date(run.started_at).getTime();
        if (now - startedAt > TEN_MINUTES_MS) {
          console.warn(`Auto-heal: marking orphaned run ${run.id} as failed`);
          await supabase
            .from("rag_research_runs")
            .update({ status: "failed", error_log: "Timeout detectado (auto-heal)" })
            .eq("id", run.id);
          run.status = "failed";
        }
      }
    }

    const allDone = runs.every((r: Record<string, unknown>) => r.status === "completed" || r.status === "failed");
    const anyRunning = runs.some((r: Record<string, unknown>) => r.status === "running");
    const anyCompleted = runs.some((r: Record<string, unknown>) => r.status === "completed");
    const activeSubdomains = getActiveSubdomains(rag);
    const expectedRuns = activeSubdomains.length * RESEARCH_LEVELS.length;
    const hasAllRuns = runs.length >= expectedRuns;

    // STATUS IS READ-ONLY: do NOT mutate status to completed/failed here.
    // Only auto-heal stuck batches to keep pipeline moving.
    if (allDone && runs.length > 0 && (rag.status === "building" || rag.status === "researching")) {
      if (hasAllRuns) {
        // All research runs done — transition to post_processing and trigger post-build
        // Instead of marking completed, start the post-build chain
        console.log(`[handleStatus] All runs done for RAG ${ragId}, triggering post_processing`);
        await updateRag(ragId as string, { status: "post_processing" });
        rag.status = "post_processing";
        EdgeRuntime.waitUntil(triggerPostBuild(ragId as string, "knowledge_graph"));
      } else if (!anyRunning) {
        const lastRun = runs[runs.length - 1];
        const lastSubdomain = lastRun?.subdomain as string;
        const lastLevel = lastRun?.research_level as string;
        const lastSubIdx = activeSubdomains.findIndex((s) => (s.name_technical as string) === lastSubdomain);
        const lastLevelIdx = RESEARCH_LEVELS.indexOf(lastLevel);
        const nextBatchIdx = (lastSubIdx >= 0 && lastLevelIdx >= 0)
          ? lastSubIdx * RESEARCH_LEVELS.length + lastLevelIdx + 1
          : runs.length;

        if (nextBatchIdx < expectedRuns) {
          const lastCompletedAt = lastRun?.completed_at ? new Date(lastRun.completed_at as string).getTime() : 0;
          if (now - lastCompletedAt > FIVE_MINUTES_MS) {
            console.warn(`Auto-heal: re-triggering stuck batch ${nextBatchIdx} for RAG ${ragId}`);
            EdgeRuntime.waitUntil(triggerBatch(ragId as string, nextBatchIdx));
          }
        }
      }
    }

    // RECOVERY GUARD: if status is "completed" but post-build never ran, force it
    if (rag.status === "completed") {
      const { count: qcCount } = await supabase
        .from("rag_quality_checks")
        .select("*", { count: "exact", head: true })
        .eq("rag_id", ragId);

      if (!qcCount || qcCount === 0) {
        console.warn(`[handleStatus] RECOVERY: RAG ${ragId} is completed but has 0 quality_checks — forcing post-build`);
        await updateRag(ragId as string, { status: "post_processing" });
        rag.status = "post_processing";
        EdgeRuntime.waitUntil(triggerPostBuild(ragId as string, "knowledge_graph"));
      }
    }
  }

  const { data: quality } = await supabase
    .from("rag_quality_checks")
    .select("*")
    .eq("rag_id", ragId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { count: contradictionsCount } = await supabase
    .from("rag_contradictions")
    .select("*", { count: "exact", head: true })
    .eq("rag_id", ragId);

  const { count: gapsCount } = await supabase
    .from("rag_gaps")
    .select("*", { count: "exact", head: true })
    .eq("rag_id", ragId);

  return {
    ...rag,
    research_runs: runs || [],
    quality_check: quality?.[0] || null,
    contradictions_count: contradictionsCount || 0,
    gaps_count: gapsCount || 0,
  };
}

// ═══════════════════════════════════════
// ACTION: LIST
// ═══════════════════════════════════════

async function handleList(userId: string) {
  const { data, error } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return { rags: data || [] };
}

// ═══════════════════════════════════════
// ACTION: QUERY — ELITE PIPELINE (Query Rewriting + Boosts + MMR + A+B + Evidence Loop)
// ═══════════════════════════════════════

async function queryRewrite(question: string): Promise<string[]> {
  try {
    const result = await chatWithTimeout(
      [
        {
          role: "system",
          content: `Genera exactamente 3 sub-queries técnicas para maximizar la búsqueda en una base de conocimiento.

REGLAS ESTRICTAS:
- Usa SOLO sinónimos y términos técnicos estrictamente relacionados con la pregunta original.
- NO añadas conceptos nuevos que no estén implícitos en la pregunta.
- Cada sub-query debe cubrir un ángulo diferente: terminología técnica, sinónimos coloquiales, conceptos relacionados directos.

Responde SOLO con un JSON array de 3 strings.`,
        },
        { role: "user", content: question },
      ],
      { model: "gemini-flash", maxTokens: 512, temperature: 0.1, responseFormat: "json" },
      8000
    );
    const parsed = JSON.parse(result.trim().startsWith("[") ? result.trim() : cleanJson(result));
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 3).map(String);
  } catch (err) {
    console.warn("[QueryRewrite] Failed, using original:", err);
  }
  return [];
}

function applySourceAuthorityBoosts(chunks: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return chunks.map((c) => {
    let boost = 0;
    const tier = c.source_tier as string;
    if (tier === "tier1_gold" || tier === "A") boost += 0.15;
    else if (tier === "tier2_silver" || tier === "B") boost += 0.05;

    const evLevel = c.evidence_level as string;
    if (evLevel === "meta_analysis" || evLevel === "rct") boost += 0.10;

    if (c.peer_reviewed === true) boost += 0.05;

    const quality = c.quality as Record<string, unknown>;
    if (quality && typeof quality.score === "number" && quality.score >= 85) boost += 0.05;

    return { ...c, boosted_score: (c.rrf_score as number || c.similarity as number || 0) + boost };
  }).sort((a, b) => (b.boosted_score as number) - (a.boosted_score as number));
}

function applyMMRAndSourceCap(chunks: Array<Record<string, unknown>>, maxChunks = 8): Array<Record<string, unknown>> {
  const lambda = 0.7;
  const maxPerSource = 2;
  const candidates = chunks.slice(0, 15);
  const selected: Array<Record<string, unknown>> = [];
  const sourceCount: Record<string, number> = {};

  while (selected.length < maxChunks && candidates.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const sourceId = (c.source_name as string) || "unknown";
      if ((sourceCount[sourceId] || 0) >= maxPerSource) continue;

      const relevance = c.boosted_score as number || 0;
      let maxSim = 0;
      for (const s of selected) {
        // Simplified MMR: penalize same subdomain/source
        if (s.source_name === c.source_name) maxSim = Math.max(maxSim, 0.8);
        else if (s.subdomain === c.subdomain) maxSim = Math.max(maxSim, 0.4);
      }
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) { bestScore = mmrScore; bestIdx = i; }
    }

    if (bestIdx === -1) break;
    const chosen = candidates.splice(bestIdx, 1)[0];
    const sourceId = (chosen.source_name as string) || "unknown";
    sourceCount[sourceId] = (sourceCount[sourceId] || 0) + 1;
    selected.push(chosen);
  }

  return selected;
}

function verifyEvidenceChunks(answer: string, totalChunks: number): string[] {
  const refs = answer.match(/\[Chunk\s+(\d+)\]/g) || [];
  const invalid: string[] = [];
  for (const ref of refs) {
    const num = parseInt(ref.match(/\d+/)?.[0] || "0");
    if (num < 1 || num > totalChunks) invalid.push(ref);
  }
  return invalid;
}

async function handleQuery(userId: string, body: Record<string, unknown>) {
  const startTime = Date.now();
  const { ragId, question } = body;
  if (!ragId || !question) throw new Error("ragId and question are required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (rag.status !== "completed") throw new Error("RAG is not completed yet");

  // Step 1: Query Rewriting + Embeddings in parallel
  const [subQueries, questionEmbedding] = await Promise.all([
    queryRewrite(question as string),
    generateEmbedding(question as string),
  ]);

  const allQueries = [question as string, ...subQueries];

  // Step 2: Parallel hybrid search for all queries
  const embeddingPromises = subQueries.map((q) => generateEmbedding(q));
  const subEmbeddings = await Promise.all(embeddingPromises);
  const allEmbeddings = [questionEmbedding, ...subEmbeddings];

  const searchPromises = allQueries.map((q, i) =>
    supabase.rpc("search_rag_hybrid", {
      query_embedding: `[${allEmbeddings[i].join(",")}]`,
      query_text: q,
      match_rag_id: ragId,
      match_count: 15,
    }).then(({ data }) => data || []).catch(() => [])
  );
  const searchResults = await Promise.all(searchPromises);

  // Merge & dedup by chunk id, keeping highest rrf_score
  const chunkMap = new Map<string, Record<string, unknown>>();
  for (const results of searchResults) {
    for (const chunk of results) {
      const existing = chunkMap.get(chunk.id);
      if (!existing || (chunk.rrf_score || 0) > (existing.rrf_score as number || 0)) {
        chunkMap.set(chunk.id, chunk);
      }
    }
  }
  let candidateChunks = Array.from(chunkMap.values());
  const chunksRetrieved = candidateChunks.length;

  if (candidateChunks.length === 0) {
    const latencyMs = Date.now() - startTime;
    await supabase.from("rag_query_log").insert({
      rag_id: ragId, query: question as string, response: "No tengo evidencia suficiente para esta consulta.",
      chunks_used: [], quality_score: 0, latency_ms: latencyMs, chunks_retrieved: 0, reranked_count: 0,
    });
    return { answer: "No tengo evidencia suficiente para esta consulta.", sources: [], confidence: 0, evidence_chunks: [], claim_map: {} };
  }

  // Step 3: Answerability Gate — check average similarity
  const avgSimilarity = candidateChunks.reduce((sum, c) => sum + (c.similarity as number || 0), 0) / candidateChunks.length;
  if (avgSimilarity < 0.45) {
    const latencyMs = Date.now() - startTime;
    await supabase.from("rag_query_log").insert({
      rag_id: ragId, query: question as string, response: "No tengo evidencia suficiente para esta consulta.",
      chunks_used: [], quality_score: avgSimilarity, latency_ms: latencyMs, chunks_retrieved: chunksRetrieved, reranked_count: 0,
    });
    return { answer: "No tengo evidencia suficiente para esta consulta. La relevancia de las fuentes disponibles es demasiado baja.", sources: [], confidence: avgSimilarity, evidence_chunks: [], claim_map: {} };
  }

  // Step 4: Source Authority Boosts
  candidateChunks = applySourceAuthorityBoosts(candidateChunks);

  // Step 5: Rerank with Gemini
  const rerankedChunks = await rerankChunks(question as string, candidateChunks);
  const rerankedCount = rerankedChunks.length;

  // Step 6: MMR + Source Cap
  const finalChunks = applyMMRAndSourceCap(
    rerankedChunks.map((c) => ({ ...c, boosted_score: c.boosted_score || c.rrf_score || c.similarity || 0 })),
    8
  );

  // Step 7: Build A+B Elite Prompt
  const chunksContext = finalChunks
    .map((c: Record<string, unknown>, i: number) => {
      const sourceLine = c.source_url ? `[Fuente: ${c.source_name} — ${c.source_url}]` : `[Subdominio: ${c.subdomain}]`;
      const tierLabel = c.source_tier === "tier1_gold" || c.source_tier === "A" ? "🥇 Gold" : c.source_tier === "tier2_silver" || c.source_tier === "B" ? "🥈 Silver" : "🥉 Bronze";
      return `[Chunk ${i + 1} | Similitud: ${(c.similarity as number)?.toFixed(2) || 'N/A'} | Tier: ${tierLabel} | ${sourceLine}]\n${c.content}`;
    })
    .join("\n\n---\n\n");

  const domain = rag.domain_description as string;
  const systemPrompt = `Eres un asistente experto en ${domain}.
Tu conocimiento proviene EXCLUSIVAMENTE de los documentos proporcionados, que son fuentes REALES.

REGLAS A (CORRECCIÓN):
1. Responde SOLO con información de los documentos. NO inventes NADA.
2. Cada afirmación importante DEBE citar la fuente: (Fuente: nombre, URL) y referenciar [Chunk X].
3. Si hay debate entre fuentes, presenta AMBAS posturas sin tomar partido.
4. Si no tienes datos suficientes, dilo claramente.
5. Nunca hagas diagnóstico ni sustituyas consejo profesional.

REGLAS B (ACCIÓN):
6. Después de la evidencia, da pasos concretos que el usuario pueda ejecutar.
7. Incluye: qué hacer, qué NO hacer, señales de alerta.
8. Usa ejemplos de frases reales cuando sea útil.
9. Si el tema es sensible, añade "consulta con un profesional si..."

FORMATO DE SALIDA OBLIGATORIO:

## 📚 QUÉ DICE LA EVIDENCIA
[Claims verificados. Cada claim DEBE citar (Fuente: nombre, URL) y referenciar [Chunk X]]

## ✅ QUÉ HACER
[Pasos concretos y ejecutables basados en la evidencia]

## ❌ QUÉ NO HACER
[Errores comunes a evitar]

## ⚠️ SEÑALES DE ALERTA
[Cuándo consultar un profesional]

## 📎 FUENTES
[Lista numerada de fuentes con URLs]

Al final, indica tu nivel de confianza: {"confidence": 0.X}

DOCUMENTOS REALES:
${chunksContext}`;

  let answer = await chat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: question as string },
    ],
    { model: "gemini-pro", maxTokens: 4096, temperature: 0.2 }
  );

  // Step 8: Evidence Loop Correction (max 1 retry)
  const invalidRefs = verifyEvidenceChunks(answer, finalChunks.length);
  if (invalidRefs.length > 0) {
    console.warn(`[EvidenceLoop] Found ${invalidRefs.length} invalid chunk refs: ${invalidRefs.join(", ")}`);
    answer = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: question as string },
        { role: "assistant", content: answer },
        { role: "user", content: `CORRECCIÓN: Las siguientes referencias a chunks son inválidas y deben eliminarse: ${invalidRefs.join(", ")}. Regenera la respuesta eliminando las afirmaciones que dependían de esos chunks inexistentes. Mantén el mismo formato A+B.` },
      ],
      { model: "gemini-pro", maxTokens: 4096, temperature: 0.1 }
    );
  }

  // Parse confidence
  let confidence = 0.7;
  const confMatch = answer.match(/\{"confidence":\s*([\d.]+)\}/);
  if (confMatch) confidence = parseFloat(confMatch[1]);
  const cleanAnswer = answer.replace(/\{"confidence":\s*[\d.]+\}/, "").trim();

  // Build claim map (simplified: extract [Chunk X] references per section)
  const claimMap: Record<string, string[]> = {};
  const claimRegex = /([^.!?\n]+\[Chunk\s+\d+\][^.!?\n]*[.!?]?)/g;
  let match;
  while ((match = claimRegex.exec(cleanAnswer)) !== null) {
    const claim = match[1].trim();
    const chunkRefs = claim.match(/\[Chunk\s+(\d+)\]/g) || [];
    claimMap[claim.slice(0, 100)] = chunkRefs.map((r) => r.replace(/\[Chunk\s+/, "").replace("]", ""));
  }

  // Build evidence chunks for inspector
  const evidenceChunks = finalChunks.map((c, i) => ({
    chunk_id: c.id,
    chunk_index: i + 1,
    content_preview: (c.content as string).slice(0, 200),
    rrf_score: c.rrf_score || 0,
    boosted_score: c.boosted_score || 0,
    similarity: c.similarity || 0,
    source_name: c.source_name || "",
    source_url: c.source_url || "",
    source_tier: c.source_tier || "C",
    authority_score: c.authority_score || 0,
    subdomain: c.subdomain || "",
  }));

  // Latency logging
  const latencyMs = Date.now() - startTime;
  await supabase.from("rag_query_log").insert({
    rag_id: ragId,
    query: question as string,
    response: cleanAnswer,
    chunks_used: finalChunks.map((c) => c.subdomain as string),
    quality_score: confidence,
    latency_ms: latencyMs,
    chunks_retrieved: chunksRetrieved,
    reranked_count: rerankedCount,
  });

  return {
    answer: cleanAnswer,
    sources: finalChunks.map((c: Record<string, unknown>) => ({
      subdomain: c.subdomain,
      source_name: c.source_name,
      source_url: c.source_url,
      similarity: c.similarity,
      excerpt: (c.content as string).slice(0, 200) + "...",
      metadata: c.metadata,
    })),
    confidence,
    evidence_chunks: evidenceChunks,
    claim_map: claimMap,
    tokens_used: cleanAnswer.length,
    latency_ms: latencyMs,
  };
}

// ═══════════════════════════════════════
// ACTION: EXPORT
// ═══════════════════════════════════════

async function handleExport(userId: string, body: Record<string, unknown>) {
  const { ragId, format = "document_md" } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG project not found");
  if (rag.status !== "completed") throw new Error("RAG is not completed yet");

  const { data: chunks } = await supabase
    .from("rag_chunks")
    .select("content, subdomain, metadata")
    .eq("rag_id", ragId)
    .order("subdomain")
    .order("chunk_index");

  const { data: variables } = await supabase
    .from("rag_variables")
    .select("name, variable_type, description")
    .eq("rag_id", ragId);

  const { data: contradictions } = await supabase
    .from("rag_contradictions")
    .select("claim_a, claim_b, severity")
    .eq("rag_id", ragId);

  const { data: sources } = await supabase
    .from("rag_sources")
    .select("source_name, source_url, source_type, tier, quality_score, subdomain")
    .eq("rag_id", ragId);

  const domainMap = rag.domain_map as Record<string, unknown>;
  const subdomains = (domainMap?.subdomains as Array<Record<string, unknown>>) || [];

  let md = `# Base de Conocimiento: ${rag.domain_description}\n\n`;
  md += `**Fecha:** ${new Date(rag.updated_at as string).toLocaleDateString()}\n`;
  md += `**Cobertura:** ${rag.coverage_pct}% | **Fuentes:** ${rag.total_sources} | **Chunks:** ${rag.total_chunks}\n`;
  md += `**Veredicto:** ${rag.quality_verdict}\n\n---\n\n`;

  const intent = domainMap?.interpreted_intent as Record<string, unknown>;
  if (intent) {
    md += `## Resumen Ejecutivo\n\n**Necesidad:** ${intent.real_need}\n\n**Perfil:** ${intent.consumer_profile}\n\n`;
  }

  const chunksBySubdomain: Record<string, Array<Record<string, unknown>>> = {};
  for (const chunk of (chunks || [])) {
    const sd = chunk.subdomain as string;
    if (!chunksBySubdomain[sd]) chunksBySubdomain[sd] = [];
    chunksBySubdomain[sd].push(chunk);
  }

  for (const sub of subdomains) {
    const name = sub.name_technical as string;
    md += `\n---\n\n## ${name} (${sub.name_colloquial})\n\n`;

    const subChunks = chunksBySubdomain[name] || [];
    for (const chunk of subChunks) {
      md += `${chunk.content}\n\n`;
    }

    const subSources = (sources || []).filter((s: Record<string, unknown>) => s.subdomain === name);
    if (subSources.length > 0) {
      md += `### Fuentes\n\n`;
      for (const src of subSources) {
        md += `- **${src.source_name}** (${src.tier})${src.source_url ? ` — ${src.source_url}` : ""}\n`;
      }
      md += `\n`;
    }
  }

  if ((variables || []).length > 0) {
    md += `\n---\n\n## Variables Detectadas\n\n| Variable | Tipo | Descripción |\n|----------|------|-------------|\n`;
    for (const v of variables!) {
      md += `| ${v.name} | ${v.variable_type} | ${v.description} |\n`;
    }
  }

  if ((contradictions || []).length > 0) {
    md += `\n---\n\n## Contradicciones\n\n`;
    for (const c of contradictions!) {
      md += `- **${c.severity?.toUpperCase()}:** "${c.claim_a}" vs "${c.claim_b}"\n`;
    }
  }

  await supabase.from("rag_exports").insert({ rag_id: ragId as string, format: format as string });

  return { markdown: md, format };
}

// ═══════════════════════════════════════
// UPGRADE 7: PUBLIC QUERY (API key based)
// ═══════════════════════════════════════

async function handlePublicQuery(body: Record<string, unknown>) {
  const { ragId, question, apiKey } = body;
  if (!ragId || !question || !apiKey) throw new Error("ragId, question, and apiKey are required");

  // Validate API key
  const { data: keyRecord } = await supabase
    .from("rag_api_keys")
    .select("*")
    .eq("rag_id", ragId)
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (!keyRecord) throw new Error("Invalid or expired API key");

  // Check monthly usage
  const monthlyLimit = (keyRecord.monthly_limit as number) || 1000;
  const currentUsage = (keyRecord.monthly_usage as number) || 0;
  if (currentUsage >= monthlyLimit) throw new Error("Monthly usage limit exceeded");

  // Get the RAG
  const { data: rag } = await supabase
    .from("rag_projects")
    .select("*")
    .eq("id", ragId)
    .single();

  if (!rag || rag.status !== "completed") throw new Error("RAG not found or not ready");

  // Execute query (reuse internal logic)
  const questionEmbedding = await generateEmbedding(question as string);

  let candidateChunks: Array<Record<string, unknown>> = [];
  try {
    const { data: hybridResults } = await supabase.rpc("search_rag_hybrid", {
      query_embedding: `[${questionEmbedding.join(",")}]`,
      query_text: question as string,
      match_rag_id: ragId,
      match_count: 15,
    });
    candidateChunks = hybridResults || [];
  } catch {
    const { data: fallbackChunks } = await supabase.rpc("search_rag_chunks", {
      query_embedding: `[${questionEmbedding.join(",")}]`,
      match_rag_id: ragId,
      match_threshold: 0.5,
      match_count: 10,
    });
    candidateChunks = fallbackChunks || [];
  }

  if (candidateChunks.length === 0) {
    return { answer: "No tengo datos suficientes.", sources: [], confidence: 0 };
  }

  const rerankedChunks = await rerankChunks(question as string, candidateChunks);

  const chunksContext = rerankedChunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join("\n\n---\n\n");

  const answer = await chat(
    [
      { role: "system", content: `Eres un asistente experto en ${rag.domain_description}. Responde SOLO con información de los documentos.\n\nDOCUMENTOS:\n${chunksContext}` },
      { role: "user", content: question as string },
    ],
    { model: "gemini-pro", maxTokens: 4096, temperature: 0.2 }
  );

  // Increment usage
  await supabase
    .from("rag_api_keys")
    .update({ monthly_usage: currentUsage + 1, last_used_at: new Date().toISOString() })
    .eq("id", keyRecord.id);

  return {
    answer,
    sources: rerankedChunks.map((c) => ({
      subdomain: c.subdomain,
      excerpt: (c.content as string).slice(0, 200) + "...",
    })),
    confidence: 0.7,
  };
}

// ═══════════════════════════════════════
// UPGRADE 7: API KEY MANAGEMENT
// ═══════════════════════════════════════

async function handleManageApiKeys(userId: string, body: Record<string, unknown>) {
  const { ragId, subAction, keyId } = body;
  if (!ragId) throw new Error("ragId is required");

  // Verify ownership
  const { data: rag } = await supabase
    .from("rag_projects")
    .select("id")
    .eq("id", ragId)
    .eq("user_id", userId)
    .single();

  if (!rag) throw new Error("RAG not found");

  switch (subAction) {
    case "list": {
      const { data: keys } = await supabase
        .from("rag_api_keys")
        .select("id, api_key, name, is_active, monthly_usage, monthly_limit, created_at, last_used_at")
        .eq("rag_id", ragId)
        .order("created_at", { ascending: false });
      return { keys: keys || [] };
    }
    case "create": {
      const name = (body.name as string) || "API Key";
      const apiKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { data: newKey, error } = await supabase
        .from("rag_api_keys")
        .insert({
          rag_id: ragId,
          api_key: apiKey,
          name,
          is_active: true,
          monthly_limit: 1000,
          monthly_usage: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return { key: newKey };
    }
    case "revoke": {
      if (!keyId) throw new Error("keyId required");
      await supabase.from("rag_api_keys").update({ is_active: false }).eq("id", keyId).eq("rag_id", ragId);
      return { revoked: true };
    }
    default:
      throw new Error("Unknown subAction: " + subAction);
  }
}

// ═══════════════════════════════════════
// ACTION: FETCH SOURCES (for Ingestion Console)
// ═══════════════════════════════════════

async function handleFetchSources(userId: string, body: Record<string, unknown>) {
  const { ragId } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase.from("rag_projects").select("id").eq("id", ragId).eq("user_id", userId).single();
  if (!rag) throw new Error("RAG project not found");

  const { data: sources } = await supabase
    .from("rag_sources")
    .select("id, source_name, source_url, source_type, tier, status, word_count, authority_score, evidence_level, peer_reviewed, error, created_at")
    .eq("rag_id", ragId)
    .order("created_at", { ascending: false })
    .limit(200);

  return { sources: sources || [] };
}

// ═══════════════════════════════════════
// ACTION: FETCH JOB STATS (for Ingestion Console)
// ═══════════════════════════════════════

async function handleFetchJobStats(userId: string, body: Record<string, unknown>) {
  const { ragId } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase.from("rag_projects").select("id").eq("id", ragId).eq("user_id", userId).single();
  if (!rag) throw new Error("RAG project not found");

  const statuses = ["PENDING", "RUNNING", "RETRY", "DONE", "FAILED", "DLQ"];
  const stats: Record<string, number> = {};

  for (const status of statuses) {
    const { count } = await supabase.from("rag_jobs").select("*", { count: "exact", head: true }).eq("rag_id", ragId).eq("status", status);
    stats[status] = count || 0;
  }

  return { stats };
}

// ═══════════════════════════════════════
// ACTION: RETRY DLQ JOBS
// ═══════════════════════════════════════

async function handleRetryDlq(userId: string, body: Record<string, unknown>) {
  const { ragId } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase.from("rag_projects").select("id").eq("id", ragId).eq("user_id", userId).single();
  if (!rag) throw new Error("RAG project not found");

  const { data, error } = await supabase
    .from("rag_jobs")
    .update({ status: "PENDING", attempt: 0, run_after: new Date().toISOString(), locked_by: null, locked_at: null, error: null })
    .eq("rag_id", ragId)
    .eq("status", "DLQ")
    .select("id");

  if (error) throw error;
  return { retried: data?.length || 0 };
}

// ═══════════════════════════════════════
// ACTION: PURGE COMPLETED JOBS
// ═══════════════════════════════════════

async function handlePurgeJobs(userId: string, body: Record<string, unknown>) {
  const { ragId } = body;
  if (!ragId) throw new Error("ragId is required");

  const { data: rag } = await supabase.from("rag_projects").select("id").eq("id", ragId).eq("user_id", userId).single();
  if (!rag) throw new Error("RAG project not found");

  const { data, error } = await supabase.rpc("purge_completed_jobs", { target_rag_id: ragId });
  if (error) throw error;
  return { purged: data || 0 };
}

// ═══════════════════════════════════════
// PATTERN DETECTION ENGINE
// ═══════════════════════════════════════

async function internalRagQuery(ragId: string, question: string): Promise<{ answer: string; chunkIds: string[] }> {
  // Simplified internal query: embed → hybrid search → LLM answer
  const embedding = await generateEmbedding(question);
  const { data: chunks } = await supabase.rpc("search_rag_hybrid", {
    query_embedding: `[${embedding.join(",")}]`,
    query_text: question,
    match_rag_id: ragId,
    match_count: 10,
  });

  if (!chunks || chunks.length === 0) {
    return { answer: "Sin información disponible.", chunkIds: [] };
  }

  const chunkIds = chunks.map((c: Record<string, unknown>) => c.id as string);
  const context = chunks.map((c: Record<string, unknown>, i: number) => `[${i + 1}] ${(c.content as string).slice(0, 600)}`).join("\n\n");

  const answer = await chatWithTimeout(
    [
      { role: "system", content: `Responde basándote SOLO en los documentos proporcionados. Sé conciso y preciso.\n\nDOCUMENTOS:\n${context}` },
      { role: "user", content: question },
    ],
    { model: "gemini-flash", maxTokens: 2048, temperature: 0.2 },
    30000
  );

  return { answer, chunkIds };
}

async function executePatternDetection(body: Record<string, unknown>) {
  const runId = body.runId as string;
  const ragId = body.ragId as string;
  const projectId = body.projectId as string;

  if (!runId || !ragId) throw new Error("runId and ragId required");

  try {
    // Update status
    await supabase.from("pattern_detection_runs").update({ status: "ANALYZING_DOMAIN" }).eq("id", runId);

    // ── SUB-FASE 1: Domain Analysis via RAG queries ──
    const domainQueries = [
      "¿Cuáles son los principales conceptos, teorías y marcos teóricos de este dominio?",
      "¿Qué variables, métricas e indicadores son más relevantes en este campo?",
      "¿Cuáles son las tendencias emergentes y cambios recientes en este sector?",
      "¿Qué factores externos (regulatorios, tecnológicos, sociales) impactan este dominio?",
      "¿Cuáles son los principales actores, instituciones y fuentes de datos de referencia?",
      "¿Qué metodologías de análisis predictivo se utilizan en este campo?",
    ];

    const domainResults: Array<{ query: string; answer: string; chunkIds: string[] }> = [];
    for (const q of domainQueries) {
      try {
        const result = await internalRagQuery(ragId, q);
        domainResults.push({ query: q, ...result });
        await new Promise(r => setTimeout(r, 1000)); // Rate limit
      } catch (e) {
        console.error(`[PatternDetection] Domain query failed: ${q}`, e);
        domainResults.push({ query: q, answer: "Error en consulta", chunkIds: [] });
      }
    }

    const domainContext = {
      queries: domainResults.map(r => ({ q: r.query, a: r.answer.slice(0, 500) })),
      allChunkIds: [...new Set(domainResults.flatMap(r => r.chunkIds))],
    };

    await supabase.from("pattern_detection_runs").update({ status: "DETECTING_SOURCES", domain_context: domainContext }).eq("id", runId);

    // ── SUB-FASE 2: Detect Data Sources ──
    const sourceQueries = [
      "¿Qué APIs públicas, bases de datos abiertas y datasets están disponibles en este dominio?",
      "¿Qué fuentes de datos en tiempo real existen (sensores, mercados, redes sociales)?",
      "¿Qué instituciones publican informes periódicos o estadísticas oficiales?",
      "¿Qué herramientas de monitoreo o plataformas de análisis se usan en este sector?",
    ];

    const sourceResults: Array<{ query: string; answer: string; chunkIds: string[] }> = [];
    for (const q of sourceQueries) {
      try {
        const result = await internalRagQuery(ragId, q);
        sourceResults.push({ query: q, ...result });
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        sourceResults.push({ query: q, answer: "Error", chunkIds: [] });
      }
    }

    // Also query Knowledge Graph nodes
    const { data: kgNodes } = await supabase
      .from("rag_knowledge_graph_nodes")
      .select("label, node_type, description")
      .eq("rag_id", ragId)
      .in("node_type", ["institution", "tool", "dataset", "method"])
      .limit(30);

    const detectedSources = {
      fromQueries: sourceResults.map(r => ({ q: r.query, a: r.answer.slice(0, 400) })),
      kgNodes: (kgNodes || []).map(n => ({ label: n.label, type: n.node_type, desc: (n.description || "").slice(0, 200) })),
    };

    await supabase.from("pattern_detection_runs").update({ status: "GENERATING_PATTERNS", detected_sources: detectedSources }).eq("id", runId);

    // ── SUB-FASE 3: Generate Patterns with Gemini Pro ──
    const domainSummary = domainResults.map(r => `Q: ${r.query}\nA: ${r.answer.slice(0, 400)}`).join("\n\n");
    const sourcesSummary = sourceResults.map(r => `Q: ${r.query}\nA: ${r.answer.slice(0, 300)}`).join("\n\n");
    const kgSummary = (kgNodes || []).map(n => `- ${n.label} (${n.node_type}): ${(n.description || "").slice(0, 100)}`).join("\n");

    const patternPrompt = `Eres un analista de inteligencia predictiva de nivel senior. Basándote en el siguiente contexto de dominio, genera entre 10 y 15 patrones predictivos organizados en 5 capas.

CONTEXTO DEL DOMINIO:
${domainSummary}

FUENTES DE DATOS DISPONIBLES:
${sourcesSummary}

ENTIDADES DEL KNOWLEDGE GRAPH:
${kgSummary}

CAPAS DE ANÁLISIS:
1. OBVIA — Patrones evidentes que cualquier analista detectaría (correlaciones directas, tendencias lineales)
2. ANALÍTICA AVANZADA — Requieren modelado estadístico (regresiones multivariable, series temporales, clustering)
3. SEÑALES DÉBILES — Indicadores tempranos no obvios (cambios en patentes, movimientos regulatorios, shifts en comunidades)
4. INTELIGENCIA LATERAL — Cruces entre dominios aparentemente no relacionados (analogías de otros sectores)
5. EDGE EXTREMO — Hipótesis especulativas con potencial disruptivo (cisnes negros, convergencias tecnológicas)

Para cada patrón genera JSON exacto:
{
  "patterns": [
    {
      "name": "Nombre descriptivo del patrón",
      "description": "Descripción de 2-3 frases",
      "layer": 1-5,
      "layer_name": "Nombre de la capa",
      "impact": 0.0-1.0,
      "confidence": 0.0-1.0,
      "p_value": 0.001-0.5,
      "anticipation_days": 30-730,
      "data_sources": [{"name": "Fuente", "type": "api|dataset|report|sensor", "url": "si disponible"}],
      "evidence_summary": "Resumen de la evidencia que soporta este patrón",
      "counter_evidence": "Factores que podrían invalidar este patrón",
      "uncertainty_type": "aleatory|epistemic|model",
      "retrospective_cases": [{"case": "Ejemplo histórico", "outcome": "Qué pasó"}]
    }
  ]
}

IMPORTANTE: Genera EXACTAMENTE entre 10 y 15 patrones, distribuyendo al menos 2 en cada capa. Los de capas 4-5 deben ser genuinamente creativos y no convencionales.`;

    const patternsRaw = await chatWithTimeout(
      [
        { role: "system", content: "Eres un analista de inteligencia predictiva. Responde SOLO con JSON válido." },
        { role: "user", content: patternPrompt },
      ],
      { model: "gemini-pro", maxTokens: 8192, temperature: 0.7, responseFormat: "json" },
      60000
    );

    const parsed = safeParseJson(patternsRaw) as { patterns?: Array<Record<string, unknown>> };
    const patterns = parsed?.patterns || [];

    if (patterns.length === 0) {
      throw new Error("No patterns generated by LLM");
    }

    await supabase.from("pattern_detection_runs").update({ status: "VALIDATING", patterns: { raw: patterns } }).eq("id", runId);

    // ── SUB-FASE 4: Validate patterns against RAG chunks ──
    const validatedPatterns: Array<Record<string, unknown>> = [];

    for (const pattern of patterns) {
      const searchQuery = `${pattern.name} ${(pattern.description as string || "").slice(0, 200)}`;
      
      try {
        const embedding = await generateEmbedding(searchQuery);
        const { data: matchedChunks } = await supabase.rpc("search_rag_hybrid", {
          query_embedding: `[${embedding.join(",")}]`,
          query_text: searchQuery,
          match_rag_id: ragId,
          match_count: 5,
        });

        const relevantChunks = (matchedChunks || []).filter((c: Record<string, unknown>) => (c.rrf_score as number || 0) > 0.01);
        const chunkIds = relevantChunks.map((c: Record<string, unknown>) => c.id as string);

        let validationStatus = "moved_to_hypothesis";
        if (relevantChunks.length >= 2) validationStatus = "validated";
        else if (relevantChunks.length === 1) validationStatus = "degraded";

        validatedPatterns.push({
          ...pattern,
          validation_status: validationStatus,
          evidence_chunk_ids: chunkIds,
        });

        await new Promise(r => setTimeout(r, 500)); // Rate limit
      } catch (e) {
        console.error(`[PatternDetection] Validation failed for pattern: ${pattern.name}`, e);
        validatedPatterns.push({
          ...pattern,
          validation_status: "moved_to_hypothesis",
          evidence_chunk_ids: [],
        });
      }
    }

    // ── PERSIST: Save detected_patterns ──
    const { data: bizProject } = await supabase
      .from("business_projects")
      .select("user_id")
      .eq("id", projectId)
      .single();

    const userId = bizProject?.user_id;

    for (const p of validatedPatterns) {
      await supabase.from("detected_patterns").insert({
        run_id: runId,
        project_id: projectId,
        rag_id: ragId,
        user_id: userId,
        name: p.name as string,
        description: p.description as string || null,
        layer: (p.layer as number) || 1,
        layer_name: (p.layer_name as string) || "Desconocida",
        impact: p.impact as number || null,
        confidence: p.confidence as number || null,
        p_value: p.p_value as number || null,
        anticipation_days: p.anticipation_days as number || null,
        evidence_chunk_ids: (p.evidence_chunk_ids as string[]) || [],
        evidence_summary: p.evidence_summary as string || null,
        counter_evidence: p.counter_evidence as string || null,
        data_sources: p.data_sources || null,
        validation_status: p.validation_status as string,
        uncertainty_type: p.uncertainty_type as string || null,
        retrospective_cases: p.retrospective_cases || null,
      });
    }

    // Update run as completed
    const validationResults = {
      total: validatedPatterns.length,
      validated: validatedPatterns.filter(p => p.validation_status === "validated").length,
      degraded: validatedPatterns.filter(p => p.validation_status === "degraded").length,
      hypothesis: validatedPatterns.filter(p => p.validation_status === "moved_to_hypothesis").length,
    };

    await supabase.from("pattern_detection_runs").update({
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
      validation_results: validationResults,
    }).eq("id", runId);

    console.log(`[PatternDetection] Completed: ${validatedPatterns.length} patterns (${validationResults.validated} validated, ${validationResults.degraded} degraded, ${validationResults.hypothesis} hypothesis)`);

    return { ok: true, runId, patterns: validatedPatterns.length, validation: validationResults };

  } catch (err) {
    console.error("[PatternDetection] Fatal error:", err);
    await supabase.from("pattern_detection_runs").update({
      status: "FAILED",
      error: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    }).eq("id", runId);
    throw err;
  }
}

// ═══════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Service-role only actions
    if (action === "build-batch" || action === "post-build" || action === "execute-domain-analysis" || action === "resume-build" || action === "external-worker-poll" || action === "external-worker-complete" || action === "external-worker-fail" || action === "execute-pattern-detection" || action === "execute-kg-subdomain") {
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (token !== SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized: requires service role" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let result;
      if (action === "build-batch") {
        result = await handleBuildBatch(body);
      } else if (action === "post-build") {
        result = await handlePostBuild(body);
      } else if (action === "resume-build") {
        result = await handleResumeBuild(body);
      } else if (action === "external-worker-poll") {
        const workerId = (body.workerId as string) || "ext-unknown";
        const { data: jobs } = await supabase.rpc("pick_external_job", { p_worker_id: workerId });
        if (!jobs || jobs.length === 0) {
          result = { ok: true, job: null };
        } else {
          const job = jobs[0];
          const { data: src } = await supabase.from("rag_sources").select("source_url, source_name").eq("id", job.source_id).single();
          result = { ok: true, job: { id: job.id, rag_id: job.rag_id, source_id: job.source_id, url: src?.source_url, source_name: src?.source_name, payload: job.payload } };
        }
      } else if (action === "external-worker-complete") {
        const jobId = body.jobId as string;
        const extractedText = body.extractedText as string;
        const quality = (body.quality as string) || "medium";
        if (!jobId || !extractedText) throw new Error("jobId and extractedText required");
        await supabase.rpc("complete_external_job", { p_job_id: jobId, p_extracted_text: extractedText, p_extraction_quality: quality });
        result = { ok: true };
      } else if (action === "external-worker-fail") {
        const jobId = body.jobId as string;
        const errorMsg = body.error as string || "External worker failure";
        if (!jobId) throw new Error("jobId required");
        await supabase.rpc("mark_job_retry", { job_id: jobId, err: { message: errorMsg, source: "external_worker" } });
        result = { ok: true };
      } else if (action === "execute-pattern-detection") {
        result = await executePatternDetection(body);
      } else if (action === "execute-kg-subdomain") {
        const ragId = body.ragId as string;
        const subdomain = body.subdomain as string;
        if (!ragId || !subdomain) throw new Error("ragId and subdomain required");
        const kgResult = await buildKGForSubdomain(ragId, subdomain);
        result = { ok: true, ragId, subdomain, ...kgResult };
      } else {
        // execute-domain-analysis
        const ragId = body.ragId as string;
        if (!ragId) throw new Error("ragId is required");
        const { data: ragProject, error: ragErr } = await supabase
          .from("rag_projects")
          .select("domain_description, moral_mode")
          .eq("id", ragId)
          .single();
        if (ragErr || !ragProject) throw new Error("RAG project not found");
        await analyzeDomain(ragId, ragProject.domain_description, ragProject.moral_mode);
        result = { ok: true, ragId };
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Public query (API key auth, no JWT needed)
    if (action === "public_query") {
      const result = await handlePublicQuery(body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    let result: unknown;

    switch (action) {
      case "create":
        result = await handleCreate(userId, body);
        break;
      case "confirm":
        result = await handleConfirm(userId, body);
        break;
      case "status":
        result = await handleStatus(userId, body);
        break;
      case "list":
        result = await handleList(userId);
        break;
      case "query":
        result = await handleQuery(userId, body);
        break;
      case "export":
        result = await handleExport(userId, body);
        break;
      case "rebuild":
        result = await handleRebuild(userId, body);
        break;
      case "manage_api_keys":
        result = await handleManageApiKeys(userId, body);
        break;
      case "fetch_sources":
        result = await handleFetchSources(userId, body);
        break;
      case "fetch_job_stats":
        result = await handleFetchJobStats(userId, body);
        break;
      case "retry_dlq":
        result = await handleRetryDlq(userId, body);
        break;
      case "purge_jobs":
        result = await handlePurgeJobs(userId, body);
        break;
      case "resume":
        result = await handleResumeRequest(userId, body);
        break;
      case "regenerate-enrichment": {
        const { data: ragEnrich } = await supabase
          .from("rag_projects")
          .select("id")
          .eq("id", body.ragId)
          .eq("user_id", userId)
          .single();
        if (!ragEnrich) throw new Error("RAG not found or unauthorized");
        EdgeRuntime.waitUntil(triggerPostBuild(body.ragId, body.step || "knowledge_graph"));
        result = { status: "enrichment_started", ragId: body.ragId, step: body.step || "knowledge_graph" };
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("rag-architect error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
