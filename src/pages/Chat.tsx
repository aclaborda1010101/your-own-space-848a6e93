import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send, Loader2, User, Mic, Brain,
  Dumbbell, BookOpen, Apple, Baby, DollarSign, Square,
  Volume2, VolumeX, Search, MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
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

const AGENTS: { id: string; label: string; icon: any; color: string; description: string; visKey?: string }[] = [
  { id: "jarvis", label: "JARVIS", icon: Brain, color: "text-blue-400", description: "Asistente general" },
  { id: "potus", label: "POTUS", icon: Square, color: "text-red-400", description: "MoltBot - Ejecuta en tu Mac" },
  { id: "coach", label: "Coach POTUS", icon: Dumbbell, color: "text-amber-400", description: "Coaching ejecutivo", visKey: "academy" },
  { id: "english", label: "English", icon: BookOpen, color: "text-purple-400", description: "Profesor de inglés", visKey: "academy" },
  { id: "nutrition", label: "Nutrición", icon: Apple, color: "text-green-400", description: "Asesor nutricional", visKey: "nutrition" },
  { id: "bosco", label: "Bosco", icon: Baby, color: "text-pink-400", description: "Asistente para Bosco", visKey: "bosco" },
  { id: "finance", label: "Finanzas", icon: DollarSign, color: "text-emerald-400", description: "Asesor financiero", visKey: "finances" },
];

export default function Chat() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const vis = settings.section_visibility;
  const filteredAgents = AGENTS.filter(a => !a.visKey || vis[a.visKey as keyof typeof vis]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [agentType, setAgentType] = useState("jarvis");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [memoriesSaved, setMemoriesSaved] = useState(0);
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

  // Load conversation history
  useEffect(() => {
    if (!user?.id) return;

    const loadHistory = async () => {
      try {
        if (agentType === "potus") {
          // POTUS: load directly from conversation_history (shared with Telegram)
          const { data } = await supabase
            .from("conversation_history")
            .select("id, role, content, created_at, metadata")
            .eq("agent_type", "potus")
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
        } else {
          const { data, error } = await supabase
            .from("jarvis_conversations")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(30) as { data: any[]; error: any };

          if (error) {
            console.warn("[Chat] jarvis_conversations error, trying fallback:", error);
            const { data: oldData } = await supabase
              .from("conversation_history")
              .select("role, content, agent_type, created_at")
              .eq("user_id", user.id)
              .eq("agent_type", agentType)
              .order("created_at", { ascending: false })
              .limit(30);

            if (oldData) {
              setMessages(oldData.reverse().map((m, i) => ({
                id: `hist-${i}`,
                role: m.role as "user" | "assistant",
                content: m.content,
                timestamp: new Date(m.created_at),
                agentType: m.agent_type,
              })));
            }
          } else if (data) {
            setMessages(data.reverse().map((m, i) => ({
              id: `hist-${i}`,
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: new Date(m.created_at),
              agentType: m.agent_type,
            })));
          }
        }
      } catch (err) {
        console.error("[Chat] Load history error:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    setLoadingHistory(true);
    loadHistory();
  }, [user?.id, agentType]);

  // Auto-scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    // Broadcast channel for non-POTUS agents
    const broadcastChannel = supabase.channel("jarvis-state").on("broadcast", { event: "jarvis_response" }, (payload) => {
      if (payload.payload?.userId === user.id && payload.payload?.state === "response_ready") {
        console.log("[Chat] Realtime update received", payload.payload);
        if (payload.payload?.source === "telegram" && payload.payload?.response) {
          const potusMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: payload.payload.response,
            timestamp: new Date(),
            agentType: payload.payload.agentType || "potus",
            source: "telegram",
          };
          setMessages(prev => [...prev, potusMessage]);
          if (voiceMode) speak(payload.payload.response);
        }
      }
    }).subscribe();

    // Postgres changes channel for POTUS responses from MoltBot
    const potusChannel = supabase
      .channel("potus-history")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "conversation_history",
        filter: "agent_type=eq.potus",
      }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.role === "assistant") {
          // Avoid duplicates
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, {
              id: newMsg.id,
              role: "assistant" as const,
              content: newMsg.content,
              timestamp: new Date(newMsg.created_at),
              agentType: "potus",
              source: (newMsg.metadata?.source === "telegram" ? "telegram" : "app") as "app" | "telegram" | "whatsapp",
            }];
          });
          if (voiceMode) speak(newMsg.content);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(potusChannel);
    };
  }, [user?.id]);

  // Detect if a message is a memory/RAG query
  const isMemoryQuery = (text: string): boolean => {
    const patterns = [
      /qu[ée]\s+(dije|habl[ée]|coment[ée]|mencion[ée]|discut[ií]|acord[ée])/i,
      /qu[ée]\s+se\s+(dijo|habl[oó]|coment[oó]|decidi[oó]|acord[oó])/i,
      /recuerdas?\s+(algo|cu[aá]ndo|qu[eé]|si)/i,
      /busca\s+en\s+(mi\s+)?memoria/i,
      /en\s+mis\s+conversaciones/i,
      /alguna\s+vez\s+(dije|habl[ée]|mencion[ée])/i,
      /\bsobre\s+qu[eé]\s+habl/i,
    ];
    return patterns.some(p => p.test(text));
  };

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
          `• [${m.date}] ${m.brain ? `(${m.brain})` : ""} ${m.summary}${m.people?.length ? ` — con ${m.people.join(", ")}` : ""}`
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

    const userMessage: Message = {
      id: crypto.randomUUID(),
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
      // Check if this is a memory query - search RAG first
      let ragContext: string | null = null;
      if (isMemoryQuery(content)) {
        ragContext = await searchMemory(content);
        if (ragContext) {
          // Show RAG results as assistant message
          const ragMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: ragContext,
            timestamp: new Date(),
            agentType: "jarvis",
          };
          setMessages(prev => [...prev, ragMessage]);
          if (voiceMode && ragContext) speak(ragContext.replace(/[🧠📎*#]/g, ""));
          setLoading(false);
          return;
        }
      }

      let data: any;
      let error: any;

      if (agentType === "potus") {
        // POTUS: Save to DB + fire-and-forget to Telegram. NO potus-core call.
        // MoltBot on Mac Mini will respond via Telegram → conversation_history → Realtime
        await supabase.from("conversation_history").insert({
          user_id: user.id,
          role: "user",
          content: userMessage.content,
          agent_type: "potus",
          metadata: { source: "app" },
        });

        // Fire-and-forget: mirror to Telegram
        supabase.functions.invoke("jarvis-telegram-bridge", {
          body: { message: userMessage.content, userId: user.id, agentType: "potus" },
        }).catch(() => {});

        // No immediate response - it will come via Realtime
        setLoading(false);
        return;
      } else {
        const result = await supabase.functions.invoke("jarvis-realtime", {
          body: {
            transcript: userMessage.content,
            agentType,
            sessionId,
            userId: user.id,
          },
        });
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      const responseText = data?.message || data?.response || "Lo siento, no he podido procesar tu solicitud.";

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        agentType: data?.agentType || agentType,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data?.memoriesSaved > 0) {
        setMemoriesSaved(prev => prev + data.memoriesSaved);
      }

      if (voiceMode && responseText) {
        speak(responseText);
      }
    } catch (err) {
      console.error("[Chat] Send error:", err);
      toast.error("Error al enviar mensaje");
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Error de conexión. Por favor, intenta de nuevo.",
        timestamp: new Date(),
        agentType,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const sendMessage = () => sendMessageWithContent(input, false);

  // Voice recording
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
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ",
            "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmamx3eHNzeGZ2aGJpeXRjb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NDI4MDUsImV4cCI6MjA4NTIxODgwNX0.EgH-i0SBnlWH3lF4ZgZ3b8SRdBZc5fZruWmyaIu9GIQ`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Transcription failed");
      const data = await response.json();

      if (data.text?.trim()) {
        // Send directly instead of filling input
        await sendMessageWithContent(data.text.trim(), true);
      } else {
        toast.error("No se detectó audio. Intenta de nuevo.");
      }
    } catch (err) {
      console.error("STT error:", err);
      toast.error("Error al transcribir el audio");
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

  const currentAgent = AGENTS.find(a => a.id === agentType) || AGENTS[0];
  const AgentIcon = currentAgent.icon;

  // Voice status label
  const getVoiceStatusLabel = () => {
    if (isRecording) return "Escuchando...";
    if (isTranscribing) return "Transcribiendo...";
    if (ttsState === "loading") return "Preparando voz...";
    if (isSpeaking) return "JARVIS hablando...";
    return null;
  };

  const voiceStatus = getVoiceStatusLabel();

  return (
    <main className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden w-full pb-16 lg:pb-0">
      {/* Agent Selector Header */}
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <Select value={agentType} onValueChange={setAgentType}>
                <SelectTrigger className="w-[160px] shrink-0 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredAgents.map(agent => {
                    const Icon = agent.icon;
                    return (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4", agent.color)} />
                          <span>{agent.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {currentAgent.description}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Voice Mode Toggle */}
              <Button
                variant={voiceMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (voiceMode && isSpeaking) stopSpeaking();
                  setVoiceMode(!voiceMode);
                }}
                className={cn("gap-1.5 text-xs", voiceMode && "bg-primary text-primary-foreground")}
              >
                {voiceMode ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Voz</span>
              </Button>
              {memoriesSaved > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Brain className="h-3 w-3 mr-1" />
                  {memoriesSaved} memorias
                </Badge>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Cargando historial...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AgentIcon className={cn("h-12 w-12 mb-4", currentAgent.color)} />
                <h3 className="text-lg font-medium mb-1">
                  {currentAgent.label}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {agentType === "jarvis" && "Soy tu asistente personal. ¿En qué puedo ayudarte hoy, señor?"}
                  {agentType === "potus" && "Soy POTUS (MoltBot). Los mensajes se envían a Telegram y se ejecutan en tu Mac."}
                  {agentType === "coach" && "Soy tu coach ejecutivo. Trabajemos juntos en tu productividad y crecimiento."}
                  {agentType === "english" && "I'm your English teacher! Let's practice and improve your skills."}
                  {agentType === "nutrition" && "Soy tu asesor nutricional. Planifiquemos tu alimentación."}
                  {agentType === "bosco" && "¡Hola! Soy el asistente para actividades con Bosco. ¿Qué haremos hoy?"}
                  {agentType === "finance" && "Soy tu asesor financiero. Analicemos tus finanzas juntos."}
                </p>
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
                    "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
                    msg.role === "user"
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {msg.role === "user" ? (
                      msg.isVoice ? <Mic className="h-4 w-4" /> : <User className="h-4 w-4" />
                    ) : (
                      <AgentIcon className={cn("h-4 w-4", currentAgent.color)} />
                    )}
                  </div>
                  <Card className={cn(
                    "flex-1",
                    msg.role === "user"
                      ? "bg-primary/10 border-primary/20"
                      : "bg-muted/50 border-muted"
                  )}>
                    <CardContent className="p-3">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <p className="text-[10px] text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {msg.source && (
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                            msg.source === "app" && "bg-blue-500/15 text-blue-400",
                            msg.source === "telegram" && "bg-purple-500/15 text-purple-400",
                            msg.source === "whatsapp" && "bg-green-500/15 text-green-400",
                          )}>
                            {msg.source === "app" ? "app" : msg.source === "telegram" ? "telegram" : "whatsapp"}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))
            )}

            {loading && (
              <div className="flex gap-3 mr-auto max-w-[85%]">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <AgentIcon className={cn("h-4 w-4 animate-pulse", currentAgent.color)} />
                </div>
                <Card className="bg-muted/50 border-muted">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Pensando...</span>
                  </CardContent>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input with voice */}
          <div className="px-4 py-3 border-t border-border/50">
            {/* Voice status indicator */}
            {voiceStatus && (
              <div className="flex items-center justify-center gap-2 mb-2 text-xs text-muted-foreground">
                {isRecording && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                  </span>
                )}
                {(isTranscribing || ttsState === "loading") && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {isSpeaking && (
                  <Volume2 className="h-3 w-3 animate-pulse text-primary" />
                )}
                <span>{voiceStatus}</span>
                {isSpeaking && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-[10px]"
                    onClick={stopSpeaking}
                  >
                    Detener
                  </Button>
                )}
              </div>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            >
              <Button
                type="button"
                size="icon"
                variant={isRecording ? "destructive" : "outline"}
                onClick={handleMicClick}
                disabled={loading || isTranscribing}
                className="shrink-0"
              >
                {isRecording ? (
                  <Square className="h-4 w-4" />
                ) : isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isRecording ? "Escuchando..." : `Hablar con ${currentAgent.label}... (ej: "¿Qué dije sobre...?")`}
                disabled={loading || isRecording}
                className="flex-1"
                autoFocus
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={loading || !input.trim() || input.trim().length < 3}
                title="Buscar en memoria"
                onClick={async () => {
                  if (!input.trim() || !user?.id) return;
                  const q = input.trim();
                  setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: `🔍 ${q}`, timestamp: new Date(), agentType: "jarvis" }]);
                  setInput("");
                  setLoading(true);
                  const result = await searchMemory(q);
                  setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: result || "No encontré resultados en tu memoria.", timestamp: new Date(), agentType: "jarvis" }]);
                  setLoading(false);
                }}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
    </main>
  );
}
