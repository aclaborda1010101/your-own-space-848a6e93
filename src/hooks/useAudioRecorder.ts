/**
 * useAudioRecorder - Audio recording hook
 * JARVIS APP - Real-time Communication Implementation
 * Created: 2026-02-18 05:39 GMT+1
 */

import { useState, useCallback } from 'react';
import { useReactMediaRecorder } from 'react-media-recorder';
import { supabase } from '@/integrations/supabase/client';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
  uploadAudio: (userId: string) => Promise<string | null>;
  clearAudio: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const {
    startRecording: startMediaRecording,
    stopRecording: stopMediaRecording,
    mediaBlobUrl,
  } = useReactMediaRecorder({
    audio: true,
    onStop: (blobUrl, blob) => {
      setAudioBlob(blob);
      setAudioUrl(blobUrl);
      setIsRecording(false);
    },
    mediaRecorderOptions: {
      mimeType: 'audio/webm',
    },
    askPermissionOnMount: false,
  });

  const startRecording = useCallback(() => {
    setError(null);
    setDuration(0);
    
    // Request microphone permission
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => {
        setIsRecording(true);
        startMediaRecording();
        
        // Start duration counter
        const startTime = Date.now();
        const interval = setInterval(() => {
          setDuration(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        // Store interval ID to clear on stop
        (window as any).__recordingInterval = interval;
      })
      .catch((err) => {
        console.error('Microphone permission denied:', err);
        setError('No se pudo acceder al micrófono. Por favor, concede permisos.');
      });
  }, [startMediaRecording]);

  const stopRecording = useCallback(() => {
    stopMediaRecording();
    setIsRecording(false);
    
    // Clear duration interval
    if ((window as any).__recordingInterval) {
      clearInterval((window as any).__recordingInterval);
      (window as any).__recordingInterval = null;
    }
  }, [stopMediaRecording]);

  const uploadAudio = useCallback(
    async (userId: string): Promise<string | null> => {
      if (!audioBlob) {
        setError('No hay audio para subir');
        return null;
      }

      try {
        const timestamp = Date.now();
        const fileName = `${userId}/${timestamp}.webm`;

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('user-audio')
          .upload(fileName, audioBlob, {
            contentType: 'audio/webm',
            cacheControl: '3600',
            upsert: false,
        });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('user-audio')
          .getPublicUrl(fileName);

        // Insert metadata
        await (supabase as any).from('audio_messages').insert({
          user_id: userId,
          audio_url: publicUrl,
          duration_seconds: duration,
          transcription_status: 'pending',
        });

        return publicUrl;
      } catch (err) {
        console.error('Error uploading audio:', err);
        setError(err instanceof Error ? err.message : 'Error al subir audio');
        return null;
      }
    },
    [audioBlob, duration]
  );

  const clearAudio = useCallback(() => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
  }, []);

  return {
    isRecording,
    duration,
    audioBlob,
    audioUrl,
    error,
    startRecording,
    stopRecording,
    uploadAudio,
    clearAudio,
  };
}
