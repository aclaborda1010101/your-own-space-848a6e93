import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  Bot,
  User,
  Mic,
  MicOff,
  Sparkles
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const Chat = () => {
  const { user } = useAuth();
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history
  useEffect(() => {
    loadChatHistory();
  }, [user]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('potus-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'potus_chat',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newMessage: Message = {
            id: payload.new.id,
            role: payload.new.role as "user" | "assistant",
            content: payload.new.message,
            timestamp: new Date(payload.new.created_at),
          };
          
          // Only add if not already in messages (avoid duplicates)
          setMessages((prev) => {
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadChatHistory = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("potus_chat")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;

      if (data) {
        setMessages(data.map(msg => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.message,
          timestamp: new Date(msg.created_at),
        })));
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !user) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Save user message
      await supabase.from("potus_chat").insert({
        user_id: user.id,
        role: "user",
        message: userMessage.content,
      });

      // Call POTUS edge function
      const { data, error } = await supabase.functions.invoke("potus-chat", {
        body: {
          message: userMessage.content,
          context: {
            recentMessages: messages.slice(-10).map(m => ({
              role: m.role,
              content: m.content,
            })),
          },
        },
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response || "No pude procesar tu mensaje. Inténtalo de nuevo.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save assistant response
      await supabase.from("potus_chat").insert({
        user_id: user.id,
        role: "assistant",
        message: assistantMessage.content,
      });

    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Error al enviar el mensaje");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleVoice = () => {
    setIsListening(!isListening);
    // TODO: Implement voice input
    toast.info(isListening ? "Micrófono desactivado" : "Micrófono activado");
  };

  return (
    <div className="min-h-screen bg-background">
      <SidebarNew 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      <div className={cn("transition-all duration-300 flex flex-col h-screen", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <TopBar onMenuClick={openSidebar} />
        
        <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">JARVIS Chat</h1>
              <p className="text-sm text-muted-foreground font-mono">TU ASISTENTE PERSONAL</p>
            </div>
          </div>

          {/* Messages */}
          <Card className="flex-1 flex flex-col overflow-hidden border-border bg-card">
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">¡Hola! Soy JARVIS</h3>
                      <p className="text-muted-foreground text-sm max-w-md">
                        Tu asistente personal. Pregúntame lo que necesites: tareas, planificación, recordatorios...
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <span className={cn(
                        "text-xs mt-1 block",
                        message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {message.timestamp.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {message.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))
              )}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>
          </Card>

          {/* Input */}
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleVoice}
              className={cn(
                "shrink-0",
                isListening && "bg-destructive/10 text-destructive border-destructive/30"
              )}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Escribe un mensaje..."
              disabled={loading}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!input.trim() || loading}
              className="shrink-0 gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Chat;
