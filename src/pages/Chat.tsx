import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Send, Loader2, Bot, User, Trash2,
  Brain, Heart, Utensils, Baby, Wallet, Languages, Sparkles, RefreshCw
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AGENTS = [
  { id: "jarvis-core", label: "Jarvis Core", icon: Brain, color: "text-primary", menuKey: null },
  { id: "jarvis-coach", label: "Coach Personal", icon: Heart, color: "text-rose-500", menuKey: "coach" },
  { id: "jarvis-english-pro", label: "English Pro", icon: Languages, color: "text-blue-500", menuKey: "english" },
  { id: "jarvis-nutrition", label: "Nutrición", icon: Utensils, color: "text-success", menuKey: "nutrition" },
  { id: "jarvis-bosco", label: "Bosco", icon: Baby, color: "text-purple-500", menuKey: "bosco" },
  { id: "jarvis-ia-formacion", label: "IA Formación", icon: Sparkles, color: "text-warning", menuKey: "ai_course" },
];

export default function Chat() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentType, setAgentType] = useState("jarvis-core");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter agents based on menu visibility settings
  const visibleAgents = AGENTS.filter(agent => {
    if (!agent.menuKey) return true;
    const hiddenItems = (settings as any)?.hidden_menu_items;
    if (!hiddenItems || typeof hiddenItems !== 'object') return true;
    return !(hiddenItems as Record<string, boolean>)[agent.menuKey];
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [agentType]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !user) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(agentType, {
        body: { message: userMsg, userId: user.id },
      });

      if (error) throw error;

      const response = data?.response || data?.text || data?.reply || "Sin respuesta";
      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      console.error("Chat error:", err);
      toast.error("Error al enviar mensaje");
      setMessages(prev => [...prev, { role: "assistant", content: "Error al procesar tu mensaje. Intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success("Chat limpiado");
  };

  const currentAgent = AGENTS.find(a => a.id === agentType) || AGENTS[0];
  const AgentIcon = currentAgent.icon;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
      {/* Agent Selector Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={agentType} onValueChange={setAgentType}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleAgents.map(agent => {
                const Icon = agent.icon;
                return (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", agent.color)} />
                      {agent.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} className="h-8 gap-1 text-xs">
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center bg-muted/30 border border-border")}>
              <AgentIcon className={cn("w-8 h-8", currentAgent.color)} />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{currentAgent.label}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Escribe un mensaje para empezar
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/30 border border-border")}>
                    <AgentIcon className={cn("w-4 h-4", currentAgent.color)} />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted/50 text-foreground border border-border rounded-bl-md"
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/20 border border-primary/30">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
              </div>
            ))
            }
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted/30 border border-border">
                  <AgentIcon className={cn("w-4 h-4", currentAgent.color)} />
                </div>
                <div className="bg-muted/50 border border-border rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <form onSubmit={handleSend} className="flex gap-2 max-w-3xl mx-auto">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Escribe a ${currentAgent.label}...`}
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
