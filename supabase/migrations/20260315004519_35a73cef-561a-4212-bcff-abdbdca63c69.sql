DO $$
DECLARE
  v_data jsonb;
  v_incluido jsonb;
  v_stakeholders jsonb;
  v_new_stakeholders jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_i int;
  v_dp jsonb;
  v_new_dp jsonb := '[]'::jsonb;
  v_obj jsonb;
  v_new_obj jsonb := '[]'::jsonb;
BEGIN
  SELECT output_data::jsonb INTO v_data
  FROM project_wizard_steps
  WHERE project_id = '5123d6ea-14aa-4f73-a547-07393d583e89' AND step_number = 2;

  IF v_data IS NULL THEN
    RAISE EXCEPTION 'Step 2 data not found';
  END IF;

  -- 1. Remove internal/residual fields
  v_data := v_data - '_filtered_content';
  v_data := v_data - '_was_filtered';

  -- 2. Clean broken parallel_projects
  v_data := jsonb_set(v_data, '{parallel_projects}', '[]'::jsonb);

  -- 3. Remove empty arrays that add no value
  IF v_data->'restricciones' = '[]'::jsonb THEN
    v_data := v_data - 'restricciones';
  END IF;
  IF v_data->'alcance_preliminar'->'excluido' = '[]'::jsonb THEN
    v_data := jsonb_set(v_data, '{alcance_preliminar}', (v_data->'alcance_preliminar') - 'excluido');
  END IF;
  IF v_data->'cliente'->'ubicaciones' = '[]'::jsonb THEN
    v_data := jsonb_set(v_data, '{cliente}', (v_data->'cliente') - 'ubicaciones');
  END IF;

  -- 4. Uniform placeholders: [PENDIENTE DE CONFIRMAR] -> [Por confirmar]
  IF v_data->'cliente'->>'tamaño' = '[PENDIENTE DE CONFIRMAR]' THEN
    v_data := jsonb_set(v_data, '{cliente,tamaño}', '"[Por confirmar]"'::jsonb);
  END IF;
  IF v_data->'datos_cuantitativos'->>'estimación_proveedor' = '[PENDIENTE DE CONFIRMAR]' THEN
    v_data := jsonb_set(v_data, '{datos_cuantitativos,estimación_proveedor}', '"[Por confirmar]"'::jsonb);
  END IF;
  IF v_data->'datos_cuantitativos'->>'presupuesto_cliente' = '[PENDIENTE DE CONFIRMAR]' THEN
    v_data := jsonb_set(v_data, '{datos_cuantitativos,presupuesto_cliente}', '"[Por confirmar]"'::jsonb);
  END IF;

  -- objetivos: métricas de éxito
  v_obj := v_data->'objetivos';
  IF v_obj IS NOT NULL AND jsonb_array_length(v_obj) > 0 THEN
    v_new_obj := '[]'::jsonb;
    FOR v_i IN 0..jsonb_array_length(v_obj) - 1 LOOP
      v_elem := v_obj->v_i;
      IF v_elem->>'métrica_éxito' = '[PENDIENTE DE CONFIRMAR]' THEN
        v_elem := jsonb_set(v_elem, '{métrica_éxito}', '"[Por confirmar]"'::jsonb);
      END IF;
      v_new_obj := v_new_obj || jsonb_build_array(v_elem);
    END LOOP;
    v_data := jsonb_set(v_data, '{objetivos}', v_new_obj);
  END IF;

  -- decisiones_pendientes: opciones
  v_dp := v_data->'decisiones_pendientes';
  IF v_dp IS NOT NULL AND jsonb_array_length(v_dp) > 0 THEN
    v_new_dp := '[]'::jsonb;
    FOR v_i IN 0..jsonb_array_length(v_dp) - 1 LOOP
      v_elem := v_dp->v_i;
      IF v_elem->'opciones' IS NOT NULL THEN
        v_elem := jsonb_set(v_elem, '{opciones}', '"[Por confirmar]"'::jsonb);
      END IF;
      v_new_dp := v_new_dp || jsonb_build_array(v_elem);
    END LOOP;
    v_data := jsonb_set(v_data, '{decisiones_pendientes}', v_new_dp);
  END IF;

  -- stakeholders: fix placeholders
  v_stakeholders := v_data->'stakeholders';
  IF v_stakeholders IS NOT NULL AND jsonb_array_length(v_stakeholders) > 0 THEN
    v_new_stakeholders := '[]'::jsonb;
    FOR v_i IN 0..jsonb_array_length(v_stakeholders) - 1 LOOP
      v_elem := v_stakeholders->v_i;
      IF v_elem->>'dolor_principal' = '[PENDIENTE DE CONFIRMAR]' THEN
        v_elem := jsonb_set(v_elem, '{dolor_principal}', '"[Por confirmar]"'::jsonb);
      END IF;
      IF v_elem->>'rol' = '[PENDIENTE DE CONFIRMAR]' THEN
        v_elem := jsonb_set(v_elem, '{rol}', '"[Por confirmar]"'::jsonb);
      END IF;
      v_new_stakeholders := v_new_stakeholders || jsonb_build_array(v_elem);
    END LOOP;
    v_data := jsonb_set(v_data, '{stakeholders}', v_new_stakeholders);
  END IF;

  UPDATE project_wizard_steps
  SET output_data = v_data
  WHERE project_id = '5123d6ea-14aa-4f73-a547-07393d583e89' AND step_number = 2;

  RAISE NOTICE 'Generic document cleanup completed successfully';
END;
$$;