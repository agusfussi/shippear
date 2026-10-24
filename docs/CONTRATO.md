# Contrato del equipo: datos, API y forma de trabajo

> Fuente única de verdad. Si algo cambia (una columna, un campo del JSON, una ruta), **se cambia acá primero** y se avisa en el grupo.
> Responsable del documento: el integrador (rol "intermediario").

## 1. Quién hace qué

| Persona | Área | Entrega para | Depende de |
|---|---|---|---|
| Agus | Front Next.js (v0): chat, mapa, dashboard, login | — | §4 (ficha JSON), §5 (rutas) |
| Lauti | Supabase: tablas, Storage, RLS, auth | Tomi, Agus | §3 (esquema) |
| Tomi | Repo + capa de datos (`lib/db/*`) y rutas API | Agus | §3, §5 |
| Feli | IA: prompt, llamada al modelo, validación de la ficha | Tomi | §4 (ficha JSON), catálogo |
| Integrador | Este contrato, tipos compartidos, datos semilla, integración y demo | todos | — |

## 2. Decisión de producto: qué es "clasificar"

La ficha responde las 4 cosas que pide el PDF: **formato**, **nivel socioeconómico (NSE)**, **surtido ideal** y **qué ofrecer y cómo**.
Encima de eso agregamos nuestro plus: la **categoría del cliente** (`premium | estandar | basico`), una etiqueta simple para el vendedor y para el mapa.

- La categoría **no reemplaza** al NSE: es un resumen de formato + NSE + surtido, y siempre viene con un `motivo`.
- El color del pin en el mapa sale de `categoria`; la forma del pin, de `formato`.
- Cada clasificación trae las **señales** que la justifican (eso es lo que hace creíble la demo).

## 3. Esquema de datos (contrato aplicado por Lauti)

**Integración aprobada por Lauti:** la base del prototipo se adapta a este contrato en español. Las tablas previas se conservan en el esquema privado `legacy_shippear` como respaldo, sin acceso desde el cliente. El esquema público de la aplicación queda en español. No volver a aplicar el SQL del prototipo sobre esta base.

`profiles` usa `nombre` y `rol` (`vendedor | admin`); la cuenta indicada por Lauti es admin. `comercios` incluye `vendedor_asignado`, `es_demo` y `notas`; `visitas` incluye `client_request_id` y `fecha_visita`; `fotos` incluye `mime_type` y `byte_size`; `fichas` conserva el JSON completo y `request_id` para reintentos; `productos_lv` incluye `sku`, `gama`, `activo` y `es_demo`. Los identificadores y datos semilla del prototipo se preservan. La relación `visita → ficha` es única, como define este contrato.

```
profiles      (id = auth.users.id, nombre, rol: 'vendedor'|'admin', created_at)
comercios     (id, nombre, direccion, lat, lng, creado_por → profiles, created_at)
visitas       (id, comercio_id → comercios, vendedor_id → profiles, created_at)
fotos         (id, visita_id → visitas, tipo: 'fachada'|'gondola'|'extra', storage_path, created_at)
fichas        (id, visita_id → visitas UNIQUE, formato, nse, categoria, data jsonb,
               modelo, prompt_version, created_at)
mensajes      (id, visita_id → visitas, rol: 'user'|'assistant', contenido, created_at)
productos_lv  (id, nombre, categoria, presentacion, formatos_objetivo text[], nse_objetivo text[])
```

- Catálogo oficial del grupo (63 productos de La Virginia, Alicante, Virgin Islands, Litoral, Chocolino, Tuy y Giacomo): migración `20261024180000_catalogo_oficial_lv.sql`, con `sku` = código del catálogo (`LAV-001`, `ALI-006`…). Fuente: `lib/ai/catalogo.ts`, que además aporta marca, subcategoría y detalles al prompt (se cruzan por `sku`). `formatos_objetivo`, `nse_objetivo` y `gama` son estimación del equipo. Los productos DEMO quedan activos porque fichas viejas los referencian, pero si hay productos oficiales la IA usa solo esos.

- **Comercio ≠ visita.** Un comercio tiene muchas visitas; cada visita tiene sus fotos, su ficha y su chat. Eso nos da el "historial por comercio" del PLUS gratis.
- `fichas.formato`, `fichas.nse` y `fichas.categoria` se duplican como columnas (además de `data`) para que el dashboard y el mapa filtren sin leer el JSON.
- `modelo` + `prompt_version` = trazabilidad: sabemos qué versión del prompt generó cada ficha.
- Fotos en Storage, bucket **privado** `fotos`, ruta `{comercio_id}/{visita_id}/{tipo}-{uuid}.jpg` (también PNG/WebP). En la DB sólo guardamos el path. La subida se hace desde funciones de `lib/db/`; las rutas validan que cada medio pertenezca al comercio y visita del usuario. No se guardan URLs firmadas.
- Vista para el mapa: `v_comercios_ultima_ficha` (comercio + datos de su última ficha).

**RLS (permisos)**
- Vendedor: lee todos los comercios con `nombre, lat, lng, formato, nse` (mapa); lee/escribe sólo **sus** visitas, fotos y mensajes.
- Admin: lee todo. El dashboard sólo lo ve admin (se chequea en el front **y** en la RLS/ruta).
- Cuentas nuevas: se crean con `activo = false` (migración `20261024190000_perfiles_inactivos_por_defecto.sql`). No ven nada hasta que un admin las habilita desde el panel (Equipo).

## 4. Ficha del local: JSON que devuelve la IA (contrato Feli ↔ Tomi ↔ Agus)

```json
{
  "formato": { "tipo": "autoservicio", "tamano": "chico", "cajas": 2, "m2_estimados": 60, "gondolas": 3 },
  "nse": { "nivel": "medio", "senales": ["gaseosas de 1ª y 2ª marca", "papel doble y simple hoja", "vino en botella $4.000–9.000", "sin premium (oliva, frutos secos)"] },
  "surtido": {
    "tiene": ["Café molido 500 g"],
    "le_falta": ["Café molido 250 g", "Mate cocido x 50", "Té en saquitos x 25", "Café instantáneo 100 g"]
  },
  "ofrecer_primero": [
    { "producto": "Café molido 250 g", "argumento": "La categoría está en góndola y nuestra marca no; ocupa el espacio de la competencia a precio similar." }
  ],
  "categoria": { "valor": "estandar", "motivo": "Autoservicio chico de barrio con público medio: compra marcas de primera pero sin premium." },
  "competencia": { "marcas": 2, "share_frentes_pct": 70, "promos": ["2x1 visible en café torrado"] },
  "confianza": 0.8
}
```

- `formato.tipo` ∈ `almacen | autoservicio | kiosco | despensa | cafeteria | otro`
- `nse.nivel` ∈ `bajo | medio | alto`
- `categoria.valor` ∈ `premium | estandar | basico`. Regla de consistencia: NSE `alto` no puede ser `basico` y NSE `bajo` no puede ser `premium` (se chequea al validar).
- Los nombres de productos en `surtido` y `ofrecer_primero` **tienen que existir en `productos_lv`** (se pasa el catálogo en el prompt).
- Feli valida la respuesta con un schema (zod) antes de guardarla. Si no valida: se reintenta una vez y si falla se devuelve error, nunca se guarda una ficha rota.
- Los tipos TypeScript de esta ficha viven en un solo archivo (`types/ficha.ts`) y todos lo importan.
- Campos numéricos que no puedan observarse (`cajas`, `m2_estimados`, `gondolas`, `share_frentes_pct`, `marcas`) aceptan `null`; `tamano` admite `desconocido`. `limitaciones` es un campo obligatorio de texto para evitar presentar una estimación como certeza. `le_falta` sólo contiene ausencias respaldadas; los productos a confirmar pueden aparecer en `ofrecer_primero` con su argumento. Máximo tres ofertas. El NSE es una hipótesis comercial agregada, no información personal de los clientes.
- Gemini se llama mediante el SDK oficial `@google/genai`, exclusivamente en servidor. La clave se configura en `GEMINI_API_KEY`; el modelo se elige con `GEMINI_MODEL`. Se registran `modelo` y `prompt_version`.

**Cómo llamar a la IA desde las rutas (Feli → Tomi).** Todo vive en `lib/ai` (solo servidor, modelo Gemini) y no toca Supabase: la ruta baja las fotos y pasa los bytes. `lib/db/api.ts` usa `analizarConGemini(ctx)` y `conversarConGemini(ctx, ficha, mensajes)` de `lib/ai/gemini.ts`, que traducen el contexto de Supabase a estas funciones:

```ts
analizarFotos({ fotos, audios?, catalogo })        // → { ficha, modelo, promptVersion }  (lanza FichaInvalidaError si no valida tras 1 reintento)
responderChat({ ficha, fotos?, historial?, mensaje, catalogo })
  // mensaje: string | { mimeType, data }   (texto o nota de voz)
  // → { respuesta, transcripcion? }        (transcripcion solo si fue audio: es lo que se guarda en mensajes.contenido)
// fotos: { tipo: 'fachada'|'gondola'|'extra', mimeType, data: Buffer }[]   catalogo: filas de productos_lv
```

- Las notas de voz son opcionales y suman contexto; el audio no se guarda en Storage (si se quiere guardar, hay que sumarlo al §3).
- Modelos: `GEMINI_MODEL` (recomendado `gemini-3.5-flash`, ~5 s por ficha; `gemini-3.8-flash` tardó >100 s por saturación) y opcional `GEMINI_MODEL_RESPALDO` (por defecto `gemini-3.1-flash-lite`). Si el principal falla por saturación o timeout se usa el de respaldo; `modelo` en el resultado dice cuál respondió. Si la ficha no valida, se reintenta una vez pasándole los errores al modelo.

## 5. Rutas API (Next.js, contrato Tomi ↔ Agus)

| Método | Ruta | Quién | Hace |
|---|---|---|---|
| POST | `/api/comercios` | vendedor | Crea comercio (nombre, dirección, lat/lng) |
| POST | `/api/visitas` | vendedor | Crea visita para un comercio → `{ visita_id }` |
| POST | `/api/visitas/:id/fotos` | vendedor | Registra fotos ya subidas a Storage |
| POST | `/api/visitas/:id/analizar` | vendedor | Llama a la IA con las fotos → guarda y devuelve la ficha |
| POST | `/api/visitas/:id/chat` | vendedor | Repregunta con la ficha + fotos como contexto |
| GET | `/api/mapa` | vendedor/admin | Comercios + última ficha (admin recibe más campos) |
| GET | `/api/metricas` | admin | Agregados para el dashboard |
| GET | `/api/auth/session` | autenticado | Usuario y perfil real de Supabase |
| POST | `/api/auth/login` | público | Login con email y contraseña; establece cookies |
| POST | `/api/auth/logout` | autenticado | Cierra la sesión real |
| GET/PATCH | `/api/equipo` | admin | Lista perfiles / habilita o bloquea un vendedor |
| GET | `/api/productos` | autenticado | Catálogo activo |
| GET | `/api/comercios` | autenticado | Comercios visibles y resumen para selector |
| GET | `/api/visitas` | autenticado | Historial autorizado |
| PATCH | `/api/auth/profile` | autenticado | Actualiza únicamente el nombre propio |

Las rutas reciben nombres de campos en español y devuelven errores JSON con estado HTTP. `/api/mapa` entrega únicamente datos básicos a vendedores; las fichas, argumentos y competencia de otras visitas se reservan al admin. Los supervisores del prototipo se representan como admin en este contrato de dos roles.

`/api/visitas/:id/analizar` recibe `{request_id}`; el servidor carga sus fotos y catálogo, valida la salida y llama a `guardar_ficha`. Un reintento devuelve la ficha existente sin duplicarla. Para una nueva evaluación se crea una nueva visita. `/api/visitas/:id/chat` recibe `{contenido,request_id}` y guarda mensajes; sólo el servidor escribe como assistant.

No hay respuestas de IA ni usuarios simulados como fallback: si faltan credenciales se informa la configuración pendiente. Los datos DEMO siguen identificados como tales. El primer flujo integrado usa fotografías JPEG/PNG/WebP; video/audio requieren un flujo de captura y validación adicional.

La API key del modelo **sólo** vive en el servidor (rutas API). Nunca en el cliente.

## 6. Repo y forma de trabajo

```
app/            páginas (chat, mapa, dashboard, login) + app/api/*
lib/db/         funciones Supabase (Tomi)
lib/ai/         prompt + llamada al modelo + validación (Feli)
types/          tipos compartidos (ficha, db)
supabase/       migraciones SQL + seed (Lauti)
docs/           este contrato
```

- `main` siempre deployable (Vercel deploya `main`). Cada uno trabaja en su rama: `front/...`, `db/...`, `api/...`, `ai/...`.
- PR chico → lo revisa/mergea el integrador. Mergear seguido (cada 1–2 h), no al final.
- Variables (`.env.local`, nunca commitear; mismas en Vercel):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`. Se aceptan `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `AI_API_KEY` como alias para instalaciones existentes. La publishable key identifica la aplicación; la identidad y los permisos del usuario provienen de su sesión y perfil.
- Tipos de la DB generados con `supabase gen types typescript` → `types/db.ts` cada vez que Lauti cambia el esquema.

## 7. Checkpoints de integración

1. **Contrato cerrado**: todos aprobaron §3 y §4.
2. **Camino feliz con mocks**: el front muestra una ficha falsa (JSON de §4) en el chat y comercios falsos en el mapa.
3. **IA sola**: Feli corre el prompt con 3 juegos de fotos reales y devuelve fichas válidas.
4. **Punta a punta**: fotos → Storage → analizar → ficha en DB → aparece en el mapa.
5. **Dashboard** con datos semilla (10–15 comercios).
6. **Ensayo de demo** con un comercio real de principio a fin.
