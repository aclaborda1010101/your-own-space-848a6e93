import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MessageSquare, X, Send, Loader2, ChevronDown } from "lucide-react";
import { useJarvisCoach, type CoachMessage, type EmotionalState } from "@/hooks/useJarvisCoach";
import { cn } from "@/lib/utils";
import AISpectrum from "@/components/ui/AISpectrum";

interface JarvisFloatingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "chat" | "voice";
  onModeChange: (mode: "chat" | "voice") => void;
  onStartVoice: () => void;
  isVoiceConnected: boolean;
  isVoiceConnecting: boolean;
  voiceTranscript: string;
  voiceResponse: string;
}

const DEFAULT_EMOTIONAL_STATE: EmotionalState = {
  energy: 5,
  mood: 5,
  stress: 5,
  anxiety: 3,
  motivation: 5,
};

// Voice mode component that auto-starts conversation
const VoiceModeContent = ({
  isVoiceConnected,
  isVoiceConnecting,
  voiceTranscript,
  voiceResponse,
  onStartVoice,
}: {
  isVoiceConnected: boolean;
  isVoiceConnecting: boolean;
  voiceTranscript: string;
  voiceResponse: string;
  onStartVoice: () => void;
}) => {
  const hasAutoStarted = useRef(false);

  // Auto-start voice when component mounts (user switches to voice mode)
  useEffect(() => {
    if (!isVoiceConnected && !isVoiceConnecting && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      onStartVoice();
    }
  }, [isVoiceConnected, isVoiceConnecting, onStartVoice]);

  // Reset auto-start flag when disconnected
  useEffect(() => {
    if (!isVoiceConnected && !isVoiceConnecting) {
      hasAutoStarted.current = false;
    }
  }, [isVoiceConnected, isVoiceConnecting]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 gap-4">
      {isVoiceConnected ? (
        <div className="text-center space-y-2">
          {voiceTranscript && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Tú:</span> {voiceTranscript}
            </p>
          )}
          {voiceResponse && (
            <p className="text-sm text-foreground">
              <span className="font-medium text-primary">JARVIS:</span> {voiceResponse}
            </p>
          )}
          {!voiceTranscript && !voiceResponse && (
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Mic className="h-4 w-4 animate-pulse text-primary" />
                Escuchando...
              </p>
              <p className="text-xs text-muted-foreground/70">
                Habla normalmente, JARVIS responderá automáticamente
              </p>
            </div>
          )}
        </div>
      ) : isVoiceConnecting ? (
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Conectando...</p>
        </div>
      ) : (
        <>
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Conversación continua con JARVIS
            </p>
            <p className="text-xs text-muted-foreground/70">
              Pulsa para conectar. Habla naturalmente sin pulsar de nuevo.
            </p>
          </div>
          <Button
            onClick={onStartVoice}
            disabled={isVoiceConnecting}
            className="gap-2"
          >
            <Mic className="h-4 w-4" />
            Iniciar conversación
          </Button>
        </>
      )}
    </div>
  );
};

export const JarvisFloatingPanel = ({
  isOpen,
  onClose,
  mode,
  onModeChange,
  onStartVoice,
  isVoiceConnected,
  isVoiceConnecting,
  voiceTranscript,
  voiceResponse,
}: JarvisFloatingPanelProps) => {
  const { session, loading, startSession, sendMessage, endSession } = useJarvisCoach();
  const [inputMessage, setInputMessage] = useState("");
  const [initialized, setInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages, voiceTranscript, voiceResponse]);

  // Initialize chat session when panel opens and chat mode is selected
  useEffect(() => {
    if (isOpen && mode === "chat" && !session && !initialized) {
      startSession("daily", DEFAULT_EMOTIONAL_STATE);
      setInitialized(true);
    }
  }, [isOpen, mode, session, initialized, startSession]);

  // Reset when panel closes
  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
    }
  }, [isOpen]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || loading) return;
    
    const message = inputMessage;
    setInputMessage("");
    
    await sendMessage(message);
  }, [inputMessage, loading, sendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleClose = useCallback(async () => {
    if (session && session.messages.length > 0) {
      await endSession();
    }
    onClose();
  }, [session, endSession, onClose]);

  if (!isOpen) return null;

  return (
    <div className="w-80 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6">
            <AISpectrum size={24} />
          </div>
          <span className="font-medium text-sm text-foreground">JARVIS</span>
        </div>
        
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          <Button
            size="sm"
            variant={mode === "chat" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => onModeChange("chat")}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Chat
          </Button>
          <Button
            size="sm"
            variant={mode === "voice" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => onModeChange("voice")}
          >
            <Mic className="h-3.5 w-3.5 mr-1" />
            Voz
          </Button>
        </div>
        
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={handleClose}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Content */}
      <div className="h-72">
        {mode === "chat" ? (
          <>
            {/* Chat messages */}
            <ScrollArea ref={scrollRef} className="h-56 px-3 py-2">
              {session?.messages.length === 0 && !loading && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Escribe un mensaje para empezar
                </div>
              )}
              
              {session?.messages.map((msg: CoachMessage, i: number) => (
                <div
                  key={i}
                  className={cn(
                    "mb-2 p-2 rounded-lg text-sm",
                    msg.role === "user"
                      ? "bg-primary/10 text-foreground ml-6"
                      : "bg-muted/50 text-foreground mr-6"
                  )}
                >
                  {msg.role === "assistant" && (
                    <span className="text-xs font-medium text-primary block mb-1">JARVIS</span>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
              
              {loading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pensando...
                </div>
              )}
            </ScrollArea>
            
            {/* Chat input */}
            <div className="p-3 border-t border-border/50">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 h-9 text-sm bg-muted/30"
                  disabled={loading}
                />
                <Button
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || loading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Voice mode - auto-start conversation when switching to voice */
          <VoiceModeContent
            isVoiceConnected={isVoiceConnected}
            isVoiceConnecting={isVoiceConnecting}
            voiceTranscript={voiceTranscript}
            voiceResponse={voiceResponse}
            onStartVoice={onStartVoice}
          />
        )}
      </div>
    </div>
  );
};
