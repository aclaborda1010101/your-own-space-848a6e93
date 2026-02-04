import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type HybridState = 'idle' | 'listening' | 'processing' | 'speaking';

interface UseJarvisHybridOptions {
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onStateChange?: (state: HybridState) => void;
}

export function useJarvisHybrid(options: UseJarvisHybridOptions = {}) {
  const { onTranscript, onResponse, onStateChange } = options;
  
  const [state, setState] = useState<HybridState>('idle');
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const updateState = useCallback((newState: HybridState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const processAudio = useCallback(async () => {
    updateState('processing');
    
    try {
      // Convertir audio a base64
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Enviar a edge function
      const { data, error } = await supabase.functions.invoke('jarvis-hybrid-voice', {
        body: {
          action: 'process_voice',
          audioBlob: base64Audio,
        },
      });

      if (error) throw error;

      // Mostrar transcripción
      setTranscript(data.transcript);
      onTranscript?.(data.transcript);

      // Mostrar respuesta
      setResponse(data.response);
      onResponse?.(data.response);

      // Reproducir audio de respuesta
      updateState('speaking');
      
      const audioData = atob(data.audioBase64);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      const audioBlob2 = new Blob([audioArray], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob2);

      if (!audioElementRef.current) {
        audioElementRef.current = new Audio();
      }
      
      audioElementRef.current.src = audioUrl;
      audioElementRef.current.onended = () => {
        updateState('idle');
        setIsActive(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audioElementRef.current.play();

    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error('Error al procesar el audio');
      updateState('idle');
      setIsActive(false);
    }
  }, [updateState, onTranscript, onResponse]);

  const startListening = useCallback(async () => {
    try {
      setIsActive(true);
      updateState('listening');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length > 0) {
          processAudio();
        }
      };

      mediaRecorder.start();
      toast.success('JARVIS escuchando...');

      // Auto-stop después de 10 segundos
      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          stopRecording();
        }
      }, 10000);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Error al acceder al micrófono');
      setIsActive(false);
      updateState('idle');
    }
  }, [updateState, stopRecording, processAudio]);

  const toggleSession = useCallback(() => {
    if (isActive) {
      stopRecording();
    } else {
      startListening();
    }
  }, [isActive, startListening, stopRecording]);

  return {
    state,
    isActive,
    transcript,
    response,
    toggleSession,
    stopRecording,
  };
}
