export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function prepareOAuthWindow(): Window | null {
  if (!isInIframe()) return null;
  return window.open("about:blank", "_blank", "noopener,noreferrer");
}

export function redirectToOAuthUrl(url: string, popup: Window | null) {
  if (popup && !popup.closed) {
    popup.location.href = url;
    return;
  }

  window.location.assign(url);
}

export function getSafeRedirectTarget(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw) return fallback;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
    if (decoded.startsWith("/login") || decoded.startsWith("/oauth/google")) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}

export function persistRedirectTarget(target: string) {
  try {
    sessionStorage.setItem("jarvis:post-auth-redirect", target);
  } catch {}
}

export function consumeRedirectTarget(fallback = "/dashboard") {
  try {
    const stored = sessionStorage.getItem("jarvis:post-auth-redirect");
    if (stored) {
      sessionStorage.removeItem("jarvis:post-auth-redirect");
      return getSafeRedirectTarget(stored, fallback);
    }
  } catch {}
  return fallback;
}
