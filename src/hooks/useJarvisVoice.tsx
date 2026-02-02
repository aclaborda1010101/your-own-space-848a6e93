import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface UseJarvisVoiceOptions {
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onStateChange?: (state: VoiceState) => void;
  autoSpeak?: boolean;
}

export function useJarvisVoice(options: UseJarvisVoiceOptions = {}) {
  const { onTranscript, onResponse, onStateChange, autoSpeak = true } = options;
  
  const [state, setState] = useState<VoiceState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Update state and notify
  const updateState = useCallback((newState: VoiceState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Start recording audio
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;
      
      // Initialize audio context for potential visualization
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      updateState('listening');
      
      console.log('Started recording');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('No se pudo acceder al micrófono');
    }
  }, [updateState]);

  // Stop recording and transcribe
  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        updateState('thinking');
        
        // Stop media stream tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
        });
        
        console.log('Audio blob size:', audioBlob.size);
        
        if (audioBlob.size < 1000) {
          console.log('Audio too short, ignoring');
          updateState('idle');
          resolve(null);
          return;
        }
        
        try {
          // Send to STT
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          formData.append('language', 'es');
          
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-stt`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: formData,
            }
          );
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Transcription failed');
          }
          
          const data = await response.json();
          const transcribedText = data.text?.trim();
          
          if (transcribedText) {
            console.log('Transcribed:', transcribedText);
            setTranscript(transcribedText);
            onTranscript?.(transcribedText);
            resolve(transcribedText);
          } else {
            updateState('idle');
            resolve(null);
          }
        } catch (error) {
          console.error('Transcription error:', error);
          toast.error('Error al transcribir audio');
          updateState('idle');
          resolve(null);
        }
      };
      
      mediaRecorderRef.current.stop();
    });
  }, [updateState, onTranscript]);

  // Text to speech using JARVIS voice
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text) return;
    
    updateState('speaking');
    setIsSpeaking(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'TTS failed');
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      // Apply audio processing using Web Audio API
      if (audioContextRef.current) {
        try {
          const source = audioContextRef.current.createMediaElementSource(audio);
          
          // Create audio processing chain for JARVIS effect
          // Subtle echo effect
          const convolver = audioContextRef.current.createConvolver();
          
          // Equalizer boost at 2500Hz
          const eq = audioContextRef.current.createBiquadFilter();
          eq.type = 'peaking';
          eq.frequency.value = 2500;
          eq.gain.value = 2;
          eq.Q.value = 1;
          
          // High-pass filter at 100Hz
          const highpass = audioContextRef.current.createBiquadFilter();
          highpass.type = 'highpass';
          highpass.frequency.value = 100;
          
          // Connect the chain
          source.connect(eq);
          eq.connect(highpass);
          highpass.connect(audioContextRef.current.destination);
        } catch (e) {
          // If audio processing fails, just play normally
          console.log('Audio processing unavailable, playing raw audio');
        }
      }
      
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
          updateState('idle');
          currentAudioRef.current = null;
          resolve();
        };
        
        audio.onerror = (e) => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
          updateState('idle');
          currentAudioRef.current = null;
          reject(e);
        };
        
        audio.play().catch(reject);
      });
    } catch (error) {
      console.error('TTS error:', error);
      toast.error('Error al sintetizar voz');
      setIsSpeaking(false);
      updateState('idle');
    }
  }, [updateState]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    updateState('idle');
  }, [updateState]);

  // Process voice input through AI and respond
  const processVoiceInput = useCallback(async (text: string) => {
    updateState('thinking');
    
    try {
      // Send to JARVIS coach for processing
      const { data, error } = await supabase.functions.invoke('jarvis-coach', {
        body: { 
          message: text,
          sessionType: 'daily',
          emotionalState: { energy: 5, mood: 5, stress: 3, anxiety: 3, motivation: 5 },
          messages: []
        }
      });
      
      if (error) throw error;
      
      const responseText = data?.message || 'Lo siento, no he podido procesar tu mensaje.';
      onResponse?.(responseText);
      
      if (autoSpeak) {
        await speak(responseText);
      } else {
        updateState('idle');
      }
      
      return responseText;
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Error al procesar mensaje');
      updateState('idle');
      return null;
    }
  }, [updateState, onResponse, autoSpeak, speak]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  return {
    state,
    isRecording,
    isSpeaking,
    transcript,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
    processVoiceInput,
  };
}
