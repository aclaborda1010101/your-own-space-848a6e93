// Send push notification via APNs (iOS) using a .p8 signing key.
// Endpoint: POST { user_id, title, body, data?, notification_type?, scheduled_id?, bypass_preferences? }
//
// Required secrets:
//   - APNS_KEY_ID         (10-char Key ID)
//   - APNS_TEAM_ID        (10-char Apple Team ID)
//   - APNS_BUNDLE_ID      (e.g. com.maniasstudio.jarvis)  — fallback used if missing
//   - APNS_KEY_P8         (raw .p8 contents incl. -----BEGIN PRIVATE KEY-----)
//                         (also accepts legacy name APNS_KEY for backwards compat)
//   - APNS_USE_SANDBOX    ("true" for dev/TestFlight, otherwise prod)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendPayload {
  user_id?: string;
  device_token?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  notification_type?: string;
  scheduled_id?: string;
  bypass_preferences?: boolean;
  badge?: number;
  sound?: string;
}

let cachedJwt: { token: string; exp: number } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let payload: SendPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!payload.title || !payload.body) {
    return json({ error: "title and body are required" }, 400);
  }
  if (!payload.user_id && !payload.device_token) {
    return json({ error: "user_id or device_token required" }, 400);
  }

  // 1. Preferences gate (only when targeting a user)
  if (payload.user_id && !payload.bypass_preferences) {
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", payload.user_id)
      .maybeSingle();

    if (prefs && !prefs.enabled) {
      return await markAndReturn(supabase, payload.scheduled_id, "skipped_disabled", "Notifications disabled");
    }
    if (!subgroupEnabled(prefs, payload.notification_type)) {
      return await markAndReturn(supabase, payload.scheduled_id, "skipped_disabled", "Subgroup disabled");
    }
    const { data: quiet } = await supabase.rpc("is_in_quiet_hours", { p_user_id: payload.user_id });
    if (quiet === true) {
      return await markAndReturn(supabase, payload.scheduled_id, "skipped_quiet_hours", "Quiet hours");
    }
  }

  // 2. Resolve target tokens
  let targets: { token: string; platform: string }[] = [];
  if (payload.device_token) {
    targets = [{ token: payload.device_token, platform: "ios" }];
  } else {
    const { data: tokens, error: tokErr } = await supabase
      .from("device_tokens")
      .select("token, platform")
      .eq("user_id", payload.user_id!)
      .eq("is_active", true);
    if (tokErr) return json({ error: tokErr.message }, 500);
    targets = (tokens ?? []).filter((t) => t.platform === "ios");
  }

  if (targets.length === 0) {
    return await markAndReturn(supabase, payload.scheduled_id, "failed", "No active iOS device tokens");
  }

  // 3. Sign APNs JWT
  let apnsJwt: string;
  try {
    apnsJwt = await getApnsJwt();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return await markAndReturn(supabase, payload.scheduled_id, "failed", `APNs JWT: ${msg}`);
  }

  const bundleId = Deno.env.get("APNS_BUNDLE_ID") || "com.maniasstudio.jarvis";
  const useSandbox = (Deno.env.get("APNS_USE_SANDBOX") ?? "true").toLowerCase() === "true";
  const host = useSandbox ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";

  // 4. Send
  const apsBody = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: payload.sound ?? "default",
      badge: payload.badge ?? 1,
      "mutable-content": 1,
    },
    ...(payload.data ?? {}),
    notification_type: payload.notification_type ?? "custom",
  };
  const apsBodyStr = JSON.stringify(apsBody);

  const results = await Promise.all(
    targets.map(async (t) => {
      try {
        const res = await fetch(`${host}/3/device/${t.token}`, {
          method: "POST",
          headers: {
            authorization: `bearer ${apnsJwt}`,
            "apns-topic": bundleId,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "content-type": "application/json",
          },
          body: apsBodyStr,
        });
        if (res.status === 200) return { token: t.token, ok: true };
        const errBody = await res.text();
        if (res.status === 410 || /BadDeviceToken|Unregistered/i.test(errBody)) {
          if (payload.user_id) {
            await supabase
              .from("device_tokens")
              .update({ is_active: false })
              .eq("user_id", payload.user_id)
              .eq("token", t.token);
          }
        }
        return { token: t.token, ok: false, status: res.status, error: errBody };
      } catch (e) {
        return { token: t.token, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;

  if (payload.scheduled_id) {
    await supabase
      .from("scheduled_notifications")
      .update({
        status: sent > 0 ? "sent" : "failed",
        attempt_count: 1,
        sent_at: sent > 0 ? new Date().toISOString() : null,
        last_error: failed > 0 ? JSON.stringify(results.filter((r) => !r.ok)).slice(0, 500) : null,
      })
      .eq("id", payload.scheduled_id);
  }

  return json({ sent, failed, results }, sent > 0 ? 200 : 502);
});

function subgroupEnabled(prefs: any, type?: string): boolean {
  if (!prefs) return true;
  switch (type) {
    case "task_reminder": return !!prefs.tasks_enabled;
    case "event_reminder":
    case "calendar_update": return !!prefs.calendar_enabled;
    case "jarvis_suggestion": return !!prefs.jarvis_enabled;
    case "plaud_pending": return !!prefs.plaud_enabled;
    default: return true;
  }
}

async function markAndReturn(
  supabase: ReturnType<typeof createClient>,
  scheduledId: string | undefined,
  status: string,
  reason: string,
) {
  if (scheduledId) {
    await supabase
      .from("scheduled_notifications")
      .update({ status, last_error: reason })
      .eq("id", scheduledId);
  }
  return json({ skipped: true, status, reason }, 200);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

// ---- APNs JWT (ES256) signing ----
async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp - now > 300) return cachedJwt.token;

  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const p8 = Deno.env.get("APNS_KEY_P8") ?? Deno.env.get("APNS_KEY");
  if (!keyId || !teamId || !p8) {
    throw new Error("APNS_KEY_ID, APNS_TEAM_ID and APNS_KEY_P8 must be set");
  }

  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${claims}`;

  const cryptoKey = await importP8(p8);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = b64urlBytes(new Uint8Array(signature));
  const token = `${signingInput}.${sigB64}`;
  cachedJwt = { token, exp: now + 50 * 60 };
  return token;
}

async function importP8(p8: string): Promise<CryptoKey> {
  const pem = p8
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

function b64url(input: string): string {
  return b64urlBytes(new TextEncoder().encode(input));
}
function b64urlBytes(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
