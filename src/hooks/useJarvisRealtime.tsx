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

  // Start realtime session with WebRTC
  const startSession = useCallback(async () => {
    if (isActive) return;
    
    try {
      updateState('connecting');
      setIsActive(true);
      
      // Get ephemeral token from edge function
      console.log('Getting ephemeral token...');
      const { data, error } = await supabase.functions.invoke('jarvis-voice');
      
      if (error || !data?.client_secret?.value) {
        console.error('Failed to get ephemeral token:', error, data);
        throw new Error('No se pudo obtener el token de sesión');
      }
      
      const ephemeralKey = data.client_secret.value;
      console.log('Got ephemeral token, setting up WebRTC...');
      
      // Get microphone access
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
      }
      
      // Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      
      // Add microphone track
      mediaStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, mediaStreamRef.current!);
      });
      
      // Set up audio output
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.style.display = 'none';  // Oculto pero en DOM
      document.body.appendChild(audioEl);  // AÑADIR AL DOM
      audioElementRef.current = audioEl;
      
      pc.ontrack = (event) => {
        console.log('Received remote audio track');
        audioEl.srcObject = event.streams[0];
      };
      
      // Set up data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;
      
      dc.onopen = () => {
        console.log('Data channel open');
        updateState('listening');
      };
      
      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch (e) {
          console.error('Error parsing realtime event:', e);
        }
      };
      
      dc.onerror = (err) => {
        console.error('Data channel error:', err);
      };
      
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('Sending offer to OpenAI Realtime...');
      const response = await fetch(
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
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI Realtime error:', response.status, errorText);
        throw new Error(`Error de conexión: ${response.status}`);
      }
      
      const answerSdp = await response.text();
      console.log('Got answer SDP, setting remote description...');
      
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
      
      console.log('WebRTC connection established!');
      
    } catch (error) {
      console.error('Error starting realtime session:', error);
      toast.error(error instanceof Error ? error.message : 'Error al iniciar sesión de voz');
      stopSession();
    }
  }, [isActive, updateState]);

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = useCallback((event: any) => {
    console.log('Realtime event:', event.type, event);
    
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
        console.error('Realtime API error:', event.error);
        toast.error('Error en la conversación');
        break;
    }
  }, [updateState, onTranscript, onResponse]);

  // Stop the realtime session
  const stopSession = useCallback(() => {
    console.log('Stopping realtime session...');
    
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
      audioElementRef.current.remove();  // ELIMINAR DEL DOM
      audioElementRef.current = null;
    }
    
    setIsActive(false);
    updateState('idle');
    setTranscript('');
    setResponse('');
  }, [updateState]);

  // Toggle session
  const toggleSession = useCallback(() => {
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
