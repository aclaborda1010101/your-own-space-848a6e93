// Edge function temporal para enriquecer contactos del usuario Agustín con
// el dump del XLSX (parseado y normalizado). Solo lee el array que llega en el body.
// No requiere JWT — usa service role y un user_id hardcodeado a Agustín.

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

async function pgRpc(url: string, key: string, sql: string) {
  // Usamos la REST de Supabase para ejecutar via función SQL? No existe.
  // Vamos directo via PostgREST: insertamos a la staging via /rest/v1/_tmp_mac_import
  throw new Error("not used");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!SUPABASE_URL || !SERVICE) return json({ error: "missing env" }, 500);

    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : null;
    if (!rows) return json({ error: "rows array required" }, 400);

    // 1. Limpiar staging
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/_tmp_mac_import?id=gte.0`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: "return=minimal" },
    });
    if (!delRes.ok && delRes.status !== 404) {
      return json({ error: "truncate failed", detail: await delRes.text() }, 500);
    }

    // 2. Insertar staging en chunks de 500 vía PostgREST
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r: any) => ({
        name: r.name,
        name_norm: r.name_norm,
        desired_wa: r.desired_wa,
        phones: r.phones,
      }));
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/_tmp_mac_import`, {
        method: "POST",
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(chunk),
      });
      if (!ins.ok) {
        return json({ error: "insert chunk failed", chunk: i, detail: await ins.text() }, 500);
      }
      inserted += chunk.length;
    }

    // 3. Llamar la función matching+merge: como no tenemos rpc dedicado, hacemos
    //    select por chunks y matching en JS.
    //
    //    Estrategia: traemos people_contacts de Agustín, hacemos match en memoria,
    //    generamos UPDATE/DELETE individuales vía PostgREST.

    // 3a. Cargar todos los contactos de Agustín
    const cRes = await fetch(
      `${SUPABASE_URL}/rest/v1/people_contacts?user_id=eq.${USER_ID}&select=id,name,wa_id,phone_numbers&limit=5000`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
    );
    if (!cRes.ok) return json({ error: "load contacts failed", detail: await cRes.text() }, 500);
    const contacts = (await cRes.json()) as Array<{
      id: string;
      name: string | null;
      wa_id: string | null;
      phone_numbers: string[] | null;
    }>;

    const normName = (s: string) =>
      (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

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

    let matchedByPhone = 0;
    let matchedByName = 0;
    let enriched = 0;
    let ghostsMerged = 0;
    const unmatched: Array<{ name: string; phones: string[] }> = [];
    const touchedDetails: Array<{ name: string; contact_id: string; wa_id: string; via: string }> = [];

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
        continue;
      }
      if (via === "phone") matchedByPhone++; else matchedByName++;

      // Resolver colisión: ¿hay un fantasma que ya tenga desired_wa?
      const ghost = byPhone.get(r.desired_wa);
      if (ghost && ghost.id !== match.id) {
        // mover mensajes ghost -> match
        await fetch(
          `${SUPABASE_URL}/rest/v1/contact_messages?user_id=eq.${USER_ID}&contact_id=eq.${ghost.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
              "Content-Type": "application/json", Prefer: "return=minimal",
            },
            body: JSON.stringify({ contact_id: match.id }),
          },
        );
        // borrar headlines del ghost
        await fetch(
          `${SUPABASE_URL}/rest/v1/contact_headlines?contact_id=eq.${ghost.id}`,
          { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: "return=minimal" } },
        );
        // borrar el ghost
        await fetch(
          `${SUPABASE_URL}/rest/v1/people_contacts?id=eq.${ghost.id}&user_id=eq.${USER_ID}`,
          { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: "return=minimal" } },
        );
        ghostsMerged++;
        byPhone.delete(r.desired_wa);
      }

      // mergear phones + setear wa_id si falta
      const existingDigits = new Set((match.phone_numbers || []).map((p) => String(p).replace(/[^\d]/g, "")));
      const mergedPhones = [...(match.phone_numbers || [])];
      for (const p of r.phones) if (!existingDigits.has(p)) mergedPhones.push(p);

      const updates: Record<string, unknown> = {};
      let needUpdate = false;
      if (!match.wa_id) { updates.wa_id = r.desired_wa; needUpdate = true; }
      if (mergedPhones.length !== (match.phone_numbers || []).length) {
        updates.phone_numbers = mergedPhones; needUpdate = true;
      }
      if (needUpdate) {
        const upd = await fetch(
          `${SUPABASE_URL}/rest/v1/people_contacts?id=eq.${match.id}&user_id=eq.${USER_ID}`,
          {
            method: "PATCH",
            headers: {
              apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
              "Content-Type": "application/json", Prefer: "return=minimal",
            },
            body: JSON.stringify(updates),
          },
        );
        if (upd.ok) {
          enriched++;
          // borrar headline del touched para regen
          await fetch(
            `${SUPABASE_URL}/rest/v1/contact_headlines?contact_id=eq.${match.id}`,
            { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: "return=minimal" } },
          );
          // actualiza maps locales
          if (typeof updates.wa_id === "string") byPhone.set(updates.wa_id, { ...match, wa_id: updates.wa_id });
          for (const p of r.phones) byPhone.set(p, { ...match, phone_numbers: mergedPhones });
        }
        touchedDetails.push({ name: r.name, contact_id: match.id, wa_id: r.desired_wa, via });
      }
    }

    return json({
      total: rows.length,
      inserted_staging: inserted,
      matchedByPhone,
      matchedByName,
      enriched,
      ghostsMerged,
      unmatched_count: unmatched.length,
      unmatched_sample: unmatched.slice(0, 30),
      touched_sample: touchedDetails.slice(0, 30),
      checks: {
        juan_jacome: touchedDetails.find((t) => t.name.toLowerCase().includes("jacome")) ||
                      unmatched.find((u) => u.name.toLowerCase().includes("jacome")) || null,
        laura_militar: touchedDetails.find((t) => t.name.toLowerCase().includes("militar")) ||
                       unmatched.find((u) => u.name.toLowerCase().includes("militar")) || null,
        rafa_obra: touchedDetails.find((t) => t.name.toLowerCase().includes("obra")) ||
                   unmatched.find((u) => u.name.toLowerCase().includes("obra")) || null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
