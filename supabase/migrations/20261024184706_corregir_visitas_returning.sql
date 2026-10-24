-- INSERT ... RETURNING evalúa también SELECT sobre la fila recién creada.
-- El helper STABLE que vuelve a consultar visitas no puede verla en ese mismo comando.
-- Usar la fila directamente mantiene el aislamiento sin consultar la tabla desde su propia política.
alter policy visitas_lectura on public.visitas
using (
  (select private.rol_actual()) is not null
  and (vendedor_id = (select auth.uid()) or (select private.es_admin()))
);
