import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, X, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

// Animated waveform that reacts to audio levels
const AnimatedWaveform = ({ audioLevel, isActive }: { audioLevel: number; isActive: boolean }) => {
  const bars = 24;
  const [levels, setLevels] = useState<number[]>(Array(bars).fill(0.1));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLevels(prev => prev.map((_, i) => {
        if (!isActive) {
          return 0.1 + Math.sin((Date.now() / 200) + i * 0.3) * 0.05;
        }
        const base = audioLevel * 0.8;
        const wave = Math.sin((Date.now() / 60) + i * 0.5) * 0.2;
        const random = Math.random() * 0.1;
        return Math.max(0.08, Math.min(1, base + wave + random));
      }));
    }, 50);
    
    return () => clearInterval(interval);
  }, [audioLevel, isActive]);
  
  return (
    <div className="flex items-center justify-center gap-[3px] h-16 px-4">
      {levels.map((level, i) => (
        <div
          key={i}
          className="w-[3px] bg-gradient-to-t from-primary via-primary/80 to-primary/50 rounded-full transition-all duration-[50ms]"
          style={{ height: `${level * 100}%`, minHeight: '4px' }}
        />
      ))}
    </div>
  );
};

export const PotusFloatingButton = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ConversationState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusText, setStatusText] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);
  const isOpenRef = useRef(false);
  const hasSpokenRef = useRef(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    return () => cleanup();
  }, []);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch (e) { /* ignore */ }
    }
    mediaRecorderRef.current = null;
    analyserRef.current = null;
    isProcessingRef.current = false;
    hasSpokenRef.current = false;
  }, []);

  const processRecording = useCallback(async () => {
    if (isProcessingRef.current || !isOpenRef.current) return;
    isProcessingRef.current = true;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setState('processing');
    setStatusText('POTUS está pensando...');
    setAudioLevel(0);
    
    // Stop media recorder
    if (mediaRecorderRef.current?.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.onstop = () => resolve();
          mediaRecorderRef.current.stop();
        } else {
          resolve();
        }
      });
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    const audioBlob = new Blob(audioChunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || 'audio/webm'
    });
    audioChunksRef.current = [];
    
    // Check if we have enough audio
    if (audioBlob.size < 1000 || !hasSpokenRef.current) {
      console.log('Not enough audio, restarting...');
      isProcessingRef.current = false;
      hasSpokenRef.current = false;
      if (isOpenRef.current) {
        startListening();
      }
      return;
    }
    
    try {
      // Transcribe audio using Whisper (jarvis-stt)
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', 'es');
      
      console.log('Sending audio to Whisper for transcription...');
      
      const sttResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-stt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );
      
      if (!sttResponse.ok) {
        throw new Error(`Transcription failed: ${sttResponse.status}`);
      }
      
      const sttData = await sttResponse.json();
      const userText = sttData.text?.trim();
      
      console.log('Transcribed text:', userText);
      
      if (!userText) {
        console.log('No text detected, restarting...');
        isProcessingRef.current = false;
        hasSpokenRef.current = false;
        if (isOpenRef.current) {
          startListening();
        }
        return;
      }
      
      // Check for goodbye phrases
      const goodbyePhrases = ['adiós', 'adios', 'cerrar', 'hasta luego', 'chao', 'bye', 'terminar'];
      const shouldClose = goodbyePhrases.some(phrase => 
        userText.toLowerCase().includes(phrase)
      );
      
      // Save user message
      if (user) {
        await supabase.from("potus_chat").insert({
          user_id: user.id,
          role: "user",
          message: userText,
        });
      }
      
      // Get response from POTUS
      const chatResponse = await supabase.functions.invoke("potus-chat", {
        body: { message: userText },
      });
      
      if (chatResponse.error) throw chatResponse.error;
      
      const assistantText = chatResponse.data?.response || "Lo siento, no pude procesar tu mensaje.";
      
      console.log('POTUS response:', assistantText);
      
      // Save assistant message
      if (user) {
        await supabase.from("potus_chat").insert({
          user_id: user.id,
          role: "assistant",
          message: assistantText,
        });
      }
      
      await speakResponse(assistantText, shouldClose);
      
    } catch (error) {
      console.error("Error processing:", error);
      toast.error("Error al procesar el audio");
      isProcessingRef.current = false;
      hasSpokenRef.current = false;
      if (isOpenRef.current) {
        startListening();
      }
    }
  }, [user]);

  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || isProcessingRef.current || !isOpenRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    setAudioLevel(normalizedLevel);
    
    const SILENCE_THRESHOLD = 0.04;
    const SILENCE_DURATION = 1500;
    
    if (normalizedLevel > SILENCE_THRESHOLD) {
      // User is speaking
      hasSpokenRef.current = true;
      silenceStartRef.current = null;
    } else {
      // Silence detected
      if (!silenceStartRef.current) {
        silenceStartRef.current = Date.now();
      } else if (hasSpokenRef.current && Date.now() - silenceStartRef.current > SILENCE_DURATION) {
        // User spoke and then was silent for 1.5s
        processRecording();
        return;
      }
    }
    
    animationRef.current = requestAnimationFrame(analyzeAudio);
  }, [processRecording]);

  const startListening = useCallback(async () => {
    if (isProcessingRef.current || !isOpenRef.current) return;
    
    try {
      console.log('Requesting microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      if (!isOpenRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      streamRef.current = stream;
      
      // Setup audio analyzer
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Reset state
      silenceStartRef.current = null;
      hasSpokenRef.current = false;
      audioChunksRef.current = [];
      
      // Start analyzing
      analyzeAudio();
      
      // Start recording
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      
      setState('listening');
      setStatusText('Escuchando...');
      
      console.log('Microphone active, listening...');
      
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("No se pudo acceder al micrófono. Habilita los permisos en tu navegador.");
      handleClose();
    }
  }, [analyzeAudio]);

  const speakResponse = useCallback(async (text: string, shouldCloseAfter: boolean = false) => {
    if (!isOpenRef.current) return;
    
    setState('speaking');
    setStatusText('POTUS está hablando...');
    
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
      
      if (!response.ok) throw new Error('TTS failed');
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      let speakingInterval: ReturnType<typeof setInterval>;
      
      audio.onplay = () => {
        speakingInterval = setInterval(() => {
          setAudioLevel(0.4 + Math.random() * 0.4);
        }, 100);
      };
      
      audio.onended = () => {
        clearInterval(speakingInterval);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        setAudioLevel(0);
        isProcessingRef.current = false;
        hasSpokenRef.current = false;
        
        if (shouldCloseAfter) {
          handleClose();
        } else if (isOpenRef.current) {
          startListening();
        }
      };
      
      audio.onerror = () => {
        clearInterval(speakingInterval);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        isProcessingRef.current = false;
        hasSpokenRef.current = false;
        if (isOpenRef.current) {
          startListening();
        }
      };
      
      await audio.play();
      
    } catch (error) {
      console.error("TTS error:", error);
      isProcessingRef.current = false;
      hasSpokenRef.current = false;
      if (isOpenRef.current) {
        startListening();
      }
    }
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    isOpenRef.current = true;
    setState('idle');
    setStatusText('Iniciando...');
    
    // Start listening after a brief delay for animation
    setTimeout(() => {
      if (isOpenRef.current) {
        startListening();
      }
    }, 150);
  }, [startListening]);

  const handleClose = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    setState('idle');
    setStatusText('');
    setAudioLevel(0);
    cleanup();
  }, [cleanup]);

  const getStatusIcon = () => {
    switch (state) {
      case 'listening':
        return <Mic className="h-5 w-5 text-destructive" />;
      case 'processing':
        return <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      case 'speaking':
        return <Volume2 className="h-5 w-5 text-primary animate-pulse" />;
      default:
        return <Mic className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
          
          <div className={cn(
            "relative flex flex-col items-center gap-4 px-8 py-6 rounded-3xl",
            "bg-card/95 border border-primary/30 shadow-2xl shadow-primary/20",
            "backdrop-blur-xl min-w-[280px]",
            "animate-in zoom-in-95 fade-in duration-200"
          )}>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
            
            <AnimatedWaveform 
              audioLevel={audioLevel} 
              isActive={state === 'listening' || state === 'speaking'} 
            />
            
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                state === 'listening' && "bg-destructive/20",
                state === 'processing' && "bg-primary/20",
                state === 'speaking' && "bg-primary/20",
                state === 'idle' && "bg-muted"
              )}>
                {getStatusIcon()}
              </div>
              <span className="text-sm text-muted-foreground font-medium">
                {statusText}
              </span>
            </div>
            
            {state === 'listening' && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  Habla cuando quieras...
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      <Button
        onClick={handleOpen}
        disabled={isOpen}
        className={cn(
          "fixed right-4 z-40 h-14 w-14 rounded-full shadow-lg",
          "bg-gradient-to-br from-primary to-primary/80",
          "hover:shadow-xl hover:shadow-primary/30 hover:scale-105",
          "transition-all duration-300",
          "bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:bottom-6"
        )}
      >
        <div className="relative">
          <Mic className="h-6 w-6" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        </div>
      </Button>
    </>
  );
};
