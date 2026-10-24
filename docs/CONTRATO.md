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

## 3. Esquema de datos (propuesta para Lauti)

```
profiles      (id = auth.users.id, nombre, rol: 'vendedor'|'admin', created_at)
comercios     (id, nombre, direccion, lat, lng, creado_por → profiles, created_at)
visitas       (id, comercio_id → comercios, vendedor_id → profiles, created_at)
fotos         (id, visita_id → visitas, tipo: 'fachada'|'gondola'|'extra', storage_path, created_at)
fichas        (id, visita_id → visitas UNIQUE, formato, nse, categoria, data jsonb,
               modelo, prompt_version, created_at)
mensajes      (id, visita_id → visitas, rol: 'user'|'assistant', contenido, created_at)
productos_lv  (id, marca, nombre, categoria, subcategoria, presentacion, detalles,
               formatos_objetivo text[], nse_objetivo text[])
```

- `productos_lv` se carga desde el catálogo oficial del grupo (63 productos de La Virginia, Alicante, Virgin Islands, Litoral, Chocolino, Tuy y Giacomo). `id` es el código del catálogo (`LAV-001`, `ALI-006`…). `marca`, `subcategoria` y `detalles` vienen del catálogo; `formatos_objetivo` y `nse_objetivo` son estimación nuestra y hoy están en `lib/ai/catalogo.ts` (`catalogoDemo`), que sirve de fuente para el seed.

- **Comercio ≠ visita.** Un comercio tiene muchas visitas; cada visita tiene sus fotos, su ficha y su chat. Eso nos da el "historial por comercio" del PLUS gratis.
- `fichas.formato`, `fichas.nse` y `fichas.categoria` se duplican como columnas (además de `data`) para que el dashboard y el mapa filtren sin leer el JSON.
- `modelo` + `prompt_version` = trazabilidad: sabemos qué versión del prompt generó cada ficha.
- Fotos en Storage, bucket `fotos`, ruta `{comercio_id}/{visita_id}/{tipo}-{n}.jpg`. En la DB sólo guardamos el path.
- Vista para el mapa: `v_comercios_ultima_ficha` (comercio + datos de su última ficha).

**RLS (permisos)**
- Vendedor: lee todos los comercios con `nombre, lat, lng, formato, nse` (mapa); lee/escribe sólo **sus** visitas, fotos y mensajes.
- Admin: lee todo. El dashboard sólo lo ve admin (se chequea en el front **y** en la RLS/ruta).

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

**Cómo llamar a la IA desde las rutas (Feli → Tomi).** Todo se importa de `lib/ai` (solo servidor, modelo Gemini). No toca Supabase: la ruta baja las fotos/audios y pasa los bytes.

```ts
analizarFotos({ fotos, audios?, catalogo })        // → { ficha, modelo, promptVersion }  (lanza FichaInvalidaError si no valida tras 1 reintento)
responderChat({ ficha, fotos?, historial?, mensaje, catalogo })
  // mensaje: string | { mimeType, data }   (texto o nota de voz)
  // → { respuesta, transcripcion? }        (transcripcion solo si fue audio: es lo que se guarda en mensajes.contenido)
// fotos: { tipo: 'fachada'|'gondola'|'extra', mimeType, data: Buffer }[]   catalogo: filas de productos_lv
```

- Las notas de voz son opcionales y suman contexto; el audio no se guarda en Storage (si se quiere guardar, hay que sumarlo al §3).
- Variables opcionales `AI_MODEL` y `AI_MODEL_RESPALDO` para cambiar los modelos de Gemini sin tocar código (por defecto `gemini-3.5-flash` y `gemini-3.1-flash-lite`). Si el principal falla por saturación o timeout se usa el de respaldo; `modelo` en el resultado dice cuál respondió.

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
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`.
- Tipos de la DB generados con `supabase gen types typescript` → `types/db.ts` cada vez que Lauti cambia el esquema.

## 7. Checkpoints de integración

1. **Contrato cerrado**: todos aprobaron §3 y §4.
2. **Camino feliz con mocks**: el front muestra una ficha falsa (JSON de §4) en el chat y comercios falsos en el mapa.
3. **IA sola**: Feli corre el prompt con 3 juegos de fotos reales y devuelve fichas válidas.
4. **Punta a punta**: fotos → Storage → analizar → ficha en DB → aparece en el mapa.
5. **Dashboard** con datos semilla (10–15 comercios).
6. **Ensayo de demo** con un comercio real de principio a fin.
