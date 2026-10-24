# AGENTS.md: instrucciones para personas y agentes de IA

Este archivo lo leen Claude Code, Cursor, Codex, v0 y cualquier agente que trabaje en el repo. También es la guía rápida para el equipo.
**Antes de tocar código, leé `docs/CONTRATO.md`.** Es la fuente de verdad sobre el esquema, el JSON de la ficha y las rutas.

## Qué es el proyecto

Shippe.AR, hackathon SHIPPE.AR #3, track La Virginia "Perfil del Punto de Venta".
El vendedor entra a un comercio, sube fotos (fachada, góndolas y extras) a un chat, y la IA devuelve una **ficha del local**:
formato, nivel socioeconómico (NSE) con señales, surtido ideal de La Virginia, qué ofrecer primero con argumento, competencia, y nuestro plus: **categoría de cliente** (`premium | estandar | basico`).

Hay dos roles:
- **vendedor**: chat de visita y mapa (datos básicos).
- **admin**: mapa con todos los datos y dashboard de métricas.

## Stack

- Next.js (App Router) + TypeScript, desplegado en Vercel desde `main`.
- Supabase: Postgres, Auth, Storage (bucket `fotos`) y RLS.
- Modelo de IA con visión, llamado **solo desde el servidor** (`app/api/*`).
- Validación con zod.

## Estructura

```
app/            páginas (login, chat, mapa, dashboard) + app/api/*
components/     UI (generada con v0 y ajustada)
lib/db/         acceso a Supabase: única capa que habla con la DB
lib/ai/         prompt, llamada al modelo y validación de la ficha
types/          ficha.ts (contrato de la IA), db.ts (generado por Supabase)
supabase/       migraciones SQL y seed
docs/           CONTRATO.md
```

## Dueños (pedí review al dueño si tocás su zona)

| Zona | Dueño |
|---|---|
| `app/` (páginas), `components/` | Agus |
| `supabase/`, RLS, Storage | Lauti |
| `lib/db/`, `app/api/` | Tomi |
| `lib/ai/` | Feli |
| `docs/`, `types/`, `AGENTS.md`, merges a `main` | Integrador |

## Reglas que no se rompen

1. **El contrato manda.** Si cambiás una tabla, una columna, un campo de la ficha o una ruta, primero actualizá `docs/CONTRATO.md` y `types/`, en el mismo PR, y avisá en el grupo.
2. **Nada de secretos en el código.** Las claves van en `.env.local` (está en `.gitignore`) y en las variables de Vercel. `SUPABASE_SERVICE_ROLE_KEY` y `AI_API_KEY` nunca se usan en componentes de cliente ni en variables `NEXT_PUBLIC_*`.
3. **Los componentes no llaman a Supabase ni a la IA directamente.** Usan las rutas de `app/api/*` o las funciones de `lib/db/`.
4. **Toda ficha se valida** con el schema de `types/ficha.ts` antes de guardarse. Nunca se guarda una ficha que no valida.
5. **Trazabilidad:** cada ficha guarda `modelo` y `prompt_version`. Si cambiás el prompt, subí `prompt_version`.
6. **Los permisos se chequean en el servidor** (RLS y la ruta API), no solo escondiendo botones en el front.
7. **Nombres:** tablas y columnas de la DB en `snake_case` y en español (como en el contrato). Código TypeScript en `camelCase`. Los valores de enums van sin tilde: `estandar`, `basico`, `almacen`.
8. **No inventes productos.** Las recomendaciones salen de la tabla `productos_lv`.

## Flujo de Git

- `main` siempre tiene que compilar, porque Vercel la deploya en cada push.
- Una rama por tarea: `front/...`, `db/...`, `api/...`, `ai/...`, `docs/...`.
- `git pull origin main` antes de empezar y antes de abrir el PR.
- PRs chicos y frecuentes (cada 1–2 h). Los mergea el integrador.
- Mensajes de commit en español, en imperativo: "Agregar ruta de análisis de visita".
- Nunca hagas `push --force` sobre `main` ni sobre la rama de otra persona.

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo servidor
AI_API_KEY=                  # solo servidor
```

## Antes de abrir un PR

- [ ] `npm run build` pasa sin errores.
- [ ] `npm run lint` pasa (cuando ESLint esté configurado; hoy el script existe pero falta la config).
- [ ] Si tocaste el esquema: hay migración en `supabase/` y regeneraste `types/db.ts` (`supabase gen types typescript`).
- [ ] Si tocaste la ficha o las rutas: actualizaste `docs/CONTRATO.md` y `types/`.
- [ ] No hay claves, `.env` ni `console.log` con datos sensibles.

## Notas para agentes de IA

- Respondé y comentá en español rioplatense, igual que el resto del repo.
- Hacé el cambio mínimo que pide la tarea. No reestructures carpetas ni renombres cosas fuera de tu zona.
- Si el pedido contradice `docs/CONTRATO.md`, frená y preguntá antes de cambiar el contrato.
- No agregues dependencias nuevas sin decirlo en el resumen del PR.
- Si generás UI con v0, adaptala a los tipos de `types/ficha.ts`. No inventes campos nuevos.
