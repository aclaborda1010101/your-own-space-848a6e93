

## Fix: Stale cached module crash

The error shows a failed dynamic import of `ProjectWizard.tsx` with an old build timestamp (`?t=1773669133217`). The browser has a cached `index.html` pointing to a module that no longer exists on the server.

### Change

In `index.html`, improve the `vite:preloadError` handler to also catch dynamic import failures (not just preload errors), and force a clean reload immediately instead of waiting 12 seconds:

**`index.html`** — enhance the `unhandledrejection` listener to catch "Failed to fetch dynamically imported module" errors and trigger an immediate cache-bust reload (same as the existing `vite:preloadError` handler):

```javascript
window.addEventListener("unhandledrejection", function (e) {
  var reason = e && e.reason ? (e.reason.message || e.reason) : "";
  var msg = String(reason || "").toLowerCase();
  
  // Catch stale dynamic imports
  if (msg.indexOf("failed to fetch dynamically imported module") !== -1) {
    e.preventDefault();
    if (!sessionStorage.getItem("__jarvis_chunk_reload")) {
      sessionStorage.setItem("__jarvis_chunk_reload", "1");
      location.reload();
      return;
    }
  }
  
  // Existing URL constructor error handling stays
  if (msg.indexOf("url is not a constructor") !== -1) { ... }
});
```

This ensures stale-cache users get an automatic reload on the first hit instead of seeing the error boundary.

### Files modified

| File | Change |
|------|--------|
| `index.html` | Add dynamic import failure detection to `unhandledrejection` handler |

