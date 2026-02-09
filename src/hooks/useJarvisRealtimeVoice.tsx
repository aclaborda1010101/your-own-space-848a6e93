import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRecognition, RecognitionState } from './useVoiceRecognition';
import { useJarvisTTS, TTSState } from './useJarvisTTS';
import { toast } from 'sonner';

export type JarvisRealtimeState = 
  | 'idle' 
  | 'listening' 
  | 'processing_stt' 
  | 'thinking' 
  | 'speaking' 
  | 'error';

export type AgentType = 'default' | 'coach' | 'english' | 'nutrition';

interface UseJarvisRealtimeVoiceOptions {
  agentType?: AgentType;
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onStateChange?: (state: JarvisRealtimeState) => void;
  autoSpeak?: boolean;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function useJarvisRealtimeVoice(options: UseJarvisRealtimeVoiceOptions = {}) {
  const { 
    agentType = 'default', 
    onTranscript, 
    onResponse, 
    onStateChange,
    autoSpeak = true,
  } = options;
  
  const { user } = useAuth();
  
  const [state, setState] = useState<JarvisRealtimeState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const isProcessingRef = useRef(false);

  // Update state and notify
  const updateState = useCallback((newState: JarvisRealtimeState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Voice Recognition (STT with Groq)
  const {
    isRecording,
    startRecording: startSTT,
    stopRecording: stopSTT,
    cancelRecording,
  } = useVoiceRecognition({
    onTranscript: (text) => {
      setTranscript(text);
      onTranscript?.(text);
    },
    onStateChange: (sttState) => {
      if (sttState === 'recording') {
        updateState('listening');
      } else if (sttState === 'processing') {
        updateState('processing_stt');
      }
    },
  });

  // TTS (ElevenLabs)
  const {
    isSpeaking,
    speak,
    stopSpeaking,
  } = useJarvisTTS({
    onSpeakingStart: () => {
      updateState('speaking');
    },
    onSpeakingEnd: () => {
      updateState('idle');
    },
  });

  // Process transcript through Claude via jarvis-realtime edge function
  const processWithClaude = useCallback(async (text: string): Promise<string | null> => {
    if (!user?.id) {
      toast.error('No autenticado');
      return null;
    }

    updateState('thinking');
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('jarvis-realtime', {
        body: {
          transcript: text,
          agentType,
          sessionId: sessionIdRef.current,
          userId: user.id,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const responseText = data.response;
      
      setResponse(responseText);
      onResponse?.(responseText);
      
      // Add to local messages
      const userMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      
      const assistantMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMsg, assistantMsg]);
      
      return responseText;
    } catch (err) {
      console.error('[JarvisRealtimeVoice] Claude error:', err);
      const message = err instanceof Error ? err.message : 'Error procesando mensaje';
      setError(message);
      toast.error('Error de JARVIS', { description: message });
      updateState('error');
      return null;
    }
  }, [user?.id, agentType, updateState, onResponse]);

  // Start voice conversation (begin recording)
  const startListening = useCallback(async () => {
    if (isProcessingRef.current || isRecording || isSpeaking) {
      return;
    }
    
    setError(null);
    setTranscript('');
    setResponse('');
    
    await startSTT();
  }, [isRecording, isSpeaking, startSTT]);

  // Stop listening and process
  const stopListening = useCallback(async () => {
    if (!isRecording || isProcessingRef.current) {
      return;
    }
    
    isProcessingRef.current = true;
    
    try {
      // Stop recording and get transcript
      const text = await stopSTT();
      
      if (!text) {
        updateState('idle');
        isProcessingRef.current = false;
        return;
      }
      
      // Process with Claude
      const responseText = await processWithClaude(text);
      
      if (!responseText) {
        isProcessingRef.current = false;
        return;
      }
      
      // Speak response
      if (autoSpeak) {
        await speak(responseText);
      } else {
        updateState('idle');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [isRecording, stopSTT, processWithClaude, autoSpeak, speak, updateState]);

  // Toggle recording (push-to-talk style)
  const toggleListening = useCallback(async () => {
    if (isRecording) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [isRecording, startListening, stopListening]);

  // Send text message (for hybrid input)
  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessingRef.current) {
      return null;
    }
    
    isProcessingRef.current = true;
    setTranscript(text);
    onTranscript?.(text);
    
    try {
      const responseText = await processWithClaude(text);
      
      if (!responseText) {
        return null;
      }
      
      if (autoSpeak) {
        await speak(responseText);
      } else {
        updateState('idle');
      }
      
      return responseText;
    } finally {
      isProcessingRef.current = false;
    }
  }, [processWithClaude, autoSpeak, speak, updateState, onTranscript]);

  // Stop everything
  const stop = useCallback(() => {
    cancelRecording();
    stopSpeaking();
    isProcessingRef.current = false;
    updateState('idle');
  }, [cancelRecording, stopSpeaking, updateState]);

  // Reset session
  const resetSession = useCallback(() => {
    stop();
    sessionIdRef.current = crypto.randomUUID();
    setMessages([]);
    setTranscript('');
    setResponse('');
    setError(null);
  }, [stop]);

  // Subscribe to Supabase Realtime for state sync
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('jarvis-state')
      .on('broadcast', { event: 'jarvis_response' }, ({ payload }) => {
        if (payload.userId === user.id && payload.sessionId === sessionIdRef.current) {
          console.log('[JarvisRealtimeVoice] Realtime update:', payload.state);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    // State
    state,
    isRecording,
    isSpeaking,
    isProcessing: isProcessingRef.current || state === 'thinking' || state === 'processing_stt',
    
    // Data
    transcript,
    response,
    messages,
    error,
    sessionId: sessionIdRef.current,
    
    // Actions
    startListening,
    stopListening,
    toggleListening,
    sendTextMessage,
    stop,
    resetSession,
    
    // Direct TTS control
    speak,
    stopSpeaking,
  };
}
