import { z } from "zod"

// Contrato de la ficha del local (docs/CONTRATO.md §4). Todos importan de acá.

export const formatosTipo = ["almacen", "autoservicio", "kiosco", "despensa", "cafeteria", "otro"] as const
export const nseNiveles = ["bajo", "medio", "alto"] as const
export const categoriasCliente = ["premium", "estandar", "basico"] as const

// Schema sin refinamientos: es el que se convierte a JSON Schema para el modelo.
export const fichaBaseSchema = z.object({
  formato: z.object({
    tipo: z.enum(formatosTipo),
    tamano: z.string().min(1),
    cajas: z.number().int().min(0),
    m2_estimados: z.number().min(0),
    gondolas: z.number().int().min(0),
  }),
  nse: z.object({
    nivel: z.enum(nseNiveles),
    senales: z.array(z.string().min(1)).min(1),
  }),
  surtido: z.object({
    tiene: z.array(z.string().min(1)),
    le_falta: z.array(z.string().min(1)),
  }),
  ofrecer_primero: z
    .array(
      z.object({
        producto: z.string().min(1),
        argumento: z.string().min(1),
      }),
    )
    .min(1),
  categoria: z.object({
    valor: z.enum(categoriasCliente),
    motivo: z.string().min(1),
  }),
  competencia: z.object({
    marcas: z.number().int().min(0),
    share_frentes_pct: z.number().min(0).max(100),
    promos: z.array(z.string()),
  }),
  confianza: z.number().min(0).max(1),
})

// Regla de consistencia: NSE alto no puede ser básico y NSE bajo no puede ser premium.
export const fichaSchema = fichaBaseSchema.superRefine((ficha, ctx) => {
  if (ficha.nse.nivel === "alto" && ficha.categoria.valor === "basico") {
    ctx.addIssue({ code: "custom", path: ["categoria", "valor"], message: "NSE alto no puede tener categoría basico" })
  }
  if (ficha.nse.nivel === "bajo" && ficha.categoria.valor === "premium") {
    ctx.addIssue({ code: "custom", path: ["categoria", "valor"], message: "NSE bajo no puede tener categoría premium" })
  }
})

export type Ficha = z.infer<typeof fichaSchema>
export type FormatoTipo = (typeof formatosTipo)[number]
export type NseNivel = (typeof nseNiveles)[number]
export type CategoriaCliente = (typeof categoriasCliente)[number]
