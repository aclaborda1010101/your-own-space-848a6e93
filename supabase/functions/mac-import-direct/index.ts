// Edge function temporal: enriquecer + crear contactos nuevos para Agustín
// desde el dump del XLSX. Recibe { rows: [...], createMissing: bool }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USER_ID = "f103da90-81d4-43a2-ad34-b33db8b9c369"; // agustin@hustleovertalks.com

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!SUPABASE_URL || !SERVICE) return json({ error: "missing env" }, 500);

    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : null;
    const createMissing = !!body?.createMissing;
    if (!rows) return json({ error: "rows array required" }, 400);

    // Cargar contactos actuales
    const cRes = await fetch(
      `${SUPABASE_URL}/rest/v1/people_contacts?user_id=eq.${USER_ID}&select=id,name,wa_id,phone_numbers&limit=10000`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
    );
    if (!cRes.ok) return json({ error: "load contacts failed", detail: await cRes.text() }, 500);
    const contacts = (await cRes.json()) as Array<{
      id: string; name: string | null; wa_id: string | null; phone_numbers: string[] | null;
    }>;

    const normName = (s: string) =>
      (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ").trim();

    const byPhone = new Map<string, typeof contacts[number]>();
    const byName = new Map<string, typeof contacts[number]>();
    for (const c of contacts) {
      if (c.wa_id) byPhone.set(c.wa_id, c);
      for (const p of c.phone_numbers || []) {
        const d = String(p).replace(/[^\d]/g, "");
        if (d) byPhone.set(d, c);
      }
      if (c.name) byName.set(normName(c.name), c);
    }

    let matchedByPhone = 0, matchedByName = 0, enriched = 0, ghostsMerged = 0;
    let created = 0, skipped = 0;
    const unmatched: Array<{ name: string; phones: string[] }> = [];
    const toCreate: Array<{ user_id: string; name: string; wa_id: string; phone_numbers: string[]; metadata: Record<string, unknown> }> = [];

    for (const r of rows as Array<{ name: string; name_norm: string; desired_wa: string; phones: string[] }>) {
      let match: typeof contacts[number] | undefined;
      let via = "";
      for (const p of r.phones) {
        if (byPhone.has(p)) { match = byPhone.get(p); via = "phone"; break; }
      }
      if (!match) {
        const m = byName.get(r.name_norm);
        if (m) { match = m; via = "name"; }
      }

      if (!match) {
        unmatched.push({ name: r.name, phones: r.phones });
        if (createMissing) {
          // Evitar duplicar entre rows del mismo lote: marcar phones como ya usados
          const taken = r.phones.some((p) => byPhone.has(p));
          if (taken) { skipped++; continue; }
          const newRow = {
            user_id: USER_ID,
            name: r.name,
            wa_id: r.desired_wa,
            phone_numbers: r.phones,
            metadata: { source: "mac_csv_import" },
          };
          toCreate.push(newRow);
          // marcar para no duplicar en el resto del bucle
          const fake = { id: "_pending_", name: r.name, wa_id: r.desired_wa, phone_numbers: r.phones };
          for (const p of r.phones) byPhone.set(p, fake as any);
          byName.set(r.name_norm, fake as any);
        }
        continue;
      }

      if (via === "phone") matchedByPhone++; else matchedByName++;

      // Colisión: ¿hay un fantasma con desired_wa?
      const ghost = byPhone.get(r.desired_wa);
      if (ghost && ghost.id !== match.id && ghost.id !== "_pending_") {
        await fetch(`${SUPABASE_URL}/rest/v1/contact_messages?user_id=eq.${USER_ID}&contact_id=eq.${ghost.id}`, {
          method: "PATCH",
          headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ contact_id: match.id }),
        });
        await fetch(`${SUPABASE_URL}/rest/v1/contact_headlines?contact_id=eq.${ghost.id}`, {
          method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: "return=minimal" },
        });
        await fetch(`${SUPABASE_URL}/rest/v1/people_contacts?id=eq.${ghost.id}&user_id=eq.${USER_ID}`, {
          method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: "return=minimal" },
        });
        ghostsMerged++;
        byPhone.delete(r.desired_wa);
      }

      const existingDigits = new Set((match.phone_numbers || []).map((p) => String(p).replace(/[^\d]/g, "")));
      const mergedPhones = [...(match.phone_numbers || [])];
      for (const p of r.phones) if (!existingDigits.has(p)) mergedPhones.push(p);

      const updates: Record<string, unknown> = {};
      let need = false;
      if (!match.wa_id) { updates.wa_id = r.desired_wa; need = true; }
      if (mergedPhones.length !== (match.phone_numbers || []).length) {
        updates.phone_numbers = mergedPhones; need = true;
      }
      if (need) {
        const upd = await fetch(
          `${SUPABASE_URL}/rest/v1/people_contacts?id=eq.${match.id}&user_id=eq.${USER_ID}`,
          {
            method: "PATCH",
            headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify(updates),
          },
        );
        if (upd.ok) {
          enriched++;
          await fetch(`${SUPABASE_URL}/rest/v1/contact_headlines?contact_id=eq.${match.id}`, {
            method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: "return=minimal" },
          });
          if (typeof updates.wa_id === "string") byPhone.set(updates.wa_id, { ...match, wa_id: updates.wa_id });
          for (const p of r.phones) byPhone.set(p, { ...match, phone_numbers: mergedPhones });
        }
      }
    }

    // Insertar los nuevos en bulk de 200
    const createdDetails: Array<{ name: string; wa_id: string }> = [];
    if (createMissing && toCreate.length > 0) {
      for (let i = 0; i < toCreate.length; i += 200) {
        const chunk = toCreate.slice(i, i + 200);
        const ins = await fetch(`${SUPABASE_URL}/rest/v1/people_contacts`, {
          method: "POST",
          headers: {
            apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
            "Content-Type": "application/json", Prefer: "return=minimal",
          },
          body: JSON.stringify(chunk),
        });
        if (!ins.ok) {
          return json({ error: "bulk insert failed", chunk_start: i, detail: await ins.text(), created_so_far: created }, 500);
        }
        created += chunk.length;
        for (const c of chunk) createdDetails.push({ name: c.name, wa_id: c.wa_id });
      }
    }

    return json({
      total: rows.length,
      matchedByPhone, matchedByName, enriched, ghostsMerged,
      created, skipped,
      unmatched_total: unmatched.length,
      checks: {
        juan_jacome: createdDetails.find((t) => t.name.toLowerCase().includes("jacome")) || null,
        laura_militar: createdDetails.find((t) => t.name.toLowerCase().includes("militar")) || null,
        rafa_obra: createdDetails.find((t) => t.name.toLowerCase().includes("obra")) || null,
      },
      created_sample: createdDetails.slice(0, 20),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
