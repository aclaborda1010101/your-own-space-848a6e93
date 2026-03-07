
## Diagnosis

The "Error al actualizar resumen" happens because the edge function `project-activity-intelligence` was never deployed. The console shows `FunctionsFetchError: Failed to send a request to the Edge Function`, and there are zero logs for this function in Supabase.

The database tables and columns are all correctly created. The function code and config.toml entry exist. It just needs deployment.

## Fix

1. **Deploy the edge function** `project-activity-intelligence` so it becomes callable from the frontend.

That is the only change needed. No code modifications required.
