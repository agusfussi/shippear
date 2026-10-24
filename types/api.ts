import type { Ficha } from "./ficha"

export type AppUser = { id: string; email: string; name: string; role: "admin" | "seller"; active: boolean }
export type MapStore = { id: string; nombre: string; direccion: string | null; lat: number | null; lng: number | null; formato: string | null; nse: string | null; es_demo: boolean; categoria?: string | null; ficha?: Ficha | null; visita_id?: string | null; fecha_visita?: string | null; visitas?: number }
export type VisitSummary = { id: string; comercio_id: string; fecha_visita: string; notas: string | null; comercios: { nombre: string } | null }
