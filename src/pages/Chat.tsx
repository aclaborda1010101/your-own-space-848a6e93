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
  Send, Loader2, Bot, User, Mic, MicOff, Brain,
  Dumbbell, BookOpen, Apple, Baby, DollarSign, Sparkles, Cpu
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentType?: string;
}

const AGENTS = [
  { id: "jarvis", label: "JARVIS", icon: Brain, color: "text-blue-400", description: "Asistente general" },
  { id: "potus", label: "POTUS", icon: Cpu, color: "text-red-400", description: "MoltBot - Ejecuta en tu Mac" },
  { id: "coach", label: "Coach POTUS", icon: Dumbbell, color: "text-amber-400", description: "Coaching ejecutivo" },
  { id: "english", label: "English", icon: BookOpen, color: "text-purple-400", description: "Profesor de inglés" },
  { id: "nutrition", label: "Nutrición", icon: Apple, color: "text-green-400", description: "Asesor nutricional" },
  { id: "bosco", label: "Bosco", icon: Baby, color: "text-pink-400", description: "Asistente para Bosco" },
  { id: "finance", label: "Finanzas", icon: DollarSign, color: "text-emerald-400", description: "Asesor financiero" },
];

export default function Chat() {
  const { user } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useSidebarState();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [agentType, setAgentType] = useState("jarvis");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [memoriesSaved, setMemoriesSaved] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load conversation history
  useEffect(() => {
    if (!user?.id) return;

    const loadHistory = async () => {
      try {
        // Try new table first
        const { data, error } = await supabase
          .from("jarvis_conversations")
          .select("role, content, agent_type, created_at")
          .eq("user_id", user.id)
          .eq("agent_type", agentType)
          .order("created_at", { ascending: false })
          .limit(30);

        if (error) {
          console.warn("[Chat] jarvis_conversations error, trying fallback:", error);
          // Fallback to old table
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

  // Realtime subscription for POTUS responses
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('potus-responses')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[Chat] New message via Realtime:", payload.new);
          
          const newMessage: Message = {
            id: payload.new.id,
            role: payload.new.role as "user" | "assistant",
            content: payload.new.content,
            timestamp: new Date(payload.new.created_at),
            agentType: payload.new.agent_type,
          };
          
          // Only add if not already in messages (avoid duplicates)
          setMessages((prev) => {
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) return prev;
            
            // Show toast for assistant messages from POTUS
            if (newMessage.role === "assistant" && newMessage.agentType === "potus") {
              toast.success("POTUS ha respondido");
              setLoading(false);
            }
            
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !user?.id) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      agentType,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // POTUS usa Telegram bridge (respuesta via Realtime)
      if (agentType === "potus") {
        const { data, error } = await supabase.functions.invoke("jarvis-telegram-bridge", {
          body: {
            message: userMessage.content,
            sessionId,
          },
        });

        if (error) throw error;

        toast.success("Mensaje enviado a POTUS", {
          description: "La respuesta llegará en breve...",
        });
        
        setLoading(false);
        return;
      }

      // Otros agentes usan jarvis-realtime (respuesta inmediata)
      const { data, error } = await supabase.functions.invoke("jarvis-realtime", {
        body: {
          transcript: userMessage.content,
          agentType,
          sessionId,
          userId: user.id,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.response || "Lo siento, no he podido procesar tu solicitud.",
        timestamp: new Date(),
        agentType: data?.agentType || agentType,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data?.memoriesSaved > 0) {
        setMemoriesSaved(prev => prev + data.memoriesSaved);
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

  const currentAgent = AGENTS.find(a => a.id === agentType) || AGENTS[0];
  const AgentIcon = currentAgent.icon;

  return (
    <div className="flex h-screen bg-background">
      <SidebarNew sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
          {/* Agent Selector Header */}
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Select value={agentType} onValueChange={setAgentType}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENTS.map(agent => {
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
            {memoriesSaved > 0 && (
              <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/30">
                <Brain className="h-3 w-3 mr-1" />
                {memoriesSaved} memorias
              </Badge>
            )}
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
                      <User className="h-4 w-4" />
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
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {msg.timestamp.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                      </p>
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

          {/* Input */}
          <div className="px-4 py-3 border-t border-border/50">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Hablar con ${currentAgent.label}...`}
                disabled={loading}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
