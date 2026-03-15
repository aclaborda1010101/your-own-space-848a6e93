DO $$
DECLARE
  v_data jsonb;
  v_alcance_key text;
  v_incluido jsonb;
  v_new_incluido jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_alertas jsonb;
  v_new_alertas jsonb := '[]'::jsonb;
  v_contexto text;
  v_resumen text;
  i int;
BEGIN
  SELECT output_data::jsonb INTO v_data
  FROM project_wizard_steps
  WHERE project_id = '5123d6ea-14aa-4f73-a547-07393d583e89' AND step_number = 2;

  IF v_data IS NULL THEN
    RAISE EXCEPTION 'Step 2 data not found';
  END IF;

  -- 1. Fix cliente.nombre_comercial
  v_data := jsonb_set(v_data, '{cliente,nombre_comercial}', '"Mirnidón Retail"'::jsonb);

  -- 2. Fix cliente.contexto_comercial: remove personal monetization reference
  v_contexto := v_data->'cliente'->>'contexto_comercial';
  v_contexto := replace(v_contexto, 
    ' Agustín Cifuentes, el desarrollador, tiene experiencia en sistemas de IA con un modelo de monetización por licencias recurrentes mensuales (10-20 EUR/usuario) para sus propios proyectos, lo que podría ser una referencia para el producto final.',
    '');
  v_data := jsonb_set(v_data, '{cliente,contexto_comercial}', to_jsonb(v_contexto));

  -- 3. Remove alert about 3000€/mes personal tokens
  v_alertas := v_data->'alertas';
  IF v_alertas IS NOT NULL AND jsonb_array_length(v_alertas) > 0 THEN
    FOR i IN 0..jsonb_array_length(v_alertas) - 1 LOOP
      v_elem := v_alertas->i;
      IF position('3000' in coalesce(v_elem->>'descripción','')) = 0 THEN
        v_new_alertas := v_new_alertas || jsonb_build_array(v_elem);
      END IF;
    END LOOP;
    v_data := jsonb_set(v_data, '{alertas}', v_new_alertas);
  END IF;

  -- 4. Clean alcance incluido: remove personal system features
  IF v_data ? 'alcance_preliminar' THEN
    v_alcance_key := 'alcance_preliminar';
  ELSE
    v_alcance_key := 'alcance';
  END IF;

  v_incluido := v_data->v_alcance_key->'incluido';
  IF v_incluido IS NOT NULL AND jsonb_array_length(v_incluido) > 0 THEN
    v_new_incluido := '[]'::jsonb;
    FOR i IN 0..jsonb_array_length(v_incluido) - 1 LOOP
      v_elem := v_incluido->i;
      IF position('Clonación de voz' in coalesce(v_elem->>'funcionalidad','')) = 0
         AND position('Switching entre múltiples IAs' in coalesce(v_elem->>'funcionalidad','')) = 0 THEN
        v_new_incluido := v_new_incluido || jsonb_build_array(v_elem);
      END IF;
    END LOOP;
    v_data := jsonb_set(v_data, ARRAY[v_alcance_key, 'incluido'], v_new_incluido);
  END IF;

  -- 5. Clear false positive parallel_projects
  v_data := jsonb_set(v_data, '{parallel_projects}', '[]'::jsonb);

  -- 6. Remove internal metadata
  v_data := v_data - '_contract_validation';

  -- 7. Clean resumen if contains personal reference
  v_resumen := v_data->>'resumen_ejecutivo';
  IF v_resumen IS NOT NULL THEN
    v_resumen := regexp_replace(v_resumen, 'Agustín Cifuentes.*?3000[^.]*\.', '', 'g');
    v_data := jsonb_set(v_data, '{resumen_ejecutivo}', to_jsonb(v_resumen));
  END IF;

  UPDATE project_wizard_steps
  SET output_data = v_data
  WHERE project_id = '5123d6ea-14aa-4f73-a547-07393d583e89' AND step_number = 2;

  RAISE NOTICE 'Briefing cleaned successfully';
END;
$$;