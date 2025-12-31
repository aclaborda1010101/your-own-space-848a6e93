import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, Brain, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTasks } from "@/hooks/useTasks";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JarvisVoiceButtonProps {
  className?: string;
}

export const JarvisVoiceButton = ({ className }: JarvisVoiceButtonProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { addTask } = useTasks();
  const { createEvent, connected: calendarConnected } = useGoogleCalendar();

  // Handle tool calls from the AI
  const handleToolCall = useCallback(async (toolName: string, args: any) => {
    console.log('Tool call:', toolName, args);
    
    if (toolName === 'create_task') {
      try {
        await addTask({
          title: args.title,
          type: args.type,
          priority: args.priority,
          duration: args.duration,
        });
        toast.success(`Tarea creada: ${args.title}`);
        return { success: true, message: `Tarea "${args.title}" creada correctamente` };
      } catch (error) {
        console.error('Error creating task:', error);
        toast.error('Error al crear la tarea');
        return { success: false, error: 'Error al crear la tarea' };
      }
    }
    
    if (toolName === 'create_event') {
      if (!calendarConnected) {
        toast.error('Conecta Google Calendar para crear eventos');
        return { success: false, error: 'Google Calendar no conectado' };
      }
      
      try {
        await createEvent({
          title: args.title,
          time: args.time,
          duration: args.duration,
          description: args.description || '',
        });
        toast.success(`Evento creado: ${args.title}`);
        return { success: true, message: `Evento "${args.title}" creado correctamente` };
      } catch (error) {
        console.error('Error creating event:', error);
        toast.error('Error al crear el evento');
        return { success: false, error: 'Error al crear el evento' };
      }
    }
    
    return { success: false, error: 'Función no reconocida' };
  }, [addTask, createEvent, calendarConnected]);

  // Handle messages from OpenAI
  const handleMessage = useCallback(async (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received event:', data.type, data);

      switch (data.type) {
        case 'session.created':
          console.log('Session created');
          setIsConnected(true);
          setIsConnecting(false);
          break;
          
        case 'input_audio_buffer.speech_started':
          setIsSpeaking(true);
          setTranscript("");
          break;
          
        case 'input_audio_buffer.speech_stopped':
          setIsSpeaking(false);
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          setTranscript(data.transcript || "");
          break;
          
        case 'response.audio_transcript.delta':
          setResponse(prev => prev + (data.delta || ""));
          break;
          
        case 'response.audio_transcript.done':
          // Response complete
          break;
          
        case 'response.done':
          setResponse("");
          break;
          
        case 'response.function_call_arguments.done':
          // Handle function call
          const toolName = data.name;
          const args = JSON.parse(data.arguments);
          const result = await handleToolCall(toolName, args);
          
          // Send function result back
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: data.call_id,
                output: JSON.stringify(result),
              }
            }));
            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
          }
          break;
          
        case 'error':
          console.error('OpenAI error:', data.error);
          toast.error(data.error?.message || 'Error de conexión');
          break;
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }, [handleToolCall]);

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setTranscript("");
    setResponse("");
    
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Get ephemeral token
      const { data, error } = await supabase.functions.invoke('jarvis-voice');
      
      if (error) throw error;
      if (!data?.client_secret?.value) {
        throw new Error('No se pudo obtener token de sesión');
      }
      
      const ephemeralKey = data.client_secret.value;
      
      // Create peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      
      // Set up audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioRef.current = audioEl;
      
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };
      
      // Add microphone track
      pc.addTrack(stream.getTracks()[0]);
      
      // Set up data channel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      
      dc.addEventListener('message', handleMessage);
      dc.addEventListener('open', () => {
        console.log('Data channel open');
      });
      
      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Connect to OpenAI Realtime API
      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
      });
      
      if (!sdpResponse.ok) {
        throw new Error('Error conectando con OpenAI');
      }
      
      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      
      await pc.setRemoteDescription(answer);
      console.log('WebRTC connection established');
      
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      toast.error(error.message || 'Error al iniciar conversación');
      setIsConnecting(false);
      disconnect();
    }
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setTranscript("");
    setResponse("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className={cn("fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3", className)}>
      {/* Transcript/Response bubble */}
      {isConnected && (transcript || response) && (
        <div className="max-w-xs bg-card border border-border rounded-lg p-3 shadow-lg animate-fade-in">
          {transcript && (
            <p className="text-sm text-muted-foreground mb-1">
              <span className="font-medium text-foreground">Tú:</span> {transcript}
            </p>
          )}
          {response && (
            <p className="text-sm text-foreground">
              <span className="font-medium text-primary">JARVIS:</span> {response}
            </p>
          )}
        </div>
      )}
      
      {/* Main button */}
      <div className="relative">
        {/* Pulse animation when speaking */}
        {isSpeaking && (
          <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
        )}
        
        {/* Glow effect when connected */}
        {isConnected && (
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-pulse" />
        )}
        
        <Button
          size="lg"
          onClick={isConnected ? disconnect : startConversation}
          disabled={isConnecting}
          className={cn(
            "relative h-16 w-16 rounded-full shadow-lg transition-all duration-300",
            isConnected 
              ? "bg-destructive hover:bg-destructive/90" 
              : "bg-primary hover:bg-primary/90",
            isSpeaking && "scale-110"
          )}
        >
          {isConnecting ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isConnected ? (
            <X className="h-6 w-6" />
          ) : (
            <div className="flex flex-col items-center">
              <Brain className="h-6 w-6" />
            </div>
          )}
        </Button>
        
        {/* Label */}
        {!isConnected && !isConnecting && (
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground whitespace-nowrap">
            JARVIS
          </span>
        )}
        
        {isConnected && (
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium text-primary whitespace-nowrap flex items-center gap-1">
            <Mic className="h-3 w-3" />
            Escuchando...
          </span>
        )}
      </div>
    </div>
  );
};
