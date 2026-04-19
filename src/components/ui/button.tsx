import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — upgraded to the holo design system.
 * - Default variant now has lima-neon glow
 * - New "holo" variant for top CTAs
 * - New "glow" variant for secondary accent actions (cian)
 * - Preserves existing shadcn API — every import keeps working
 */
const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_8px_24px_-8px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_12px_32px_-8px_hsl(var(--primary)/0.6)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-110 shadow-[0_4px_16px_-4px_hsl(var(--destructive)/0.4)]",
        outline:
          "border border-border bg-background/60 backdrop-blur hover:bg-primary/5 hover:border-primary/40 text-foreground",
        secondary:
          "bg-secondary/80 text-secondary-foreground hover:bg-secondary backdrop-blur border border-border/50",
        ghost: "hover:bg-primary/8 hover:text-foreground text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        holo:
          "bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.55),0_0_60px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_32px_hsl(var(--primary)/0.7),0_0_80px_hsl(var(--primary)/0.35)] hover:brightness-105",
        glow:
          "bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 hover:shadow-[0_0_20px_hsl(var(--accent)/0.4)] backdrop-blur",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8 text-base",
        xl: "h-12 rounded-2xl px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
