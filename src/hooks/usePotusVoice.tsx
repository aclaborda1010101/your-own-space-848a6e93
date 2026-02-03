import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

// Check for SpeechRecognition support
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const usePotusVoice = () => {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [state, setState] = useState<ConversationState>('idle');
  const [transcript, setTranscript] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');

  const cleanup = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    isProcessingRef.current = false;
    finalTranscriptRef.current = '';
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const processTranscript = useCallback(async (text: string) => {
    if (!text.trim() || isProcessingRef.current || !isActive) return;
    
    isProcessingRef.current = true;
    setState('processing');
    setTranscript('');
    
    // Stop recognition during processing
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
    }
    
    try {
      // Check for goodbye phrases
      const goodbyePhrases = ['adiós', 'adios', 'cerrar', 'hasta luego', 'chao', 'bye', 'terminar'];
      const shouldClose = goodbyePhrases.some(phrase => 
        text.toLowerCase().includes(phrase)
      );
      
      // Save user message
      if (user) {
        await supabase.from("potus_chat").insert({
          user_id: user.id,
          role: "user",
          message: text,
        });
      }
      
      // Get response from POTUS
      const chatResponse = await supabase.functions.invoke("potus-chat", {
        body: { message: text },
      });
      
      if (chatResponse.error) throw chatResponse.error;
      
      const assistantText = chatResponse.data?.response || "Lo siento, no pude procesar tu mensaje.";
      
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
      toast.error("Error al procesar el mensaje");
      isProcessingRef.current = false;
      if (isActive) {
        startListening();
      }
    }
  }, [user, isActive]);

  const startListening = useCallback(() => {
    if (isProcessingRef.current || !isActive) return;
    
    if (!SpeechRecognition) {
      toast.error("Tu navegador no soporta reconocimiento de voz");
      return;
    }
    
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onstart = () => {
        setState('listening');
        setTranscript('');
        finalTranscriptRef.current = '';
      };
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript;
        }
        
        const displayText = finalTranscriptRef.current + interimTranscript;
        setTranscript(displayText);
        
        // Reset silence timer when speech is detected
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        
        // After 1.5s of silence, process the transcript
        silenceTimeoutRef.current = setTimeout(() => {
          const textToProcess = finalTranscriptRef.current.trim() || displayText.trim();
          if (textToProcess) {
            processTranscript(textToProcess);
          }
        }, 1500);
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          toast.error("Permiso de micrófono denegado. Habilítalo en la configuración del navegador.");
          stop();
        } else if (event.error !== 'aborted') {
          // Restart on other errors
          if (isActive && !isProcessingRef.current) {
            setTimeout(() => startListening(), 500);
          }
        }
      };
      
      recognition.onend = () => {
        // Restart if we're still active and not processing
        if (isActive && !isProcessingRef.current) {
          setTimeout(() => startListening(), 100);
        }
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      console.error("Error starting recognition:", error);
      toast.error("Error al iniciar el reconocimiento de voz");
    }
  }, [isActive, processTranscript]);

  const speakResponse = useCallback(async (text: string, shouldCloseAfter: boolean = false) => {
    if (!isActive) return;
    
    setState('speaking');
    
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
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        isProcessingRef.current = false;
        
        if (shouldCloseAfter) {
          stop();
        } else if (isActive) {
          startListening();
        }
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        isProcessingRef.current = false;
        if (isActive) {
          startListening();
        }
      };
      
      await audio.play();
      
    } catch (error) {
      console.error("TTS error:", error);
      isProcessingRef.current = false;
      if (isActive) {
        startListening();
      }
    }
  }, [isActive]);

  const start = useCallback(async () => {
    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      toast.error("No se pudo acceder al micrófono. Habilita los permisos.");
      return;
    }
    
    setIsActive(true);
    setState('idle');
    setTranscript('');
    
    // Small delay then start listening
    setTimeout(() => {
      startListening();
    }, 100);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    setState('idle');
    setTranscript('');
    cleanup();
  }, [cleanup]);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
    } else {
      start();
    }
  }, [isActive, start, stop]);

  // Update startListening when isActive changes
  useEffect(() => {
    if (isActive && state === 'idle' && !isProcessingRef.current) {
      startListening();
    }
  }, [isActive]);

  return {
    isActive,
    state,
    transcript,
    start,
    stop,
    toggle,
  };
};
