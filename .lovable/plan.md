

## Plan: Fix "compartir todos los módulos" error

### Root Cause
The `resource_shares_type_check` constraint only allows these types: `business_project`, `task`, `rag_project`, `pattern_detector_run`, `people_contact`, `calendar`, `check_in`, `data_source`. But `useSharing.tsx` includes `bl_audit` in its `ALL_RESOURCE_TYPES` array.

### Fix
**SQL Migration**: Update the check constraint to include `bl_audit`:
```sql
ALTER TABLE resource_shares DROP CONSTRAINT resource_shares_type_check;
ALTER TABLE resource_shares ADD CONSTRAINT resource_shares_type_check 
  CHECK (resource_type = ANY(ARRAY[
    'business_project','task','rag_project','pattern_detector_run',
    'people_contact','calendar','check_in','data_source','bl_audit'
  ]));
```

No frontend changes needed — `useSharing.tsx` already has `bl_audit` in the array.

