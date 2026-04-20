// Edge function: enriquecer / crear contactos desde CSV de Contactos de Mac.
// Recibe { contacts: ParsedMacContact[], dryRun: boolean }
// Devuelve { enriched, created, skipped, collisionsResolved, ghostsMerged, errors }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

function pickWaId(phones: string[]): string | null {
  // Prioriza móviles (empiezan por 6/7 en ES tras prefijo 34)
  const mobile = phones.find(p => /^34[679]/.test(p)) || phones.find(p => /^[679]/.test(p));
  return mobile || phones[0] || null;
}

function normName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Cliente con JWT del usuario para identificarlo
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Cliente con service role para insertar/actualizar sin restricciones de RLS
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();
    const incoming: IncomingContact[] = body.contacts || [];
    const dryRun: boolean = !!body.dryRun;

    if (!Array.isArray(incoming) || incoming.length === 0) {
      return new Response(JSON.stringify({ error: "No contacts" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cargar TODOS los contactos del usuario (paginado por seguridad)
    const existing: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await admin
        .from("people_contacts")
        .select("id, name, wa_id, phone_numbers, emails, company, role")
        .eq("user_id", userId)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      existing.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Índices de lookup
    const byName = new Map<string, any>();
    const byPhone = new Map<string, any>(); // normalized digits → contact
    const byWaId = new Map<string, any>();
    for (const c of existing) {
      if (c.name) byName.set(normName(c.name), c);
      if (c.wa_id) byWaId.set(c.wa_id, c);
      const phones = (c.phone_numbers || []) as string[];
      for (const p of phones) {
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
        // Buscar match: por teléfono normalizado (cualquiera) o por nombre exacto
        let match: any = null;
        for (const p of vc.phonesNormalized) {
          if (byPhone.has(p)) { match = byPhone.get(p); break; }
          if (byWaId.has(p)) { match = byWaId.get(p); break; }
        }
        if (!match && vc.fullName) {
          const m = byName.get(normName(vc.fullName));
          if (m) match = m;
        }

        const desiredWaId = pickWaId(vc.phonesNormalized);

        if (match) {
          // ENRIQUECER
          const updates: any = {};
          let need = false;

          // wa_id: solo rellenar si falta
          if (!match.wa_id && desiredWaId) {
            // Comprobar colisión: ¿otro contacto ya tiene ese wa_id?
            const collide = byWaId.get(desiredWaId);
            if (collide && collide.id !== match.id) {
              // Fantasma a fusionar → mover mensajes al match real
              if (!dryRun) {
                await admin.from("contact_messages")
                  .update({ contact_id: match.id })
                  .eq("user_id", userId)
                  .eq("contact_id", collide.id);
                await admin.from("people_contacts")
                  .delete()
                  .eq("id", collide.id)
                  .eq("user_id", userId);
                await admin.from("contact_headlines")
                  .delete()
                  .eq("contact_id", collide.id);
              }
              ghostsMerged++;
              byWaId.delete(desiredWaId);
              collisionsResolved++;
            }
            updates.wa_id = desiredWaId;
            need = true;
          }

          // phone_numbers: añadir nuevos
          const existingPhones = new Set(
            (match.phone_numbers || []).map((p: string) => String(p).replace(/[^\d]/g, ""))
          );
          const newPhones = vc.phonesNormalized.filter(p => !existingPhones.has(p));
          if (newPhones.length > 0) {
            updates.phone_numbers = [...(match.phone_numbers || []), ...newPhones];
            need = true;
          }

          // emails: añadir nuevos
          const existingEmails = new Set((match.emails || []).map((e: string) => e.toLowerCase()));
          const newEmails = vc.emails.filter(e => !existingEmails.has(e.toLowerCase()));
          if (newEmails.length > 0) {
            updates.emails = [...(match.emails || []), ...newEmails];
            need = true;
          }

          // Empresa / puesto si están vacíos
          if (!match.company && vc.organization) { updates.company = vc.organization; need = true; }
          if (!match.role && vc.title) { updates.role = vc.title; need = true; }

          if (need) {
            if (!dryRun) {
              await admin.from("people_contacts").update(updates).eq("id", match.id);
              await admin.from("contact_headlines").delete().eq("contact_id", match.id);
            }
            enriched++;
            touchedIds.add(match.id);
            // refrescar índices locales
            if (updates.wa_id) byWaId.set(updates.wa_id, match);
            for (const p of newPhones) byPhone.set(p, match);
          } else {
            skipped++;
          }
        } else {
          // CREAR
          if (!dryRun) {
            const { data: nc, error: insErr } = await admin
              .from("people_contacts")
              .insert({
                user_id: userId,
                name: vc.fullName,
                wa_id: desiredWaId,
                phone_numbers: vc.phonesNormalized,
                emails: vc.emails,
                company: vc.organization,
                role: vc.title,
                notes: vc.notes,
                source: "mac_csv_import",
              })
              .select("id")
              .single();
            if (insErr) throw insErr;
            if (nc) {
              touchedIds.add(nc.id);
              const stub = { id: nc.id, name: vc.fullName, wa_id: desiredWaId, phone_numbers: vc.phonesNormalized, emails: vc.emails };
              byName.set(normName(vc.fullName), stub);
              if (desiredWaId) byWaId.set(desiredWaId, stub);
              for (const p of vc.phonesNormalized) byPhone.set(p, stub);
            }
          }
          created++;
        }
      } catch (e: any) {
        errors.push(`${vc.fullName}: ${e.message || e}`);
      }
    }

    return new Response(
      JSON.stringify({
        enriched,
        created,
        skipped,
        collisionsResolved,
        ghostsMerged,
        touched: touchedIds.size,
        errors: errors.slice(0, 20),
        dryRun,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("import-mac-contacts error", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
