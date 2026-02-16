import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Send, Loader2, User, Mic, Brain,
  Square, Volume2, VolumeX, Search
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useJarvisTTS } from "@/hooks/useJarvisTTS";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentType?: string;
  isVoice?: boolean;
  source?: "app" | "telegram" | "whatsapp";
}

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // POTUS Mode Always Active
  const agentType = "potus";
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { speak, stopSpeaking, isSpeaking, state: ttsState } = useJarvisTTS();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversation history (Unified Memory)
  useEffect(() => {
    if (!user?.id) return;

    const loadHistory = async () => {
      try {
        // Load directly from conversation_history (shared with Telegram)
        const { data } = await supabase
          .from("conversation_history")
          .select("id, role, content, created_at, metadata")
          .order("created_at", { ascending: false })
          .limit(50);

        if (data) {
          setMessages(data.reverse().map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at),
            agentType: "potus",
            source: (m.metadata as any)?.source === "telegram" ? "telegram" as const
              : (m.metadata as any)?.source === "whatsapp" ? "whatsapp" as const
              : "app" as const,
          })));
        }
      } catch (err) {
        console.error("[Chat] Load history error:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    setLoadingHistory(true);
    loadHistory();
  }, [user?.id]);

  // Auto-scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Realtime subscription (Listen for POTUS responses)
  useEffect(() => {
    if (!user?.id) return;

    const potusChannel = supabase
      .channel("potus-history-chat")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "conversation_history",
        // Listen for new assistant messages or my own messages (to confirm receipt)
        // filter: "agent_type=eq.potus", 
      }, (payload) => {
        const newMsg = payload.new as any;
        
        // Avoid duplicates if we already optimistically added it
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          
          // If it's a message from ME (assistant), add it
          if (newMsg.role === "assistant") {
             const msg: Message = {
              id: newMsg.id,
              role: "assistant",
              content: newMsg.content,
              timestamp: new Date(newMsg.created_at),
              agentType: "potus",
              source: (newMsg.metadata?.source === "telegram" ? "telegram" : "app") as "app" | "telegram" | "whatsapp",
            };
            if (voiceMode) speak(newMsg.content);
            return [...prev, msg];
          }
          // If it's a message from telegram (user role but source telegram), add it too
          if (newMsg.role === "user" && newMsg.metadata?.source === "telegram") {
             return [...prev, {
              id: newMsg.id,
              role: "user",
              content: newMsg.content,
              timestamp: new Date(newMsg.created_at),
              agentType: "potus",
              source: "telegram",
            }];
          }
          
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(potusChannel);
    };
  }, [user?.id, voiceMode]);

  // Search Memory (RAG) - Directly invoke search function
  const searchMemory = async (query: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("search-rag", {
        body: { query, limit: 5 },
      });
      if (error || !data) return null;
      
      let result = "";
      if (data.answer) {
        result = `🧠 **Búsqueda en memoria:**\n\n${data.answer}`;
      }
      if (data.matches?.length > 0) {
        const refs = data.matches.slice(0, 3).map((m: any) => 
          `• [${m.date}] ${m.brain ? `(${m.brain})` : ""} ${m.summary}`
        ).join("\n");
        result += `\n\n📎 **Fuentes:**\n${refs}`;
      }
      return result || null;
    } catch (e) {
      console.error("[Chat] RAG search error:", e);
      return null;
    }
  };

  const sendMessageWithContent = async (content: string, isVoice = false) => {
    if (!content.trim() || loading || !user?.id) return;

    // 1. Optimistic UI Update
    const tempId = crypto.randomUUID();
    const userMessage: Message = {
      id: tempId,
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
      agentType,
      isVoice,
      source: "app",
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // 2. Check for explicit memory search
      const isSearch = content.toLowerCase().startsWith("busca") || content.toLowerCase().includes("qué dije sobre");
      
      if (isSearch) {
         const ragContext = await searchMemory(content);
         if (ragContext) {
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: "assistant",
              content: ragContext,
              timestamp: new Date(),
              agentType: "jarvis",
            }]);
            setLoading(false);
            return; // Local RAG response, no need to send to POTUS core yet
         }
      }

      // 3. Send to POTUS (DB)
      // Save to DB so CloudBot can pick it up
      const { error } = await supabase.from("conversation_history").insert({
        user_id: user.id,
        role: "user",
        content: userMessage.content,
        agent_type: "potus",
        metadata: { source: "app" },
      });

      if (error) throw error;

      // 4. Notify Telegram Bridge (Fire & Forget)
      // This ensures you get a notification on Telegram if not looking at the app
      supabase.functions.invoke("jarvis-telegram-bridge", {
        body: { message: userMessage.content, userId: user.id, agentType: "potus" },
      }).catch(() => {});

      // Note: We don't set loading=false immediately if we expect a real response from CloudBot
      // But CloudBot might take seconds. For UI responsiveness, let's keep loading for a bit or just wait for realtime.
      // Ideally, CloudBot should ack. For now, let's clear loading after a timeout to avoid stuck UI.
      setTimeout(() => setLoading(false), 3000); 

    } catch (err) {
      console.error("[Chat] Send error:", err);
      toast.error("Error al enviar mensaje");
      setLoading(false);
    } finally {
      inputRef.current?.focus();
    }
  };

  const sendMessage = () => sendMessageWithContent(input, false);

  // Voice recording logic
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAndSend(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      toast.error("No se pudo acceder al micrófono");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const transcribeAndSend = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("language", "es");

      const response = await fetch(
        `https://xfjlwxssxfvhbiytcoar.supabase.co/functions/v1/speech-to-text`,
        {
          method: "POST",
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ"}`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Transcription failed");
      const data = await response.json();

      if (data.text?.trim()) {
        await sendMessageWithContent(data.text.trim(), true);
      } else {
        toast.error("No se detectó audio.");
      }
    } catch (err) {
      console.error("STT error:", err);
      toast.error("Error al transcribir");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const voiceStatus = isRecording ? "Escuchando..." : isTranscribing ? "Transcribiendo..." : isSpeaking ? "JARVIS hablando..." : null;

  return (
    <main className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden w-full pb-16 lg:pb-0">
      {/* Header Simplificado */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-3 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
            <Square className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">POTUS</span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Línea Directa
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={voiceMode ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              if (voiceMode && isSpeaking) stopSpeaking();
              setVoiceMode(!voiceMode);
            }}
            className={cn("h-8 w-8 p-0", voiceMode && "bg-primary text-primary-foreground")}
          >
            {voiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-background to-muted/10">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
            <span className="text-xs text-muted-foreground">Sincronizando memoria...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
            <Square className="h-12 w-12 mb-4 text-muted-foreground" />
            <p className="text-sm">Inicia sesión segura con POTUS.</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              )}>
                {msg.role === "user" ? <User className="h-4 w-4" /> : <Square className="h-4 w-4 text-red-500" />}
              </div>
              
              <div className={cn(
                "flex flex-col gap-1",
                msg.role === "user" ? "items-end" : "items-start"
              )}>
                <div className={cn(
                  "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border rounded-tl-sm"
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                
                <div className="flex items-center gap-1.5 px-1 opacity-70">
                  <span className="text-[9px] font-medium uppercase tracking-wider">
                    {msg.source || "app"}
                  </span>
                  <span className="text-[9px]">•</span>
                  <span className="text-[9px]">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border/50">
        {voiceStatus && (
          <div className="flex justify-center mb-2">
            <Badge variant="secondary" className="animate-pulse gap-1.5">
              <Mic className="h-3 w-3" />
              {voiceStatus}
            </Badge>
          </div>
        )}
        
        <form
          className="flex items-end gap-2 max-w-3xl mx-auto"
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
        >
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleMicClick}
            className={cn(
              "rounded-full h-10 w-10 shrink-0 transition-all",
              isRecording && "bg-red-500 text-white border-red-600 hover:bg-red-600 hover:text-white"
            )}
          >
            {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
          </Button>

          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe a POTUS..."
              className="rounded-full pl-4 pr-10 h-10 bg-muted/50 border-transparent focus:bg-background focus:border-primary/20"
              disabled={loading}
            />
            <Button 
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1 h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
              onClick={() => {
                 if(input.trim()) sendMessageWithContent("Busca en memoria: " + input);
              }}
              title="Buscar en memoria"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <Button 
            type="submit" 
            size="icon" 
            className="rounded-full h-10 w-10 shrink-0 shadow-md"
            disabled={!input.trim() || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </main>
  );
}
