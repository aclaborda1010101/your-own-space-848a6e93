export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access to window.top can throw; assume iframe.
    return true;
  }
}

export function prepareOAuthWindow(): Window | null {
  if (!isInIframe()) return null;

  // Open synchronously (in the click handler) to avoid popup blockers.
  return window.open("about:blank", "_blank", "noopener,noreferrer");
}

export function redirectToOAuthUrl(url: string, popup: Window | null) {
  if (popup && !popup.closed) {
    popup.location.href = url;
    return;
  }

  window.location.assign(url);
}
