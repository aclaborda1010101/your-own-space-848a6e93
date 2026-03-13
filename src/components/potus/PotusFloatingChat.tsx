import { useState, useEffect } from "react";
import { Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PotusCompactChat } from "./PotusCompactChat";
import { usePotusProactive } from "@/hooks/usePotusProactive";

export function PotusFloatingChat() {
  const [open, setOpen] = useState(false);
  const { hasUnread, markRead } = usePotusProactive(() => setOpen(true));

  useEffect(() => {
    if (open && hasUnread) markRead();
  }, [open, hasUnread, markRead]);

  return (
    <>
      {/* Compact popup */}
      <div
        className={cn(
          "fixed bottom-20 right-4 z-[60] lg:bottom-20 lg:right-6",
          "w-[360px] h-[500px] max-h-[70vh]",
          "rounded-2xl border border-border bg-background shadow-2xl",
          "flex flex-col overflow-hidden",
          "transition-all duration-300 ease-out origin-bottom-right",
          open
            ? "scale-100 opacity-100 pointer-events-auto translate-y-0"
            : "scale-90 opacity-0 pointer-events-none translate-y-4"
        )}
      >
        {/* Close bar */}
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {open && <PotusCompactChat />}
      </div>

      {/* FAB */}
      <div className="fixed bottom-24 right-4 z-[60] lg:bottom-6 lg:right-6">
        <Button
          size="lg"
          className="relative h-14 rounded-full px-5 shadow-lg gap-2"
          onClick={() => setOpen((v) => !v)}
        >
          <Shield className="h-5 w-5" />
          POTUS
          {hasUnread && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-destructive" />
            </span>
          )}
        </Button>
      </div>
    </>
  );
}
