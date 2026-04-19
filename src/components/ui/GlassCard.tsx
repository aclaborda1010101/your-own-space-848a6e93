import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

/**
 * GlassCard — wrapper con glassmorphism dark refinado.
 * Background translúcido + blur + borde sutil. Hover opcional eleva 2px y
 * pinta halo índigo.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 ease-out",
        hover &&
          "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_8px_32px_-8px_hsl(var(--primary)/0.2)]",
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = "GlassCard";
