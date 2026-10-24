import "server-only"
import { z } from "zod"
import { analizarConGemini, conversarConGemini, type ContextoIA } from "../ai/gemini"
import { validarFicha } from "../../types/ficha"
import type { Json } from "../../types/db"
import { adminClient, authorizedVisit, context, userClient } from "./server"
import { ApiError, body, dbResult, endpoint, sameOrigin } from "./http"

const uuid = z.string().uuid()
const nombre = z.string().trim().min(1).max(200)
const idempotencia = z.object({ request_id: uuid })
const fotoSchema = z.object({ tipo: z.enum(["fachada", "gondola", "extra"]), storage_path: z.string().min(1).max(500), mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]), byte_size: z.number().int().positive().max(10485760) })

async function contenidoIA(visitaId: string) {
  const ctx = await authorizedVisit(visitaId)
  const [comercio, productos, fotos] = await Promise.all([
    ctx.client.from("comercios").select("nombre,direccion").eq("id", ctx.visit.comercio_id).single().then(dbResult),
    ctx.client.from("productos_lv").select("*").eq("activo", true).order("nombre").then(dbResult),
    ctx.client.from("fotos").select("*").eq("visita_id", visitaId).order("created_at").then(dbResult),
  ])
  if (!comercio) throw new ApiError(404, "Comercio no encontrado")
  if (!productos?.length) throw new ApiError(409, "El catálogo está vacío")
  if (!fotos?.length) throw new ApiError(400, "Subí al menos una foto de la visita")
  if (fotos.length > 6) throw new ApiError(400, "Usá hasta 6 fotos por visita")
  let totalBytes = 0
  const imagenes = []
  for (const foto of fotos) {
    const blob = dbResult(await ctx.client.storage.from("fotos").download(foto.storage_path))
    if (!blob) throw new ApiError(404, "No se encontró una foto")
    totalBytes += blob.size
    if (totalBytes > 12 * 1024 * 1024) throw new ApiError(413, "Las fotos superan 12 MiB; usá versiones más pequeñas")
    imagenes.push({ mimeType: foto.mime_type, data: Buffer.from(await blob.arrayBuffer()).toString("base64") })
  }
  const aiContext: ContextoIA = { comercio, productos, notas: ctx.visit.notas, fotos: imagenes }
  return { ...ctx, aiContext }
}

async function dispatch(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/$/, "")
  const method = request.method
  if (method !== "GET") sameOrigin(request)
  if (path === "/api/auth/login" && method === "POST") {
    const input = await body(request, z.object({ email: z.string().email(), password: z.string().min(1).max(200) }))
    const client = await userClient()
    const { error } = await client.auth.signInWithPassword(input)
    if (error) throw new ApiError(401, "Correo o contraseña incorrectos, o correo sin confirmar")
    return (await context()).session
  }
  if (path === "/api/auth/signup" && method === "POST") {
    const input = await body(request, z.object({ email: z.string().email(), password: z.string().min(8).max(200), nombre }))
    const client = await userClient()
    const { error } = await client.auth.signUp({ email: input.email, password: input.password, options: { data: { full_name: input.nombre } } })
    if (error) throw new ApiError(400, "No se pudo registrar la cuenta. Revisá los datos y la configuración de Auth")
    return { ok: true, mensaje: "Revisá tu correo para confirmar la cuenta antes de ingresar" }
  }
  if (path === "/api/auth/logout" && method === "POST") {
    const client = await userClient()
    await client.auth.signOut()
    return { ok: true }
  }
  if (path === "/api/auth/session" && method === "GET") return (await context()).session
  if (path === "/api/auth/profile" && method === "PATCH") {
    const { client, user } = await context()
    const input = await body(request, z.object({ nombre }))
    dbResult(await client.from("profiles").update(input).eq("id", user.id))
    return { ok: true }
  }
  if (path === "/api/comercios") {
    const { client, user } = await context()
    if (method === "GET") return dbResult(await client.from("comercios").select("id,nombre,direccion,lat,lng,es_demo").order("nombre").limit(500))
    if (method === "POST") {
      const input = await body(request, z.object({ nombre, direccion: z.string().max(500).nullable().optional(), lat: z.number().min(-90).max(90).nullable().optional(), lng: z.number().min(-180).max(180).nullable().optional() })
        .refine(v => (v.lat == null) === (v.lng == null), "Completá ambas coordenadas"))
      return dbResult(await client.from("comercios").insert({ ...input, vendedor_asignado: user.id }).select().single())
    }
  }
  if (path === "/api/visitas") {
    const { client, user } = await context()
    if (method === "GET") return dbResult(await client.from("visitas").select("id,comercio_id,fecha_visita,notas,comercios(nombre)").order("fecha_visita", { ascending: false }).limit(30))
    if (method === "POST") {
      const input = await body(request, z.object({ comercio_id: uuid, client_request_id: uuid, notas: z.string().max(10000).optional() }))
      const result = await client.from("visitas").insert(input).select().single()
      const visit = result.error?.code === "23505" ? dbResult(await client.from("visitas").select().eq("vendedor_id", user.id).eq("client_request_id", input.client_request_id).single()) : dbResult(result)
      if (visit && (visit.comercio_id !== input.comercio_id || (visit.notas || "") !== (input.notas || ""))) throw new ApiError(409, "La clave de reintento pertenece a otra visita")
      return { visita_id: visit!.id }
    }
  }
  if (path === "/api/productos" && method === "GET") {
    const { client } = await context()
    return dbResult(await client.from("productos_lv").select("*").eq("activo", true).order("nombre"))
  }
  if (path === "/api/mapa" && method === "GET") {
    const { client } = await context()
    return dbResult(await client.rpc("mapa_comercios"))
  }
  if (path === "/api/equipo") {
    const { client } = await context(true)
    if (method === "GET") return dbResult(await client.from("profiles").select("id,nombre,rol,activo").order("nombre"))
    if (method === "PATCH") {
      const input = await body(request, z.object({ id: uuid, activo: z.boolean() }))
      const target = dbResult(await client.from("profiles").select("rol").eq("id", input.id).maybeSingle())
      if (target?.rol !== "vendedor") throw new ApiError(400, "Sólo se puede modificar el acceso de vendedores")
      dbResult(await adminClient().from("profiles").update({ activo: input.activo }).eq("id", input.id).eq("rol", "vendedor"))
      return { ok: true }
    }
  }
  if (path === "/api/metricas" && method === "GET") {
    const { client } = await context(true)
    const [comercios, visitas, fichas] = await Promise.all([
      client.from("comercios").select("id,es_demo").then(dbResult),
      client.from("visitas").select("id,comercio_id,fecha_visita").then(dbResult),
      client.from("fichas").select("categoria,data,visita_id").then(dbResult),
    ])
    const offers = (fichas || []).reduce((sum, f) => sum + ((f.data as { ofrecer_primero?: unknown[] }).ofrecer_primero?.length || 0), 0)
    return { comercios: comercios?.length || 0, visitas: visitas?.length || 0, fichas: fichas?.length || 0, recomendaciones: offers,
      comercios_demo: comercios?.filter(c => c.es_demo).length || 0,
      categorias: Object.fromEntries(["premium", "estandar", "basico"].map(c => [c, fichas?.filter(f => f.categoria === c).length || 0])) }
  }
  const match = path.match(/^\/api\/visitas\/([^/]+)\/(fotos|analizar|chat|ficha)$/)
  if (match) {
    const id = uuid.parse(match[1])
    const ctx = await authorizedVisit(id)
    if (match[2] === "fotos" && method === "POST") {
      const input = await body(request, z.object({ fotos: z.array(fotoSchema).min(1).max(6) }))
      if (input.fotos.some(f => !f.storage_path.startsWith(`${ctx.visit.comercio_id}/${id}/`))) throw new ApiError(400, "Foto de otra visita")
      const existing = dbResult(await ctx.client.from("fotos").select().eq("visita_id", id).in("storage_path", input.fotos.map(f => f.storage_path))) || []
      const nuevas = input.fotos.filter(f => !existing.some(e => e.storage_path === f.storage_path))
      const saved = nuevas.length ? dbResult(await ctx.client.from("fotos").insert(nuevas.map(f => ({ ...f, visita_id: id }))).select()) || [] : []
      return [...existing, ...saved]
    }
    if (match[2] === "ficha" && method === "GET") return dbResult(await ctx.client.from("fichas").select().eq("visita_id", id).maybeSingle())
    if (match[2] === "analizar" && method === "POST") {
      const input = await body(request, idempotencia)
      const existing = dbResult(await ctx.client.from("fichas").select().eq("visita_id", id).maybeSingle())
      if (existing) return { ficha_id: existing.id, ficha: existing.data, reutilizada: true }
      const writer = adminClient()
      if (!(process.env.GEMINI_API_KEY || process.env.AI_API_KEY) || !process.env.GEMINI_MODEL) throw new ApiError(503, "Falta configurar Gemini en el servidor")
      const { aiContext } = await contenidoIA(id)
      let output
      try { output = await analizarConGemini(aiContext) } catch { throw new ApiError(502, "Gemini no pudo generar una ficha válida. Podés reintentar") }
      const result = await writer.rpc("guardar_ficha", { p_visita_id: id, p_request_id: input.request_id, p_data: output.ficha as Json, p_modelo: output.modelo, p_prompt_version: output.promptVersion })
      if (result.error?.code === "23505") {
        const concurrent = dbResult(await ctx.client.from("fichas").select().eq("visita_id", id).single())
        return { ficha_id: concurrent!.id, ficha: concurrent!.data, reutilizada: true }
      }
      return { ficha_id: dbResult(result), ficha: output.ficha, reutilizada: false }
    }
    if (match[2] === "chat") {
      if (method === "GET") return dbResult(await ctx.client.from("mensajes").select("rol,contenido,created_at").eq("visita_id", id).order("created_at").limit(100))
      if (method === "POST") {
        const input = await body(request, z.object({ contenido: z.string().trim().min(1).max(10000), request_id: uuid }))
        const writer = adminClient()
        if (!(process.env.GEMINI_API_KEY || process.env.AI_API_KEY) || !process.env.GEMINI_MODEL) throw new ApiError(503, "Falta configurar Gemini en el servidor")
        const previous = dbResult(await ctx.client.from("mensajes").select("contenido").eq("visita_id", id).eq("request_id", input.request_id).eq("rol", "user").maybeSingle())
        if (previous && previous.contenido !== input.contenido) throw new ApiError(409, "Clave de reintento usada con otro mensaje")
        const replay = dbResult(await ctx.client.from("mensajes").select("contenido").eq("visita_id", id).eq("request_id", input.request_id).eq("rol", "assistant").maybeSingle())
        if (replay) return replay
        const { aiContext } = await contenidoIA(id)
        const stored = dbResult(await ctx.client.from("fichas").select("data").eq("visita_id", id).maybeSingle())
        if (!stored) throw new ApiError(409, "Primero analizá la visita")
        if (!previous) dbResult(await ctx.client.from("mensajes").insert({ visita_id: id, rol: "user", contenido: input.contenido, request_id: input.request_id }))
        const messages = dbResult(await ctx.client.from("mensajes").select("rol,contenido").eq("visita_id", id).order("created_at", { ascending: false }).limit(20)) || []
        let respuesta
        try { respuesta = await conversarConGemini(aiContext, validarFicha(stored.data, aiContext.productos), messages.reverse()) } catch { throw new ApiError(502, "Gemini no pudo responder; reintentá el mensaje") }
        const result = await writer.from("mensajes").insert({ visita_id: id, rol: "assistant", contenido: respuesta, request_id: input.request_id })
        if (result.error?.code !== "23505") dbResult(result)
        const saved = dbResult(await ctx.client.from("mensajes").select("contenido").eq("visita_id", id).eq("rol", "assistant").eq("request_id", input.request_id).single())
        return saved
      }
    }
  }
  throw new ApiError(404, "Ruta no encontrada")
}
export function handleApi(request: Request) { return endpoint(() => dispatch(request)) }
