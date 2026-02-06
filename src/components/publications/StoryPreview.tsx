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

// NYC Taxi Yellow - fixed accent color
const getAccentColor = (text: string): string => {
  return "#F7B731"; // NYC Taxi Yellow
};

const STYLE_CONFIG: Record<string, {
  background: string;
  textColor: string;
  textColorHex: string;
  overlayClass: string;
  mainFont: string;
  reflectionFont: string;
  useDivider: boolean;
  useSerifItalic: boolean;
  dayInAccent: boolean;
}> = {
  premium_signature: {
    background: "bg-black",
    textColor: "text-white",
    textColorHex: "#FFFFFF",
    overlayClass: "bg-black/65",
    mainFont: "font-sans font-bold",
    reflectionFont: "font-sans font-light",
    useDivider: false,
    useSerifItalic: false,
    dayInAccent: false,
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
  const config = STYLE_CONFIG[storyStyle] || STYLE_CONFIG.premium_signature;
  
  // Get consistent accent color based on content
  const accentColor = useMemo(() => getAccentColor(phraseText + reflectionText), [phraseText, reflectionText]);

  // Truncate reflection text for preview
  const truncatedReflection = useMemo(() => {
    if (reflectionText.length > 300) {
      return reflectionText.substring(0, 300) + "...";
    }
    return reflectionText;
  }, [reflectionText]);

  // Highlight a key word in the phrase with accent color
  const highlightedPhrase = useMemo(() => {
    if (!phraseText) return null;
    const words = phraseText.split(' ');
    if (words.length < 3) return phraseText;
    
    // Pick a word to highlight (avoid first and last, prefer middle)
    const highlightIndex = Math.floor(words.length / 2);
    
    return words.map((word, idx) => (
      <span 
        key={idx} 
        style={idx === highlightIndex ? { color: accentColor, fontWeight: 'bold' } : undefined}
      >
        {word}{idx < words.length - 1 ? ' ' : ''}
      </span>
    ));
  }, [phraseText, accentColor]);

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
      
      {/* Time display - always text color, not accent */}
      <div 
        className={cn("absolute top-4 left-4 text-lg font-light", config.textColor)}
        style={{ textShadow: backgroundImageUrl ? '0 1px 3px rgba(0,0,0,0.5)' : undefined }}
      >
        {storyTime || "00:00"}
      </div>

      {/* Challenge counter */}
      <div 
        className={cn("absolute top-4 right-4 text-sm font-light", config.textColor)}
        style={{ textShadow: backgroundImageUrl ? '0 1px 3px rgba(0,0,0,0.5)' : undefined }}
      >
        <span 
          className="font-bold text-lg"
          style={config.dayInAccent ? { color: accentColor } : undefined}
        >
          {challengeDay}
        </span>
        <span className="opacity-70">/{challengeTotal}</span>
      </div>

      {/* Main content */}
      <div className="absolute inset-0 flex flex-col justify-center px-5 py-12">
        {/* Main phrase with highlighted word */}
        {phraseText && (
          <div className="mb-3">
            <p 
              className={cn(
                "text-lg leading-tight",
                config.textColor,
                config.mainFont,
                config.useSerifItalic && "italic"
              )}
              style={{ textShadow: backgroundImageUrl ? '0 1px 3px rgba(0,0,0,0.5)' : undefined }}
            >
              {highlightedPhrase}
            </p>
          </div>
        )}

        {/* Divider line for Brutalista style */}
        {config.useDivider && (
          <div 
            className="w-16 h-0.5 my-3"
            style={{ backgroundColor: accentColor }}
          />
        )}

        {/* Reflection - Montserrat Thin, justified */}
        <div className="mt-2">
          <p 
            className={cn(
              "text-sm leading-relaxed text-justify",
              config.textColor,
              config.reflectionFont
            )}
            style={{ 
              textShadow: backgroundImageUrl ? '0 1px 2px rgba(0,0,0,0.4)' : undefined,
              fontWeight: 300, // Thin weight
            }}
          >
            {truncatedReflection || "Tu reflexión aparecerá aquí..."}
          </p>
        </div>
      </div>

      {/* Bottom signature area */}
      <div 
        className={cn(
          "absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs opacity-60",
          config.textColor
        )}
        style={{ textShadow: backgroundImageUrl ? '0 1px 2px rgba(0,0,0,0.3)' : undefined }}
      >
        <span className="font-light tracking-wider">@agustinrubini</span>
        <span className="font-thin uppercase tracking-widest text-[10px]">Montserrat</span>
      </div>

      {/* Style label */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
        <span 
          className={cn(
            "text-[10px] uppercase tracking-widest opacity-40 font-light",
            config.textColor
          )}
        >
          {storyStyle.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
};
