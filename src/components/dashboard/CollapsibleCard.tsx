import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CollapsibleCardProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onHide?: () => void;
  defaultOpen?: boolean;
  headerClassName?: string;
  badge?: React.ReactNode;
}

export const CollapsibleCard = ({
  id,
  title,
  icon,
  children,
  onHide,
  defaultOpen = true,
  headerClassName,
  badge,
}: CollapsibleCardProps) => {
  const storageKey = `collapsible-${id}`;
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) return saved === "true";
    } catch {}
    return defaultOpen;
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    try { sessionStorage.setItem(storageKey, String(open)); } catch {}
  };

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <div className="border border-border/60 bg-card rounded-lg overflow-hidden transition-colors hover:border-border">
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-3 sm:px-4 py-2.5",
          isOpen && "border-b border-border/40",
          headerClassName
        )}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2.5 hover:text-primary transition-colors flex-1 min-w-0">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                {icon}
              </div>
              <span className="text-sm font-semibold text-foreground truncate">{title}</span>
              {badge && <span className="shrink-0">{badge}</span>}
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ml-auto shrink-0",
                isOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          
          {onHide && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onHide}
                  className="h-6 w-6 ml-2 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <EyeOff className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ocultar</TooltipContent>
            </Tooltip>
          )}
        </div>

        <CollapsibleContent>
          <div className="card-content animate-in fade-in-0 slide-in-from-top-1 duration-200">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
