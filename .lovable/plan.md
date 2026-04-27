Diagnóstico: no tienes que empezar desde cero. El presupuesto ya está aprobado y en BBDD contiene los datos correctos: desarrollo 12.400 €, mantenimiento 250 €/mes y asesoría IA 4.000 €/mes / 40h. El fallo está en la regeneración de Step 30: la propuesta guardada sigue siendo la versión 1 antigua y el botón no está creando una nueva versión visible con el renderer actualizado. Además, el backend tiene prioridad absoluta por el presupuesto guardado de Step 6 y puede ignorar parte del `commercial_terms_v1` fresco que envía el frontend.

Plan de corrección:

1. Corregir la regeneración de propuesta cliente para presupuestos ya aprobados
   - En `generate_client_proposal`, usar siempre el presupuesto aprobado/guardado como fuente base, pero mezclar de forma segura los datos frescos del frontend cuando aporten campos editoriales o condiciones calculadas.
   - Mantener Step 6 como fuente de verdad económica, pero no dejar que una derivación antigua bloquee el nuevo formato de propuesta.
   - Forzar que cada click en “Regenerar propuesta cliente” inserte una nueva versión Step 30 y actualice el estado React con esa versión.

2. Aplicar el nuevo formato aunque el presupuesto ya estuviera aprobado
   - No exigir volver a editar ni aprobar Step 6 si ya está `approved`.
   - Al pulsar “Regenerar propuesta cliente”, derivar condiciones desde el Step 6 actual y renderizar con el formato nuevo:
     - “Desarrollo único”
     - “Desarrollo + asesoría IA”
     - mantenimiento descontado 80 €/mes en la opción con asesoría IA: 250 → 170 €/mes
     - sin fila “Total estimado primer año”
     - nota de compromiso mínimo 12 meses
     - modalidad de pago fija: 50% firma / 50% entrega; mensualidades a final de mes; APIs según consumo real

3. Blindaje anti-propuesta obsoleta
   - Añadir una comprobación en backend tras renderizar: si el markdown generado aún contiene “Opción estándar”, “Opción con asesoría IA”, “Total estimado primer año”, “se ajustará la cuota mensual” o “plan de mantenimiento incluye 5 horas”, devolver error claro en vez de guardar basura antigua.
   - Añadir en frontend una comprobación después de regenerar: si la nueva Step 30 contiene patrones antiguos, mostrar aviso y no permitir descargar ese PDF.

4. Mejorar UX del botón
   - Cambiar copy/estado para que quede claro: “Regenerar propuesta con presupuesto aprobado”.
   - Al terminar, mostrar la versión nueva generada y refrescar Step 30 desde BBDD.
   - Si la versión no sube, mostrar error explícito en vez de aparentar éxito.

5. Tests y validación
   - Actualizar/añadir tests del builder F7 para comprobar que el markdown final contiene el formato nuevo y no contiene textos antiguos.
   - Verificar con el proyecto actual `6ef807d1-9c3b-4a9d-b88a-71530c3d7aaf` que Step 30 pasa de versión 1 a versión 2 y que la sección de presupuesto queda con 12.400 €, 6.200 €, 250 €/mes, 170 €/mes y 4.000 €/mes.
   - Actualizar `cache-bust` en `src/main.tsx` para evitar que la preview siga usando bundle antiguo.

Resultado esperado: con el presupuesto ya aprobado, solo tendrás que pulsar “Regenerar propuesta cliente”. No hará falta regenerar presupuesto, ni reaprobarlo, ni repetir pasos anteriores.