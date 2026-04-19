import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge — holo edition.
 * - "default" now uses subtle primary tint with border + mono font for HUD feel
 * - New "holo" variant for data chips (lime glow)
 * - New "accent" variant for cian holographic info
 * - "solid" kept as the old bg-primary behaviour if you need it
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary/12 text-primary border-primary/30",
        secondary:
          "bg-secondary/60 text-secondary-foreground border-border/50",
        destructive:
          "bg-destructive/12 text-destructive border-destructive/40",
        outline: "text-foreground border-border",
        holo:
          "bg-primary/15 text-primary border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.25)]",
        accent:
          "bg-accent/15 text-accent border-accent/40",
        success: "bg-success/12 text-success border-success/40",
        warning: "bg-warning/12 text-warning border-warning/40",
        solid:
          "border-transparent bg-primary text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
