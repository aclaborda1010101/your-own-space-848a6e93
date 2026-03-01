

## Diagnosis: Why the other user doesn't see shared resources

I've verified the database and found the root causes:

### What's working
- The `resource_shares` table has 2 entries: `business_project` (editor) and `pattern_detector_run` (editor) shared with the other user.
- The RLS policies are correct — `has_shared_access` returns `true` for the shared user.
- At the database level, the other user **should** see the shared `business_projects` and `pattern_detector_runs`.

### What's NOT working

**Problem 1: Missing shares for other resource types.**
Only `business_project` and `pattern_detector_run` were shared. The following resource types have NO share entries: `task`, `calendar`, `rag_project`, `people_contact`, `data_source`. Each type requires its own share because the RLS policies check by `resource_type`.

**Problem 2: No ShareDialog on Tasks, Calendar, Contacts, or Data Sources pages.**
The "Compartir" button was only added to Projects, RAG Architect, and Pattern Detector. There's no way to share the other modules from the UI.

**Problem 3: Calendar is edge-function-based (iCloud integration), not purely DB-based.**
Calendar events come from the `icloud-calendar` edge function tied to each user's own integration credentials. Sharing calendar via `resource_shares` won't work the same way — the other user doesn't have the owner's iCloud credentials.

### Plan

1. **Add ShareDialog to Tasks, Calendar, and Data Sources pages** — so the user can share each module independently.

2. **Create a "Share All" option** — When sharing from Projects, automatically create shares for ALL related resource types (`business_project`, `task`, `people_contact`, `pattern_detector_run`, `rag_project`, `data_source`, `calendar`, `check_in`) in a single action, so the other user sees everything.

3. **Add a "Compartido conmigo" section in Settings** — so the shared-with user can see what has been shared with them.

4. **Calendar sharing limitation** — Calendar events from iCloud can't be shared via DB sharing (they come from each user's personal integration). I'll add a note in the UI explaining this. However, manually created calendar events stored in DB could potentially be shared.

### Technical changes

- **`src/hooks/useSharing.tsx`**: Add a `shareAllResources` method that creates shares for all resource types at once.
- **`src/pages/Tasks.tsx`**: Add ShareDialog with `resourceType="task"`.
- **`src/pages/Calendar.tsx`**: Add ShareDialog with `resourceType="calendar"` (with a note about iCloud limitation).
- **`src/components/sharing/ShareDialog.tsx`**: Add a checkbox "Compartir todos los módulos" that triggers bulk sharing.
- **`src/pages/Settings.tsx`**: Add "Compartido conmigo" section showing resources shared with the current user.

