import "server-only"
import { z } from "zod"
import type { Content, Part } from "@google/genai"
import type { Ficha } from "../../types/ficha"
import type { ProductoLV } from "./catalogo"
import { generar } from "./cliente"
import { armarPromptChat, PROMPT_TRANSCRIPCION } from "./prompt"
import { aInlineData, validarEntradas, type AudioEntrada, type FotoEntrada } from "./tipos"

// Mismo formato que la tabla mensajes (docs/CONTRATO.md §3).
export type MensajeHistorial = {
  rol: "user" | "assistant"
  contenido: string
}

export type RespuestaChat = {
  respuesta: string
  // Solo viene si el mensaje fue una nota de voz. Es lo que se guarda en mensajes.contenido.
  transcripcion?: string
}

const respuestaAudioSchema = z.object({
  transcripcion: z.string(),
  respuesta: z.string().min(1),
})
const respuestaAudioJsonSchema: Record<string, unknown> = { ...z.toJSONSchema(respuestaAudioSchema) }
delete respuestaAudioJsonSchema.$schema

/**
 * Responde una repregunta del vendedor (texto o nota de voz) con la ficha y las fotos como contexto.
 */
export async function responderChat({
  ficha,
  fotos = [],
  historial = [],
  mensaje,
  catalogo,
}: {
  ficha: Ficha
  fotos?: FotoEntrada[]
  historial?: MensajeHistorial[]
  mensaje: string | AudioEntrada
  catalogo: ProductoLV[]
}): Promise<RespuestaChat> {
  const esAudio = typeof mensaje !== "string"
  validarEntradas(fotos, esAudio ? [mensaje] : [])

  const contents: Content[] = historial.map((m) => ({
    role: m.rol === "assistant" ? "model" : "user",
    parts: [{ text: m.contenido }],
  }))

  // Las fotos van junto al mensaje actual para que el modelo las tenga a mano en cada repregunta.
  const partes: Part[] = []
  fotos.forEach((foto, i) => {
    partes.push({ text: `Foto ${i + 1} (${foto.tipo}):` }, aInlineData(foto))
  })
  partes.push(esAudio ? aInlineData(mensaje) : { text: mensaje })
  contents.push({ role: "user", parts: partes })

  const systemInstruction = armarPromptChat(ficha, catalogo) + (esAudio ? `\n\n${PROMPT_TRANSCRIPCION}` : "")
  const { respuesta } = await generar({
    contents,
    config: esAudio
      ? { systemInstruction, responseMimeType: "application/json", responseJsonSchema: respuestaAudioJsonSchema }
      : { systemInstruction },
  })

  const texto = respuesta.text ?? ""
  if (!esAudio) {
    if (!texto.trim()) throw new Error("La IA devolvió una respuesta vacía")
    return { respuesta: texto.trim() }
  }

  const resultado = respuestaAudioSchema.safeParse(JSON.parse(texto))
  if (!resultado.success) throw new Error("La IA no devolvió transcripción y respuesta válidas")
  return resultado.data
}
