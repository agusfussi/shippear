// Prueba la IA sola, sin Supabase ni front (checkpoint 3 del contrato).
//
// Uso:
//   npm run probar-ia -- <carpeta> [--chat "pregunta"] [--chat-audio <archivo>]
//
// La carpeta tiene archivos nombrados por tipo:
//   fachada-1.jpg, gondola-1.jpg, gondola-2.png, extra-1.jpg  → fotos
//   audio-1.m4a, audio-2.ogg                                  → notas de voz (opcionales)
//   cualquier otra imagen                                     → foto "extra"

import { readdirSync, readFileSync } from "node:fs"
import { extname, join } from "node:path"
import { analizarFotos, catalogoDemo, responderChat, type AudioEntrada, type FotoEntrada, type TipoFoto } from "../lib/ai"

const mimePorExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
}

function leerArchivo(ruta: string) {
  const mimeType = mimePorExtension[extname(ruta).toLowerCase()]
  if (!mimeType) throw new Error(`Extensión no soportada: ${ruta}`)
  return { mimeType, data: readFileSync(ruta) }
}

function leerArgumento(nombre: string) {
  const i = process.argv.indexOf(nombre)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const carpeta = process.argv[2]
  if (!carpeta || carpeta.startsWith("--")) {
    console.error('Uso: npm run probar-ia -- <carpeta> [--chat "pregunta"] [--chat-audio <archivo>]')
    process.exit(1)
  }

  const fotos: FotoEntrada[] = []
  const audios: AudioEntrada[] = []
  for (const nombre of readdirSync(carpeta).sort()) {
    const tipo = nombre.split("-")[0].toLowerCase()
    if (tipo === "fachada" || tipo === "gondola" || tipo === "extra") {
      fotos.push({ tipo: tipo as TipoFoto, ...leerArchivo(join(carpeta, nombre)) })
    } else if (tipo === "audio") {
      audios.push(leerArchivo(join(carpeta, nombre)))
    } else if (mimePorExtension[extname(nombre).toLowerCase()]?.startsWith("image/")) {
      // Fotos sin prefijo (ej. "WhatsApp Image ...jpeg"): van como extra.
      fotos.push({ tipo: "extra", ...leerArchivo(join(carpeta, nombre)) })
    }
  }
  console.log(`📷 ${fotos.length} fotos, 🎙️ ${audios.length} notas de voz`)

  const inicio = Date.now()
  const { ficha, modelo, promptVersion } = await analizarFotos({ fotos, audios, catalogo: catalogoDemo })
  console.log(`✅ Ficha válida en ${((Date.now() - inicio) / 1000).toFixed(1)} s (${modelo}, prompt ${promptVersion})\n`)
  console.log(JSON.stringify(ficha, null, 2))

  const pregunta = leerArgumento("--chat")
  const audioChat = leerArgumento("--chat-audio")
  if (pregunta || audioChat) {
    const mensaje = audioChat ? leerArchivo(audioChat) : pregunta!
    const { respuesta, transcripcion } = await responderChat({ ficha, fotos, mensaje, catalogo: catalogoDemo })
    if (transcripcion) console.log(`\n🎙️ Transcripción: ${transcripcion}`)
    console.log(`\n💬 ${respuesta}`)
  }
}

main().catch((error) => {
  console.error("❌", error instanceof Error ? error.message : error)
  process.exit(1)
})
