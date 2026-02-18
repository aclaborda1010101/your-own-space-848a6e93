import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border bg-card rounded-lg overflow-hidden">
        {/* Header - Always visible */}
        <div className={cn(
          "flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-card border-b border-border",
          !isOpen && "border-b-0",
          headerClassName
        )}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:text-primary transition-colors flex-1 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
              <span className="text-sm sm:text-base font-semibold text-foreground truncate">{title}</span>
              {badge}
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200 ml-auto flex-shrink-0",
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
                  className="h-7 w-7 ml-2 text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ocultar tarjeta</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Collapsible Content */}
        <CollapsibleContent>
          <div className="card-content">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
