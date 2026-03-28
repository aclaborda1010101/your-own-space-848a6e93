

# Plan: Fix Stale Cache in Lovable Preview + Add Force Refresh Button

## Problem
The Lovable preview serves cached versions (404 or old UI) because there are no `Cache-Control` headers on `index.html`, and the existing anti-SW guard runs too late to prevent all cache hits.

## Root Cause
- `index.html` has no cache-control meta hints and `vercel.json` has no header rules -- the CDN/server may cache it
- The anti-SW guard in `index.html` already blocks SW registration and nukes caches, but browser HTTP cache can still serve stale `index.html` itself
- `runtimeFreshness.ts` handles build changes but can't help if the browser never fetches the new `index.html`

## Changes

### 1. Add cache-control meta tag to `index.html` (line 5)
Add `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">` and `<meta http-equiv="Pragma" content="no-cache">` in `<head>` to hint browsers not to cache the HTML document.

### 2. Add cache-control headers in `vercel.json`
Add a headers rule for `index.html` (and the root `/`) setting `Cache-Control: no-store, no-cache, must-revalidate` so the CDN and browser always fetch fresh HTML.

### 3. Create `ForceRefreshButton` component
A small floating button (bottom-right, above the FAB area) that:
- Shows "🔄" icon
- On click: nukes SW + caches, appends `_cb` param, reloads
- Only visible on preview/lovable.app hosts (uses the same hostname detection)

### 4. Add `ForceRefreshButton` to `AppLayout.tsx`
Render it inside the layout so it's always accessible.

## Files Modified
1. `index.html` -- add meta cache-control tags
2. `vercel.json` -- add headers for no-cache on HTML
3. `src/components/layout/ForceRefreshButton.tsx` -- new component
4. `src/components/layout/AppLayout.tsx` -- import and render the button

