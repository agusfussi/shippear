import { NextResponse } from "next/server"
import { z } from "zod"

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie" } })
}
export async function endpoint(action: () => Promise<unknown>) {
  try { return json(await action()) } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status)
    if (error instanceof z.ZodError) return json({ error: "Datos inválidos", campos: error.issues.map(i => i.path.join(".")) }, 400)
    return json({ error: "No se pudo completar la operación. Revisá la configuración del servidor." }, 500)
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Origen no autorizado")
}
export async function body<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  sameOrigin(request)
  if (Number(request.headers.get("content-length") || 0) > 100000) throw new ApiError(413, "Solicitud demasiado grande")
  let raw = ""
  if (request.body) {
    const reader = request.body.getReader()
    const decoder = new TextDecoder()
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 100000) { await reader.cancel(); throw new ApiError(413, "Solicitud demasiado grande") }
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
  }
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new ApiError(400, "Se esperaba JSON válido") }
  return schema.parse(value)
}
export function dbResult<T>(result: { data: T; error: { code?: string; message?: string } | null }): T {
  if (result.error) throw new ApiError(result.error.code === "42501" ? 403 : result.error.code === "23505" ? 409 : 500, "No se pudo guardar o consultar el registro")
  return result.data
}
