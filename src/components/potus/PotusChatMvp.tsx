import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RotateCcw, Send, Shield, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePotusMvpChat } from "@/hooks/usePotusMvpChat";

const STARTER_PROMPTS = [
  "Priorízame el día con lo importante primero.",
  "Hazme un resumen rápido de foco para hoy.",
  "Ayúdame a desbloquear una decisión.",
];

export function PotusChatMvp() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { messages, status, statusLabel, error, conversationKey, surfaces, sendMessage, reset } = usePotusMvpChat();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || status === "sending") return;
    setInput("");
    await sendMessage(content);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-4 px-4 py-4 md:py-6">
      <Card className="border-amber-500/20 bg-gradient-to-br from-background to-amber-500/5">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
                <Shield className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <CardTitle>POTUS · núcleo mínimo</CardTitle>
                <CardDescription>Texto puro, una sola llamada backend y estado visible.</CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">estado: {statusLabel}</Badge>
              <Badge variant="outline">backend: potus-core</Badge>
              <Badge variant="outline">superficies: {surfaces.join(" + ")}</Badge>
              {conversationKey && <Badge variant="outline">hilo: {conversationKey}</Badge>}
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={reset} disabled={messages.length === 0 && !error}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
        </CardHeader>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <ScrollArea className="flex-1 px-4 py-4 md:px-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-6 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-500/30 bg-amber-500/10">
                  <Shield className="h-8 w-8 text-amber-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Canal limpio de texto</h2>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Sin voz, sin realtime y sin selector de agentes. Este MVP deja un único flujo app → potus-core → respuesta.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <Button key={prompt} variant="outline" onClick={() => setInput(prompt)}>
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {message.role === "assistant" && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
                        <Shield className="h-4 w-4 text-amber-500" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6",
                        message.role === "user"
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border bg-muted/40 text-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {message.role === "user" && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                        <Smartphone className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}

                {status === "sending" && (
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
                      <Shield className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="rounded-3xl rounded-bl-md border border-border bg-muted/40 px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          {error && (
            <div className="border-t border-border bg-destructive/5 px-4 py-3 text-sm text-destructive md:px-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>Error backend: {error}</span>
              </div>
            </div>
          )}

          <div className="border-t border-border px-4 py-4 md:px-6">
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribe a POTUS…"
                disabled={status === "sending"}
                className="flex-1"
              />
              <Button type="submit" disabled={!input.trim() || status === "sending"}>
                {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
