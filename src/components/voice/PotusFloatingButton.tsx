import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Animated waveform that updates during recording
const AnimatedWaveform = ({ audioLevel }: { audioLevel: number }) => {
  const bars = 32;
  const [levels, setLevels] = useState<number[]>(Array(bars).fill(0.1));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLevels(prev => prev.map((_, i) => {
        const base = audioLevel * 0.6;
        const wave = Math.sin((Date.now() / 80) + i * 0.4) * 0.25;
        const random = Math.random() * 0.15;
        return Math.max(0.08, Math.min(1, base + wave + random));
      }));
    }, 40);
    
    return () => clearInterval(interval);
  }, [audioLevel]);
  
  return (
    <div className="flex items-center justify-center gap-[3px] h-12 px-6">
      {levels.map((level, i) => (
        <div
          key={i}
          className="w-[3px] bg-gradient-to-t from-primary via-primary/80 to-primary/50 rounded-full transition-all duration-[40ms]"
          style={{
            height: `${level * 100}%`,
            minHeight: '3px',
          }}
        />
      ))}
    </div>
  );
};

export const PotusFloatingButton = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Analyze audio levels and detect silence
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    setAudioLevel(normalizedLevel);
    
    // Detect silence (level below threshold for 1.5 seconds)
    const SILENCE_THRESHOLD = 0.05;
    const SILENCE_DURATION = 1500;
    
    if (normalizedLevel < SILENCE_THRESHOLD) {
      if (!silenceStartRef.current) {
        silenceStartRef.current = Date.now();
      } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
        // Auto-stop recording after silence
        stopRecording();
        return;
      }
    } else {
      silenceStartRef.current = null;
    }
    
    animationRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  // Start recording
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
      
      // Setup audio analyzer
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Start analyzing
      silenceStartRef.current = null;
      analyzeAudio();
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("No se pudo acceder al micrófono");
      handleClose();
    }
  }, [analyzeAudio]);

  // Stop recording and transcribe
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }
    
    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        
        // Stop audio analysis
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        
        // Stop media stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || 'audio/webm'
        });
        
        if (audioBlob.size < 1000) {
          setIsProcessing(false);
          handleClose();
          resolve();
          return;
        }
        
        try {
          // Transcribe audio
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
          
          if (!response.ok) throw new Error('Transcription failed');
          
          const data = await response.json();
          const text = data.text?.trim();
          
          if (text && user) {
            // Save to potus_chat
            await supabase
              .from("potus_chat")
              .insert({
                user_id: user.id,
                role: "user",
                message: text,
              });
            
            // Send to POTUS for processing (webhook will handle response)
            await supabase.functions.invoke("potus-chat", {
              body: { message: text },
            });
            
            toast.success("Mensaje enviado a POTUS");
          }
          
          handleClose();
        } catch (error) {
          console.error("Error processing audio:", error);
          toast.error("Error al procesar audio");
          handleClose();
        }
        
        resolve();
      };
      
      mediaRecorderRef.current!.stop();
    });
  }, [user]);

  // Handle open - start recording immediately
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    // Delay slightly to allow animation
    setTimeout(() => {
      startRecording();
    }, 100);
  }, [startRecording]);

  // Handle close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsRecording(false);
    setIsProcessing(false);
    setAudioLevel(0);
    cleanup();
  }, [cleanup]);

  // Cancel recording
  const handleCancel = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    handleClose();
  }, [handleClose]);

  return (
    <>
      {/* Voice Overlay Pill */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with blur */}
          <div 
            className="absolute inset-0 bg-background/60 backdrop-blur-md"
            onClick={handleCancel}
          />
          
          {/* Pill */}
          <div className={cn(
            "relative flex items-center gap-4 px-6 py-4 rounded-full",
            "bg-card/90 border border-primary/30 shadow-2xl shadow-primary/20",
            "backdrop-blur-xl",
            "animate-in zoom-in-95 fade-in duration-200"
          )}>
            {/* Close button */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 hover:bg-destructive/20 hover:text-destructive"
              onClick={handleCancel}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* Content */}
            <div className="flex flex-col items-center min-w-[200px]">
              {isRecording && (
                <>
                  <AnimatedWaveform audioLevel={audioLevel} />
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    <span className="text-sm text-muted-foreground">Escuchando...</span>
                  </div>
                </>
              )}
              
              {isProcessing && (
                <div className="flex items-center gap-3 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Procesando...</span>
                </div>
              )}
            </div>
            
            {/* Mic indicator */}
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              isRecording 
                ? "bg-destructive/20 text-destructive" 
                : "bg-primary/20 text-primary"
            )}>
              <Mic className={cn("h-5 w-5", isRecording && "animate-pulse")} />
            </div>
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
