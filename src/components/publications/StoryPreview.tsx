import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface StoryPreviewProps {
  phraseText: string;
  reflectionText: string;
  storyStyle: string;
  storyTime: string;
  challengeDay: number;
  challengeTotal: number;
  backgroundImageUrl?: string;
  className?: string;
}

const STYLE_CONFIG: Record<string, {
  background: string;
  textColor: string;
  accentColor: string;
  overlayClass: string;
  fontClass: string;
}> = {
  papel_claro: {
    background: "bg-[#f5f1e8]",
    textColor: "text-[#2a2a2a]",
    accentColor: "text-amber-700",
    overlayClass: "",
    fontClass: "font-serif",
  },
  urban_muted: {
    background: "bg-gradient-to-b from-slate-600 to-slate-800",
    textColor: "text-slate-100",
    accentColor: "text-amber-400",
    overlayClass: "backdrop-blur-sm",
    fontClass: "font-sans",
  },
  urban_bw_blur: {
    background: "bg-gradient-to-b from-neutral-700 to-neutral-900",
    textColor: "text-white",
    accentColor: "text-neutral-300",
    overlayClass: "backdrop-blur-md",
    fontClass: "font-sans",
  },
  brutalista: {
    background: "bg-gradient-to-b from-zinc-800 to-black",
    textColor: "text-white",
    accentColor: "text-amber-500",
    overlayClass: "backdrop-blur-sm",
    fontClass: "font-mono",
  },
};

export const StoryPreview = ({
  phraseText,
  reflectionText,
  storyStyle,
  storyTime,
  challengeDay,
  challengeTotal,
  backgroundImageUrl,
  className,
}: StoryPreviewProps) => {
  const config = STYLE_CONFIG[storyStyle] || STYLE_CONFIG.papel_claro;

  // Truncate reflection text for preview
  const truncatedReflection = useMemo(() => {
    if (reflectionText.length > 200) {
      return reflectionText.substring(0, 200) + "...";
    }
    return reflectionText;
  }, [reflectionText]);

  return (
    <div
      className={cn(
        "relative w-full aspect-[9/16] rounded-xl overflow-hidden shadow-lg border border-border/50",
        !backgroundImageUrl && config.background,
        config.overlayClass,
        className
      )}
    >
      {/* Background image if provided */}
      {backgroundImageUrl && (
        <img 
          src={backgroundImageUrl}
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* Overlay for readability when using background image */}
      {backgroundImageUrl && (
        <div className="absolute inset-0 bg-black/40" />
      )}
      {/* Time display */}
      <div className={cn("absolute top-4 left-4 text-lg font-light", config.textColor)}>
        {storyTime || "00:00"}
      </div>

      {/* Challenge counter */}
      <div className={cn("absolute top-4 right-4 text-sm font-light", config.textColor)}>
        <span className={cn("font-bold text-lg", config.accentColor)}>{challengeDay}</span>
        <span className="opacity-70">/{challengeTotal}</span>
      </div>

      {/* Main content */}
      <div className="absolute inset-0 flex flex-col justify-center px-5 py-12">
        {/* Phrase */}
        <div className="mb-4">
          <p className={cn(
            "text-base leading-relaxed text-justify",
            config.textColor,
            config.fontClass
          )}>
            {truncatedReflection || "Tu reflexión aparecerá aquí..."}
          </p>
        </div>
      </div>

      {/* Bottom signature area */}
      <div className={cn(
        "absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs opacity-60",
        config.textColor
      )}>
        <span className="font-light tracking-wider">@agustinrubini</span>
        <span className="font-thin uppercase tracking-widest text-[10px]">Montserrat</span>
      </div>

      {/* Style label */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
        <span className={cn(
          "text-[10px] uppercase tracking-widest opacity-40 font-light",
          config.textColor
        )}>
          {storyStyle.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
};
