import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

/**
 * One-shot native chrome configuration: dark status bar matching the theme,
 * splash fade-out as soon as React has mounted.
 */
export async function bootNativeChrome() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#0F172A" }).catch(() => undefined); // Android only
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  } catch (e) {
    console.warn("[nativeBoot] StatusBar config failed:", e);
  }
  try {
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch (e) {
    console.warn("[nativeBoot] SplashScreen.hide failed:", e);
  }
}
