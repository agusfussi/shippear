import { z } from "zod"

export const formatoSchema = z.enum(["almacen", "autoservicio", "kiosco", "despensa", "cafeteria", "otro"])
export const fichaSchema = z.object({
  formato: z.object({ tipo: formatoSchema, tamano: z.enum(["chico", "mediano", "grande", "desconocido"]), cajas: z.number().int().nonnegative().nullable(), m2_estimados: z.number().positive().nullable(), gondolas: z.number().int().nonnegative().nullable() }),
  nse: z.object({ nivel: z.enum(["bajo", "medio", "alto"]), senales: z.array(z.string().min(1).max(1000)).min(1).max(30) }),
  surtido: z.object({ tiene: z.array(z.string().min(1)).max(100), le_falta: z.array(z.string().min(1)).max(100) }),
  ofrecer_primero: z.array(z.object({ producto: z.string().min(1), argumento: z.string().min(1).max(2000) })).max(3),
  categoria: z.object({ valor: z.enum(["premium", "estandar", "basico"]), motivo: z.string().min(1).max(2000) }),
  competencia: z.object({ marcas: z.number().int().nonnegative().nullable(), share_frentes_pct: z.number().min(0).max(100).nullable(), promos: z.array(z.string().max(1000)).max(30) }),
  confianza: z.number().min(0).max(1),
  limitaciones: z.string().min(1).max(4000),
}).strict()

export type Ficha = z.infer<typeof fichaSchema>

export function validarFicha(input: unknown, catalogo: { nombre: string }[]): Ficha {
  const ficha = fichaSchema.parse(input)
  if ((ficha.nse.nivel === "alto" && ficha.categoria.valor === "basico") || (ficha.nse.nivel === "bajo" && ficha.categoria.valor === "premium")) throw new Error("Categoría incompatible con el NSE")
  const nombres = new Set(catalogo.map(p => p.nombre))
  for (const nombre of [...ficha.surtido.tiene, ...ficha.surtido.le_falta, ...ficha.ofrecer_primero.map(p => p.producto)]) {
    if (!nombres.has(nombre)) throw new Error("Producto fuera del catálogo")
  }
  if (new Set(ficha.ofrecer_primero.map(p => p.producto)).size !== ficha.ofrecer_primero.length) throw new Error("Producto recomendado repetido")
  return ficha
}

export type FormatoTipo = z.infer<typeof formatoSchema>
export type NseNivel = Ficha["nse"]["nivel"]
