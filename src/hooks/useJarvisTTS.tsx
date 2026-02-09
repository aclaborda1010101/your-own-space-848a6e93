import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

export type TTSState = 'idle' | 'loading' | 'speaking' | 'error';

interface UseJarvisTTSOptions {
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onStateChange?: (state: TTSState) => void;
}

// Supabase Edge Function for TTS (API keys managed server-side)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xfjlwxssxfvhbiytcoar.supabase.co';
const TTS_ENDPOINT = `${SUPABASE_URL}/functions/v1/text-to-speech`;

// JARVIS Voice ID (Castellano España - clonada de Iron Man 2)
const JARVIS_VOICE_ID = 'QvEUryiZK2HehvWPsmiL';

// Voice settings for JARVIS
const JARVIS_VOICE_SETTINGS = {
  stability: 0.7,
  similarity_boost: 0.85,
  style: 0.35,
  use_speaker_boost: true,
};

// Split text into chunks for better streaming
const splitTextIntoChunks = (text: string, maxLength: number = 500): string[] => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

export function useJarvisTTS(options: UseJarvisTTSOptions = {}) {
  const { onSpeakingStart, onSpeakingEnd, onStateChange } = options;
  
  const [state, setState] = useState<TTSState>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update state and notify
  const updateState = useCallback((newState: TTSState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Initialize audio context lazily
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // Apply JARVIS AI effect to audio (subtle processing)
  const processAudio = useCallback((audio: HTMLAudioElement): void => {
    try {
      const ctx = getAudioContext();
      
      // Resume context if suspended
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const source = ctx.createMediaElementSource(audio);
      
      // High-pass filter at 80Hz (remove rumble)
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 80;
      
      // Low-pass filter at 12kHz (slightly soften highs)
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 12000;
      
      // Presence boost at 3kHz
      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3000;
      presence.gain.value = 2.5;
      presence.Q.value = 1;
      
      // Air boost at 6kHz
      const air = ctx.createBiquadFilter();
      air.type = 'peaking';
      air.frequency.value = 6000;
      air.gain.value = 1.5;
      air.Q.value = 1;
      
      // Subtle compression
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 10;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.05;
      
      // Connect chain
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(presence);
      presence.connect(air);
      air.connect(compressor);
      compressor.connect(ctx.destination);
      
    } catch (e) {
      // If processing fails, audio will play through default path
      console.log('[JarvisTTS] Audio processing unavailable:', e);
    }
  }, [getAudioContext]);

  // Play next audio in queue
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      updateState('idle');
      onSpeakingEnd?.();
      return;
    }
    
    const audio = audioQueueRef.current.shift()!;
    currentAudioRef.current = audio;
    
    audio.onended = () => {
      playNextInQueue();
    };
    
    audio.onerror = (e) => {
      console.error('[JarvisTTS] Audio playback error:', e);
      playNextInQueue(); // Continue with next chunk
    };
    
    audio.play().catch((e) => {
      console.error('[JarvisTTS] Play error:', e);
      playNextInQueue();
    });
  }, [updateState, onSpeakingEnd]);

  // Fetch audio for a text chunk using Supabase Edge Function (TTS)
  const fetchAudioChunk = useCallback(async (
    text: string, 
    signal?: AbortSignal
  ): Promise<HTMLAudioElement | null> => {
    try {
      const response = await fetch(TTS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voiceId: JARVIS_VOICE_ID,
        }),
        signal,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail?.message || `HTTP ${response.status}`);
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      
      // Apply JARVIS audio processing
      processAudio(audio);
      
      // Clean up URL when audio ends
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
      
      return audio;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }, [processAudio]);

  // Speak text with JARVIS voice (with streaming/chunking)
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!text?.trim()) return;
    
    // Cancel any ongoing speech
    stopSpeaking();
    
    setError(null);
    setCurrentText(text);
    setIsSpeaking(true);
    updateState('loading');
    onSpeakingStart?.();
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      // Split into chunks for better streaming UX
      const chunks = splitTextIntoChunks(text, 300);
      console.log(`[JarvisTTS] Speaking ${text.length} chars in ${chunks.length} chunks`);
      
      // Fetch first chunk immediately, queue rest
      const firstAudio = await fetchAudioChunk(chunks[0], signal);
      
      if (!firstAudio || signal.aborted) {
        throw new Error('Cancelled');
      }
      
      // Start playing first chunk
      isPlayingRef.current = true;
      updateState('speaking');
      currentAudioRef.current = firstAudio;
      
      firstAudio.onended = () => {
        playNextInQueue();
      };
      
      firstAudio.play().catch((e) => {
        console.error('[JarvisTTS] First chunk play error:', e);
        playNextInQueue();
      });
      
      // Fetch remaining chunks in parallel (with limit)
      const remainingChunks = chunks.slice(1);
      const fetchPromises = remainingChunks.map((chunk, i) => 
        // Stagger requests slightly to maintain order
        new Promise<HTMLAudioElement | null>(resolve => {
          setTimeout(async () => {
            try {
              const audio = await fetchAudioChunk(chunk, signal);
              resolve(audio);
            } catch {
              resolve(null);
            }
          }, i * 50);
        })
      );
      
      // Add to queue as they complete
      for (const promise of fetchPromises) {
        const audio = await promise;
        if (audio && !signal.aborted) {
          audioQueueRef.current.push(audio);
        }
      }
      
    } catch (err) {
      if ((err as Error).message === 'Cancelled') {
        return;
      }
      
      console.error('[JarvisTTS] TTS error:', err);
      const message = err instanceof Error ? err.message : 'Error de síntesis de voz';
      setError(message);
      updateState('error');
      setIsSpeaking(false);
      
      if (!message.includes('quota') && !message.includes('limit')) {
        toast.error('Error de voz JARVIS', { description: message });
      }
    }
  }, [fetchAudioChunk, playNextInQueue, updateState, onSpeakingStart]);

  // Stop speaking immediately
  const stopSpeaking = useCallback(() => {
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Stop current audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    
    // Clear queue
    audioQueueRef.current.forEach(audio => {
      audio.pause();
    });
    audioQueueRef.current = [];
    
    isPlayingRef.current = false;
    setIsSpeaking(false);
    updateState('idle');
  }, [updateState]);

  // Pause/resume
  const pause = useCallback(() => {
    if (currentAudioRef.current && !currentAudioRef.current.paused) {
      currentAudioRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (currentAudioRef.current && currentAudioRef.current.paused) {
      currentAudioRef.current.play();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopSpeaking]);

  return {
    state,
    isSpeaking,
    currentText,
    error,
    speak,
    stopSpeaking,
    pause,
    resume,
  };
}
