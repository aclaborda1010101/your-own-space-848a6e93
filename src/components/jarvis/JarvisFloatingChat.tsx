import { useState, useEffect } from "react";
import { Bot, X, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JarvisChat } from "./JarvisChat";
import { useAuth } from "@/hooks/useAuth";

/**
 * Desktop-only floating JARVIS chat.
 * Hidden on mobile/iPad (lg breakpoint) — those use the dedicated /chat page.
 */
export function JarvisFloatingChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Auto-open once on first desktop session
  useEffect(() => {
    if (!user || mounted) return;
    setMounted(true);
    setOpen(true);
  }, [user, mounted]);

  if (!user) return null;

  return (
    <div className="hidden lg:block">
      {/* Floating panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-[60]",
          "w-[400px] h-[560px] max-h-[75vh]",
          "rounded-2xl border border-border bg-background shadow-2xl",
          "flex flex-col overflow-hidden",
          "transition-all duration-300 ease-out origin-bottom-right",
          open && !minimized
            ? "scale-100 opacity-100 pointer-events-auto translate-y-0"
            : "scale-90 opacity-0 pointer-events-none translate-y-4"
        )}
      >
        {/* Top bar (close / minimize) */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMinimized(true)}
            title="Minimizar"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setOpen(false)}
            title="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {open && <JarvisChat variant="floating" autoProactive />}
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-[60]">
        <Button
          size="icon"
          className="relative h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            if (minimized) {
              setMinimized(false);
              setOpen(true);
            } else {
              setOpen((v) => !v);
            }
          }}
          aria-label="Abrir JARVIS"
        >
          <Bot className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

export default JarvisFloatingChat;
