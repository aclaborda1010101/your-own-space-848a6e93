import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    
    // Get session with provider token
    const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ refresh_token: accessToken }),
    });

    // We need the provider_token from the frontend
    const providerToken = req.headers.get('x-google-token');
    
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

      const calendarResponse = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            'Authorization': `Bearer ${providerToken}`,
          },
        }
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

        // Determine event type based on keywords
        let type: 'work' | 'life' | 'health' | 'family' = 'work';
        const title = (event.summary || '').toLowerCase();
        
        if (title.includes('familia') || title.includes('family') || title.includes('hijo') || title.includes('hija')) {
          type = 'family';
        } else if (title.includes('gym') || title.includes('entrena') || title.includes('deporte') || title.includes('salud') || title.includes('médico') || title.includes('doctor')) {
          type = 'health';
        } else if (title.includes('meditación') || title.includes('descanso') || title.includes('personal') || title.includes('hobby')) {
          type = 'life';
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

      // Parse time and calculate end time
      const now = new Date();
      const [hours, minutes] = eventData.time.split(':').map(Number);
      
      const startDateTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes
      );
      
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
      };

      const createResponse = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${providerToken}`,
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
      const getResponse = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventData.eventId}`,
        {
          headers: {
            'Authorization': `Bearer ${providerToken}`,
          },
        }
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

      const updateResponse = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventData.eventId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${providerToken}`,
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

      const deleteResponse = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventData.eventId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${providerToken}`,
          },
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
