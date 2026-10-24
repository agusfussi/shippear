"use client"
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "../../types/db"
import { publicEnv } from "./env"

export type FotoSlotTipo = "fachada" | "gondola" | "extra"
export type ArchivoConTipo = File | { file: File; tipo?: FotoSlotTipo }

export async function subirFotos(comercioId: string, visitaId: string, archivos: ArchivoConTipo[]) {
  const { url, key } = publicEnv()
  const client = createBrowserClient<Database>(url, key)
  const extensiones: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }
  const items = archivos.map((entry) =>
    entry instanceof File ? { file: entry, tipo: "gondola" as FotoSlotTipo } : { file: entry.file, tipo: entry.tipo ?? ("gondola" as FotoSlotTipo) }
  )
  if (items.length > 6 || items.reduce((sum, i) => sum + i.file.size, 0) > 12 * 1024 * 1024) throw new Error("Usá hasta 6 fotos y 12 MiB en total")
  const fotos: Array<{ tipo: FotoSlotTipo; storage_path: string; mime_type: string; byte_size: number }> = []
  for (const { file: archivo, tipo } of items) {
    if (!extensiones[archivo.type] || archivo.size <= 0 || archivo.size > 10 * 1024 * 1024) throw new Error("Usá fotos JPEG, PNG o WebP de hasta 10 MiB")
    const storagePath = `${comercioId}/${visitaId}/${tipo}-${crypto.randomUUID()}.${extensiones[archivo.type]}`
    const { error } = await client.storage.from("fotos").upload(storagePath, archivo, { contentType: archivo.type, upsert: false })
    if (error) throw new Error("No se pudo subir una foto. Revisá tu sesión y conexión")
    fotos.push({ tipo, storage_path: storagePath, mime_type: archivo.type, byte_size: archivo.size })
  }
  return fotos
}
