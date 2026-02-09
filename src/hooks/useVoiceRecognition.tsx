import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export type RecognitionState = 'idle' | 'recording' | 'processing' | 'error';

interface UseVoiceRecognitionOptions {
  onTranscript?: (text: string) => void;
  onStateChange?: (state: RecognitionState) => void;
  language?: string;
}

// Supabase Edge Function for STT (API keys managed server-side)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xfjlwxssxfvhbiytcoar.supabase.co';
const STT_ENDPOINT = `${SUPABASE_URL}/functions/v1/speech-to-text`;

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const { onTranscript, onStateChange, language = 'es' } = options;
  
  const [state, setState] = useState<RecognitionState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Update state and notify
  const updateState = useCallback((newState: RecognitionState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Check microphone permission
  const checkMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state === 'granted' || result.state === 'prompt';
    } catch {
      // Firefox doesn't support permissions.query for microphone
      return true;
    }
  }, []);

  // Start recording audio from microphone
  const startRecording = useCallback(async () => {
    setError(null);
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        } 
      });
      
      streamRef.current = stream;
      
      // Determine best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : 'audio/ogg';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Error de grabación');
        updateState('error');
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      updateState('recording');
      
      console.log('[VoiceRecognition] Started recording with', mimeType);
    } catch (err) {
      console.error('Error starting recording:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('Permiso de micrófono denegado');
        toast.error('Permiso de micrófono denegado', {
          description: 'Por favor, permite el acceso al micrófono en la configuración del navegador'
        });
      } else if (message.includes('NotFoundError')) {
        setError('No se encontró micrófono');
        toast.error('No se encontró micrófono');
      } else {
        setError(message);
        toast.error('No se pudo acceder al micrófono');
      }
      
      updateState('error');
    }
  }, [updateState]);

  // Stop recording and transcribe using Groq Whisper
  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        updateState('processing');
        
        // Stop media stream tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        console.log('[VoiceRecognition] Audio blob size:', audioBlob.size, 'type:', mimeType);
        
        // Check minimum audio size (avoid sending noise)
        if (audioBlob.size < 1000) {
          console.log('[VoiceRecognition] Audio too short, ignoring');
          updateState('idle');
          resolve(null);
          return;
        }
        
        try {
          // Determine file extension
          const extension = mimeType.includes('webm') ? 'webm' 
            : mimeType.includes('mp4') ? 'mp4' 
            : mimeType.includes('ogg') ? 'ogg' 
            : 'wav';
          
          // Send to Supabase Edge Function (Groq Whisper)
          const formData = new FormData();
          formData.append('file', audioBlob, `recording.${extension}`);
          formData.append('language', language);
          
          console.log('[VoiceRecognition] Sending to STT Edge Function...');
          const startTime = Date.now();
          
          const response = await fetch(STT_ENDPOINT, {
            method: 'POST',
            body: formData,
          });
          
          const elapsed = Date.now() - startTime;
          console.log(`[VoiceRecognition] STT response in ${elapsed}ms`);
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
          }
          
          const data = await response.json();
          const transcribedText = data.text?.trim();
          
          if (transcribedText) {
            console.log('[VoiceRecognition] Transcribed:', transcribedText);
            setTranscript(transcribedText);
            onTranscript?.(transcribedText);
            updateState('idle');
            resolve(transcribedText);
          } else {
            console.log('[VoiceRecognition] No text transcribed');
            updateState('idle');
            resolve(null);
          }
        } catch (err) {
          console.error('[VoiceRecognition] Transcription error:', err);
          const message = err instanceof Error ? err.message : 'Error de transcripción';
          setError(message);
          toast.error('Error al transcribir audio', { description: message });
          updateState('error');
          resolve(null);
        }
      };
      
      mediaRecorderRef.current.stop();
    });
  }, [updateState, onTranscript, language]);

  // Cancel recording without transcribing
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    audioChunksRef.current = [];
    setIsRecording(false);
    updateState('idle');
  }, [updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    state,
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    checkMicrophonePermission,
  };
}
