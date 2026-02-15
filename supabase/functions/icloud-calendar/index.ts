import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-timezone, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// CalDAV constants
const CALDAV_ENDPOINT = "https://caldav.icloud.com";

interface CalDAVEvent {
  id: string;
  uid: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  allDay: boolean;
}

/**
 * Parse iCalendar (ICS) format to extract events
 */
function parseICS(icsData: string): CalDAVEvent[] {
  const events: CalDAVEvent[] = [];
  const lines = icsData.split(/\r?\n/);
  
  let currentEvent: Partial<CalDAVEvent> | null = null;
  let inEvent = false;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inEvent = true;
      currentEvent = { id: crypto.randomUUID() };
    } else if (line.startsWith("END:VEVENT") && currentEvent) {
      inEvent = false;
      if (currentEvent.uid && currentEvent.title && currentEvent.start) {
        events.push(currentEvent as CalDAVEvent);
      }
      currentEvent = null;
    } else if (inEvent && currentEvent) {
      const [key, ...valueParts] = line.split(":");
      const value = valueParts.join(":");
      
      if (key.startsWith("UID")) {
        currentEvent.uid = value;
      } else if (key.startsWith("SUMMARY")) {
        currentEvent.title = value;
      } else if (key.startsWith("DTSTART")) {
        currentEvent.start = parseICSDate(value);
        currentEvent.allDay = !line.includes("T");
      } else if (key.startsWith("DTEND")) {
        currentEvent.end = parseICSDate(value);
      } else if (key.startsWith("LOCATION")) {
        currentEvent.location = value;
      } else if (key.startsWith("DESCRIPTION")) {
        currentEvent.description = value;
      }
    }
  }

  return events;
}

/**
 * Convert ICS date format to ISO string
 */
function parseICSDate(icsDate: string): string {
  // Format: YYYYMMDD or YYYYMMDDTHHmmssZ
  const cleaned = icsDate.replace(/[^0-9TZ]/g, "");
  
  if (cleaned.length === 8) {
    // All day event: YYYYMMDD
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  } else if (cleaned.length >= 15) {
    // Datetime: YYYYMMDDTHHmmss
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    const hour = cleaned.slice(9, 11);
    const minute = cleaned.slice(11, 13);
    const second = cleaned.slice(13, 15);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}${cleaned.endsWith("Z") ? "Z" : ""}`;
  }
  
  return icsDate;
}

/**
 * Format ISO date to ICS format
 */
function formatICSDate(isoDate: string, allDay: boolean = false): string {
  const date = new Date(isoDate);
  
  if (allDay) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
  }
  
  return date.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

function normalizeICloudEmail(email: string) {
  return String(email ?? "").trim();
}

function normalizeICloudPassword(password: string) {
  // Some users paste passwords with spaces/newlines; CalDAV Basic auth needs it compact.
  return String(password ?? "")
    .trim()
    .replace(/\s+/g, "");
}

async function checkICloudCredentials(email: string, password: string): Promise<{ connected: boolean; message?: string }> {
  const auth = btoa(`${email}:${password}`);
  const principalResponse = await fetch(`${CALDAV_ENDPOINT}/`, {
    method: "PROPFIND",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/xml; charset=utf-8",
      "Depth": "0",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`,
  });

  if (principalResponse.status === 401) {
    return {
      connected: false,
      message: "Credenciales de iCloud inválidas. Revisa tu Apple ID y la contraseña de aplicación.",
    };
  }

  if (!principalResponse.ok) {
    const errorText = await principalResponse.text();
    console.error("CalDAV check error:", principalResponse.status, errorText.substring(0, 200));
    throw new Error(`CalDAV error: ${principalResponse.status}`);
  }

  return { connected: true };
}

/**
 * Fetch events from iCloud Calendar using CalDAV
 */
async function fetchEvents(
  email: string,
  password: string,
  startDate: Date,
  endDate: Date
): Promise<CalDAVEvent[]> {
  const auth = btoa(`${email}:${password}`);
  
  // First, discover the principal URL
  const principalResponse = await fetch(`${CALDAV_ENDPOINT}/`, {
    method: "PROPFIND",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/xml; charset=utf-8",
      "Depth": "0",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`,
  });

  if (!principalResponse.ok) {
    if (principalResponse.status === 401) {
      throw new Error("Invalid iCloud credentials. Please check your Apple ID and App-Specific Password.");
    }
    throw new Error(`CalDAV error: ${principalResponse.status}`);
  }

  const principalXml = await principalResponse.text();
  console.log("CalDAV principal response:", principalXml.substring(0, 500));
  
  // Extract principal URL from response
  let principalUrl: string | null = null;
  
  const pattern1 = principalXml.match(/<current-user-principal[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);
  if (pattern1) principalUrl = pattern1[1];
  
  if (!principalUrl) {
    const pattern2 = principalXml.match(/<d:current-user-principal[^>]*>[\s\S]*?<d:href[^>]*>([^<]+)<\/d:href>/i);
    if (pattern2) principalUrl = pattern2[1];
  }
  
  if (!principalUrl) {
    const hrefMatch = principalXml.match(/<href[^>]*>([^<]*\/\d+\/principal\/[^<]*)<\/href>/i);
    if (hrefMatch) principalUrl = hrefMatch[1];
  }

  console.log("Extracted principal URL:", principalUrl);

  if (!principalUrl) {
    console.error("Could not parse principal URL from response:", principalXml);
    throw new Error("Could not find CalDAV principal URL");
  }

  // Get calendar home
  const homeResponse = await fetch(`${CALDAV_ENDPOINT}${principalUrl}`, {
    method: "PROPFIND",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/xml; charset=utf-8",
      "Depth": "0",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set/>
  </d:prop>
</d:propfind>`,
  });

  if (!homeResponse.ok) {
    const errorText = await homeResponse.text();
    console.error("CalDAV calendar home error:", homeResponse.status, errorText);
    throw new Error(`CalDAV calendar home error: ${homeResponse.status}`);
  }

  const homeXml = await homeResponse.text();
  console.log("CalDAV calendar home response:", homeXml.substring(0, 500));
  
  // Extract calendar-home-set
  let calendarHome: string | null = null;
  
  const homePattern1 = homeXml.match(/<calendar-home-set[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);
  if (homePattern1) calendarHome = homePattern1[1];
  
  if (!calendarHome) {
    const homePattern2 = homeXml.match(/<c:calendar-home-set[^>]*>[\s\S]*?<d:href[^>]*>([^<]+)<\/d:href>/i);
    if (homePattern2) calendarHome = homePattern2[1];
  }
  
  if (!calendarHome) {
    const homePattern3 = homeXml.match(/<href[^>]*>([^<]*\/calendars\/[^<]*)<\/href>/i);
    if (homePattern3) calendarHome = homePattern3[1];
  }
  
  if (!calendarHome) {
    console.log("Could not find calendar-home-set, using principal URL as fallback");
    calendarHome = principalUrl;
  }
  
  console.log("Extracted calendar home:", calendarHome);

  // Build the calendar home URL
  const calendarHomeUrl = calendarHome.startsWith("http") 
    ? calendarHome 
    : `${CALDAV_ENDPOINT}${calendarHome}`;

  // STEP 3: List individual calendars in the calendar home
  console.log("Listing calendars from:", calendarHomeUrl);
  
  const calendarsResponse = await fetch(calendarHomeUrl, {
    method: "PROPFIND",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/xml; charset=utf-8",
      "Depth": "1",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:resourcetype/>
    <d:displayname/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`,
  });

  if (!calendarsResponse.ok) {
    const errorText = await calendarsResponse.text();
    console.error("CalDAV list calendars error:", calendarsResponse.status, errorText);
    throw new Error(`CalDAV list calendars error: ${calendarsResponse.status}`);
  }

  const calendarsXml = await calendarsResponse.text();
  console.log("CalDAV calendars list response:", calendarsXml.substring(0, 800));

  // Extract calendar URLs - look for responses that have <c:calendar/> resource type
  const calendarUrls: string[] = [];
  
  // Split by <response> or <d:response>
  const responseBlocks = calendarsXml.split(/<(?:d:)?response[^>]*>/i).slice(1);
  
  for (const block of responseBlocks) {
    // Check if this response is a calendar (has calendar resourcetype)
    const isCalendar = /<(?:c:|cal:)?calendar[^>]*\/>/i.test(block) || 
                       /<resourcetype[^>]*>[\s\S]*?<(?:c:|cal:)?calendar/i.test(block);
    
    if (isCalendar) {
      // Extract href from this response
      const hrefMatch = block.match(/<(?:d:)?href[^>]*>([^<]+)<\/(?:d:)?href>/i);
      if (hrefMatch) {
        const calUrl = hrefMatch[1];
        // Skip the calendar home itself (ends with /calendars/)
        if (!calUrl.endsWith('/calendars/')) {
          calendarUrls.push(calUrl);
        }
      }
    }
  }

  console.log("Found calendars:", calendarUrls);

  if (calendarUrls.length === 0) {
    console.log("No calendars found, trying to use calendar home directly");
    calendarUrls.push(calendarHome);
  }

  // Query events from each calendar
  const startStr = formatICSDate(startDate.toISOString());
  const endStr = formatICSDate(endDate.toISOString());
  
  const allEvents: CalDAVEvent[] = [];

  for (const calUrl of calendarUrls) {
    const eventsUrl = calUrl.startsWith("http") 
      ? calUrl 
      : `${CALDAV_ENDPOINT}${calUrl}`;
    
    console.log("Fetching events from calendar:", eventsUrl);

    try {
      const eventsResponse = await fetch(eventsUrl, {
        method: "REPORT",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/xml; charset=utf-8",
          "Depth": "1",
        },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${startStr}" end="${endStr}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
      });

      if (!eventsResponse.ok) {
        const errorText = await eventsResponse.text();
        console.log("CalDAV events error for calendar", calUrl, ":", eventsResponse.status, errorText.substring(0, 200));
        continue; // Skip this calendar, try next
      }

      const eventsXml = await eventsResponse.text();
      
      // Extract calendar data from response - handle multiple namespace formats
      const calendarDataMatches = eventsXml.match(/<(?:c:|cal:)?calendar-data[^>]*>([\s\S]*?)<\/(?:c:|cal:)?calendar-data>/gi) || [];

      for (const match of calendarDataMatches) {
        const icsData = match
          .replace(/<(?:c:|cal:)?calendar-data[^>]*>/i, "")
          .replace(/<\/(?:c:|cal:)?calendar-data>/i, "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");
        
        const events = parseICS(icsData);
        allEvents.push(...events);
      }
    } catch (err) {
      console.error("Error fetching events from calendar", calUrl, ":", err);
      continue;
    }
  }

  console.log("Total events found:", allEvents.length);
  return allEvents;
}

/**
 * Create a new event in iCloud Calendar
 */
async function createEvent(
  email: string,
  password: string,
  calendarPath: string,
  event: {
    title: string;
    start: string;
    end: string;
    location?: string;
    description?: string;
    allDay?: boolean;
  }
): Promise<{ success: boolean; uid: string }> {
  const auth = btoa(`${email}:${password}`);
  const uid = crypto.randomUUID();
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const startFormatted = formatICSDate(event.start, event.allDay);
  const endFormatted = formatICSDate(event.end, event.allDay);

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//JARVIS//iCloud Integration//ES
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART${event.allDay ? ";VALUE=DATE" : ""}:${startFormatted}
DTEND${event.allDay ? ";VALUE=DATE" : ""}:${endFormatted}
SUMMARY:${event.title}
${event.location ? `LOCATION:${event.location}` : ""}
${event.description ? `DESCRIPTION:${event.description}` : ""}
END:VEVENT
END:VCALENDAR`;

  const response = await fetch(`${CALDAV_ENDPOINT}${calendarPath}${uid}.ics`, {
    method: "PUT",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "text/calendar; charset=utf-8",
      "If-None-Match": "*",
    },
    body: icsContent,
  });

  if (!response.ok && response.status !== 201) {
    if (response.status === 401) {
      throw new Error("Invalid iCloud credentials. Please check your Apple ID and App-Specific Password.");
    }
    const error = await response.text();
    console.error("CalDAV create error:", response.status, error);
    throw new Error(`Failed to create event: ${response.status}`);
  }

  return { success: true, uid };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate JWT and get user id (Edge Runtime: don't rely on session storage)
    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      console.error("Auth claims error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    // Get iCloud credentials from secrets (set by admin) or user_integrations
    const APPLE_ID_EMAIL = Deno.env.get("APPLE_ID_EMAIL");
    const APPLE_APP_SPECIFIC_PASSWORD = Deno.env.get("APPLE_APP_SPECIFIC_PASSWORD");

    // Check if user has personal iCloud setup, otherwise use global
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("icloud_email, icloud_password_encrypted, icloud_enabled, icloud_calendars")
      .eq("user_id", userId)
      .single();

    const emailRaw = integration?.icloud_email || APPLE_ID_EMAIL;
    const passwordRaw = integration?.icloud_password_encrypted || APPLE_APP_SPECIFIC_PASSWORD;

    const email = normalizeICloudEmail(emailRaw ?? "");
    const password = normalizeICloudPassword(passwordRaw ?? "");

    if (!email || !password) {
      return new Response(
        JSON.stringify({ 
          error: "iCloud not configured", 
          connected: false,
          message: "Por favor configura tus credenciales de iCloud en Ajustes" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timezone = req.headers.get("x-user-timezone") || "Europe/Madrid";

    switch (action) {
      case "check": {
        // Validate credentials (avoid returning 500, which breaks the UI)
        const result = await checkICloudCredentials(email, password);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "fetch": {
        const { startDate, endDate } = body;
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);

        let events: CalDAVEvent[] = [];
        try {
          events = await fetchEvents(email, password, start, end);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          if (msg.includes("Invalid iCloud credentials")) {
            return new Response(
              JSON.stringify({
                connected: false,
                message: "Credenciales de iCloud inválidas. Ve a Ajustes y vuelve a introducir tu Apple ID y contraseña de aplicación.",
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw e;
        }

        // Update last sync time
        await supabase
          .from("user_integrations")
          .upsert({
            user_id: userId,
            icloud_last_sync: new Date().toISOString(),
          }, { onConflict: "user_id" });

        // Transform events to match the existing calendar format
        const formattedEvents = events.map(event => {
          const startTime = new Date(event.start);
          const endTime = event.end ? new Date(event.end) : new Date(startTime.getTime() + 60 * 60 * 1000);
          const durationMs = endTime.getTime() - startTime.getTime();
          const durationMins = Math.round(durationMs / 60000);

          // Extract date in YYYY-MM-DD format using the user's timezone
          const dateStr = startTime.toLocaleDateString("en-CA", { timeZone: timezone });

          // Determine event type based on keywords
          let type: "work" | "life" | "health" | "family" = "life";
          const title = event.title.toLowerCase();
          if (title.includes("trabajo") || title.includes("meeting") || title.includes("reunion") || title.includes("call")) {
            type = "work";
          } else if (title.includes("medico") || title.includes("doctor") || title.includes("gym") || title.includes("entreno")) {
            type = "health";
          } else if (title.includes("familia") || title.includes("cumple") || title.includes("bosco")) {
            type = "family";
          }

          return {
            id: event.uid,
            title: event.title,
            date: dateStr,
            time: startTime.toLocaleTimeString("es-ES", { 
              hour: "2-digit", 
              minute: "2-digit",
              hour12: false,
              timeZone: timezone 
            }),
            duration: durationMins < 60 ? `${durationMins}min` : `${Math.round(durationMins / 60)}h`,
            type,
            location: event.location,
            allDay: event.allDay,
          };
        });

        return new Response(
          JSON.stringify({ connected: true, events: formattedEvents, source: "icloud" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create": {
        const { title, start, end, location, description, allDay, calendarPath } = body;

        if (!title || !start) {
          return new Response(
            JSON.stringify({ error: "Title and start date are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const result = await createEvent(
            email,
            password,
            calendarPath || "/calendars/", // Default calendar path
            {
              title,
              start,
              end: end || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(),
              location,
              description,
              allDay,
            }
          );

          return new Response(
            JSON.stringify({ connected: true, ...result }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          if (msg.includes("Invalid iCloud credentials")) {
            return new Response(
              JSON.stringify({
                connected: false,
                message: "Credenciales de iCloud inválidas. Ve a Ajustes y vuelve a introducir tu Apple ID y contraseña de aplicación.",
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw e;
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("iCloud Calendar error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        connected: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
