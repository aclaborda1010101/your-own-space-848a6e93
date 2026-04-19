import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input — holo edition.
 * - Glass background, subtle inner ring
 * - Focus ring in lima with a soft glow
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-border/60 bg-input/70 backdrop-blur px-3.5 py-2 text-base text-foreground",
          "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/60",
          "focus-visible:outline-none focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:shadow-[0_0_20px_-4px_hsl(var(--primary)/0.3)]",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
