"use client"
import { createBrowserClient } from "@supabase/ssr"
import type { TipoFoto } from "../ai/tipos"
import type { Database } from "../../types/db"
import { publicEnv } from "./env"

export type FotoSlotTipo = TipoFoto
export type ArchivoConTipo =
  | File
  | { file: File; tipo?: TipoFoto }
  | { archivo: File; tipo: TipoFoto }

export async function subirFotos(comercioId: string, visitaId: string, archivos: ArchivoConTipo[]) {
  const { url, key } = publicEnv()
  const client = createBrowserClient<Database>(url, key)
  const extensiones: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
  const items = archivos.map((entry) => {
    if (entry instanceof File) {
      return { file: entry, tipo: "gondola" as TipoFoto }
    }
    const file = "file" in entry && entry.file ? entry.file : (entry as { archivo: File }).archivo
    const tipo = entry.tipo ?? ("gondola" as TipoFoto)
    return { file, tipo }
  })
  if (items.length > 6 || items.reduce((sum, i) => sum + i.file.size, 0) > 12 * 1024 * 1024) throw new Error("Usá hasta 6 fotos y 12 MiB en total")
  const fotos: Array<{ tipo: TipoFoto; storage_path: string; mime_type: string; byte_size: number }> = []
  for (const { file: archivo, tipo } of items) {
    if (!extensiones[archivo.type] || archivo.size <= 0 || archivo.size > 10 * 1024 * 1024) throw new Error("Usá fotos JPEG, PNG o WebP de hasta 10 MiB")
    const storagePath = `${comercioId}/${visitaId}/${tipo}-${crypto.randomUUID()}.${extensiones[archivo.type]}`
    const { error } = await client.storage.from("fotos").upload(storagePath, archivo, { contentType: archivo.type, upsert: false })
    if (error) throw new Error("No se pudo subir una foto. Revisá tu sesión y conexión")
    fotos.push({ tipo, storage_path: storagePath, mime_type: archivo.type, byte_size: archivo.size })
  }
  return fotos
}
