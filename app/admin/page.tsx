"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CheckCircle2,
  Compass,
  Layers,
  LogOut,
  MapPin,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react"
import { getSession, signOut } from "../../lib/auth"
import { api } from "../../lib/client-api"
import type { MapStore } from "../../types/api"

const CoverageMap = dynamic(() => import("../map/customer-map"), { ssr: false })

type Metricas = {
  comercios: number
  visitas: number
  fichas: number
  recomendaciones: number
  comercios_demo: number
  categorias: Record<string, number>
}

type Persona = {
  id: string
  nombre: string
  rol: string
  activo: boolean
}

type Producto = {
  id: string
  nombre: string
  categoria: string
  presentacion: string
  gama: string
  es_demo: boolean
}

type AdminSection = "map" | "analytics" | "team" | "products"

const CATEGORIA_META: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  premium: {
    label: "Premium",
    color: "#2166f3",
    bg: "#e9f0ff",
    desc: "Alta rotación, potencial para línea completa y lanzamientos",
  },
  estandar: {
    label: "Estándar",
    color: "#14b8a6",
    bg: "#e6f9f6",
    desc: "Surtido troncal consolidado con espacio de expansión",
  },
  basico: {
    label: "Básico",
    color: "#f59e0b",
    bg: "#fef5e7",
    desc: "Foco en SKUs de entrada y alta rotación",
  },
}

const FORMATO_LABELS: Record<string, string> = {
  autoservicio: "Autoservicio",
  almacen: "Almacén",
  despensa: "Despensa",
  kiosco: "Kiosco",
  cafeteria: "Cafetería",
  otro: "Otro",
}

export default function AdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [section, setSection] = useState<AdminSection>("map")
  const [metrics, setMetrics] = useState<Metricas | null>(null)
  const [stores, setStores] = useState<MapStore[]>([])
  const [team, setTeam] = useState<Persona[]>([])
  const [products, setProducts] = useState<Producto[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSession()
      .then(async (u) => {
        if (!u) {
          router.replace("/login")
          return
        }
        if (u.role !== "admin") {
          router.replace("/")
          return
        }
        setReady(true)
        const [m, t, p, s] = await Promise.all([
          api<Metricas>("/api/metricas"),
          api<Persona[]>("/api/equipo"),
          api<Producto[]>("/api/productos"),
          api<MapStore[]>("/api/mapa"),
        ])
        setMetrics(m)
        setTeam(t)
        setProducts(p)
        setStores(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar el panel"))
  }, [router])

  async function toggle(p: Persona) {
    setBusy(true)
    setError("")
    try {
      await api("/api/equipo", {
        method: "PATCH",
        body: JSON.stringify({ id: p.id, activo: !p.activo }),
      })
      setTeam((t) => t.map((u) => (u.id === p.id ? { ...u, activo: !u.activo } : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setBusy(false)
    }
  }

  const insightsAndCharts = useMemo(() => {
    const formatoCounts: Record<string, number> = {}
    const nseCounts: Record<string, number> = { alto: 0, medio: 0, bajo: 0 }
    const missingCounts: Record<string, { nombre: string; count: number }> = {}
    const recommendedCounts: Record<string, { nombre: string; count: number }> = {}
    const highCompetitionStores: Array<{
      id: string
      nombre: string
      share: number
      marcas: number
      promos: string[]
    }> = []

    let analyzedStores = 0
    let totalShareSum = 0
    let shareSamples = 0

    for (const store of stores) {
      const fmt = store.formato || store.ficha?.formato.tipo || null
      if (fmt) {
        formatoCounts[fmt] = (formatoCounts[fmt] || 0) + 1
      }
      const nse = store.nse || store.ficha?.nse.nivel || null
      if (nse && nse in nseCounts) {
        nseCounts[nse] = (nseCounts[nse] || 0) + 1
      }

      const ficha = store.ficha
      if (!ficha) continue
      analyzedStores += 1

      for (const prodNombre of ficha.surtido.le_falta) {
        if (!missingCounts[prodNombre]) {
          missingCounts[prodNombre] = { nombre: prodNombre, count: 0 }
        }
        missingCounts[prodNombre].count += 1
      }

      for (const item of ficha.ofrecer_primero) {
        if (!recommendedCounts[item.producto]) {
          recommendedCounts[item.producto] = { nombre: item.producto, count: 0 }
        }
        recommendedCounts[item.producto].count += 1
      }

      const share = ficha.competencia.share_frentes_pct
      if (share !== null) {
        totalShareSum += share
        shareSamples += 1
        highCompetitionStores.push({
          id: store.id,
          nombre: store.nombre,
          share,
          marcas: ficha.competencia.marcas ?? 0,
          promos: ficha.competencia.promos,
        })
      }
    }

    const topMissing = Object.values(missingCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    const topRecommended = Object.values(recommendedCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    const topCompStores = highCompetitionStores
      .sort((a, b) => b.share - a.share)
      .slice(0, 4)

    const avgCompetitorShare =
      shareSamples > 0 ? Math.round(totalShareSum / shareSamples) : 0
    const highCompCount = highCompetitionStores.filter((s) => s.share >= 50).length

    const premiumCount =
      metrics?.categorias?.premium ??
      stores.filter((s) => (s.categoria || s.ficha?.categoria.valor) === "premium").length
    const estandarCount =
      metrics?.categorias?.estandar ??
      stores.filter((s) => (s.categoria || s.ficha?.categoria.valor) === "estandar").length
    const basicoCount =
      metrics?.categorias?.basico ??
      stores.filter((s) => (s.categoria || s.ficha?.categoria.valor) === "basico").length

    return {
      analyzedStores,
      formatoCounts,
      nseCounts,
      topMissing,
      topRecommended,
      topCompStores,
      avgCompetitorShare,
      highCompCount,
      premiumCount,
      estandarCount,
      basicoCount,
    }
  }, [stores, metrics])

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fc] px-4 text-[#17243a]">
        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : (
          <div className="flex items-center gap-3 text-sm font-semibold text-[#5b6b82]">
            <Sparkles size={18} className="animate-spin text-[#2166f3]" />
            Verificando acceso de administrador...
          </div>
        )}
      </main>
    )
  }

  const navItems: Array<{ key: AdminSection; label: string; icon: typeof MapPin }> = [
    { key: "map", label: "Mapa PDV", icon: MapPin },
    { key: "analytics", label: "Métricas & IA", icon: BarChart3 },
    { key: "team", label: "Equipo", icon: Users },
    { key: "products", label: "Catálogo LV", icon: Boxes },
  ]

  return (
    <main className="min-h-screen bg-[#f5f8fc] text-[#17243a]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#dce4ef] bg-white/95 px-3.5 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#2166f3] text-white shadow-[0_4px_12px_rgba(33,102,243,.25)]">
            <Sparkles size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight sm:text-lg">
                Shippe<span className="text-[#2166f3]">.AR</span> · Admin
              </h1>
              <span className="hidden rounded-full bg-[#e9f0ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2166f3] sm:inline-block">
                La Virginia
              </span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Perfil del Punto de Venta · Cobertura, fichas y foco comercial
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 text-xs font-semibold sm:gap-2.5 sm:text-sm">
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce4ef] bg-white px-2.5 text-[#17243a] hover:bg-[#f8fafd] sm:h-9 sm:px-3"
          >
            <Compass size={14} className="text-[#2166f3]" />
            <span>Nueva visita</span>
          </Link>
          <Link
            href="/settings"
            className="inline-flex h-8 items-center rounded-lg border border-[#dce4ef] bg-white px-2.5 text-[#5b6b82] hover:bg-[#f8fafd] sm:h-9 sm:px-3"
          >
            Cuenta
          </Link>
          <button
            type="button"
            onClick={async () => {
              try {
                await signOut()
                router.replace("/login")
              } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo cerrar sesión")
              }
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce4ef] bg-white px-2.5 text-[#718096] hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:h-9 sm:px-3"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </nav>
      </header>

      <div className="mx-auto max-w-[1360px] px-3 py-4 sm:px-6 sm:py-6">
        {/* Section Switcher */}
        <nav className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:mb-6">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {navItems.map(({ key, label, icon: Icon }) => {
              const active = section === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSection(key)}
                  className={
                    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 sm:py-2.5 sm:text-sm " +
                    (active
                      ? "bg-[#2166f3] text-white shadow-[0_6px_16px_rgba(33,102,243,.25)]"
                      : "border border-[#dce4ef] bg-white text-[#5b6b82] hover:text-[#17243a]")
                  }
                >
                  <Icon size={15} />
                  {label}
                </button>
              )
            })}
          </div>

          {metrics && (
            <div className="hidden items-center gap-2 rounded-xl border border-[#dce4ef] bg-white px-3 py-1.5 text-xs text-[#5b6b82] md:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                <b>{metrics.comercios}</b> PDVs · <b>{metrics.fichas}</b> fichas validadas
              </span>
            </div>
          )}
        </nav>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-700 sm:text-sm"
          >
            {error}
          </p>
        )}

        {/* SECTION: MAP */}
        {section === "map" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dce4ef] bg-white p-3.5 sm:px-5 sm:py-4">
              <div>
                <h2 className="text-base font-bold sm:text-lg">
                  Mapa de Cobertura y Categorización de PDVs
                </h2>
                <p className="text-xs text-[#718096]">
                  Pines coloreados por categoría de cliente (Premium, Estándar, Básico) y forma según formato comercial. Hacé clic en un local para inspeccionar su última ficha.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSection("analytics")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#e9f0ff] px-3 py-1.5 text-xs font-bold text-[#2166f3] hover:bg-[#dbe7ff]"
              >
                <Sparkles size={14} />
                Ver insights agénticos
              </button>
            </div>
            <CoverageMap embedded />
          </section>
        )}

        {/* SECTION: ANALYTICS & AGENTIC INSIGHTS */}
        {section === "analytics" && (
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">
                Métricas de Ejecución & Insights Agénticos
              </h2>
              <p className="mt-1 text-xs text-[#718096] sm:text-sm">
                Datos consolidados en tiempo real desde Supabase (`comercios`, `visitas`, `fichas`). Las recomendaciones reflejan oportunidades detectadas en góndola (`ofrecer_primero`), no ventas confirmadas.
              </p>
            </div>

            {metrics ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                  <div className="rounded-2xl border border-[#dce4ef] bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#718096]">
                      <span>Comercios PDV</span>
                      <Store size={16} className="text-[#2166f3]" />
                    </div>
                    <strong className="mt-2 block text-2xl font-extrabold sm:text-3xl">
                      {metrics.comercios}
                    </strong>
                    <span className="mt-1 block text-[11px] text-[#718096]">
                      {metrics.comercios_demo} de semilla DEMO
                    </span>
                  </div>

                  <div className="rounded-2xl border border-[#dce4ef] bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#718096]">
                      <span>Visitas relevadas</span>
                      <MapPin size={16} className="text-emerald-600" />
                    </div>
                    <strong className="mt-2 block text-2xl font-extrabold sm:text-3xl">
                      {metrics.visitas}
                    </strong>
                    <span className="mt-1 block text-[11px] text-[#718096]">
                      Historial auditable por vendedor
                    </span>
                  </div>

                  <div className="rounded-2xl border border-[#dce4ef] bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#718096]">
                      <span>Fichas IA validadas</span>
                      <CheckCircle2 size={16} className="text-teal-600" />
                    </div>
                    <strong className="mt-2 block text-2xl font-extrabold sm:text-3xl">
                      {metrics.fichas}
                    </strong>
                    <span className="mt-1 block text-[11px] text-[#718096]">
                      100% validadas con Zod (Contrato §4)
                    </span>
                  </div>

                  <div className="rounded-2xl border border-[#dce4ef] bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#718096]">
                      <span>Oportunidades SKUs</span>
                      <TrendingUp size={16} className="text-amber-500" />
                    </div>
                    <strong className="mt-2 block text-2xl font-extrabold sm:text-3xl">
                      {metrics.recomendaciones}
                    </strong>
                    <span className="mt-1 block text-[11px] text-[#718096]">
                      Sugerencias `ofrecer_primero`
                    </span>
                  </div>
                </div>

                {/* Bloque de Insights Agénticos */}
                <div className="rounded-2xl border border-[#bfd4ff] bg-gradient-to-br from-[#eef4ff] via-white to-[#f5f9ff] p-4 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2166f3] text-white">
                        <Sparkles size={16} />
                      </span>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2166f3]">
                          Foco Comercial de la Semana · Insights Agénticos
                        </span>
                        <h3 className="text-base font-bold sm:text-lg">
                          Acciones sugeridas sobre la cartera relevada
                        </h3>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5b6b82] shadow-2xs">
                      Basado en {insightsAndCharts.analyzedStores || metrics.fichas} fichas activas
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {/* Insight 1: Quick Win Surtido */}
                    <div className="rounded-xl border border-[#dce4ef] bg-white p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#2166f3]">
                        <PackageCheck size={15} />
                        <span>1. Brecha de Surtido Prioritaria</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#17243a] sm:text-sm">
                        {insightsAndCharts.topMissing[0] ? (
                          <>
                            <b>{insightsAndCharts.topMissing[0].nombre}</b> falta en{" "}
                            <b>{insightsAndCharts.topMissing[0].count}</b> comercios relevados. Priorizar su introducción en locales{" "}
                            <b>Premium y Estándar</b> durante la próxima ruta.
                          </>
                        ) : (
                          <>
                            Priorizar la línea troncal de infusiones y especias La Virginia en los{" "}
                            <b>{metrics.comercios}</b> comercios registrados para capturar frentes calientes.
                          </>
                        )}
                      </p>
                    </div>

                    {/* Insight 2: Presión Competitiva */}
                    <div className="rounded-xl border border-[#dce4ef] bg-white p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-600">
                        <ShieldAlert size={15} />
                        <span>2. Defensa de Góndola & Frentes</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#17243a] sm:text-sm">
                        {insightsAndCharts.topCompStores[0] ? (
                          <>
                            Share competitivo promedio del <b>{insightsAndCharts.avgCompetitorShare}%</b> (máximo en{" "}
                            <b>{insightsAndCharts.topCompStores[0].nombre}</b> con{" "}
                            <b>{insightsAndCharts.topCompStores[0].share}%</b>). Reforzar exhibición a altura de ojos.
                          </>
                        ) : (
                          <>
                            Se detectaron <b>{insightsAndCharts.highCompCount}</b> locales con alta ocupación de marcas rivales. Usar argumentos de rotación de `ofrecer_primero`.
                          </>
                        )}
                      </p>
                    </div>

                    {/* Insight 3: Mix por Categoría */}
                    <div className="rounded-xl border border-[#dce4ef] bg-white p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-teal-600">
                        <Layers size={15} />
                        <span>3. Estrategia por Categoría PDV</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#17243a] sm:text-sm">
                        Cartera actual: <b>{insightsAndCharts.premiumCount} Premium</b> (empujar gama Gourmet/Reserva),{" "}
                        <b>{insightsAndCharts.estandarCount} Estándar</b> (ampliar surtido faltante) y{" "}
                        <b>{insightsAndCharts.basicoCount} Básico</b> (asegurar SKUs de entrada).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Charts Grid aligned with Contract §4 */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Categoría de Cliente */}
                  <div className="rounded-2xl border border-[#dce4ef] bg-white p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold">
                          Categoría de Cliente (`premium | estandar | basico`)
                        </h3>
                        <p className="text-xs text-[#718096]">
                          Clasificación sintética del Contrato §4 guardada en `fichas.categoria`
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3.5">
                      {(["premium", "estandar", "basico"] as const).map((catKey) => {
                        const count = metrics.categorias[catKey] ?? 0
                        const total = Math.max(metrics.fichas, 1)
                        const pct = Math.round((count / total) * 100)
                        const meta = CATEGORIA_META[catKey]
                        return (
                          <div key={catKey} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: meta.color }}
                                />
                                <span className="font-bold text-[#17243a]">{meta.label}</span>
                                <span className="hidden text-[#718096] sm:inline">· {meta.desc}</span>
                              </div>
                              <span className="font-bold text-[#17243a]">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#eef2f8]">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.max(count > 0 ? 6 : 0, pct)}%`,
                                  backgroundColor: meta.color,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Formato & NSE */}
                  <div className="rounded-2xl border border-[#dce4ef] bg-white p-5">
                    <h3 className="text-base font-bold">
                      Mix por Formato de Local y Nivel Socioeconómico (NSE)
                    </h3>
                    <p className="text-xs text-[#718096]">
                      Distribución según última ficha activa de cada punto de venta
                    </p>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#718096]">
                          Formato (`formato.tipo`)
                        </p>
                        <div className="space-y-2">
                          {(
                            ["autoservicio", "almacen", "despensa", "kiosco", "cafeteria", "otro"] as const
                          ).map((fmt) => {
                            const n = insightsAndCharts.formatoCounts[fmt] || 0
                            return (
                              <div
                                key={fmt}
                                className="flex items-center justify-between rounded-lg bg-[#f8fafd] px-3 py-1.5 text-xs"
                              >
                                <span className="font-medium text-[#17243a]">
                                  {FORMATO_LABELS[fmt] || fmt}
                                </span>
                                <b className="text-[#2166f3]">{n}</b>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#718096]">
                          NSE Inferido (`nse.nivel`)
                        </p>
                        <div className="space-y-2">
                          {[
                            { key: "alto", label: "NSE Alto", badge: "bg-indigo-50 text-indigo-700" },
                            { key: "medio", label: "NSE Medio", badge: "bg-sky-50 text-sky-700" },
                            { key: "bajo", label: "NSE Bajo", badge: "bg-amber-50 text-amber-700" },
                          ].map((item) => {
                            const n = insightsAndCharts.nseCounts[item.key] || 0
                            return (
                              <div
                                key={item.key}
                                className="flex items-center justify-between rounded-lg bg-[#f8fafd] px-3 py-2 text-xs"
                              >
                                <span className={`rounded-md px-2 py-0.5 font-bold ${item.badge}`}>
                                  {item.label}
                                </span>
                                <b className="text-[#17243a]">{n} PDVs</b>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Faltantes / Oportunidades */}
                  <div className="rounded-2xl border border-[#dce4ef] bg-white p-5">
                    <h3 className="text-base font-bold">
                      Top Oportunidades de Surtido (`surtido.le_falta` & `ofrecer_primero`)
                    </h3>
                    <p className="text-xs text-[#718096]">
                      Productos del catálogo `productos_lv` más recomendados o ausentes en góndola
                    </p>

                    {insightsAndCharts.topMissing.length > 0 ||
                    insightsAndCharts.topRecommended.length > 0 ? (
                      <div className="mt-4 space-y-2.5">
                        {(insightsAndCharts.topMissing.length > 0
                          ? insightsAndCharts.topMissing
                          : insightsAndCharts.topRecommended
                        ).map((item) => (
                          <div
                            key={item.nombre}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[#edf2f9] bg-[#f8fafd] px-3.5 py-2.5 text-xs"
                          >
                            <span className="font-semibold text-[#17243a]">{item.nombre}</span>
                            <span className="shrink-0 rounded-full bg-[#e9f0ff] px-2.5 py-0.5 font-bold text-[#2166f3]">
                              {item.count} PDV{item.count === 1 ? "" : "s"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-xl bg-[#f8fafd] p-4 text-xs text-[#718096]">
                        Todavía no hay faltantes agregados en las fichas o todos los locales tienen surtido completo.
                      </p>
                    )}
                  </div>

                  {/* Presión Competitiva */}
                  <div className="rounded-2xl border border-[#dce4ef] bg-white p-5">
                    <h3 className="text-base font-bold">
                      Presión Competitiva en Góndola (`competencia`)
                    </h3>
                    <p className="text-xs text-[#718096]">
                      Comercios con mayor porcentaje de frentes ocupados por marcas competidoras
                    </p>

                    {insightsAndCharts.topCompStores.length > 0 ? (
                      <div className="mt-4 space-y-2.5">
                        {insightsAndCharts.topCompStores.map((comp) => (
                          <div
                            key={comp.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-[#edf2f9] bg-[#f8fafd] px-3.5 py-2.5 text-xs"
                          >
                            <div className="min-w-0">
                              <b className="truncate text-[#17243a]">{comp.nombre}</b>
                              <span className="ml-2 text-[#718096]">
                                {comp.marcas} marca{comp.marcas === 1 ? "" : "s"} rivales
                              </span>
                            </div>
                            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">
                              {comp.share}% frentes
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 rounded-xl bg-[#f8fafd] p-4 text-xs text-[#718096]">
                        Sin datos de frentes competitivos registrados todavía.
                      </p>
                    )}
                  </div>
                </div>

                {/* Aviso de trazabilidad y datos DEMO */}
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <p>
                    <b>Nota de trazabilidad:</b> Hay <b>{metrics.comercios_demo}</b> comercios identificados con{" "}
                    <code>es_demo = true</code>. Cada visita genera una ficha validada con `modelo` y `prompt_version`; un comercio puede acumular múltiples visitas a lo largo del tiempo.
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-[#718096]">Cargando métricas...</p>
            )}
          </section>
        )}

        {/* SECTION: TEAM */}
        {section === "team" && (
          <section className="rounded-2xl border border-[#dce4ef] bg-white p-4 sm:p-6">
            <h2 className="text-xl font-bold sm:text-2xl">Equipo de Ventas y Permisos</h2>
            <p className="mt-1 text-xs text-[#718096] sm:text-sm">
              Las cuentas se registran desde la pantalla de acceso o en Supabase Auth. Los permisos (`vendedor | admin` y `activo`) se verifican en el servidor mediante RLS (`profiles`).
            </p>
            <div className="mt-5 space-y-2.5">
              {team.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce4ef] bg-[#f8fafd] p-3.5 sm:p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="text-sm sm:text-base">
                        {p.nombre || "Cuenta " + p.id.slice(0, 8)}
                      </b>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " +
                          (p.rol === "admin"
                            ? "bg-[#e9f0ff] text-[#2166f3]"
                            : "bg-slate-200 text-slate-700")
                        }
                      >
                        {p.rol}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#718096]">
                      {p.activo ? "Acceso habilitado" : "Cuenta deshabilitada"}
                    </p>
                  </div>
                  {p.rol === "vendedor" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggle(p)}
                      className={
                        "rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 " +
                        (p.activo
                          ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                          : "border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700")
                      }
                    >
                      {p.activo ? "Bloquear acceso" : "Habilitar acceso"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: PRODUCTS */}
        {section === "products" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">
                Catálogo Activo La Virginia (`productos_lv`)
              </h2>
              <p className="mt-1 text-xs text-[#718096] sm:text-sm">
                Única fuente válida de SKUs para `surtido` y `ofrecer_primero` (Regla 8 del Contrato: prohibido inventar productos fuera de esta tabla).
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <article
                  key={p.id}
                  className="rounded-xl border border-[#dce4ef] bg-white p-4 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#17243a] sm:text-base">{p.nombre}</h3>
                    <span className="shrink-0 rounded-full bg-[#e9f0ff] px-2 py-0.5 text-[10px] font-bold uppercase text-[#2166f3]">
                      {p.gama}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#718096]">
                    {p.categoria} · {p.presentacion}
                  </p>
                  {p.es_demo && (
                    <p className="mt-2 inline-block rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Semilla DEMO
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
