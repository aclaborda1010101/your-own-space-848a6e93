import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RoleplayActivityProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  situation?: {
    name: string;
    description: string;
    level: string;
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function RoleplayActivity({ open, onOpenChange, onComplete, situation }: RoleplayActivityProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const defaultSituation = situation || {
    name: "Reunión de colegio",
    description: "Hablar con el profesor de Bosco sobre su progreso",
    level: "Intermedio"
  };

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput("");
      setStarted(false);
    }
  }, [open]);

  const startRoleplay = async () => {
    setLoading(true);
    setStarted(true);

    try {
      const { data, error } = await supabase.functions.invoke("jarvis-core", {
        body: {
          type: "roleplay",
          situation: defaultSituation,
          language: "en"
        }
      });

      if (error) throw error;

      setMessages([{
        role: "assistant",
        content: data.response || `Let's practice! Imagine you're at ${defaultSituation.name}. I'll play the role of the other person. Start the conversation in English!`
      }]);
    } catch (err) {
      console.error("Error starting roleplay:", err);
      setMessages([{
        role: "assistant",
        content: `Let's practice! Imagine you're at ${defaultSituation.name}. I'll play the role of the other person. Start the conversation in English!`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("jarvis-core", {
        body: {
          type: "roleplay-response",
          messages: [...messages, { role: "user", content: userMessage }],
          situation: defaultSituation,
          language: "en"
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response || "Great response! Keep practicing your English."
      }]);
    } catch (err) {
      console.error("Error in roleplay:", err);
      toast.error("Error en la práctica");
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "That's good! Keep practicing. What else would you say in this situation?"
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Role-play: {defaultSituation.name}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{defaultSituation.level}</Badge>
            <span className="text-sm text-muted-foreground">{defaultSituation.description}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {!started ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center p-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-lg">Práctica de conversación</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Practica una conversación real en inglés sobre: {defaultSituation.description}
                </p>
              </div>
              <Button onClick={startRoleplay} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparando...
                  </>
                ) : (
                  "Empezar conversación"
                )}
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted p-3 rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Write in English..."
                    className="resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button onClick={sendMessage} disabled={!input.trim() || loading} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                
                {messages.length >= 4 && (
                  <Button variant="outline" onClick={handleComplete} className="w-full gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Completar práctica
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
