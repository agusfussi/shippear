# Integración Supabase + Gemini

Proyecto conectado: `eferescsbtbpggcygqon` (Shippear).

## Estado

- Base migrada al contrato en español, con 12 comercios, 15 visitas/fichas y 15 productos DEMO conservados.
- Prototipo anterior archivado en `legacy_shippear`, sin permisos de cliente. No se eliminaron sus datos.
- Auth real con cookies; el rol se consulta en `profiles`, no en sessionStorage.
- Rutas del contrato implementadas en `app/api/[...path]/route.ts`, con acceso a datos en `lib/db/`.
- Fotos privadas en bucket `fotos`, pertenecientes al comercio y visita del usuario.
- Gemini implementado con `@google/genai`, validación Zod, catálogo activo y guardado mediante `guardar_ficha`.
- Mapa y panel usan datos de Supabase. Vendedor recibe mapa básico y sólo sus visitas; admin recibe ficha ampliada.

## Arranque para el equipo

1. Instalar dependencias con `npm ci`.
2. Copiar `.env.example` a `.env.local` y completar los valores. El archivo local nunca se sube a Git.
3. Configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para login, comercios, visitas y mapa.
4. Configurar `SUPABASE_SECRET_KEY` para guardar fichas/respuestas de IA y administrar acceso de vendedores.
5. Configurar `GEMINI_API_KEY` (obligatoria). `GEMINI_MODEL` es opcional: si no se define se usa `gemini-3.5-flash`, con `gemini-3.1-flash-lite` como respaldo (ver `lib/ai/cliente.ts`).
6. Ejecutar `npm run dev`, ingresar con una cuenta confirmada de Supabase Auth y probar una visita con fotos JPEG/PNG/WebP.

Las variables equivalentes deben configurarse en el entorno de despliegue antes de incorporar el PR a main. Se aceptan los alias anteriores `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `AI_API_KEY`. No hace falta colocar una contraseña de Postgres en el frontend.

## Flujo

Seleccionar/crear comercio → crear visita con clave de reintento → subir fotos por `lib/db/browser.ts` → registrar metadata por API → analizar en servidor → validar ficha y catálogo → guardar atómicamente → consultar ficha, chat y mapa.

Cada visita tiene una sola ficha. Para un nuevo análisis del comercio se crea otra visita. La IA no confirma stock ni pedidos: lo no observable se representa con null o limitaciones. Una propuesta copiable no equivale a una venta.

## Plan de trabajo del equipo

| Paso | Responsable sugerido | Criterio de aceptación |
|---|---|---|
| Revisar e incorporar integración | Integrador + Tomi | PR revisado y build/lint/tests correctos |
| Configurar variables del despliegue | Lauti + Tomi | Login real y lectura del catálogo/mapa |
| Ensayar captura de fotos | Agus + Lauti | Foto privada registrada en la visita correcta |
| Activar Gemini | Feli + Tomi | Ficha válida guardada y visible tras recargar |
| Ajustar UI al resultado real | Agus | Estados de carga/error y ausencia de datos claros |
| Ensayar demo | Los cinco | Foto → ficha → repregunta → mapa, sin información simulada como resultado real |

## Verificación efectuada

- `npm run build`: compilación y tipos correctos.
- `npm run lint`: sin errores ni advertencias.
- `npm test`: once pruebas de ficha, catálogo, consistencia, límite de JSON y origen de solicitudes.
- `supabase/tests/contrato_rls.sql`: PASS contra el proyecto real; pruebas revertidas sin dejar usuarios de prueba.
- Asesor Supabase: sin hallazgos de RLS/vistas/funciones; persiste aviso de protección de contraseñas filtradas desactivada, disponible en Pro o superior ([documentación](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

Pendiente por decisión del usuario: llamada real a Gemini. No se dispuso de claves privadas ni se hicieron llamadas pagas. También quedan pendientes login con credenciales del usuario y subida HTTP real de fotos. El control de permisos rechazó abrir el navegador en localhost; no se hizo revisión visual ni se ejecutó la prueba HTTP local `npm run test:smoke`. Ese script queda disponible para correr con el servidor levantado en puerto 3100 (o `SMOKE_BASE_URL`).

## Migraciones

`supabase/migrations/` contiene el historial exportado del proyecto, con sus versiones reales, y la migración de adaptación. La base remota YA está migrada: no ejecutar los scripts a mano sobre ella. `types/db.ts` se generó desde el esquema aplicado. Para cambios futuros, crear una migración nueva y regenerar los tipos.

No se probó una restauración local completa con Docker. La migración nueva se aplicó y sus permisos se comprobaron en la base remota existente.

## Límites del primer flujo

Fotos: hasta 6 y 12 MiB en total; máximo 10 MiB por archivo. Audio/video necesitan otro flujo y no se anuncian como procesados. Si falla una subida antes del registro pueden quedar archivos huérfanos; su limpieza se hace con Storage API desde un administrador, no con borrados SQL de `storage.objects`.

El límite de una ficha evita duplicados en la base; dos llamadas concurrentes al proveedor pueden consumir dos inferencias. Antes de producción conviene añadir cuota por usuario y coordinación de trabajos. Los datos DEMO no son el catálogo ni ventas oficiales de La Virginia.
