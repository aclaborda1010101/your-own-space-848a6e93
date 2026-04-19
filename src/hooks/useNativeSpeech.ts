import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

export type SpeechPermission = "granted" | "denied" | "prompt" | "unknown";

export interface UseNativeSpeechAPI {
  isNative: boolean;
  available: boolean;
  permission: SpeechPermission;
  listening: boolean;
  partial: string;
  finalText: string;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  start: (opts?: { language?: string; maxResults?: number; partialResults?: boolean }) => Promise<boolean>;
  stop: () => Promise<void>;
  reset: () => void;
}

/**
 * Native on-device speech recognition (iOS Speech / Android SpeechRecognizer)
 * via @capacitor-community/speech-recognition. On web, returns available=false.
 */
export function useNativeSpeech(): UseNativeSpeechAPI {
  const isNative = Capacitor.isNativePlatform();
  const [available, setAvailable] = useState(false);
  const [permission, setPermission] = useState<SpeechPermission>("unknown");
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNative) return;
    let mounted = true;
    (async () => {
      try {
        const { available: a } = await SpeechRecognition.available();
        if (mounted) setAvailable(!!a);
        const perm = await SpeechRecognition.checkPermissions();
        if (mounted) setPermission(mapPerm(perm.speechRecognition));
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isNative]);

  // Listener for partial / final results
  useEffect(() => {
    if (!isNative) return;
    const sub = SpeechRecognition.addListener("partialResults", (data: { matches?: string[] }) => {
      const text = data?.matches?.[0] ?? "";
      setPartial(text);
    });
    return () => {
      void sub.remove();
    };
  }, [isNative]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const r = await SpeechRecognition.requestPermissions();
      const mapped = mapPerm(r.speechRecognition);
      setPermission(mapped);
      return mapped === "granted";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [isNative]);

  const start = useCallback(
    async (opts: { language?: string; maxResults?: number; partialResults?: boolean } = {}): Promise<boolean> => {
      if (!isNative) {
        setError("Speech recognition nativo no disponible en web");
        return false;
      }
      setError(null);
      setPartial("");
      setFinalText("");
      try {
        if (permission !== "granted") {
          const ok = await requestPermission();
          if (!ok) return false;
        }
        await SpeechRecognition.start({
          language: opts.language ?? "es-ES",
          maxResults: opts.maxResults ?? 2,
          prompt: "Habla ahora",
          partialResults: opts.partialResults ?? true,
          popup: false,
        });
        setListening(true);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setListening(false);
        return false;
      }
    },
    [isNative, permission, requestPermission],
  );

  const stop = useCallback(async () => {
    if (!isNative) return;
    try {
      await SpeechRecognition.stop();
      setListening(false);
      // promote partial to final
      if (partial) setFinalText(partial);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [isNative, partial]);

  const reset = useCallback(() => {
    setPartial("");
    setFinalText("");
    setError(null);
  }, []);

  return {
    isNative,
    available,
    permission,
    listening,
    partial,
    finalText,
    error,
    requestPermission,
    start,
    stop,
    reset,
  };
}

function mapPerm(p: string): SpeechPermission {
  if (p === "granted") return "granted";
  if (p === "denied") return "denied";
  if (p === "prompt" || p === "prompt-with-rationale") return "prompt";
  return "unknown";
}

export default useNativeSpeech;
