import { Mic, Volume2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

interface PotusStatusBarProps {
  state: ConversationState;
  transcript: string;
  onClose: () => void;
}

// Compact waveform for the status bar
const MiniWaveform = ({ isActive }: { isActive: boolean }) => {
  const bars = 12;
  
  return (
    <div className="flex items-center gap-[2px] h-4">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-[2px] bg-current rounded-full transition-all duration-100",
            isActive ? "animate-pulse" : ""
          )}
          style={{ 
            height: isActive 
              ? `${Math.max(4, Math.sin((Date.now() / 100) + i * 0.5) * 8 + 10)}px`
              : '4px',
            animationDelay: `${i * 50}ms`
          }}
        />
      ))}
    </div>
  );
};

export const PotusStatusBar = ({ state, transcript, onClose }: PotusStatusBarProps) => {
  const getStatusIcon = () => {
    switch (state) {
      case 'listening':
        return <Mic className="h-4 w-4 text-destructive" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'speaking':
        return <Volume2 className="h-4 w-4 text-primary animate-pulse" />;
      default:
        return <Mic className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return transcript || 'Escuchando...';
      case 'processing':
        return 'POTUS está pensando...';
      case 'speaking':
        return 'POTUS está hablando...';
      default:
        return 'Iniciando...';
    }
  };

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50",
      "bg-card/95 backdrop-blur-md border-b border-primary/30",
      "shadow-lg shadow-primary/10",
      "animate-in slide-in-from-top duration-200",
      "safe-top"
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status icon */}
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
          state === 'listening' && "bg-destructive/20",
          state === 'processing' && "bg-primary/20",
          state === 'speaking' && "bg-primary/20",
          state === 'idle' && "bg-muted"
        )}>
          {getStatusIcon()}
        </div>
        
        {/* Waveform for listening/speaking */}
        {(state === 'listening' || state === 'speaking') && (
          <div className={cn(
            state === 'listening' ? "text-destructive" : "text-primary"
          )}>
            <MiniWaveform isActive={state === 'listening' || state === 'speaking'} />
          </div>
        )}
        
        {/* Status text */}
        <span className="flex-1 text-sm text-foreground truncate">
          {getStatusText()}
        </span>
        
        {/* Close button */}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 hover:bg-destructive/20 hover:text-destructive"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
