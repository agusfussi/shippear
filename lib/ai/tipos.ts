// Entradas que recibe la capa de IA. Las rutas de app/api/* bajan los archivos de Storage
// (o los reciben del front) y los pasan acá como bytes.

export type TipoFoto = "fachada" | "gondola" | "extra"

export type FotoEntrada = {
  tipo: TipoFoto
  mimeType: string
  data: Buffer
}

export type AudioEntrada = {
  mimeType: string
  data: Buffer
}

export const mimeTypesImagen = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
export const mimeTypesAudio = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/wav", "audio/mp4", "audio/aac", "audio/flac"]

// Gemini acepta hasta ~20 MB por request con archivos inline. Dejamos margen para el prompt.
export const MAX_BYTES_INLINE = 18 * 1024 * 1024

export class EntradaInvalidaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EntradaInvalidaError"
  }
}

// Saca parámetros como "audio/webm;codecs=opus", que es lo que manda MediaRecorder en el navegador.
function mimeBase(mimeType: string) {
  return mimeType.split(";")[0].trim().toLowerCase()
}

export function validarEntradas(fotos: FotoEntrada[], audios: AudioEntrada[]) {
  for (const foto of fotos) {
    if (!mimeTypesImagen.includes(mimeBase(foto.mimeType))) {
      throw new EntradaInvalidaError(`Formato de imagen no soportado: ${foto.mimeType}`)
    }
  }
  for (const audio of audios) {
    if (!mimeTypesAudio.includes(mimeBase(audio.mimeType))) {
      throw new EntradaInvalidaError(`Formato de audio no soportado: ${audio.mimeType}`)
    }
  }
  const total = [...fotos, ...audios].reduce((suma, archivo) => suma + archivo.data.length, 0)
  if (total > MAX_BYTES_INLINE) {
    throw new EntradaInvalidaError(`Los archivos pesan ${(total / 1024 / 1024).toFixed(1)} MB; el máximo es 18 MB por análisis`)
  }
}

export function aInlineData(archivo: { mimeType: string; data: Buffer }) {
  return { inlineData: { mimeType: mimeBase(archivo.mimeType), data: archivo.data.toString("base64") } }
}
