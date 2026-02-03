import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  message: string;
  created_at: string;
}

// Waveform component for voice visualization
const VoiceWaveform = ({ isRecording }: { isRecording: boolean }) => {
  const bars = 20;
  
  return (
    <div className="flex items-center justify-center gap-0.5 h-12">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1 bg-primary rounded-full transition-all duration-75",
            isRecording ? "animate-pulse" : "h-2"
          )}
          style={{
            height: isRecording 
              ? `${Math.random() * 100}%` 
              : '8px',
            animationDelay: `${i * 50}ms`,
            minHeight: '8px',
            maxHeight: '100%',
          }}
        />
      ))}
    </div>
  );
};

// Animated waveform that updates during recording
const AnimatedWaveform = ({ isRecording, audioLevel }: { isRecording: boolean; audioLevel: number }) => {
  const bars = 24;
  const [levels, setLevels] = useState<number[]>(Array(bars).fill(0.1));
  
  useEffect(() => {
    if (!isRecording) {
      setLevels(Array(bars).fill(0.1));
      return;
    }
    
    const interval = setInterval(() => {
      setLevels(prev => prev.map((_, i) => {
        const base = audioLevel * 0.5;
        const wave = Math.sin((Date.now() / 100) + i * 0.5) * 0.3;
        const random = Math.random() * 0.2;
        return Math.max(0.1, Math.min(1, base + wave + random));
      }));
    }, 50);
    
    return () => clearInterval(interval);
  }, [isRecording, audioLevel]);
  
  return (
    <div className="flex items-center justify-center gap-[2px] h-16 px-4">
      {levels.map((level, i) => (
        <div
          key={i}
          className="w-1 bg-gradient-to-t from-primary to-primary/60 rounded-full transition-all duration-75"
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
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages from potus_chat
  const loadMessages = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("potus_chat")
        .select("id, role, message, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);
      
      if (error) throw error;
      setMessages((data || []).map(d => ({
        ...d,
        role: d.role as "user" | "assistant",
      })));
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      loadMessages();
    }
  }, [isOpen, user, loadMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Analyze audio levels
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255);
    
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
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Start analyzing
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
    }
  }, [analyzeAudio]);

  // Stop recording and transcribe
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    
    return new Promise<string | null>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        
        // Stop audio analysis
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
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
          resolve(null);
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
          
          if (text) {
            await sendMessage(text);
          }
          
          setIsProcessing(false);
          resolve(text);
        } catch (error) {
          console.error("Transcription error:", error);
          toast.error("Error al transcribir audio");
          setIsProcessing(false);
          resolve(null);
        }
      };
      
      mediaRecorderRef.current!.stop();
    });
  }, []);

  // Send message to POTUS
  const sendMessage = useCallback(async (text: string) => {
    if (!user || !text.trim()) return;
    
    setIsLoading(true);
    
    try {
      // Save user message
      const { data: userMsg, error: userError } = await supabase
        .from("potus_chat")
        .insert({
          user_id: user.id,
          role: "user",
          message: text,
        })
        .select()
        .single();
      
      if (userError) throw userError;
      
      setMessages(prev => [...prev, { ...userMsg, role: userMsg.role as "user" | "assistant" }]);
      
      // Get POTUS response
      const { data, error } = await supabase.functions.invoke("potus-chat", {
        body: {
          message: text,
          context: {
            recentMessages: messages.slice(-10).map(m => ({
              role: m.role,
              content: m.message,
            })),
          },
        },
      });
      
      if (error) throw error;
      
      const responseText = data?.response || "Disculpe, señor, no pude procesar su solicitud.";
      
      // Save assistant message
      const { data: assistantMsg, error: assistantError } = await supabase
        .from("potus_chat")
        .insert({
          user_id: user.id,
          role: "assistant",
          message: responseText,
        })
        .select()
        .single();
      
      if (assistantError) throw assistantError;
      
      setMessages(prev => [...prev, { ...assistantMsg, role: assistantMsg.role as "user" | "assistant" }]);
      
      // Optionally speak the response
      try {
        const ttsResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text: responseText }),
          }
        );
        
        if (ttsResponse.ok) {
          const audioBlob = await ttsResponse.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play();
        }
      } catch {
        // TTS is optional, don't show error
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Error al enviar mensaje");
    } finally {
      setIsLoading(false);
    }
  }, [user, messages]);

  // Handle text input submit
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;
    
    const text = inputText;
    setInputText("");
    await sendMessage(text);
  }, [inputText, isLoading, sendMessage]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <>
      {/* Overlay Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                <span className="font-semibold text-foreground">POTUS</span>
                <span className="text-xs text-muted-foreground">Asistente Presidencial</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Messages */}
            <ScrollArea ref={scrollRef} className="h-64 p-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Mic className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Pulse el micrófono para hablar</p>
                  <p className="text-xs mt-1">o escriba un mensaje</p>
                </div>
              )}
              
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "mb-3 p-3 rounded-lg text-sm",
                    msg.role === "user"
                      ? "bg-primary/10 text-foreground ml-8"
                      : "bg-muted/50 text-foreground mr-8"
                  )}
                >
                  {msg.role === "assistant" && (
                    <span className="text-xs font-medium text-primary block mb-1">POTUS</span>
                  )}
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">POTUS está pensando...</span>
                </div>
              )}
            </ScrollArea>
            
            {/* Voice Waveform */}
            {(isRecording || isProcessing) && (
              <div className="px-4 py-2 border-t border-border bg-muted/20">
                <AnimatedWaveform isRecording={isRecording} audioLevel={audioLevel} />
                <p className="text-center text-xs text-muted-foreground mt-1">
                  {isRecording ? "Escuchando..." : "Procesando..."}
                </p>
              </div>
            )}
            
            {/* Input Area */}
            <div className="p-4 border-t border-border">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant={isRecording ? "destructive" : "outline"}
                  className="shrink-0"
                  onClick={toggleRecording}
                  disabled={isProcessing || isLoading}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className={cn("h-4 w-4", isRecording && "animate-pulse")} />
                  )}
                </Button>
                
                <Input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                  disabled={isRecording || isProcessing || isLoading}
                />
                
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputText.trim() || isRecording || isProcessing || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
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
