import "server-only"
import type { Ficha } from "../../types/ficha"
import { analizarFotos } from "./analizar"
import { catalogoDemo, type ProductoLV } from "./catalogo"
import { responderChat, type MensajeHistorial } from "./chat"
import type { NseNivel, FormatoTipo } from "../../types/ficha"
import type { TipoFoto } from "./tipos"

// Punto de entrada que usan las rutas (lib/db/api.ts). Traduce el contexto de Supabase
// a las funciones de lib/ai (analizarFotos / responderChat).

export { PROMPT_VERSION } from "./prompt"

export type FotoIA = { mimeType: string; data: string; tipo?: TipoFoto }
export type ProductoIA = {
  nombre: string
  categoria: string
  presentacion: string
  gama: string
  es_demo: boolean
  sku?: string | null
  formatos_objetivo?: string[]
  nse_objetivo?: string[]
}
export type ContextoIA = {
  comercio: { nombre: string; direccion: string | null }
  notas: string | null
  productos: ProductoIA[]
  fotos: FotoIA[]
}

// Si ya está cargado el catálogo oficial, la IA no ve los productos DEMO.
// Completa cada producto con marca, subcategoría y detalles del catálogo oficial (si lo encuentra).
function aCatalogo(productos: ProductoIA[]): ProductoLV[] {
  const oficiales = productos.filter((p) => !p.es_demo)
  return (oficiales.length > 0 ? oficiales : productos).map((p) => {
    const oficial = catalogoDemo.find((c) => c.id === p.sku || c.nombre === p.nombre)
    return {
      id: p.sku || p.nombre,
      marca: oficial?.marca,
      nombre: p.nombre,
      categoria: p.categoria,
      subcategoria: oficial?.subcategoria,
      presentacion: p.presentacion,
      detalles: [oficial?.detalles, p.es_demo ? "DEMO: producto de prueba, no oficial" : undefined].filter(Boolean).join(". ") || undefined,
      formatos_objetivo: p.formatos_objetivo?.length ? (p.formatos_objetivo as FormatoTipo[]) : oficial?.formatos_objetivo ?? [],
      nse_objetivo: p.nse_objetivo?.length ? (p.nse_objetivo as NseNivel[]) : oficial?.nse_objetivo ?? [],
    }
  })
}

function aContexto(ctx: ContextoIA) {
  return [
    `Comercio: ${ctx.comercio.nombre}${ctx.comercio.direccion ? `, ${ctx.comercio.direccion}` : ""}`,
    ctx.notas ? `Notas del vendedor: ${ctx.notas}` : undefined,
  ]
    .filter(Boolean)
    .join("\n")
}

function aFotos(fotos: FotoIA[]) {
  return fotos.map((f) => ({ tipo: f.tipo ?? ("extra" as const), mimeType: f.mimeType, data: Buffer.from(f.data, "base64") }))
}

export async function analizarConGemini(ctx: ContextoIA) {
  return analizarFotos({ fotos: aFotos(ctx.fotos), catalogo: aCatalogo(ctx.productos), contexto: aContexto(ctx) })
}

export async function conversarConGemini(ctx: ContextoIA, ficha: Ficha, mensajes: { rol: string; contenido: string }[]) {
  const historial: MensajeHistorial[] = mensajes.map((m) => ({ rol: m.rol === "assistant" ? "assistant" : "user", contenido: m.contenido }))
  const ultimo = historial.pop()
  if (!ultimo || ultimo.rol !== "user") throw new Error("No hay pregunta del vendedor para responder")
  const { respuesta } = await responderChat({ ficha, fotos: aFotos(ctx.fotos), historial, mensaje: ultimo.contenido, catalogo: aCatalogo(ctx.productos) })
  if (respuesta.length > 20000) throw new Error("Respuesta demasiado larga")
  return respuesta
}
