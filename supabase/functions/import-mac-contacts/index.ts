const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncomingContact {
  fullName: string;
  organization: string | null;
  title: string | null;
  phones: string[];
  phonesNormalized: string[];
  emails: string[];
  notes: string | null;
  birthday: string | null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickWaId(phones: string[]): string | null {
  const mobile = phones.find((p) => /^34[679]/.test(p)) || phones.find((p) => /^[679]/.test(p));
  return mobile || phones[0] || null;
}

async function getUserId(supabaseUrl: string, anonKey: string, authHeader: string): Promise<string | null> {
  if (!authHeader) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authHeader,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.id || null;
}

async function pgSelect(supabaseUrl: string, serviceRole: string, table: string, query: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`select ${table} failed: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

async function pgInsert(supabaseUrl: string, serviceRole: string, table: string, rows: unknown, returning = "representation") {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      Prefer: `return=${returning}`,
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`insert ${table} failed: ${res.status} ${await res.text()}`);
  }
  return returning === "minimal" ? null : await res.json();
}

async function pgPatch(supabaseUrl: string, serviceRole: string, table: string, filter: string, body: unknown, returning = "minimal") {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      Prefer: `return=${returning}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`patch ${table} failed: ${res.status} ${await res.text()}`);
  }
  return returning === "minimal" ? null : await res.json();
}

async function pgDelete(supabaseUrl: string, serviceRole: string, table: string, filter: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      Prefer: "return=minimal",
    },
  });
  if (!res.ok) {
    throw new Error(`delete ${table} failed: ${res.status} ${await res.text()}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";

    if (!supabaseUrl || !anonKey || !serviceRole) {
      return json({ error: "Missing Supabase env vars" }, 500);
    }

    const userId = await getUserId(supabaseUrl, anonKey, authHeader);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const incoming = Array.isArray(body?.contacts) ? (body.contacts as IncomingContact[]) : [];
    const dryRun = !!body?.dryRun;

    if (incoming.length === 0) return json({ error: "No contacts" }, 400);

    const existing = await pgSelect(
      supabaseUrl,
      serviceRole,
      "people_contacts",
      `select=id,name,wa_id,phone_numbers,emails,company,role&user_id=eq.${encodeURIComponent(userId)}&limit=5000`,
    ) as any[];

    const byName = new Map<string, any>();
    const byPhone = new Map<string, any>();
    const byWaId = new Map<string, any>();

    for (const c of existing) {
      if (c.name) byName.set(normName(c.name), c);
      if (c.wa_id) byWaId.set(String(c.wa_id), c);
      for (const p of c.phone_numbers || []) {
        const n = String(p).replace(/[^\d]/g, "");
        if (n) byPhone.set(n, c);
      }
    }

    let enriched = 0;
    let created = 0;
    let skipped = 0;
    let collisionsResolved = 0;
    let ghostsMerged = 0;
    const touchedIds = new Set<string>();
    const errors: string[] = [];

    for (const vc of incoming) {
      try {
        let match: any = null;
        for (const p of vc.phonesNormalized || []) {
          if (byPhone.has(p)) { match = byPhone.get(p); break; }
          if (byWaId.has(p)) { match = byWaId.get(p); break; }
        }
        if (!match && vc.fullName) {
          const maybe = byName.get(normName(vc.fullName));
          if (maybe) match = maybe;
        }

        const desiredWaId = pickWaId(vc.phonesNormalized || []);

        if (match) {
          const updates: Record<string, unknown> = {};
          let need = false;

          if (!match.wa_id && desiredWaId) {
            const collide = byWaId.get(desiredWaId);
            if (collide && collide.id !== match.id) {
              if (!dryRun) {
                await pgPatch(
                  supabaseUrl,
                  serviceRole,
                  "contact_messages",
                  `user_id=eq.${encodeURIComponent(userId)}&contact_id=eq.${encodeURIComponent(collide.id)}`,
                  { contact_id: match.id },
                );
                await pgDelete(
                  supabaseUrl,
                  serviceRole,
                  "people_contacts",
                  `id=eq.${encodeURIComponent(collide.id)}&user_id=eq.${encodeURIComponent(userId)}`,
                );
                await pgDelete(
                  supabaseUrl,
                  serviceRole,
                  "contact_headlines",
                  `contact_id=eq.${encodeURIComponent(collide.id)}`,
                );
              }
              ghostsMerged++;
              collisionsResolved++;
              byWaId.delete(desiredWaId);
            }
            updates.wa_id = desiredWaId;
            need = true;
          }

          const existingPhones = new Set((match.phone_numbers || []).map((p: string) => String(p).replace(/[^\d]/g, "")));
          const newPhones = (vc.phonesNormalized || []).filter((p) => !existingPhones.has(p));
          if (newPhones.length > 0) {
            updates.phone_numbers = [...(match.phone_numbers || []), ...newPhones];
            need = true;
          }

          const existingEmails = new Set((match.emails || []).map((e: string) => String(e).toLowerCase()));
          const newEmails = (vc.emails || []).filter((e) => !existingEmails.has(String(e).toLowerCase()));
          if (newEmails.length > 0) {
            updates.emails = [...(match.emails || []), ...newEmails];
            need = true;
          }

          if (!match.company && vc.organization) { updates.company = vc.organization; need = true; }
          if (!match.role && vc.title) { updates.role = vc.title; need = true; }

          if (need) {
            if (!dryRun) {
              await pgPatch(supabaseUrl, serviceRole, "people_contacts", `id=eq.${encodeURIComponent(match.id)}`, updates);
              await pgDelete(supabaseUrl, serviceRole, "contact_headlines", `contact_id=eq.${encodeURIComponent(match.id)}`);
            }
            enriched++;
            touchedIds.add(match.id);
            if (typeof updates.wa_id === "string") byWaId.set(updates.wa_id, { ...match, ...updates });
            for (const p of newPhones) byPhone.set(p, { ...match, ...updates });
          } else {
            skipped++;
          }
        } else {
          if (!dryRun) {
            const inserted = await pgInsert(supabaseUrl, serviceRole, "people_contacts", {
              user_id: userId,
              name: vc.fullName,
              wa_id: desiredWaId,
              phone_numbers: vc.phonesNormalized || [],
              emails: vc.emails || [],
              company: vc.organization,
              role: vc.title,
              notes: vc.notes,
              source: "mac_csv_import",
            }) as any[];
            const nc = inserted?.[0];
            if (nc?.id) touchedIds.add(nc.id);
          }
          created++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${vc.fullName}: ${msg}`);
      }
    }

    return json({
      enriched,
      created,
      skipped,
      collisionsResolved,
      ghostsMerged,
      touched: touchedIds.size,
      errors: errors.slice(0, 20),
      dryRun,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("import-mac-contacts error", msg);
    return json({ error: msg }, 500);
  }
});
