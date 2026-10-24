# Shippe.AR

Asistente para vendedores de La Virginia: fotos del comercio → ficha y propuestas de surtido → chat e información para administración.

Stack: Next.js App Router + TypeScript, Supabase (Auth/Postgres/Storage/RLS) y Gemini en servidor.

## Empezar

1. `npm ci`
2. Copiar `.env.example` a `.env.local` y completar Supabase. Las claves privadas van sólo en el servidor.
3. `npm run dev`

La base remota ya está migrada al contrato en español. Los datos cargados están identificados como DEMO. No ejecutar nuevamente las migraciones a mano sobre el proyecto existente.

- [Contrato del equipo](docs/CONTRATO.md)
- [Configuración, plan y pruebas pendientes](docs/INTEGRACION_SUPABASE.md)
- [Pruebas SQL de permisos](supabase/tests/contrato_rls.sql)

Verificación: `npm run build`, `npm run lint`, `npm test`.

Gemini requiere `GEMINI_API_KEY`, `GEMINI_MODEL` y `SUPABASE_SECRET_KEY`. Si faltan, la aplicación informa la configuración pendiente; no utiliza respuestas simuladas.

