export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || "No se pudo completar la operación")
  return result as T
}
export const post = <T>(path: string, value: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(value) })
