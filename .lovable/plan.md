

## Plan: Fix "Unknown action: run_audit" error

The edge function code already contains the `run_audit` handler (lines 452-586), but the deployed version doesn't have it. The last deployment may have failed silently or used a stale version.

### Action
1. **Redeploy** the `project-wizard-step` edge function -- no code changes needed, just a fresh deployment to push the current code that already includes all Phase 4-9 actions.

