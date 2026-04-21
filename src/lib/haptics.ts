/**
 * Imperative haptic feedback — usable anywhere (no hooks needed).
 * Components like Button, Switch, Slider etc. call these directly
 * from event handlers. The useHaptics hook still exists for
 * components that prefer the hook API.
 */
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const isNative = (() => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
})();

const webSupported =
  typeof navigator !== "undefined" && "vibrate" in navigator;

const webVibrate = (ms: number | number[]) => {
  if (webSupported) try { navigator.vibrate(ms); } catch { /* noop */ }
};

export const haptic = {
  light() {
    if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else webVibrate(10);
  },
  medium() {
    if (isNative) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    else webVibrate(25);
  },
  heavy() {
    if (isNative) void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    else webVibrate(50);
  },
  success() {
    if (isNative) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else webVibrate([10, 50, 10]);
  },
  warning() {
    if (isNative) void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    else webVibrate([30, 30, 30]);
  },
  error() {
    if (isNative) void Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    else webVibrate([50, 100, 50]);
  },
  selection() {
    if (isNative) {
      void Haptics.selectionStart()
        .then(() => Haptics.selectionChanged())
        .then(() => Haptics.selectionEnd())
        .catch(() => {});
    } else {
      webVibrate(5);
    }
  },
};
