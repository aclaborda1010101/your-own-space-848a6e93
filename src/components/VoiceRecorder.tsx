/**
 * VoiceRecorder - Hold-to-record voice message component
 * JARVIS APP - Real-time Communication Implementation
 * Created: 2026-02-18 05:40 GMT+1
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VoiceRecorderProps {
  userId?: string;
  onAudioUploaded?: (audioUrl: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ userId, onAudioUploaded, disabled }: VoiceRecorderProps) {
  const {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    error,
    startRecording,
    stopRecording,
    uploadAudio,
    clearAudio,
  } = useAudioRecorder();

  const [uploading, setUploading] = useState(false);
  const [holding, setHolding] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle mouse/touch down
  const handlePointerDown = () => {
    if (disabled || audioBlob) return;
    setHolding(true);
    startRecording();
  };

  // Handle mouse/touch up
  const handlePointerUp = () => {
    if (!holding) return;
    setHolding(false);
    stopRecording();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, [isRecording, stopRecording]);

  const handleSend = async () => {
    if (!audioBlob || !userId) return;

    setUploading(true);
    const url = await uploadAudio(userId);
    setUploading(false);

    if (url) {
      onAudioUploaded?.(url);
      clearAudio();
    }
  };

  const handleCancel = () => {
    clearAudio();
  };

  // Show preview after recording
  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        {/* Audio preview */}
        <audio src={audioUrl} controls className="flex-1 h-8" />
        
        {/* Duration badge */}
        <span className="text-xs text-muted-foreground px-2">
          {formatDuration(duration)}
        </span>

        {/* Cancel button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCancel}
          disabled={uploading}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Send button */}
        <Button
          size="icon"
          onClick={handleSend}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Recording button */}
      <div className="flex items-center gap-2">
        <Button
          ref={buttonRef}
          size="icon"
          variant={isRecording ? 'destructive' : 'outline'}
          disabled={disabled}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={cn(
            'relative transition-all',
            isRecording && 'scale-110 animate-pulse'
          )}
          type="button"
        >
          <Mic className="h-4 w-4" />
          
          {/* Recording indicator */}
          {isRecording && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          )}
        </Button>

        {/* Duration display */}
        {isRecording && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-destructive font-mono">
              {formatDuration(duration)}
            </span>
            <span className="text-muted-foreground">
              Mantén presionado para grabar
            </span>
          </div>
        )}
      </div>

      {/* Instructions */}
      {!isRecording && (
        <p className="text-xs text-muted-foreground text-center">
          Mantén presionado para grabar mensaje de voz
        </p>
      )}

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
