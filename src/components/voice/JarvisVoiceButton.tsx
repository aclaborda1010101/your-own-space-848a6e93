import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTasks } from "@/hooks/useTasks";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AISpectrum from "@/components/ui/AISpectrum";

interface JarvisVoiceButtonProps {
  className?: string;
}

// Sound effect generator using Web Audio API
const createSoundEffect = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  return {
    playConnect: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    },
    
    playDisconnect: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.15);
      oscillator.frequency.exponentialRampToValueAtTime(220, audioContext.currentTime + 0.25);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.25);
    },
    
    playClick: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
    },
    
    playSuccess: () => {
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator1.type = 'sine';
      oscillator2.type = 'sine';
      
      oscillator1.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
      
      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator1.start(audioContext.currentTime);
      oscillator2.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.2);
      oscillator2.stop(audioContext.currentTime + 0.2);
    },
  };
};

// Audio visualizer component
const AudioVisualizer = ({ isActive, isSpeaking }: { isActive: boolean; isSpeaking: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 80;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let time = 0;
    const centerX = size / 2;
    const centerY = size / 2;

    const animate = () => {
      ctx.clearRect(0, 0, size, size);
      time += 0.03;

      const barCount = 32;
      const baseAmplitude = isSpeaking ? 1.5 : 0.8;

      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const frequency = Math.sin(time * 4 + i * 0.3) * 0.5 + 0.5;
        const amplitude = baseAmplitude + (isSpeaking ? Math.random() * 0.5 : 0);
        const barHeight = 4 + frequency * 14 * amplitude;
        const innerRadius = 16;

        const x1 = centerX + Math.cos(angle) * innerRadius;
        const y1 = centerY + Math.sin(angle) * innerRadius;
        const x2 = centerX + Math.cos(angle) * (innerRadius + barHeight);
        const y2 = centerY + Math.sin(angle) * (innerRadius + barHeight);

        const opacity = 0.4 + frequency * 0.6;
        ctx.beginPath();
        ctx.strokeStyle = `hsla(var(--primary), ${opacity})`;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Center glow
      const glowSize = 12 + Math.sin(time * 3) * 3;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowSize);
      gradient.addColorStop(0, "hsla(var(--primary), 0.8)");
      gradient.addColorStop(0.5, "hsla(var(--primary), 0.3)");
      gradient.addColorStop(1, "hsla(var(--primary), 0)");

      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(centerX, centerY, glowSize, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isSpeaking]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: 80, height: 80 }}
    />
  );
};

export const JarvisVoiceButton = ({ className }: JarvisVoiceButtonProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const soundRef = useRef<ReturnType<typeof createSoundEffect> | null>(null);
  
  const { addTask, pendingTasks, toggleComplete } = useTasks();
  const { createEvent, deleteEvent, events, connected: calendarConnected } = useGoogleCalendar();

  // Initialize sound effects
  useEffect(() => {
    soundRef.current = createSoundEffect();
  }, []);

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
        soundRef.current?.playSuccess();
        toast.success(`Tarea creada: ${args.title}`);
        return { success: true, message: `Tarea "${args.title}" creada correctamente` };
      } catch (error) {
        console.error('Error creating task:', error);
        toast.error('Error al crear la tarea');
        return { success: false, error: 'Error al crear la tarea' };
      }
    }
    
    if (toolName === 'complete_task') {
      try {
        const searchTerm = args.task_title.toLowerCase();
        const matchingTask = pendingTasks.find(task => 
          task.title.toLowerCase().includes(searchTerm)
        );
        
        if (!matchingTask) {
          toast.error(`No se encontró tarea: ${args.task_title}`);
          return { success: false, error: `No se encontró ninguna tarea pendiente que coincida con "${args.task_title}"` };
        }
        
        await toggleComplete(matchingTask.id);
        soundRef.current?.playSuccess();
        toast.success(`Tarea completada: ${matchingTask.title}`);
        return { success: true, message: `Tarea "${matchingTask.title}" marcada como completada` };
      } catch (error) {
        console.error('Error completing task:', error);
        toast.error('Error al completar la tarea');
        return { success: false, error: 'Error al completar la tarea' };
      }
    }
    
    if (toolName === 'list_pending_tasks') {
      if (pendingTasks.length === 0) {
        return { success: true, message: 'No tienes tareas pendientes' };
      }
      
      const taskList = pendingTasks.slice(0, 5).map(t => 
        `- ${t.title} (${t.priority}, ${t.type})`
      ).join('\n');
      
      return { 
        success: true, 
        message: `Tienes ${pendingTasks.length} tareas pendientes. Las más recientes son:\n${taskList}` 
      };
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
        soundRef.current?.playSuccess();
        toast.success(`Evento creado: ${args.title}`);
        return { success: true, message: `Evento "${args.title}" creado correctamente` };
      } catch (error) {
        console.error('Error creating event:', error);
        toast.error('Error al crear el evento');
        return { success: false, error: 'Error al crear el evento' };
      }
    }
    
    if (toolName === 'delete_event') {
      if (!calendarConnected) {
        toast.error('Conecta Google Calendar para eliminar eventos');
        return { success: false, error: 'Google Calendar no conectado' };
      }
      
      try {
        const searchTerm = args.event_title.toLowerCase();
        const matchingEvent = events.find(event => 
          event.title.toLowerCase().includes(searchTerm)
        );
        
        if (!matchingEvent) {
          toast.error(`No se encontró evento: ${args.event_title}`);
          return { success: false, error: `No se encontró ningún evento que coincida con "${args.event_title}"` };
        }
        
        await deleteEvent(matchingEvent.id);
        soundRef.current?.playSuccess();
        toast.success(`Evento eliminado: ${matchingEvent.title}`);
        return { success: true, message: `Evento "${matchingEvent.title}" eliminado correctamente` };
      } catch (error) {
        console.error('Error deleting event:', error);
        toast.error('Error al eliminar el evento');
        return { success: false, error: 'Error al eliminar el evento' };
      }
    }
    
    return { success: false, error: 'Función no reconocida' };
  }, [addTask, pendingTasks, toggleComplete, createEvent, deleteEvent, events, calendarConnected]);

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
          soundRef.current?.playConnect();
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
          break;
          
        case 'response.done':
          setResponse("");
          break;
          
        case 'response.function_call_arguments.done':
          const toolName = data.name;
          const args = JSON.parse(data.arguments);
          const result = await handleToolCall(toolName, args);
          
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
    soundRef.current?.playClick();
    setIsConnecting(true);
    setTranscript("");
    setResponse("");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const { data, error } = await supabase.functions.invoke('jarvis-voice');
      
      if (error) throw error;
      if (!data?.client_secret?.value) {
        throw new Error('No se pudo obtener token de sesión');
      }
      
      const ephemeralKey = data.client_secret.value;
      
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioRef.current = audioEl;
      
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };
      
      pc.addTrack(stream.getTracks()[0]);
      
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      
      dc.addEventListener('message', handleMessage);
      dc.addEventListener('open', () => {
        console.log('Data channel open');
      });
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
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
    soundRef.current?.playDisconnect();
    
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

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const handleClick = useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      startConversation();
    }
  }, [isConnected, disconnect, startConversation]);

  return (
    <div className={cn("fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3", className)}>
      {/* Transcript/Response bubble */}
      {isConnected && (transcript || response) && (
        <div className="max-w-xs bg-card/90 backdrop-blur-lg border border-primary/20 rounded-xl p-4 shadow-2xl animate-fade-in">
          {transcript && (
            <p className="text-sm text-muted-foreground mb-2">
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
      <div 
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Outer rings when connected */}
        {isConnected && (
          <>
            <div className="absolute -inset-3 rounded-full border border-primary/20 animate-pulse" />
            <div className="absolute -inset-6 rounded-full border border-primary/10" 
              style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', animationDelay: '0.5s' }} 
            />
          </>
        )}
        
        {/* Speaking waves */}
        {isSpeaking && (
          <>
            <div className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
            <div className="absolute -inset-2 rounded-full bg-primary/20 animate-ping" style={{ animationDelay: '0.2s' }} />
            <div className="absolute -inset-4 rounded-full bg-primary/10 animate-ping" style={{ animationDelay: '0.4s' }} />
          </>
        )}
        
        {/* Glow effect */}
        {(isConnected || isHovered) && (
          <div className={cn(
            "absolute inset-0 rounded-full blur-xl transition-all duration-500",
            isConnected ? "bg-primary/40" : "bg-primary/20"
          )} />
        )}
        
        <Button
          size="lg"
          onClick={handleClick}
          disabled={isConnecting}
          className={cn(
            "relative h-20 w-20 rounded-full shadow-2xl transition-all duration-300 overflow-hidden",
            isConnected 
              ? "bg-destructive hover:bg-destructive/90 border-2 border-destructive-foreground/20" 
              : "bg-card hover:bg-card/90 border-2 border-primary/30 hover:border-primary/60",
            isSpeaking && "scale-110",
            isHovered && !isConnected && "scale-105"
          )}
        >
          {/* Audio visualizer */}
          <AudioVisualizer isActive={isConnected} isSpeaking={isSpeaking} />
          
          {isConnecting ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : isConnected ? (
            <X className="h-8 w-8 relative z-10" />
          ) : (
            <div className="relative z-10">
              <AISpectrum size={48} />
            </div>
          )}
        </Button>
        
        {/* Label */}
        <div className={cn(
          "absolute -bottom-8 left-1/2 -translate-x-1/2 transition-all duration-300",
          isHovered && !isConnected && "-bottom-10"
        )}>
          {!isConnected && !isConnecting && (
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap bg-card/80 backdrop-blur-sm px-2 py-1 rounded-full border border-border/50">
              JARVIS
            </span>
          )}
          
          {isConnected && (
            <span className="text-xs font-medium text-primary whitespace-nowrap flex items-center gap-1.5 bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-primary/30">
              <Mic className="h-3 w-3 animate-pulse" />
              Escuchando...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
