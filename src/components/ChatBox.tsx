/**
 * ChatBox - Real-time chat interface
 * JARVIS APP - Real-time Communication Implementation
 * Created: 2026-02-18 05:35 GMT+1
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Mic, Keyboard, Camera as CameraIcon, Image as ImageIcon } from 'lucide-react';
import { ChatMessage } from '@/components/ChatMessage';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCamera } from '@/hooks/useCamera';
import { useNativeSpeech } from '@/hooks/useNativeSpeech';
import { useHaptics } from '@/hooks/useHaptics';
import { toast } from 'sonner';

interface ChatBoxProps {
  userId?: string;
  className?: string;
}

export function ChatBox({ userId, className }: ChatBoxProps) {
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, loading, error, sendMessage, isTyping } = useRealtimeChat(userId);
  const camera = useCamera();
  const speech = useNativeSpeech();
  const haptics = useHaptics();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Keep textbox in sync with native speech partials
  useEffect(() => {
    if (speech.listening && speech.partial) setInputValue(speech.partial);
  }, [speech.partial, speech.listening]);

  const handleAttach = async (mode: 'camera' | 'gallery') => {
    haptics.lightTap();
    const photo = mode === 'camera' ? await camera.takePhoto() : await camera.pickFromGallery();
    if (!photo) return;
    toast.success('Foto adjuntada', { description: 'Próximamente: análisis de imagen.' });
    // TODO: pipe photo.webPath / base64 into the chat upload flow
  };

  const handleNativeMicToggle = async () => {
    haptics.mediumTap();
    if (!speech.isNative || !speech.available) {
      // Fallback to existing voice-recording UI
      setInputMode('voice');
      return;
    }
    if (speech.listening) {
      await speech.stop();
      if (speech.partial.trim()) {
        await sendMessage(speech.partial.trim());
        setInputValue('');
        speech.reset();
      }
    } else {
      const ok = await speech.start({ language: 'es-ES', partialResults: true });
      if (!ok) setInputMode('voice');
    }
  };

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
                placeholder={speech.listening ? 'Escuchando…' : 'Escribe un mensaje...'}
                disabled={loading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleAttach(camera.isNative ? 'camera' : 'gallery')}
                disabled={camera.busy}
                title={camera.isNative ? 'Tomar foto' : 'Adjuntar imagen'}
              >
                {camera.isNative ? <CameraIcon className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant={speech.listening ? 'destructive' : 'outline'}
                size="icon"
                onClick={handleNativeMicToggle}
                title={speech.listening ? 'Parar dictado' : 'Dictar (nativo)'}
              >
                <Mic className={`h-4 w-4 ${speech.listening ? 'animate-pulse' : ''}`} />
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
              Enter para enviar • Shift+Enter nueva línea
              {speech.isNative && speech.available && ' • Toca el micro para dictar'}
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
