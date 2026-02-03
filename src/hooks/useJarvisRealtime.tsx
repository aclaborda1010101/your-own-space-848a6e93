import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type RealtimeState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'processing';

interface UseJarvisRealtimeOptions {
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onStateChange?: (state: RealtimeState) => void;
}

// Function execution types
interface FunctionCall {
  call_id: string;
  name: string;
  arguments: string;
}

export function useJarvisRealtime(options: UseJarvisRealtimeOptions = {}) {
  const { onTranscript, onResponse, onStateChange } = options;
  
  const [state, setState] = useState<RealtimeState>('idle');
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const pendingFunctionCallsRef = useRef<Map<string, FunctionCall>>(new Map());

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

  // Execute a function call and return the result
  const executeFunction = useCallback(async (name: string, args: Record<string, unknown>): Promise<string> => {
    console.log('[JARVIS] Executing function:', name, args);
    
    try {
      switch (name) {
        case 'create_task': {
          const { data, error } = await supabase
            .from('tasks')
            .insert({
              title: args.title as string,
              type: args.type as string,
              priority: args.priority as string,
              duration: args.duration as number,
              completed: false,
              user_id: (await supabase.auth.getUser()).data.user?.id,
            })
            .select()
            .single();
          
          if (error) throw error;
          return JSON.stringify({ success: true, task: data });
        }
        
        case 'complete_task': {
          const searchTitle = (args.task_title as string).toLowerCase();
          const { data: tasks } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('completed', false)
            .ilike('title', `%${searchTitle}%`)
            .limit(1);
          
          if (!tasks?.length) {
            return JSON.stringify({ success: false, message: 'No se encontró la tarea' });
          }
          
          const { error } = await supabase
            .from('tasks')
            .update({ completed: true, completed_at: new Date().toISOString() })
            .eq('id', tasks[0].id);
          
          if (error) throw error;
          return JSON.stringify({ success: true, task: tasks[0].title });
        }
        
        case 'list_pending_tasks': {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('title, type, priority, duration')
            .eq('completed', false)
            .order('created_at', { ascending: false })
            .limit(10);
          
          return JSON.stringify({ tasks: tasks || [] });
        }
        
        case 'get_today_summary': {
          const today = new Date().toISOString().split('T')[0];
          
          const [{ data: tasks }, { data: checkIn }] = await Promise.all([
            supabase.from('tasks').select('title, completed, type').gte('created_at', today),
            supabase.from('check_ins').select('*').eq('date', today).maybeSingle(),
          ]);
          
          const completed = tasks?.filter(t => t.completed).length || 0;
          const pending = tasks?.filter(t => !t.completed).length || 0;
          
          return JSON.stringify({
            date: today,
            tasksCompleted: completed,
            tasksPending: pending,
            checkIn: checkIn ? { energy: checkIn.energy, mood: checkIn.mood, focus: checkIn.focus } : null,
          });
        }
        
        case 'create_event': {
          // Call icloud-calendar to create event
          const eventDate = new Date().toISOString().split('T')[0];
          const startDateTime = new Date(`${eventDate}T${args.time}:00`);
          const endDateTime = new Date(startDateTime.getTime() + (args.duration as number) * 60 * 1000);
          
          const { data, error } = await supabase.functions.invoke('icloud-calendar', {
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
          const today = new Date().toISOString().split('T')[0];
          const userId = (await supabase.auth.getUser()).data.user?.id;
          
          const { data: existing } = await supabase
            .from('daily_observations')
            .select('id, observations')
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();
          
          const newObs = args.observation as string;
          const combined = existing?.observations 
            ? `${existing.observations}\n${newObs}` 
            : newObs;
          
          if (existing) {
            await supabase
              .from('daily_observations')
              .update({ observations: combined })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('daily_observations')
              .insert({ user_id: userId, date: today, observations: newObs });
          }
          
          return JSON.stringify({ success: true, message: 'Observación registrada' });
        }
        
        case 'get_my_stats': {
          const today = new Date();
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          
          const [{ data: pomodoros }, { data: tasks }, { data: checkIns }] = await Promise.all([
            supabase.from('pomodoro_sessions')
              .select('id')
              .gte('created_at', weekAgo.toISOString()),
            supabase.from('tasks')
              .select('id, completed')
              .gte('created_at', weekAgo.toISOString()),
            supabase.from('check_ins')
              .select('date')
              .gte('date', weekAgo.toISOString().split('T')[0])
              .order('date', { ascending: false }),
          ]);
          
          const streak = checkIns?.length || 0;
          const tasksCompleted = tasks?.filter(t => t.completed).length || 0;
          const totalTasks = tasks?.length || 0;
          const pomodoroCount = pomodoros?.length || 0;
          
          return JSON.stringify({
            weeklyStreak: streak,
            pomodoroSessions: pomodoroCount,
            tasksCompleted,
            totalTasks,
            completionRate: totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0,
          });
        }
        
        case 'ask_about_habits': {
          const { data: insights } = await supabase
            .from('habit_insights')
            .select('insight_type, title, description, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (!insights?.length) {
            return JSON.stringify({ 
              message: 'Aún no hay suficientes datos para generar insights sobre hábitos.',
              suggestion: 'Continúe usando la app durante unos días más.' 
            });
          }
          
          return JSON.stringify({
            question: args.question,
            insights: insights.map(i => ({
              type: i.insight_type,
              title: i.title,
              description: i.description,
            })),
          });
        }
        
        case 'delete_event': {
          const { data, error } = await supabase.functions.invoke('icloud-calendar', {
            body: {
              action: 'delete',
              title: args.event_title,
            },
          });
          
          if (error) throw error;
          return JSON.stringify({ success: true, deleted: args.event_title });
        }
        
        default:
          return JSON.stringify({ error: `Función ${name} no implementada` });
      }
    } catch (err) {
      console.error('[JARVIS] Function execution error:', err);
      return JSON.stringify({ error: err instanceof Error ? err.message : 'Error desconocido' });
    }
  }, []);

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = useCallback(async (event: Record<string, unknown>) => {
    const eventType = event.type as string;
    console.log('[JARVIS] Realtime event:', eventType);
    
    switch (eventType) {
      case 'input_audio_buffer.speech_started':
        updateState('listening');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        updateState('processing');
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
          const result = await executeFunction(fnName, parsedArgs);
          
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
        
      case 'error':
        console.error('[JARVIS] Realtime API error:', event.error);
        toast.error('Error en la conversación');
        break;
    }
  }, [updateState, onTranscript, onResponse, executeFunction, sendEvent]);

  // Stop the realtime session - defined before startSession
  const stopSession = useCallback(() => {
    console.log('[JARVIS] Stopping session...');
    
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
  }, [updateState]);

  // Start realtime session with WebRTC
  const startSession = useCallback(async () => {
    if (isActive) {
      console.log('[JARVIS] Session already active, skipping start');
      return;
    }
    
    // Local function to clean up on error
    const cleanupOnError = () => {
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
      
      // Get ephemeral token from edge function
      console.log('[JARVIS] Getting ephemeral token...');
      const { data, error } = await supabase.functions.invoke('jarvis-voice');
      
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
      
      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log('[JARVIS] Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.error('[JARVIS] WebRTC connection failed');
          toast.error('Conexión perdida con JARVIS');
          cleanupOnError();
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
        console.error('[JARVIS] Data channel error:', err);
      };
      
      dc.onclose = () => {
        console.log('[JARVIS] Data channel closed');
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
      
      console.log('[JARVIS] Sending offer to OpenAI Realtime API...');
      // WebRTC SDP exchange endpoint (ephemeral key auth)
      // Use the gathered SDP which now includes ICE candidates
      const apiResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: pc.localDescription?.sdp,
      });
      
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('[JARVIS] OpenAI Realtime error:', apiResponse.status, errorText);
        throw new Error(`Error de conexión con OpenAI: ${apiResponse.status}`);
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
      cleanupOnError();
    }
  }, [isActive, updateState, handleRealtimeEvent]);

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
  }, []);

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
