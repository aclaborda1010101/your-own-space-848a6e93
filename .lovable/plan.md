

## Root Cause

The `recoverPreviewAuthIfNeeded()` function added in the last edit is **actively breaking** the app. It detects `.lovable.app` in the hostname, doesn't find `__lovable_token` in the URL (because the Lovable Preview iframe doesn't pass auth via URL params), and redirects the entire iframe to `lovable.dev/auth-bridge` -- which shows Lovable's login page instead of JARVIS.

## Fix (1 file, 1 change)

### `index.html` -- Remove or neuter `recoverPreviewAuthIfNeeded()`

- Add `if (window.self !== window.top) return;` as the very first line inside the function, so it never fires when running inside the Lovable Preview iframe.
- This is the same guard already used in `runtimeFreshness.ts`.

```javascript
(function recoverPreviewAuthIfNeeded(){
  try {
    // Never run inside iframes (Lovable Preview handles auth itself)
    if (window.self !== window.top) return;
    // ... rest of existing code unchanged
  } catch(e){}
})();
```

No other files need changes.

## Technical Details

- The Lovable Preview embeds the app in an iframe where auth tokens are injected via postMessage/headers, not URL params.
- The `recoverPreviewAuthIfNeeded` function was designed for top-level navigation but runs unconditionally, including in iframes.
- Adding the iframe guard matches the existing pattern in `runtimeFreshness.ts` (line 64: `if (window.self !== window.top) return;`).
- The `runtimeFreshness.ts` already handles this correctly; only `index.html` is missing the check.

