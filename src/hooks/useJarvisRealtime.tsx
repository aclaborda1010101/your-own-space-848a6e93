import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type RealtimeState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'processing';

export type RealtimeVoice = 'ash' | 'verse' | 'ballad' | 'echo' | 'alloy' | 'sage' | 'shimmer';

interface UseJarvisRealtimeOptions {
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onStateChange?: (state: RealtimeState) => void;
  voice?: RealtimeVoice;
}

// Function execution types
interface FunctionCall {
  call_id: string;
  name: string;
  arguments: string;
}

// OpenAI Realtime GA model — must match supabase/functions/jarvis-voice/index.ts
const OPENAI_REALTIME_MODEL = 'gpt-realtime';

export function useJarvisRealtime(options: UseJarvisRealtimeOptions = {}) {
  const { onTranscript, onResponse, onStateChange, voice: initialVoice = 'ash' } = options;
  const [voice, setVoice] = useState<RealtimeVoice>(initialVoice);
  
  const [state, setState] = useState<RealtimeState>('idle');
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const pendingFunctionCallsRef = useRef<Map<string, FunctionCall>>(new Map());
  
  // Resilience refs
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iceRestartAttemptedRef = useRef(false);
  const responseWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const lastResponseEventRef = useRef<number>(0);

  const updateState = useCallback((newState: RealtimeState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Send an event to OpenAI via data channel
  const sendEvent = useCallback((event: object) => {
    if (dataChannelRef.current?.readyState === 'open') {
      console.log('[JARVIS] Sending event:', JSON.stringify(event).substring(0, 200));
      dataChannelRef.current.send(JSON.stringify(event));
    } else {
      console.warn('[JARVIS] Data channel not open, cannot send event');
    }
  }, []);

  // Clear all resilience timers
  const clearResilienceTimers = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (responseWatchdogRef.current) {
      clearTimeout(responseWatchdogRef.current);
      responseWatchdogRef.current = null;
    }
  }, []);

  // Execute a function call and return the result — SUPERAGENT POWERS
  const executeFunction = useCallback(async (name: string, args: Record<string, unknown>): Promise<string> => {
    console.log('[JARVIS] Executing function:', name, args);
    const sb = supabase as any;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return JSON.stringify({ error: 'No autenticado' });

      switch (name) {
        case 'create_task': {
          const { data, error } = await sb
            .from('todos')
            .insert({
              title: args.title as string,
              priority: typeof args.priority === 'number' ? args.priority : 3,
              due_date: (args.due_date as string) || null,
              is_completed: false,
              user_id: userId,
            })
            .select()
            .single();
          if (error) throw error;
          return JSON.stringify({ success: true, task: data });
        }

        case 'complete_task': {
          const searchTitle = (args.task_title as string).toLowerCase();
          const { data: tasks } = await sb
            .from('todos').select('id, title')
            .eq('user_id', userId).eq('is_completed', false)
            .ilike('title', `%${searchTitle}%`).limit(1);
          if (!tasks?.length) return JSON.stringify({ success: false, message: 'No se encontró la tarea' });
          const { error } = await sb.from('todos').update({ is_completed: true }).eq('id', tasks[0].id);
          if (error) throw error;
          return JSON.stringify({ success: true, task: tasks[0].title });
        }

        case 'list_pending_tasks': {
          const { data: tasks } = await sb
            .from('todos').select('id, title, priority, due_date')
            .eq('user_id', userId).eq('is_completed', false)
            .order('priority', { ascending: false }).limit(20);
          return JSON.stringify({ tasks: tasks || [] });
        }

        // ── SUPERAGENT: contactos ─────────────────────────────────────
        case 'search_contacts': {
          const term = String(args.query || '').trim();
          if (!term) return JSON.stringify({ contacts: [] });
          // Try fuzzy RPC first
          const { data: fuzzy } = await sb.rpc('search_contacts_fuzzy', {
            p_user_id: userId, p_search_term: term, p_limit: 8,
          });
          let ids = (fuzzy || []).map((r: any) => r.id);
          if (!ids.length) {
            const { data: ilike } = await sb.from('people_contacts')
              .select('id').eq('user_id', userId).ilike('name', `%${term}%`).limit(8);
            ids = (ilike || []).map((r: any) => r.id);
          }
          if (!ids.length) return JSON.stringify({ contacts: [], note: 'Sin coincidencias' });
          const { data: full } = await sb.from('people_contacts')
            .select('id, name, company, role, email, phone, notes, last_interaction_at')
            .in('id', ids);
          return JSON.stringify({ contacts: full || [] });
        }

        case 'create_contact': {
          const { data, error } = await sb.from('people_contacts').insert({
            user_id: userId,
            name: args.name as string,
            company: args.company || null,
            role: args.role || null,
            email: args.email || null,
            phone: args.phone || null,
            notes: args.notes || null,
          }).select().single();
          if (error) throw error;
          return JSON.stringify({ success: true, contact: data });
        }

        // ── SUPERAGENT: proyectos ─────────────────────────────────────
        case 'search_projects': {
          const term = String(args.query || '').trim();
          let q = sb.from('business_projects')
            .select('id, name, company, status, sector, estimated_value, updated_at')
            .eq('user_id', userId);
          if (term) q = q.or(`name.ilike.%${term}%,company.ilike.%${term}%`);
          const { data } = await q.order('updated_at', { ascending: false }).limit(15);
          return JSON.stringify({ projects: data || [] });
        }

        // ── SUPERAGENT: memorias ──────────────────────────────────────
        case 'search_memories': {
          const { data } = await sb.rpc('get_jarvis_context', { p_user_id: userId, p_limit: 30 });
          const term = String(args.query || '').toLowerCase();
          const filtered = term
            ? (data || []).filter((m: any) => m.content?.toLowerCase().includes(term))
            : (data || []);
          return JSON.stringify({ memories: filtered.slice(0, 15) });
        }

        // ── SUPERAGENT: emails / whatsapp ─────────────────────────────
        case 'get_emails': {
          const onlyUnread = args.unread !== false;
          let q = sb.from('jarvis_emails_cache')
            .select('from_addr, subject, preview, synced_at, is_read')
            .eq('user_id', userId);
          if (onlyUnread) q = q.eq('is_read', false);
          const { data } = await q.order('synced_at', { ascending: false }).limit(15);
          return JSON.stringify({ emails: data || [] });
        }

        case 'get_whatsapp_recent': {
          const { data } = await sb.from('whatsapp_messages')
            .select('from_name, from_number, body, created_at, direction')
            .eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
          return JSON.stringify({ messages: data || [] });
        }

        // ── SUPERAGENT: delegación a especialistas ────────────────────
        case 'ask_specialist': {
          const question = String(args.question || '');
          const { data: sess } = await supabase.auth.getSession();
          const accessToken = sess?.session?.access_token;
          const { data, error } = await supabase.functions.invoke('jarvis-gateway', {
            headers: { Authorization: `Bearer ${accessToken}` },
            body: {
              message: question,
              user_id: userId,
              platform: 'web',
            },
          });
          if (error) return JSON.stringify({ error: error.message });
          return JSON.stringify({ specialist: data?.specialist, answer: data?.response });
        }

        // ── SUPERAGENT: query genérica de cualquier tabla ─────────────
        case 'query_table': {
          const table = String(args.table || '');
          const filters = (args.filters as Record<string, any>) || {};
          const limit = Math.min(Number(args.limit || 10), 50);
          const ALLOWED = new Set([
            'todos', 'people_contacts', 'business_projects', 'check_ins', 'whoop_data',
            'jarvis_emails_cache', 'whatsapp_messages', 'bosco_observations', 'bosco_interactions',
            'transcriptions', 'specialist_memory', 'jarvis_memory', 'pomodoro_sessions',
            'challenges', 'challenge_logs', 'agent_chat_messages', 'ai_news',
          ]);
          if (!ALLOWED.has(table)) return JSON.stringify({ error: `Tabla no permitida: ${table}` });
          let q = sb.from(table).select('*').eq('user_id', userId);
          for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
          const { data, error } = await q.limit(limit);
          if (error) return JSON.stringify({ error: error.message });
          return JSON.stringify({ rows: data || [] });
        }
        
        case 'get_today_summary': {
          const today = new Date().toISOString().split('T')[0];
          const [{ data: todos }, { data: checkIn }, { data: whoop }] = await Promise.all([
            sb.from('todos').select('title, is_completed, priority').eq('user_id', userId).gte('created_at', today),
            sb.from('check_ins').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
            sb.from('whoop_data').select('recovery_score, sleep_hours, strain').eq('user_id', userId).eq('data_date', today).maybeSingle(),
          ]);
          const completed = todos?.filter((t: any) => t.is_completed).length || 0;
          const pending = todos?.filter((t: any) => !t.is_completed).length || 0;
          return JSON.stringify({
            date: today,
            tasksCompleted: completed,
            tasksPending: pending,
            checkIn: checkIn ? { energy: checkIn.energy, mood: checkIn.mood, focus: checkIn.focus } : null,
            whoop: whoop || null,
          });
        }

        case 'create_event': {
          const eventDate = new Date().toISOString().split('T')[0];
          const startDateTime = new Date(`${eventDate}T${args.time}:00`);
          const endDateTime = new Date(startDateTime.getTime() + (args.duration as number) * 60 * 1000);
          const { data: sess } = await supabase.auth.getSession();
          const { data, error } = await supabase.functions.invoke('icloud-calendar', {
            headers: { Authorization: `Bearer ${sess?.session?.access_token}` },
            body: {
              action: 'create',
              title: args.title,
              start: startDateTime.toISOString(),
              end: endDateTime.toISOString(),
              description: args.description || '',
            },
          });
          if (error) throw error;
          return JSON.stringify({ success: true, event: data });
        }

        case 'log_observation': {
          const obs = args.observation as string;
          const area = (args.area as string) || 'general';
          const { error } = await sb.from('bosco_observations').insert({
            user_id: userId,
            observation: obs,
            area,
            date: new Date().toISOString().split('T')[0],
          });
          if (error) throw error;
          return JSON.stringify({ success: true, message: 'Observación registrada' });
        }

        case 'get_my_stats': {
          const today = new Date();
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const [{ data: todos }, { data: checkIns }] = await Promise.all([
            sb.from('todos').select('id, is_completed').eq('user_id', userId).gte('created_at', weekAgo.toISOString()),
            sb.from('check_ins').select('date').eq('user_id', userId).gte('date', weekAgo.toISOString().split('T')[0]),
          ]);
          const tasksCompleted = todos?.filter((t: any) => t.is_completed).length || 0;
          const totalTasks = todos?.length || 0;
          return JSON.stringify({
            weeklyCheckIns: checkIns?.length || 0,
            tasksCompleted,
            totalTasks,
            completionRate: totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0,
          });
        }

        case 'ask_about_habits': {
          const { data: learnings } = await sb.from('agent_learnings')
            .select('category, learning_text, confidence')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(8);
          return JSON.stringify({ question: args.question, insights: learnings || [] });
        }

        case 'delete_event': {
          const { data: sess } = await supabase.auth.getSession();
          const { data, error } = await supabase.functions.invoke('icloud-calendar', {
            headers: { Authorization: `Bearer ${sess?.session?.access_token}` },
            body: { action: 'delete', title: args.event_title },
          });
          if (error) throw error;
          return JSON.stringify({ success: true, deleted: args.event_title });
        }

        // ── SUPERAGENT: análisis profundo de relación con un contacto ─
        case 'analyze_contact_relationship': {
          const term = String(args.name || '').trim();
          if (!term) return JSON.stringify({ error: 'name requerido' });

          // 1) Resolver contacto (fuzzy → ilike)
          let contact: any = null;
          const { data: fuzzy } = await sb.rpc('search_contacts_fuzzy', {
            p_user_id: userId, p_search_term: term, p_limit: 1,
          });
          if (fuzzy?.length) {
            const { data: full } = await sb.from('people_contacts')
              .select('id, name, company, role, email, phone, notes, last_interaction_at')
              .eq('id', fuzzy[0].id).maybeSingle();
            contact = full;
          }
          if (!contact) {
            const { data: ilike } = await sb.from('people_contacts')
              .select('id, name, company, role, email, phone, notes, last_interaction_at')
              .eq('user_id', userId).ilike('name', `%${term}%`).limit(1).maybeSingle();
            contact = ilike;
          }
          if (!contact) return JSON.stringify({ error: `Contacto "${term}" no encontrado` });

          const phone = contact.phone ? String(contact.phone).replace(/\D/g, '') : null;
          const email = contact.email || null;
          const nameLike = `%${contact.name.split(' ')[0]}%`;

          // 2) Traer histórico en paralelo
          const [waRes, emailRes, transRes, obsRes] = await Promise.all([
            phone
              ? sb.from('whatsapp_messages')
                  .select('body, direction, created_at')
                  .eq('user_id', userId)
                  .or(`from_number.ilike.%${phone.slice(-9)}%,to_number.ilike.%${phone.slice(-9)}%`)
                  .order('created_at', { ascending: false }).limit(15)
              : Promise.resolve({ data: [] }),
            email
              ? sb.from('jarvis_emails_cache')
                  .select('from_addr, subject, preview, synced_at')
                  .eq('user_id', userId).ilike('from_addr', `%${email}%`)
                  .order('synced_at', { ascending: false }).limit(10)
              : Promise.resolve({ data: [] }),
            sb.from('transcriptions')
              .select('title, summary, created_at')
              .eq('user_id', userId).ilike('summary', nameLike)
              .order('created_at', { ascending: false }).limit(8),
            sb.from('bosco_observations')
              .select('observation, area, date')
              .eq('user_id', userId).ilike('observation', nameLike)
              .order('date', { ascending: false }).limit(8),
          ]);
          const emails = emailRes.data || [];

          return JSON.stringify({
            contact: {
              name: contact.name, company: contact.company, role: contact.role,
              email: contact.email, phone: contact.phone, notes: contact.notes,
              last_interaction_at: contact.last_interaction_at,
            },
            whatsapp_recent: (waRes.data || []).map((m: any) => ({
              dir: m.direction, body: String(m.body || '').slice(0, 200), at: m.created_at,
            })),
            emails_recent: emails.map((e: any) => ({
              from: e.from_addr, subject: e.subject, preview: String(e.preview || '').slice(0, 160), at: e.synced_at,
            })),
            transcriptions_mentioning: (transRes.data || []).map((t: any) => ({
              title: t.title, summary: String(t.summary || '').slice(0, 220), at: t.created_at,
            })),
            observations: (obsRes.data || []).map((o: any) => ({
              text: String(o.observation || '').slice(0, 220), area: o.area, date: o.date,
            })),
          });
        }

        // ── SUPERAGENT: OpenClaw (mandar tareas a nodos POTUS / TITAN / etc) ─
        case 'openclaw_list_nodes': {
          const { data } = await sb.from('openclaw_nodes')
            .select('id, name, status, role, model, active_task, progress, last_seen_at')
            .eq('user_id', userId).order('name');
          return JSON.stringify({ nodes: data || [] });
        }

        case 'openclaw_create_task': {
          const title = String(args.title || '').trim();
          if (!title) return JSON.stringify({ error: 'title requerido' });
          const nodeName = args.node ? String(args.node).trim() : null;
          let nodeId: string | null = null;
          if (nodeName) {
            const { data: nd } = await sb.from('openclaw_nodes')
              .select('id').eq('user_id', userId).ilike('name', nodeName).maybeSingle();
            nodeId = nd?.id || null;
          }
          const priority = ['low', 'medium', 'high', 'urgent'].includes(String(args.priority))
            ? String(args.priority) : 'medium';
          const { data, error } = await sb.from('openclaw_tasks').insert({
            user_id: userId,
            title,
            description: args.description ? String(args.description) : null,
            node_id: nodeId,
            priority,
            status: 'pending',
          }).select().single();
          if (error) return JSON.stringify({ error: error.message });
          return JSON.stringify({ success: true, task: data, node: nodeName || 'auto' });
        }

        case 'openclaw_run_now': {
          const term = String(args.task_title || '').trim();
          if (!term) return JSON.stringify({ error: 'task_title requerido' });
          const { data: tasks } = await sb.from('openclaw_tasks')
            .select('id, title, status')
            .eq('user_id', userId).ilike('title', `%${term}%`)
            .in('status', ['pending', 'paused', 'completed'])
            .order('created_at', { ascending: false }).limit(1);
          if (!tasks?.length) return JSON.stringify({ error: 'Tarea no encontrada' });
          const { error } = await sb.from('openclaw_tasks')
            .update({ status: 'running', started_at: new Date().toISOString() })
            .eq('id', tasks[0].id);
          if (error) return JSON.stringify({ error: error.message });
          return JSON.stringify({ success: true, task: tasks[0].title, status: 'running' });
        }

        default:
          return JSON.stringify({ error: `Función ${name} no implementada` });
      }
    } catch (err) {
      console.error('[JARVIS] Function execution error:', err);
      return JSON.stringify({ error: err instanceof Error ? err.message : 'Error desconocido' });
    }
  }, []);

  // Start the response watchdog timer
  const startResponseWatchdog = useCallback(() => {
    // Clear any existing watchdog
    if (responseWatchdogRef.current) {
      clearTimeout(responseWatchdogRef.current);
    }
    
    // Set a watchdog that fires if no response event is received within 1.5s
    responseWatchdogRef.current = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastResponse = now - lastResponseEventRef.current;
      
      // Only trigger if still in processing state and no recent response events
      if (state === 'processing' && timeSinceLastResponse > 1200) {
        console.log('[JARVIS] Response watchdog triggered - forcing response.create');
        sendEvent({ type: 'response.create' });
        
        // Set a second watchdog to return to listening if still no response
        responseWatchdogRef.current = setTimeout(() => {
          if (state === 'processing') {
            console.log('[JARVIS] Still no response after watchdog, returning to listening');
            updateState('listening');
          }
        }, 3000);
      }
    }, 1500);
  }, [state, sendEvent, updateState]);

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = useCallback(async (event: Record<string, unknown>) => {
    const eventType = event.type as string;
    console.log('[JARVIS] Realtime event:', eventType);
    
    // Track response events for watchdog
    if (eventType.startsWith('response.')) {
      lastResponseEventRef.current = Date.now();
      // Clear watchdog on any response event
      if (responseWatchdogRef.current) {
        clearTimeout(responseWatchdogRef.current);
        responseWatchdogRef.current = null;
      }
    }
    
    switch (eventType) {
      case 'input_audio_buffer.speech_started':
        updateState('listening');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        updateState('processing');
        // Start watchdog to ensure we don't get stuck in processing
        startResponseWatchdog();
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          setTranscript(event.transcript as string);
          onTranscript?.(event.transcript as string);
        }
        break;
        
      case 'response.audio_transcript.delta':
        if (event.delta) {
          updateState('speaking');
          setResponse(prev => prev + (event.delta as string));
        }
        break;
        
      case 'response.audio_transcript.done':
        if (event.transcript) {
          setResponse(event.transcript as string);
          onResponse?.(event.transcript as string);
        }
        break;
        
      case 'response.function_call_arguments.done': {
        // OpenAI wants us to execute a function
        const callId = event.call_id as string;
        const fnName = event.name as string;
        const fnArgs = event.arguments as string;
        
        console.log('[JARVIS] Function call:', fnName, fnArgs);
        updateState('processing');
        
        try {
          const parsedArgs = JSON.parse(fnArgs || '{}');
          const t0 = Date.now();
          // 12s timeout to avoid silent hangs when an edge function or RPC stalls
          const result = await Promise.race<string>([
            executeFunction(fnName, parsedArgs),
            new Promise<string>((resolve) =>
              setTimeout(() => resolve(JSON.stringify({ error: 'timeout (12s)' })), 12000),
            ),
          ]);
          console.log(`[JARVIS] tool=${fnName} took ${Date.now() - t0}ms`);

          // Send function output back to OpenAI
          sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: result,
            },
          });

          // Request model to continue generating response
          sendEvent({ type: 'response.create' });
        } catch (err) {
          console.error('[JARVIS] Error processing function call:', err);
          sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify({ error: 'Error al ejecutar la función' }),
            },
          });
          sendEvent({ type: 'response.create' });
        }
        break;
      }
        
      case 'response.done':
        updateState('listening');
        setResponse('');
        break;
        
      case 'error': {
        const errorInfo = event.error as { message?: string; code?: string } | undefined;
        const errorMessage = errorInfo?.message || 'Error desconocido';
        const errorCode = errorInfo?.code || '';
        console.error('[JARVIS] Realtime API error:', errorCode, errorMessage);
        toast.error(`Error: ${errorMessage}`);
        break;
      }
    }
  }, [updateState, onTranscript, onResponse, executeFunction, sendEvent, startResponseWatchdog]);

  // Stop the realtime session - defined before startSession
  const stopSession = useCallback(() => {
    console.log('[JARVIS] Stopping session...');
    
    // Clear all timers
    clearResilienceTimers();
    iceRestartAttemptedRef.current = false;
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }
    
    setIsActive(false);
    updateState('idle');
    setTranscript('');
    setResponse('');
  }, [updateState, clearResilienceTimers]);

  // Start realtime session with WebRTC
  const startSession = useCallback(async () => {
    if (isActive) {
      console.log('[JARVIS] Session already active, skipping start');
      return;
    }
    
    // Check authentication first
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      toast.error('Inicie sesión para usar JARVIS');
      return;
    }
    
    // Local function to clean up on error
    const cleanupOnError = (reason?: string) => {
      console.log('[JARVIS] Cleanup on error:', reason || 'unknown');
      clearResilienceTimers();
      iceRestartAttemptedRef.current = false;
      
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = null;
        audioElementRef.current.remove();
        audioElementRef.current = null;
      }
      setIsActive(false);
      updateState('idle');
    };
    
    try {
      updateState('connecting');
      setIsActive(true);
      
      // Get ephemeral token from edge function with explicit auth header
      console.log('[JARVIS] Getting ephemeral token... voice=', voice);
      const accessToken = sessionData.session.access_token;
      const { data, error } = await supabase.functions.invoke('jarvis-voice', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { voice },
      });

      if (error || !data?.client_secret?.value) {
        console.error('[JARVIS] Failed to get ephemeral token:', error, data);
        throw new Error('No se pudo obtener el token de sesión');
      }

      const ephemeralKey = data.client_secret.value;
      console.log('[JARVIS] Got ephemeral token, requesting microphone access...');
      
      // Get microphone access
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
        console.log('[JARVIS] Microphone access granted');
      } catch (micError) {
        console.error('[JARVIS] Microphone access denied:', micError);
        throw new Error('Se requiere acceso al micrófono para usar JARVIS');
      }
      
      // Create RTCPeerConnection with ICE servers for better connectivity
      console.log('[JARVIS] Creating RTCPeerConnection with ICE servers...');
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pcRef.current = pc;
      console.log('[JARVIS] PeerConnection created successfully');
      
      // Monitor connection state with resilience
      pc.onconnectionstatechange = () => {
        const connectionState = pc.connectionState;
        const iceState = pc.iceConnectionState;
        console.log('[JARVIS] Connection state:', connectionState, 'ICE state:', iceState);
        
        // Clear any existing disconnect timer on state change
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        
        switch (connectionState) {
          case 'connected':
            // Connection is healthy, reset ICE restart flag
            iceRestartAttemptedRef.current = false;
            break;
            
          case 'disconnected':
            // Transient state - wait before giving up
            console.log('[JARVIS] Connection disconnected, attempting recovery...');
            
            // Try ICE restart once
            if (!iceRestartAttemptedRef.current) {
              iceRestartAttemptedRef.current = true;
              console.log('[JARVIS] Attempting ICE restart...');
              try {
                pc.restartIce();
              } catch (e) {
                console.warn('[JARVIS] ICE restart failed:', e);
              }
            }
            
            // Set a timer to give up after 8 seconds
            disconnectTimerRef.current = setTimeout(() => {
              if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                console.error('[JARVIS] Connection did not recover after timeout');
                toast.error('Conexión perdida con JARVIS');
                cleanupOnError('disconnect_timeout');
              }
            }, 8000);
            break;
            
          case 'failed':
            console.error('[JARVIS] WebRTC connection failed');
            toast.error('Error de conexión WebRTC');
            cleanupOnError('connection_failed');
            break;
            
          case 'closed':
            // Normal closure, no error
            console.log('[JARVIS] Connection closed normally');
            break;
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log('[JARVIS] ICE state:', pc.iceConnectionState);
      };
      
      // Add microphone track
      const tracks = mediaStreamRef.current.getTracks();
      console.log('[JARVIS] Adding microphone tracks:', tracks.length);
      tracks.forEach(track => {
        console.log('[JARVIS] Adding track:', track.kind, track.label);
        pc.addTrack(track, mediaStreamRef.current!);
      });
      
      // Set up audio output - MUST be in DOM for mobile browsers
      console.log('[JARVIS] Creating audio element for playback...');
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      (audioEl as any).playsInline = true; // CRITICAL for iOS
      audioEl.setAttribute('playsinline', ''); // Some browsers need this attribute
      audioEl.setAttribute('autoplay', '');
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      audioElementRef.current = audioEl;
      console.log('[JARVIS] Audio element created and added to DOM');
      
      pc.ontrack = (event) => {
        console.log('[JARVIS] Received remote audio track:', event.streams.length, 'streams');
        audioEl.srcObject = event.streams[0];
        // Force play for browsers that require user gesture
        audioEl.play().catch(e => console.log('[JARVIS] Audio play warning (normal on some browsers):', e.message));
      };
      
      // Set up data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;
      
      dc.onopen = () => {
        console.log('[JARVIS] Data channel open - ready for conversation!');
        
        // Use the rich instructions returned by edge function (with user context injected)
        const richInstructions: string = data.instructions || `Eres JARVIS, superagente personal con acceso completo a la app. Habla en castellano, tono mayordomo de élite, conciso y resolutivo.`;

        sendEvent({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: richInstructions,
            audio: {
              input: {
                transcription: { model: 'whisper-1' },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
              },
              output: { voice: 'alloy' },
            },
            tools: [
              // ── tareas ─────────────────────────────────────────────
              {
                type: 'function', name: 'create_task',
                description: 'Crea una nueva tarea (todo) del usuario',
                parameters: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Título de la tarea' },
                    priority: { type: 'number', description: 'Prioridad 1 (baja) a 5 (urgente)' },
                    due_date: { type: 'string', description: 'Fecha límite YYYY-MM-DD (opcional)' },
                  },
                  required: ['title'],
                },
              },
              {
                type: 'function', name: 'complete_task',
                description: 'Marca como completada una tarea buscando por título',
                parameters: { type: 'object', properties: { task_title: { type: 'string' } }, required: ['task_title'] },
              },
              {
                type: 'function', name: 'list_pending_tasks',
                description: 'Lista las tareas pendientes',
                parameters: { type: 'object', properties: {} },
              },
              // ── contactos ──────────────────────────────────────────
              {
                type: 'function', name: 'search_contacts',
                description: 'Busca contactos del usuario con matching difuso (tolera typos y nombres parciales). ÚSALO siempre que el usuario mencione una persona.',
                parameters: { type: 'object', properties: { query: { type: 'string', description: 'Nombre o parte del nombre' } }, required: ['query'] },
              },
              {
                type: 'function', name: 'create_contact',
                description: 'Crea un nuevo contacto',
                parameters: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' }, company: { type: 'string' }, role: { type: 'string' },
                    email: { type: 'string' }, phone: { type: 'string' }, notes: { type: 'string' },
                  },
                  required: ['name'],
                },
              },
              // ── proyectos ──────────────────────────────────────────
              {
                type: 'function', name: 'search_projects',
                description: 'Busca proyectos/clientes del usuario por nombre o empresa',
                parameters: { type: 'object', properties: { query: { type: 'string' } } },
              },
              // ── memoria ────────────────────────────────────────────
              {
                type: 'function', name: 'search_memories',
                description: 'Busca en la memoria persistente del asistente (preferencias, decisiones, hechos previos)',
                parameters: { type: 'object', properties: { query: { type: 'string' } } },
              },
              // ── comunicaciones ─────────────────────────────────────
              {
                type: 'function', name: 'get_emails',
                description: 'Obtiene emails (por defecto solo no leídos)',
                parameters: { type: 'object', properties: { unread: { type: 'boolean' } } },
              },
              {
                type: 'function', name: 'get_whatsapp_recent',
                description: 'Obtiene los últimos mensajes de WhatsApp',
                parameters: { type: 'object', properties: {} },
              },
              // ── delegación a especialistas ─────────────────────────
              {
                type: 'function', name: 'ask_specialist',
                description: 'Delega una consulta profunda al gateway de especialistas (coach, nutrición, inglés, finanzas, salud, retail, secretaria, bosco). Úsalo para preguntas que requieran experticia de dominio.',
                parameters: {
                  type: 'object',
                  properties: { question: { type: 'string', description: 'La pregunta completa para el especialista' } },
                  required: ['question'],
                },
              },
              // ── query genérica ─────────────────────────────────────
              {
                type: 'function', name: 'query_table',
                description: 'Consulta genérica filtrada por user_id. Tablas permitidas: todos, people_contacts, business_projects, check_ins, whoop_data, jarvis_emails_cache, whatsapp_messages, bosco_observations, bosco_interactions, transcriptions, specialist_memory, jarvis_memory, pomodoro_sessions, challenges, challenge_logs, agent_chat_messages, ai_news.',
                parameters: {
                  type: 'object',
                  properties: {
                    table: { type: 'string' },
                    filters: { type: 'object', description: 'Pares columna=valor para filtrar' },
                    limit: { type: 'number' },
                  },
                  required: ['table'],
                },
              },
              // ── resumen / stats ───────────────────────────────────
              { type: 'function', name: 'get_today_summary', description: 'Resumen del día (tareas, check-in, WHOOP)', parameters: { type: 'object', properties: {} } },
              { type: 'function', name: 'get_my_stats', description: 'Estadísticas de productividad de la última semana', parameters: { type: 'object', properties: {} } },
              { type: 'function', name: 'ask_about_habits', description: 'Insights y aprendizajes detectados sobre los hábitos del usuario', parameters: { type: 'object', properties: { question: { type: 'string' } } } },
              // ── observaciones / calendario ────────────────────────
              {
                type: 'function', name: 'log_observation',
                description: 'Registra una observación o nota',
                parameters: {
                  type: 'object',
                  properties: { observation: { type: 'string' }, area: { type: 'string', description: 'Área: general, bosco, salud, trabajo, etc.' } },
                  required: ['observation'],
                },
              },
              {
                type: 'function', name: 'create_event',
                description: 'Crea un evento en el calendario (iCloud)',
                parameters: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' }, time: { type: 'string', description: 'HH:MM' },
                    duration: { type: 'number', description: 'minutos' }, description: { type: 'string' },
                  },
                  required: ['title', 'time', 'duration'],
                },
              },
              {
                type: 'function', name: 'delete_event',
                description: 'Elimina/cancela un evento del calendario',
                parameters: { type: 'object', properties: { event_title: { type: 'string' } }, required: ['event_title'] },
              },
            ],
          },
        });
        
        updateState('listening');
        toast.success('JARVIS conectado');
      };
      
      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch (e) {
          console.error('[JARVIS] Error parsing realtime event:', e);
        }
      };
      
      dc.onerror = (err) => {
        const errorEvent = err as RTCErrorEvent;
        const errorMessage = errorEvent.error?.message || 'Error en canal de datos';
        console.error('[JARVIS] Data channel error:', errorMessage);
        toast.error(`Error de comunicación: ${errorMessage}`);
      };
      
      dc.onclose = () => {
        console.log('[JARVIS] Data channel closed');
        // If data channel closes unexpectedly while we're still active
        if (isActive && pc.connectionState === 'connected') {
          console.warn('[JARVIS] Data channel closed unexpectedly');
          toast.error('Sesión de voz finalizada');
          cleanupOnError('datachannel_closed');
        }
      };
      
      // Create offer and wait for ICE gathering to complete (required for iOS Safari)
      console.log('[JARVIS] Creating WebRTC offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Wait for ICE gathering to complete - critical for iOS Safari
      if (pc.iceGatheringState !== 'complete') {
        console.log('[JARVIS] Waiting for ICE gathering to complete...');
        await new Promise<void>((resolve) => {
          const checkState = () => {
            console.log('[JARVIS] ICE gathering state:', pc.iceGatheringState);
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          };
          pc.onicegatheringstatechange = checkState;
          // Also check if already complete
          checkState();
          // Timeout fallback after 5 seconds
          setTimeout(() => {
            console.log('[JARVIS] ICE gathering timeout, proceeding...');
            resolve();
          }, 5000);
        });
      }
      console.log('[JARVIS] ICE gathering complete, local SDP ready');
      
      // Verify SDP is available
      const localSdp = pc.localDescription?.sdp;
      if (!localSdp) {
        throw new Error('No se pudo generar la descripción SDP local');
      }
      
      console.log('[JARVIS] Sending offer to OpenAI Realtime API...');
      // GA WebRTC SDP exchange endpoint: /v1/realtime/calls
      const apiResponse = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(OPENAI_REALTIME_MODEL)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
          'Accept': 'application/sdp',
        },
        body: localSdp,
      });
      
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('[JARVIS] OpenAI Realtime error:', apiResponse.status, errorText);
        throw new Error(`Error de OpenAI (${apiResponse.status}): ${errorText.substring(0, 100)}`);
      }
      
      const answerSdp = await apiResponse.text();
      console.log('[JARVIS] Got answer SDP, setting remote description...');
      
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
      
      console.log('[JARVIS] WebRTC connection established successfully!');
      
    } catch (error) {
      console.error('[JARVIS] Error starting session:', error);
      toast.error(error instanceof Error ? error.message : 'Error al iniciar JARVIS');
      cleanupOnError('start_error');
    }
  }, [isActive, updateState, handleRealtimeEvent, sendEvent, clearResilienceTimers]);

  // Toggle session
  const toggleSession = useCallback(() => {
    console.log('[JARVIS] Toggle session, isActive:', isActive);
    if (isActive) {
      stopSession();
    } else {
      startSession();
    }
  }, [isActive, startSession, stopSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearResilienceTimers();
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioElementRef.current) {
        audioElementRef.current.remove();
      }
    };
  }, [clearResilienceTimers]);

  return {
    state,
    isActive,
    transcript,
    response,
    startSession,
    stopSession,
    toggleSession,
  };
}
