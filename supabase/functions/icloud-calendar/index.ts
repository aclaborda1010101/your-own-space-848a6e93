import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  
  // Extract principal URL from response - handle multiple XML namespace formats
  // Apple uses xmlns="DAV:" as default namespace, so tags have no prefix but may have xmlns attributes
  let principalUrl: string | null = null;
  
  // Pattern 1: No namespace prefix, with xmlns attributes on tags (Apple's actual format)
  // Matches: <current-user-principal xmlns="DAV:"><href xmlns="DAV:">/path/</href>
  const pattern1 = principalXml.match(/<current-user-principal[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);
  if (pattern1) principalUrl = pattern1[1];
  
  // Pattern 2: <d:href>...</d:href> inside <d:current-user-principal>
  if (!principalUrl) {
    const pattern2 = principalXml.match(/<d:current-user-principal[^>]*>[\s\S]*?<d:href[^>]*>([^<]+)<\/d:href>/i);
    if (pattern2) principalUrl = pattern2[1];
  }
  
  // Pattern 3: <D:href>...</D:href> (uppercase namespace)
  if (!principalUrl) {
    const pattern3 = principalXml.match(/<D:current-user-principal[^>]*>[\s\S]*?<D:href[^>]*>([^<]+)<\/D:href>/i);
    if (pattern3) principalUrl = pattern3[1];
  }
  
  // Pattern 4: Any href containing /principal/ (singular or plural) as fallback
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
    throw new Error(`CalDAV calendar home error: ${homeResponse.status}`);
  }

  const homeXml = await homeResponse.text();
  const homeMatch = homeXml.match(/<d:href>([^<]+)<\/d:href>/g);
  const calendarHome = homeMatch && homeMatch.length > 1 
    ? homeMatch[1].replace(/<\/?d:href>/g, "") 
    : principalUrl;

  // Query events with time range
  const startStr = formatICSDate(startDate.toISOString());
  const endStr = formatICSDate(endDate.toISOString());

  const eventsResponse = await fetch(`${CALDAV_ENDPOINT}${calendarHome}`, {
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
    console.error("CalDAV events error:", eventsResponse.status, errorText);
    throw new Error(`CalDAV events error: ${eventsResponse.status}`);
  }

  const eventsXml = await eventsResponse.text();
  
  // Extract calendar data from response
  const calendarDataMatches = eventsXml.match(/<c:calendar-data[^>]*>([^<]+)<\/c:calendar-data>/g) || [];
  const allEvents: CalDAVEvent[] = [];

  for (const match of calendarDataMatches) {
    const icsData = match
      .replace(/<c:calendar-data[^>]*>/, "")
      .replace(/<\/c:calendar-data>/, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    
    const events = parseICS(icsData);
    allEvents.push(...events);
  }

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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Get iCloud credentials from secrets (set by admin) or user_integrations
    const APPLE_ID_EMAIL = Deno.env.get("APPLE_ID_EMAIL");
    const APPLE_APP_SPECIFIC_PASSWORD = Deno.env.get("APPLE_APP_SPECIFIC_PASSWORD");

    // Check if user has personal iCloud setup, otherwise use global
    const { data: integration } = await supabase
      .from("user_integrations")
      .select("icloud_email, icloud_password_encrypted, icloud_enabled, icloud_calendars")
      .eq("user_id", user.id)
      .single();

    const email = integration?.icloud_email || APPLE_ID_EMAIL;
    const password = integration?.icloud_password_encrypted || APPLE_APP_SPECIFIC_PASSWORD;

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
        // Just check if iCloud is configured
        return new Response(
          JSON.stringify({ connected: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "fetch": {
        const { startDate, endDate } = body;
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);

        const events = await fetchEvents(email, password, start, end);

        // Update last sync time
        await supabase
          .from("user_integrations")
          .upsert({
            user_id: user.id,
            icloud_last_sync: new Date().toISOString(),
          }, { onConflict: "user_id" });

        // Transform events to match the existing calendar format
        const formattedEvents = events.map(event => {
          const startTime = new Date(event.start);
          const endTime = event.end ? new Date(event.end) : new Date(startTime.getTime() + 60 * 60 * 1000);
          const durationMs = endTime.getTime() - startTime.getTime();
          const durationMins = Math.round(durationMs / 60000);

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
          JSON.stringify({ events: formattedEvents, source: "icloud" }),
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
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
