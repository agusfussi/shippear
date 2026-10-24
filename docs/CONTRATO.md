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

El jurado evalúa lo que pide el PDF: **formato**, **nivel socioeconómico (NSE)**, **surtido ideal** y **qué ofrecer y cómo**.
"Premium / bajo nivel" se representa con `nse` (`bajo | medio | alto`). El color en el mapa sale de `nse`; la forma del pin, de `formato`.
Cada clasificación trae las **señales** que la justifican (eso es lo que hace creíble la demo).

## 3. Esquema de datos (propuesta para Lauti)

```
profiles      (id = auth.users.id, nombre, rol: 'vendedor'|'admin', created_at)
comercios     (id, nombre, direccion, lat, lng, creado_por → profiles, created_at)
visitas       (id, comercio_id → comercios, vendedor_id → profiles, created_at)
fotos         (id, visita_id → visitas, tipo: 'fachada'|'gondola'|'extra', storage_path, created_at)
fichas        (id, visita_id → visitas UNIQUE, formato, nse, data jsonb,
               modelo, prompt_version, created_at)
mensajes      (id, visita_id → visitas, rol: 'user'|'assistant', contenido, created_at)
productos_lv  (id, nombre, categoria, presentacion, formatos_objetivo text[], nse_objetivo text[])
```

- **Comercio ≠ visita.** Un comercio tiene muchas visitas; cada visita tiene sus fotos, su ficha y su chat. Eso nos da el "historial por comercio" del PLUS gratis.
- `fichas.formato` y `fichas.nse` se duplican como columnas (además de `data`) para que el dashboard y el mapa filtren sin leer el JSON.
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
  "competencia": { "marcas": 2, "share_frentes_pct": 70, "promos": ["2x1 visible en café torrado"] },
  "confianza": 0.8
}
```

- `formato.tipo` ∈ `almacen | autoservicio | kiosco | despensa | cafeteria | otro`
- `nse.nivel` ∈ `bajo | medio | alto`
- Los nombres de productos en `surtido` y `ofrecer_primero` **tienen que existir en `productos_lv`** (se pasa el catálogo en el prompt).
- Feli valida la respuesta con un schema (zod) antes de guardarla. Si no valida: se reintenta una vez y si falla se devuelve error, nunca se guarda una ficha rota.
- Los tipos TypeScript de esta ficha viven en un solo archivo (`types/ficha.ts`) y todos lo importan.

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
