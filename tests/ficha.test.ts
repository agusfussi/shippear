import assert from "node:assert/strict"
import test from "node:test"
import { validarFicha } from "../types/ficha"

const catalogo = [{ nombre: "Café DEMO 250 g" }, { nombre: "Té DEMO 25 saquitos" }]
const fixture = () => ({
  formato: { tipo: "autoservicio", tamano: "desconocido", cajas: 2, m2_estimados: null, gondolas: null },
  nse: { nivel: "medio", senales: ["Marcas de distintas gamas visibles en la góndola"] },
  surtido: { tiene: [], le_falta: [] },
  ofrecer_primero: [{ producto: "Café DEMO 250 g", argumento: "Probar una presentación pequeña; confirmar faltantes con el vendedor" }],
  categoria: { valor: "estandar", motivo: "Surtido mixto con señales compatibles" },
  competencia: { marcas: null, share_frentes_pct: null, promos: [] },
  confianza: .6, limitaciones: "Una imagen no permite medir el stock total",
})
test("acepta mediciones desconocidas sin inventar cifras", () => { assert.equal(validarFicha(fixture(), catalogo).competencia.marcas, null) })
test("rechaza productos inexistentes", () => { const f=fixture();f.ofrecer_primero[0].producto="Inventado";assert.throws(()=>validarFicha(f,catalogo),/catálogo/) })
test("rechaza categoría contradictoria con NSE", () => { const f=fixture();f.nse.nivel="alto";f.categoria.valor="basico";assert.throws(()=>validarFicha(f,catalogo),/incompatible/) })
test("rechaza más de tres ofertas", () => { const f=fixture();f.ofrecer_primero=Array(4).fill(f.ofrecer_primero[0]);assert.throws(()=>validarFicha(f,catalogo)) })
test("rechaza ofertas duplicadas", () => { const f=fixture();f.ofrecer_primero.push(f.ofrecer_primero[0]);assert.throws(()=>validarFicha(f,catalogo),/repetido/) })
test("exige señales y limitaciones", () => { const f=fixture();f.nse.senales=[];f.limitaciones="";assert.throws(()=>validarFicha(f,catalogo)) })
test("rechaza confianza fuera de rango y campos inesperados", () => { assert.throws(()=>validarFicha({...fixture(),confianza:1.5,sql:"drop table"},catalogo)) })
