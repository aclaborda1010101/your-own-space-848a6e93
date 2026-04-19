import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

type HapticPattern = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

const WEB_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [30, 30, 30],
  error: [50, 100, 50],
  selection: 5,
};

const isNative = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

async function nativeHaptic(pattern: HapticPattern) {
  try {
    switch (pattern) {
      case "light":
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case "medium":
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case "heavy":
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case "success":
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case "warning":
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case "error":
        await Haptics.notification({ type: NotificationType.Error });
        break;
      case "selection":
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        await Haptics.selectionEnd();
        break;
    }
    return true;
  } catch {
    return false;
  }
}

export const useHaptics = () => {
  const webSupported = typeof navigator !== "undefined" && "vibrate" in navigator;

  const vibrate = useCallback((pattern: HapticPattern = "light") => {
    if (isNative) {
      void nativeHaptic(pattern);
      return true;
    }
    if (!webSupported) return false;
    try {
      return navigator.vibrate(WEB_PATTERNS[pattern]);
    } catch {
      return false;
    }
  }, [webSupported]);

  const lightTap = useCallback(() => vibrate("light"), [vibrate]);
  const mediumTap = useCallback(() => vibrate("medium"), [vibrate]);
  const heavyTap = useCallback(() => vibrate("heavy"), [vibrate]);
  const success = useCallback(() => vibrate("success"), [vibrate]);
  const warning = useCallback(() => vibrate("warning"), [vibrate]);
  const error = useCallback(() => vibrate("error"), [vibrate]);
  const selection = useCallback(() => vibrate("selection"), [vibrate]);

  const stop = useCallback(() => {
    if (!isNative && webSupported) navigator.vibrate(0);
  }, [webSupported]);

  return {
    isSupported: isNative || webSupported,
    isNative,
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    success,
    warning,
    error,
    selection,
    stop,
  };
};

export default useHaptics;
