import "server-only"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { Database } from "../../types/db"
import type { AppUser } from "../../types/api"
import { publicEnv } from "./env"
import { ApiError } from "./http"

export async function userClient() {
  const { url, key } = publicEnv()
  const store = await cookies()
  return createServerClient<Database>(url, key, { cookies: {
    getAll: () => store.getAll(),
    setAll: values => { for (const { name, value, options } of values) store.set(name, value, options) },
  } })
}
export function adminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new ApiError(503, "Falta configurar SUPABASE_SECRET_KEY en el servidor")
  return createClient<Database>(publicEnv().url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
}
export async function context(adminOnly = false) {
  const client = await userClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new ApiError(401, "Iniciá sesión para continuar")
  const { data: profile, error: profileError } = await client.from("profiles").select("id,nombre,rol,activo").eq("id", user.id).single()
  if (profileError || !profile?.activo) throw new ApiError(403, "Cuenta sin acceso habilitado")
  if (adminOnly && profile.rol !== "admin") throw new ApiError(403, "Se requiere rol administrador")
  const session: AppUser = { id: user.id, email: user.email || "", name: profile.nombre || user.email || "Usuario", role: profile.rol === "admin" ? "admin" : "seller", active: profile.activo }
  return { client, user, profile, session }
}
export async function authorizedVisit(id: string) {
  const ctx = await context()
  const { data: visit, error } = await ctx.client.from("visitas").select("*").eq("id", id).single()
  if (error || !visit) throw new ApiError(404, "Visita no encontrada")
  return { ...ctx, visit }
}
