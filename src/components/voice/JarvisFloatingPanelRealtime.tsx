import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MessageSquare, X, Send, Loader2, ChevronDown, Volume2, VolumeX, Square, StopCircle } from "lucide-react";
import { useJarvisRealtimeVoice, JarvisRealtimeState, AgentType } from "@/hooks/useJarvisRealtimeVoice";
import { cn } from "@/lib/utils";
import AISpectrum from "@/components/ui/AISpectrum";
import JarvisOrb from "./JarvisOrb";

interface JarvisFloatingPanelRealtimeProps {
  isOpen: boolean;
  onClose: () => void;
  agentType?: AgentType;
}

// Map JarvisRealtimeState to JarvisOrb state
const mapStateToOrb = (state: JarvisRealtimeState): 'idle' | 'listening' | 'thinking' | 'speaking' => {
  switch (state) {
    case 'listening':
      return 'listening';
    case 'processing_stt':
    case 'thinking':
      return 'thinking';
    case 'speaking':
      return 'speaking';
    default:
      return 'idle';
  }
};

// State display text
const getStateText = (state: JarvisRealtimeState): string => {
  switch (state) {
    case 'listening':
      return 'Escuchando...';
    case 'processing_stt':
      return 'Transcribiendo...';
    case 'thinking':
      return 'Pensando...';
    case 'speaking':
      return 'Hablando...';
    case 'error':
      return 'Error';
    default:
      return 'Pulsa para hablar';
  }
};

export const JarvisFloatingPanelRealtime = ({
  isOpen,
  onClose,
  agentType = 'coach',
}: JarvisFloatingPanelRealtimeProps) => {
  const [mode, setMode] = useState<'chat' | 'voice'>('voice');
  const [inputMessage, setInputMessage] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use the realtime voice hook
  const {
    state,
    isRecording,
    isSpeaking,
    isProcessing,
    transcript,
    response,
    messages,
    error,
    startListening,
    stopListening,
    toggleListening,
    sendTextMessage,
    stop,
    resetSession,
    speak,
    stopSpeaking,
  } = useJarvisRealtimeVoice({
    agentType,
    autoSpeak: ttsEnabled,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, transcript, response]);

  // Handle text message send
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isProcessing) return;
    
    const message = inputMessage;
    setInputMessage("");
    
    await sendTextMessage(message);
  }, [inputMessage, isProcessing, sendTextMessage]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Handle close
  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  // Handle voice button click
  const handleVoiceClick = useCallback(() => {
    if (isRecording) {
      stopListening();
    } else if (isSpeaking) {
      stopSpeaking();
    } else {
      startListening();
    }
  }, [isRecording, isSpeaking, startListening, stopListening, stopSpeaking]);

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
          <span className="text-xs text-muted-foreground capitalize">({agentType})</span>
        </div>
        
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          <Button
            size="sm"
            variant={mode === "chat" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setMode("chat")}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Chat
          </Button>
          <Button
            size="sm"
            variant={mode === "voice" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setMode("voice")}
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
        {mode === "voice" ? (
          /* Voice Mode */
          <div className="h-full flex flex-col items-center justify-center p-4 gap-4">
            {/* Orb with state */}
            <div className="relative">
              <JarvisOrb 
                size={80} 
                state={mapStateToOrb(state)} 
              />
              {error && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                  <span className="text-xs text-destructive">Error</span>
                </div>
              )}
            </div>
            
            {/* State text */}
            <p className="text-sm text-muted-foreground">
              {getStateText(state)}
            </p>
            
            {/* Transcript display */}
            {transcript && (
              <div className="text-center max-w-full px-2">
                <p className="text-xs text-muted-foreground mb-1">Tú:</p>
                <p className="text-sm text-foreground line-clamp-2">{transcript}</p>
              </div>
            )}
            
            {/* Response display */}
            {response && (
              <div className="text-center max-w-full px-2">
                <p className="text-xs text-primary mb-1">JARVIS:</p>
                <p className="text-sm text-foreground line-clamp-3">{response}</p>
              </div>
            )}
            
            {/* Voice control button */}
            <Button
              size="lg"
              variant={isRecording ? "destructive" : isSpeaking ? "outline" : "default"}
              className={cn(
                "h-14 w-14 rounded-full p-0",
                isRecording && "animate-pulse"
              )}
              onClick={handleVoiceClick}
              disabled={isProcessing && !isRecording && !isSpeaking}
            >
              {isRecording ? (
                <Square className="h-6 w-6" />
              ) : isSpeaking ? (
                <StopCircle className="h-6 w-6" />
              ) : isProcessing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>
            
            {/* Help text */}
            <p className="text-xs text-muted-foreground/70 text-center">
              {isRecording 
                ? "Pulsa para detener y enviar" 
                : isSpeaking 
                  ? "Pulsa para silenciar"
                  : "Pulsa y habla con JARVIS"
              }
            </p>
          </div>
        ) : (
          /* Chat Mode */
          <>
            {/* Messages */}
            <ScrollArea ref={scrollRef} className="h-56 px-3 py-2">
              {messages.length === 0 && !isProcessing && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Escribe un mensaje para empezar
                </div>
              )}
              
              {messages.map((msg) => (
                <div
                  key={msg.id}
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
              
              {isProcessing && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {state === 'thinking' ? 'Pensando...' : 'Procesando...'}
                </div>
              )}
            </ScrollArea>
            
            {/* Input */}
            <div className="p-3 border-t border-border/50">
              <div className="flex gap-2">
                {/* Voice input button */}
                <Button
                  size="sm"
                  variant={isRecording ? "destructive" : "outline"}
                  className="h-9 w-9 p-0 shrink-0"
                  onClick={handleVoiceClick}
                  disabled={isProcessing && !isRecording && !isSpeaking}
                >
                  {isRecording ? (
                    <Square className="h-4 w-4" />
                  ) : isSpeaking ? (
                    <StopCircle className="h-4 w-4" />
                  ) : (
                    <Mic className={cn("h-4 w-4", isProcessing && "animate-pulse")} />
                  )}
                </Button>
                
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isRecording ? "Escuchando..." : "Escribe un mensaje..."}
                  className="flex-1 h-9 text-sm bg-muted/30"
                  disabled={isProcessing || isRecording}
                />
                
                {/* TTS toggle */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 shrink-0"
                  onClick={() => {
                    if (isSpeaking) {
                      stopSpeaking();
                    } else {
                      setTtsEnabled(!ttsEnabled);
                    }
                  }}
                  title={isSpeaking ? "Detener" : ttsEnabled ? "Silenciar respuestas" : "Activar voz"}
                >
                  {isSpeaking ? (
                    <Volume2 className="h-4 w-4 text-primary animate-pulse" />
                  ) : ttsEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                
                <Button
                  size="sm"
                  className="h-9 w-9 p-0 shrink-0"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isProcessing}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Voice state indicator */}
              {(isRecording || state === 'thinking' || isSpeaking) && (
                <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
                  <JarvisOrb 
                    size={20} 
                    state={mapStateToOrb(state)} 
                  />
                  <span>{getStateText(state)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JarvisFloatingPanelRealtime;
