

## Problem

Every time you open the preview, it shows the old/stale frontend until Lovable rebuilds. The current `runtimeFreshness.ts` only handles service worker issues in preview mode — it doesn't detect build changes like it does for published hosts. So stale browser-cached assets persist.

## Solution

Extend the preview freshness check in `runtimeFreshness.ts` to also use `__APP_BUILD_ID__` detection (same as published hosts). When the preview loads with a different build ID than what's stored, it will force a cache-busted reload automatically — no need to wait for a chat message.

### Changes to `src/lib/runtimeFreshness.ts`

In the `isPreview()` block (lines 139-156), after the SW cleanup, add build ID change detection:

```text
if (isPreview()) {
  const controlledBySw = hasActiveSwController();
  nukeSwAndCaches();

  // If SW was controlling, reload to bypass it
  if (controlledBySw) {
    const attempts = ...;
    // existing SW reload logic
  }

  // NEW: Also detect build changes in preview (same as published)
  const currentBuild = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "";
  if (currentBuild) {
    const savedBuild = localStorage.getItem(BUILD_KEY);
    localStorage.setItem(BUILD_KEY, currentBuild);
    if (savedBuild && savedBuild !== currentBuild) {
      if (sessionStorage.getItem(RELOAD_DONE) === currentBuild) {
        sessionStorage.removeItem(RELOAD_DONE);
        return false;
      }
      sessionStorage.setItem(RELOAD_DONE, currentBuild);
      setTimeout(reloadWithPreviewBypass, 250);
      return true;
    }
  }

  return false;
}
```

This ensures that when a new build is deployed, the preview auto-reloads with cache-busting on first load — eliminating the stale frontend issue without any user interaction.

