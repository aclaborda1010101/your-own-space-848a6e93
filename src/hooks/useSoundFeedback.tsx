import { useCallback, useRef, useEffect } from "react";

type SoundType = "success" | "complete" | "delete" | "tap" | "warning" | "error";

const SOUND_FREQUENCIES: Record<SoundType, { frequencies: number[]; durations: number[] }> = {
  success: { frequencies: [523, 659, 784], durations: [100, 100, 150] }, // C5, E5, G5 - Major chord arpeggio
  complete: { frequencies: [440, 554, 659], durations: [80, 80, 120] }, // A4, C#5, E5 - Positive confirmation
  delete: { frequencies: [440, 349, 294], durations: [100, 100, 150] }, // A4, F4, D4 - Descending
  tap: { frequencies: [800], durations: [30] }, // Quick tap
  warning: { frequencies: [440, 440], durations: [150, 150] }, // Double beep
  error: { frequencies: [200, 150], durations: [200, 300] }, // Low descending
};

export const useSoundFeedback = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const enabledRef = useRef<boolean>(true);

  // Initialize AudioContext on first user interaction
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        console.warn("Web Audio API not supported");
        return null;
      }
    }
    return audioContextRef.current;
  }, []);

  // Resume AudioContext if suspended (required for iOS)
  const ensureAudioContextReady = useCallback(async () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, [getAudioContext]);

  const playSound = useCallback(async (type: SoundType = "tap", volume: number = 0.3) => {
    if (!enabledRef.current) return;

    const ctx = await ensureAudioContextReady();
    if (!ctx) return;

    const soundConfig = SOUND_FREQUENCIES[type];
    let startTime = ctx.currentTime;

    soundConfig.frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.setValueAtTime(freq, startTime);
      oscillator.type = type === "error" || type === "warning" ? "square" : "sine";
      
      const duration = soundConfig.durations[index] / 1000;
      
      // Envelope for smooth sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.05);
      
      startTime += duration;
    });
  }, [ensureAudioContextReady]);

  const setEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Convenience methods
  const success = useCallback(() => playSound("success"), [playSound]);
  const complete = useCallback(() => playSound("complete"), [playSound]);
  const deleteFeedback = useCallback(() => playSound("delete"), [playSound]);
  const tap = useCallback(() => playSound("tap", 0.2), [playSound]);
  const warning = useCallback(() => playSound("warning"), [playSound]);
  const error = useCallback(() => playSound("error"), [playSound]);

  return {
    playSound,
    setEnabled,
    success,
    complete,
    delete: deleteFeedback,
    tap,
    warning,
    error,
  };
};

export default useSoundFeedback;
