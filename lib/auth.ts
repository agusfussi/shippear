import type { AppUser } from "../types/api"
import { api, post } from "./client-api"

export type UserRole = AppUser["role"]

export async function getSession(): Promise<AppUser | null> {
  const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
  if (response.status === 401 || response.status === 403) return null
  if (!response.ok) throw new Error("No se pudo verificar la sesión. Revisá la configuración de Supabase")
  return response.json()
}
export function signIn(email: string, password: string) { return post<AppUser>("/api/auth/login", { email, password }) }
export function signOut() { return post("/api/auth/logout", {}) }
export function signUp(nombre: string, email: string, password: string) { return post<{ mensaje: string }>("/api/auth/signup", { nombre, email, password }) }
export function updateName(nombre: string) { return api("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ nombre }) }) }
