import "server-only"
import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai"

// Se puede cambiar sin tocar código con AI_MODEL / AI_MODEL_RESPALDO (opcionales).
// Medido con fotos reales: gemini-3.5-flash ~5 s; gemini-3.8-flash >100 s por saturación.
export const MODELO = process.env.AI_MODEL || "gemini-3.5-flash"
export const MODELO_RESPALDO = process.env.AI_MODEL_RESPALDO || "gemini-3.1-flash-lite"

let cliente: GoogleGenAI | null = null

export function getGemini() {
  if (!cliente) {
    const apiKey = process.env.AI_API_KEY
    if (!apiKey) throw new Error("Falta AI_API_KEY en las variables de entorno")
    cliente = new GoogleGenAI({
      apiKey,
      // Corta cada intento a los 45 s y reintenta 408, 429 y 5xx (ej. 503 "high demand") una vez.
      httpOptions: { timeout: 45_000, retryOptions: { attempts: 2, initialDelay: 2, maxDelay: 5 } },
    })
  }
  return cliente
}

// Errores del pedido (400, 401, 403, 404) no se arreglan cambiando de modelo; el resto (saturación, timeout, red) sí.
function convieneRespaldo(error: unknown) {
  return !(error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429)
}

/**
 * Llama al modelo principal y, si falla por saturación o timeout, al de respaldo.
 * Devuelve qué modelo respondió, para guardarlo en fichas.modelo.
 */
export async function generar(params: Omit<GenerateContentParameters, "model">): Promise<{ respuesta: GenerateContentResponse; modelo: string }> {
  // Razonamiento bajo: con más "thinking" la ficha no mejora y tarda mucho más.
  const config = { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, ...params.config }
  try {
    return { respuesta: await getGemini().models.generateContent({ ...params, config, model: MODELO }), modelo: MODELO }
  } catch (error) {
    if (!convieneRespaldo(error) || MODELO_RESPALDO === MODELO) throw error
    console.warn(`${MODELO} falló (${error instanceof Error ? error.message.slice(0, 80) : error}), uso ${MODELO_RESPALDO}`)
    return { respuesta: await getGemini().models.generateContent({ ...params, config, model: MODELO_RESPALDO }), modelo: MODELO_RESPALDO }
  }
}
