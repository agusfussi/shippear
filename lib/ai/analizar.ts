import "server-only"
import { z } from "zod"
import type { Content, Part } from "@google/genai"
import { fichaBaseSchema, fichaSchema, type Ficha } from "../../types/ficha"
import type { ProductoLV } from "./catalogo"
import { generar } from "./gemini"
import { armarPromptFicha, PROMPT_VERSION } from "./prompt"
import { aInlineData, EntradaInvalidaError, validarEntradas, type AudioEntrada, type FotoEntrada } from "./tipos"

export class FichaInvalidaError extends Error {
  constructor(public errores: string[]) {
    super(`La IA no devolvió una ficha válida: ${errores.join("; ")}`)
    this.name = "FichaInvalidaError"
  }
}

export type ResultadoAnalisis = {
  ficha: Ficha
  modelo: string
  promptVersion: string
}

// Gemini no acepta la clave $schema en responseJsonSchema.
const { $schema: _ignorado, ...fichaJsonSchema } = z.toJSONSchema(fichaBaseSchema)

function armarPartes(fotos: FotoEntrada[], audios: AudioEntrada[]): Part[] {
  const partes: Part[] = []
  fotos.forEach((foto, i) => {
    partes.push({ text: `Foto ${i + 1} (${foto.tipo}):` }, aInlineData(foto))
  })
  audios.forEach((audio, i) => {
    partes.push({ text: `Nota de voz ${i + 1} del vendedor:` }, aInlineData(audio))
  })
  partes.push({ text: "Armá la ficha del local." })
  return partes
}

function validarRespuesta(texto: string, catalogo: ProductoLV[]): { ficha: Ficha } | { errores: string[] } {
  let json: unknown
  try {
    json = JSON.parse(texto)
  } catch {
    return { errores: ["La respuesta no es JSON válido"] }
  }

  const resultado = fichaSchema.safeParse(json)
  if (!resultado.success) {
    return { errores: resultado.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }
  }

  const ficha = resultado.data
  const nombres = new Set(catalogo.map((p) => p.nombre))
  const usados = [...ficha.surtido.tiene, ...ficha.surtido.le_falta, ...ficha.ofrecer_primero.map((o) => o.producto)]
  const inventados = usados.filter((nombre) => !nombres.has(nombre))
  if (inventados.length > 0) {
    return { errores: [`Productos que no están en el catálogo: ${[...new Set(inventados)].join(", ")}`] }
  }

  return { ficha }
}

/**
 * Analiza las fotos (y notas de voz opcionales) de una visita y devuelve la ficha validada.
 * Si la primera respuesta no valida, reintenta una vez con los errores. Si vuelve a fallar, lanza FichaInvalidaError.
 */
export async function analizarFotos({
  fotos,
  audios = [],
  catalogo,
}: {
  fotos: FotoEntrada[]
  audios?: AudioEntrada[]
  catalogo: ProductoLV[]
}): Promise<ResultadoAnalisis> {
  if (fotos.length === 0) throw new EntradaInvalidaError("Hace falta al menos una foto")
  if (catalogo.length === 0) throw new EntradaInvalidaError("El catálogo de productos está vacío")
  validarEntradas(fotos, audios)

  const contents: Content[] = [{ role: "user", parts: armarPartes(fotos, audios) }]
  let errores: string[] = []

  for (let intento = 0; intento < 2; intento++) {
    const { respuesta, modelo } = await generar({
      contents,
      config: {
        systemInstruction: armarPromptFicha(catalogo),
        responseMimeType: "application/json",
        responseJsonSchema: fichaJsonSchema,
        temperature: 0.2,
      },
    })

    const texto = respuesta.text ?? ""
    const validacion = validarRespuesta(texto, catalogo)
    if ("ficha" in validacion) {
      return { ficha: validacion.ficha, modelo, promptVersion: PROMPT_VERSION }
    }

    errores = validacion.errores
    contents.push(
      { role: "model", parts: [{ text: texto }] },
      { role: "user", parts: [{ text: `La ficha no es válida:\n- ${errores.join("\n- ")}\nCorregila y devolvé el JSON completo.` }] },
    )
  }

  throw new FichaInvalidaError(errores)
}
