import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, X, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

// Extend Window interface for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Animated waveform that reacts to speech detection
const AnimatedWaveform = ({ audioLevel, isActive }: { audioLevel: number; isActive: boolean }) => {
  const bars = 24;
  const [levels, setLevels] = useState<number[]>(Array(bars).fill(0.1));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLevels(prev => prev.map((_, i) => {
        if (!isActive) {
          // Calm state - minimal movement
          return 0.1 + Math.sin((Date.now() / 200) + i * 0.3) * 0.05;
        }
        // Active state - reacts to audio level
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
          style={{
            height: `${level * 100}%`,
            minHeight: '4px',
          }}
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
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);
  const isOpenRef = useRef(false);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const isListeningRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      isListeningRef.current = false;
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    isProcessingRef.current = false;
    finalTranscriptRef.current = '';
    setInterimTranscript('');
  }, []);

  // Process the transcribed text
  const processTranscript = useCallback(async (text: string) => {
    if (isProcessingRef.current || !isOpenRef.current || !text.trim()) return;
    
    isProcessingRef.current = true;
    setAudioLevel(0);
    setState('processing');
    setStatusText('POTUS está pensando...');
    setInterimTranscript('');
    
    // Stop recognition while processing
    if (recognitionRef.current) {
      isListeningRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    
    const userText = text.trim();
    console.log('User said:', userText);
    
    // Check for goodbye phrases
    const goodbyePhrases = ['adiós', 'adios', 'cerrar', 'hasta luego', 'chao', 'bye', 'terminar'];
    const shouldClose = goodbyePhrases.some(phrase => 
      userText.toLowerCase().includes(phrase)
    );
    
    try {
      // Save user message to potus_chat
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
      
      // Speak the response
      await speakResponse(assistantText, shouldClose);
      
    } catch (error) {
      console.error("Error processing:", error);
      toast.error("Error al procesar");
      isProcessingRef.current = false;
      if (isOpenRef.current) {
        startListening();
      }
    }
  }, [user]);

  // Start speech recognition
  const startListening = useCallback(() => {
    if (isProcessingRef.current || !isOpenRef.current) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      return;
    }
    
    // Create new recognition instance
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    finalTranscriptRef.current = '';
    
    recognition.onstart = () => {
      console.log('Speech recognition started');
      isListeningRef.current = true;
      setState('listening');
      setStatusText('Escuchando...');
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      
      // Animate waveform when speech is detected
      if (interimText || finalText) {
        setAudioLevel(0.6 + Math.random() * 0.4);
        
        // Reset silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        
        // Set new silence timeout
        silenceTimeoutRef.current = setTimeout(() => {
          // Silence detected, process what we have
          const textToProcess = finalTranscriptRef.current || interimText;
          if (textToProcess.trim() && isListeningRef.current) {
            processTranscript(textToProcess);
          }
        }, 1500);
      }
      
      if (finalText) {
        finalTranscriptRef.current += finalText;
      }
      
      setInterimTranscript(interimText || finalText);
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        toast.error("Permiso de micrófono denegado. Habilítalo en la configuración del navegador.");
        handleClose();
      } else if (event.error === 'no-speech') {
        // No speech detected, restart if still listening
        if (isOpenRef.current && !isProcessingRef.current) {
          console.log('No speech, restarting...');
          setAudioLevel(0);
        }
      } else if (event.error !== 'aborted') {
        console.error('Recognition error:', event.error);
      }
    };
    
    recognition.onend = () => {
      console.log('Speech recognition ended');
      setAudioLevel(0);
      
      // Auto-restart if still supposed to be listening
      if (isListeningRef.current && isOpenRef.current && !isProcessingRef.current) {
        console.log('Restarting recognition...');
        try {
          recognition.start();
        } catch (e) {
          console.error('Error restarting recognition:', e);
          // Try creating a new instance
          setTimeout(() => {
            if (isOpenRef.current && !isProcessingRef.current) {
              startListening();
            }
          }, 100);
        }
      }
    };
    
    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
      toast.error("Error al iniciar el reconocimiento de voz");
    }
  }, [processTranscript]);

  // Speak response using TTS
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
      
      // Animate waveform while speaking
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
        finalTranscriptRef.current = '';
        
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
        if (isOpenRef.current) {
          startListening();
        }
      };
      
      await audio.play();
      
    } catch (error) {
      console.error("TTS error:", error);
      isProcessingRef.current = false;
      if (isOpenRef.current) {
        startListening();
      }
    }
  }, []);

  // Handle open
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    isOpenRef.current = true;
    setState('idle');
    setStatusText('Iniciando...');
    
    // Request microphone permission and start listening
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        // Stop the stream immediately, we just needed permission
        stream.getTracks().forEach(track => track.stop());
        
        if (isOpenRef.current) {
          startListening();
        }
      })
      .catch((err) => {
        console.error('Microphone permission error:', err);
        toast.error("Permiso de micrófono denegado. Habilítalo en la configuración del navegador.");
        handleClose();
      });
  }, [startListening]);

  // Handle close
  const handleClose = useCallback(() => {
    isOpenRef.current = false;
    isListeningRef.current = false;
    setIsOpen(false);
    setState('idle');
    setStatusText('');
    setAudioLevel(0);
    setInterimTranscript('');
    cleanup();
  }, [cleanup]);

  // Get status icon
  const getStatusIcon = () => {
    switch (state) {
      case 'listening':
        return <Mic className="h-5 w-5 text-destructive" />;
      case 'processing':
        return (
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        );
      case 'speaking':
        return <Volume2 className="h-5 w-5 text-primary animate-pulse" />;
      default:
        return <Mic className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <>
      {/* Voice Conversation Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
          
          {/* Centered Pill */}
          <div className={cn(
            "relative flex flex-col items-center gap-4 px-8 py-6 rounded-3xl",
            "bg-card/95 border border-primary/30 shadow-2xl shadow-primary/20",
            "backdrop-blur-xl min-w-[280px] max-w-[400px]",
            "animate-in zoom-in-95 fade-in duration-200"
          )}>
            {/* Close button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* Waveform */}
            <AnimatedWaveform 
              audioLevel={audioLevel} 
              isActive={state === 'listening' || state === 'speaking'} 
            />
            
            {/* Status */}
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
            
            {/* Interim transcript display */}
            {state === 'listening' && interimTranscript && (
              <div className="text-center px-4">
                <p className="text-sm text-foreground/80 italic">
                  "{interimTranscript}"
                </p>
              </div>
            )}
            
            {/* Recording indicator */}
            {state === 'listening' && !interimTranscript && (
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
      
      {/* Floating Button */}
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
