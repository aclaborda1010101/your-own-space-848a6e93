import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type RealtimeState = 'idle' | 'connecting' | 'listening' | 'speaking';

interface UseJarvisRealtimeOptions {
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onStateChange?: (state: RealtimeState) => void;
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

  const updateState = useCallback((newState: RealtimeState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Handle realtime events from OpenAI - defined first to avoid circular dependency
  const handleRealtimeEvent = useCallback((event: any) => {
    console.log('[JARVIS] Realtime event:', event.type);
    
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        updateState('listening');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        updateState('speaking');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          setTranscript(event.transcript);
          onTranscript?.(event.transcript);
        }
        break;
        
      case 'response.audio_transcript.delta':
        if (event.delta) {
          setResponse(prev => prev + event.delta);
        }
        break;
        
      case 'response.audio_transcript.done':
        if (event.transcript) {
          setResponse(event.transcript);
          onResponse?.(event.transcript);
        }
        break;
        
      case 'response.done':
        updateState('listening');
        setResponse('');
        break;
        
      case 'error':
        console.error('[JARVIS] Realtime API error:', event.error);
        toast.error('Error en la conversación');
        break;
    }
  }, [updateState, onTranscript, onResponse]);

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
      
      // Create RTCPeerConnection
      console.log('[JARVIS] Creating RTCPeerConnection...');
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      
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
      mediaStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, mediaStreamRef.current!);
      });
      
      // Set up audio output - MUST be in DOM for mobile browsers
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      audioElementRef.current = audioEl;
      
      pc.ontrack = (event) => {
        console.log('[JARVIS] Received remote audio track');
        audioEl.srcObject = event.streams[0];
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
      
      // Create and send offer
      console.log('[JARVIS] Creating WebRTC offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('[JARVIS] Sending offer to OpenAI Realtime API...');
      const apiResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );
      
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
