import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-google-token, x-google-refresh-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Helper to refresh Google access token
async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('Token refreshed successfully, expires in:', data.expires_in);
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { action, eventData } = await req.json();
    const accessToken = authHeader.replace('Bearer ', '');

    // Get provider token from Supabase session
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabaseKey,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user');
    }

    const userData = await userResponse.json();

    // Handle token refresh action
    if (action === 'refresh-token') {
      const refreshToken = req.headers.get('x-google-refresh-token');
      
      if (!refreshToken) {
        return new Response(
          JSON.stringify({ 
            error: 'No refresh token provided',
            needsReauth: true,
            message: 'No hay refresh token. Necesitas reconectar tu cuenta de Google.'
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const newTokenData = await refreshGoogleToken(refreshToken);
      
      if (!newTokenData) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to refresh token',
            needsReauth: true,
            message: 'No se pudo renovar el token. Reconecta tu cuenta de Google.'
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          access_token: newTokenData.access_token,
          expires_in: newTokenData.expires_in,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // We need the provider_token from the frontend
    let providerToken = req.headers.get('x-google-token');
    const refreshToken = req.headers.get('x-google-refresh-token');
    
    if (!providerToken) {
      return new Response(
        JSON.stringify({ 
          error: 'No Google token available',
          needsReauth: true,
          message: 'Por favor, vuelve a iniciar sesión con Google para conectar tu calendario'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

    // Helper function to make Google API calls with auto-refresh
    async function googleApiCall(url: string, options: RequestInit = {}): Promise<Response> {
      const makeRequest = (token: string) => {
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers as Record<string, string>,
            'Authorization': `Bearer ${token}`,
          },
        });
      };

      let response = await makeRequest(providerToken!);

      // If 401 and we have a refresh token, try to refresh
      if (response.status === 401 && refreshToken) {
        console.log('Token expired, attempting refresh...');
        const newTokenData = await refreshGoogleToken(refreshToken);
        
        if (newTokenData) {
          providerToken = newTokenData.access_token;
          response = await makeRequest(providerToken);
        }
      }

      return response;
    }

    if (action === 'list') {
      // Get week range from request or default to current week
      const { startDate, endDate } = eventData || {};
      
      let timeMin: string;
      let timeMax: string;
      
      if (startDate && endDate) {
        timeMin = new Date(startDate).toISOString();
        timeMax = new Date(endDate).toISOString();
      } else {
        // Default: get current week's events
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as start
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        
        timeMin = startOfWeek.toISOString();
        timeMax = endOfWeek.toISOString();
      }

      const calendarResponse = await googleApiCall(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`
      );

      if (!calendarResponse.ok) {
        const errorText = await calendarResponse.text();
        console.error('Calendar API error:', errorText);
        
        if (calendarResponse.status === 401) {
          return new Response(
            JSON.stringify({ 
              error: 'Token expired',
              needsReauth: true,
              message: 'Tu sesión de Google ha expirado. Vuelve a iniciar sesión.'
            }),
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        
        throw new Error(`Calendar API error: ${calendarResponse.status}`);
      }

      const calendarData = await calendarResponse.json();
      
      // Transform events to our format
      const events = (calendarData.items || []).map((event: any) => {
        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;
        
        let time = '';
        let duration = '';
        let date = '';
        
        if (startTime) {
          const startDate = new Date(startTime);
          date = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
          time = startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
          
          if (endTime) {
            const endDate = new Date(endTime);
            const durationMs = endDate.getTime() - startDate.getTime();
            const durationMins = Math.round(durationMs / 60000);
            duration = durationMins >= 60 
              ? `${Math.floor(durationMins / 60)}h ${durationMins % 60 > 0 ? (durationMins % 60) + 'min' : ''}`
              : `${durationMins} min`;
          }
        }

        // First check extendedProperties for stored type
        let type: 'work' | 'life' | 'finance' | 'health' | 'family' = 'work';
        const storedType = event.extendedProperties?.private?.jarvisType;
        
        if (storedType && ['work', 'life', 'finance', 'health', 'family'].includes(storedType)) {
          type = storedType as typeof type;
        } else {
          // Fallback: determine event type based on keywords
          const title = (event.summary || '').toLowerCase();
          
          if (title.includes('familia') || title.includes('family') || title.includes('hijo') || title.includes('hija')) {
            type = 'family';
          } else if (title.includes('gym') || title.includes('entrena') || title.includes('deporte') || title.includes('salud') || title.includes('médico') || title.includes('doctor')) {
            type = 'health';
          } else if (title.includes('finanzas') || title.includes('banco') || title.includes('inversión') || title.includes('dinero') || title.includes('pago')) {
            type = 'finance';
          } else if (title.includes('meditación') || title.includes('descanso') || title.includes('personal') || title.includes('hobby')) {
            type = 'life';
          }
        }

        return {
          id: event.id,
          googleId: event.id,
          title: event.summary || 'Sin título',
          date,
          time,
          duration: duration.trim() || '30 min',
          type,
          description: event.description || '',
          location: event.location || '',
          htmlLink: event.htmlLink,
        };
      });

      return new Response(
        JSON.stringify({ events }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create') {
      if (!eventData) {
        throw new Error('Event data is required');
      }

      // Parse date and time to calculate start/end
      const [hours, minutes] = eventData.time.split(':').map(Number);
      
      let startDateTime: Date;
      if (eventData.date) {
        // Use provided date (format: YYYY-MM-DD)
        const [year, month, day] = eventData.date.split('-').map(Number);
        startDateTime = new Date(year, month - 1, day, hours, minutes);
      } else {
        // Fallback to today
        const now = new Date();
        startDateTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes
        );
      }
      
      const endDateTime = new Date(startDateTime.getTime() + (eventData.duration || 30) * 60000);

      const calendarEvent = {
        summary: eventData.title,
        description: eventData.description || '',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        extendedProperties: {
          private: {
            jarvisType: eventData.type || 'work',
          },
        },
      };

      const createResponse = await googleApiCall(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(calendarEvent),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Create event error:', errorText);
        throw new Error(`Failed to create event: ${createResponse.status}`);
      }

      const createdEvent = await createResponse.json();

      return new Response(
        JSON.stringify({ success: true, event: createdEvent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      if (!eventData || !eventData.eventId) {
        throw new Error('Event ID and data are required');
      }

      // First get the existing event to preserve its dates if not changing them
      const getResponse = await googleApiCall(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventData.eventId}`
      );

      if (!getResponse.ok) {
        throw new Error(`Failed to get event: ${getResponse.status}`);
      }

      const existingEvent = await getResponse.json();

      // Build updated event
      const updatedEvent: any = {
        ...existingEvent,
        summary: eventData.title || existingEvent.summary,
        description: eventData.description !== undefined ? eventData.description : existingEvent.description,
        extendedProperties: {
          private: {
            ...(existingEvent.extendedProperties?.private || {}),
            jarvisType: eventData.type || existingEvent.extendedProperties?.private?.jarvisType || 'work',
          },
        },
      };

      // Update time if provided
      if (eventData.time) {
        const [hours, minutes] = eventData.time.split(':').map(Number);
        const existingStart = new Date(existingEvent.start.dateTime || existingEvent.start.date);
        
        const startDateTime = new Date(
          existingStart.getFullYear(),
          existingStart.getMonth(),
          existingStart.getDate(),
          hours,
          minutes
        );
        
        const duration = eventData.duration || 30;
        const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

        updatedEvent.start = {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        updatedEvent.end = {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      const updateResponse = await googleApiCall(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventData.eventId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedEvent),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Update event error:', errorText);
        throw new Error(`Failed to update event: ${updateResponse.status}`);
      }

      const result = await updateResponse.json();
      console.log('Event updated:', result.id);

      return new Response(
        JSON.stringify({ success: true, event: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (!eventData || !eventData.eventId) {
        throw new Error('Event ID is required');
      }

      const deleteResponse = await googleApiCall(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventData.eventId}`,
        {
          method: 'DELETE',
        }
      );

      if (!deleteResponse.ok && deleteResponse.status !== 204) {
        const errorText = await deleteResponse.text();
        console.error('Delete event error:', errorText);
        throw new Error(`Failed to delete event: ${deleteResponse.status}`);
      }

      console.log('Event deleted:', eventData.eventId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
