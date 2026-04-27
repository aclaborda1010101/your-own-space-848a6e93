-- Step 28 v1 -> v2 in-place: mover SCOPE-007 (Revista emocional) de mvp a fast_follow_f2
DO $$
DECLARE
  v_src_id uuid := 'c9e3ac94-8c70-4d29-808b-f0cb078f5703';
  v_output jsonb;
  v_scope jsonb;
  v_mvp jsonb;
  v_f2 jsonb;
  v_moved jsonb;
  v_new_mvp jsonb;
  v_new_f2 jsonb;
BEGIN
  SELECT output_data INTO v_output
  FROM public.project_wizard_steps
  WHERE id = v_src_id;

  v_scope := v_output->'scope_architecture_v1';
  v_mvp := v_scope->'mvp';
  v_f2 := v_scope->'fast_follow_f2';

  SELECT elem INTO v_moved
  FROM jsonb_array_elements(v_mvp) elem
  WHERE elem->>'scope_id' = 'SCOPE-007'
  LIMIT 1;

  IF v_moved IS NULL THEN
    RAISE EXCEPTION 'SCOPE-007 not found in mvp bucket';
  END IF;

  v_moved := jsonb_set(v_moved, '{bucket}', '"fast_follow_f2"');
  v_moved := jsonb_set(v_moved, '{status}', '"deferred"');

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_new_mvp
  FROM jsonb_array_elements(v_mvp) elem
  WHERE elem->>'scope_id' <> 'SCOPE-007';

  v_new_f2 := v_f2 || jsonb_build_array(v_moved);

  v_scope := jsonb_set(v_scope, '{mvp}', v_new_mvp);
  v_scope := jsonb_set(v_scope, '{fast_follow_f2}', v_new_f2);

  v_scope := jsonb_set(
    v_scope,
    '{scope_decision_log}',
    COALESCE(v_scope->'scope_decision_log', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'decision', 'move_component',
      'scope_id', 'SCOPE-007',
      'from_bucket', 'mvp',
      'to_bucket', 'fast_follow_f2',
      'reason', 'Decisión de producto: MVP demasiado cargado para Lovable. Revista emocional pasa a fast-follow F2.',
      'applied_in_version', 2,
      'applied_at', now()
    ))
  );

  v_output := jsonb_set(v_output, '{scope_architecture_v1}', v_scope);

  UPDATE public.project_wizard_steps
  SET output_data = v_output,
      version = 2,
      status = 'review',
      model_used = COALESCE(model_used, 'deterministic') || '+manual_patch_v2',
      updated_at = now()
  WHERE id = v_src_id;
END $$;