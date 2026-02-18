/**
 * ChatBox - Real-time chat interface
 * JARVIS APP - Real-time Communication Implementation
 * Created: 2026-02-18 05:35 GMT+1
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Mic, Keyboard } from 'lucide-react';
import { ChatMessage } from '@/components/ChatMessage';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChatBoxProps {
  userId?: string;
  className?: string;
}

export function ChatBox({ userId, className }: ChatBoxProps) {
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, loading, error, sendMessage, isTyping } = useRealtimeChat(userId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    await sendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!userId) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Usuario no autenticado. Por favor, inicia sesión.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
            J
          </div>
          <div>
            <h3 className="font-semibold">JARVIS</h3>
            <p className="text-sm text-muted-foreground">
              {isTyping ? 'Escribiendo...' : 'Online'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-semibold mb-2">¡Hola!</p>
              <p>Envía un mensaje para comenzar a hablar con JARVIS.</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isOwnMessage={message.role === 'user'}
              />
            ))}
            {isTyping && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-2 w-2 rounded-full bg-current animate-bounce" />
                </div>
                <span>JARVIS está escribiendo...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        {inputMode === 'text' ? (
          <>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe un mensaje..."
                disabled={loading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setInputMode('voice')}
                title="Cambiar a voz"
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                type="submit"
                disabled={!inputValue.trim() || loading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Presiona Enter para enviar • Shift+Enter para nueva línea
            </p>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setInputMode('text')}
                title="Cambiar a texto"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <VoiceRecorder
                  userId={userId}
                  onAudioUploaded={(url) => {
                    console.log('Audio uploaded:', url);
                    // Audio will be transcribed by Edge Function
                    // Response will arrive via Realtime
                  }}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
