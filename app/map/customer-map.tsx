"use client"

import "leaflet/dist/leaflet.css"

import Link from "next/link"
import L from "leaflet"
import { ArrowLeft, ArrowUpRight, MapPin, RotateCcw, Search } from "lucide-react"
import { Marker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet"
import { useEffect, useMemo, useState } from "react"
import { api } from "../../lib/client-api"
import type { MapStore } from "../../types/api"

type CategoriaValor = "premium" | "estandar" | "basico"
type FormatoTipo = "almacen" | "autoservicio" | "kiosco" | "despensa" | "cafeteria" | "otro"
type NseNivel = "bajo" | "medio" | "alto"

const ROSARIO_CENTER: [number, number] = [-32.9468, -60.6393]

// Mapa 100% gratuito siempre (CartoDB Voyager sobre OpenStreetMap, sin API key, sin tarjeta)
const FREE_MAP_TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
const FREE_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

const CATEGORIA_META: Record<
  CategoriaValor,
  { color: string; bg: string; text: string; border: string; label: string }
> = {
  premium: {
    color: "#10b981",
    bg: "bg-[#ecfdf5]",
    text: "text-[#047857]",
    border: "border-[#a7f3d0]",
    label: "Premium",
  },
  estandar: {
    color: "#2166f3",
    bg: "bg-[#e9f0ff]",
    text: "text-[#1d4ed8]",
    border: "border-[#bfdbfe]",
    label: "Estándar",
  },
  basico: {
    color: "#f59e0b",
    bg: "bg-[#fffbeb]",
    text: "text-[#b45309]",
    border: "border-[#fde68a]",
    label: "Básico",
  },
}

const FORMATO_META: Record<
  FormatoTipo,
  { label: string; short: string; borderRadius: string; svgPath: string }
> = {
  autoservicio: {
    label: "Autoservicio",
    short: "AUTO",
    borderRadius: "10px",
    svgPath:
      '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 7H6"/>',
  },
  almacen: {
    label: "Almacén",
    short: "ALM",
    borderRadius: "9999px",
    svgPath: '<path d="M3 9l2-5h14l2 5"/><path d="M5 9v10h14V9"/><path d="M10 19v-5h4v5"/>',
  },
  despensa: {
    label: "Despensa",
    short: "DESP",
    borderRadius: "12px 4px 12px 4px",
    svgPath:
      '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5"/><path d="M12 12v9"/><path d="M12 12L4 7.5"/>',
  },
  kiosco: {
    label: "Kiosco",
    short: "KIOS",
    borderRadius: "6px",
    svgPath: '<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/>',
  },
  cafeteria: {
    label: "Cafetería",
    short: "CAFE",
    borderRadius: "14px 14px 6px 14px",
    svgPath:
      '<path d="M17 8h1a3 3 0 0 1 0 6h-1"/><path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><line x1="6" y1="3" x2="6" y2="5"/><line x1="10" y1="3" x2="10" y2="5"/><line x1="14" y1="3" x2="14" y2="5"/>',
  },
  otro: {
    label: "Otro",
    short: "PDV",
    borderRadius: "50%",
    svgPath: '<circle cx="12" cy="12" r="7"/>',
  },
}

function getCategoriaMeta(cat?: string | null) {
  if (cat === "premium" || cat === "estandar" || cat === "basico") {
    return CATEGORIA_META[cat]
  }
  return {
    color: "#64748b",
    bg: "bg-[#f1f5fa]",
    text: "text-[#52627b]",
    border: "border-[#dce4ef]",
    label: "Sin categoría",
  }
}

function getFormatoMeta(fmt?: string | null) {
  if (
    fmt === "autoservicio" ||
    fmt === "almacen" ||
    fmt === "despensa" ||
    fmt === "kiosco" ||
    fmt === "cafeteria" ||
    fmt === "otro"
  ) {
    return FORMATO_META[fmt]
  }
  return FORMATO_META.otro
}

function buildComercioIcon(categoria?: string | null, formato?: string | null, isSelected?: boolean) {
  const cat = getCategoriaMeta(categoria)
  const fmt = getFormatoMeta(formato)
  const size = isSelected ? 38 : 32
  const ring = isSelected
    ? `box-shadow: 0 0 0 5px ${cat.color}38, 0 6px 16px rgba(11,31,58,0.28); transform: scale(1.06);`
    : `box-shadow: 0 3px 10px rgba(11,31,58,0.2);`

  const html = `
    <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
      <div style="
        width:${size}px;
        height:${size}px;
        background:${cat.color};
        border:2.5px solid #ffffff;
        border-radius:${fmt.borderRadius};
        display:flex;
        align-items:center;
        justify-content:center;
        color:#ffffff;
        transition:all 0.2s ease;
        ${ring}
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? 18 : 15}" height="${
    isSelected ? 18 : 15
  }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          ${fmt.svgPath}
        </svg>
      </div>
      <span style="
        margin-top:2px;
        padding:1px 5px;
        border-radius:4px;
        background:${isSelected ? "#0b1f3a" : "rgba(255,255,255,0.92)"};
        color:${isSelected ? "#ffffff" : "#17243a"};
        border:1px solid ${cat.color};
        font-size:8.5px;
        font-weight:800;
        letter-spacing:0.04em;
        line-height:1.1;
        white-space:nowrap;
      ">${fmt.short}</span>
    </div>
  `

  return L.divIcon({
    className: "custom-pin-icon",
    html,
    iconSize: [size + 14, size + 18],
    iconAnchor: [(size + 14) / 2, (size + 18) / 2],
    popupAnchor: [0, -(size / 2)],
  })
}

function Recenter({ position }: { position: [number, number] }) {
  const [lat, lng] = position
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 14, { duration: 0.6 })
  }, [map, lat, lng])
  return null
}

export default function CustomerMapPage({ embedded = false }: { embedded?: boolean }) {
  const [stores, setStores] = useState<MapStore[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [query, setQuery] = useState("")
  const [catFilter, setCatFilter] = useState<CategoriaValor | "todas">("todas")
  const [formatoFilter, setFormatoFilter] = useState<FormatoTipo | "todos">("todos")
  const [nseFilter, setNseFilter] = useState<NseNivel | "todos">("todos")
  const [error, setError] = useState("")
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let live = true
    api<MapStore[]>("/api/mapa")
      .then((rows) => {
        if (live) {
          setStores(rows)
          setSelectedId(rows[0]?.id || "")
          setLoaded(true)
        }
      })
      .catch((e) => {
        if (live) {
          setError(e instanceof Error ? e.message : "No se pudo cargar el mapa")
          setLoaded(true)
        }
      })
    return () => {
      live = false
    }
  }, [])

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      const matchQuery =
        s.nombre.toLowerCase().includes(query.toLowerCase()) ||
        (s.direccion || "").toLowerCase().includes(query.toLowerCase()) ||
        (s.formato || "").toLowerCase().includes(query.toLowerCase())
      const cat = s.categoria || s.ficha?.categoria.valor || null
      const fmt = s.formato || s.ficha?.formato.tipo || null
      const nse = s.nse || s.ficha?.nse.nivel || null
      const matchCat = catFilter === "todas" || cat === catFilter
      const matchFmt = formatoFilter === "todos" || fmt === formatoFilter
      const matchNse = nseFilter === "todos" || nse === nseFilter
      return matchQuery && matchCat && matchFmt && matchNse
    })
  }, [stores, query, catFilter, formatoFilter, nseFilter])

  const points = useMemo(
    () =>
      filtered.filter(
        (s): s is MapStore & { lat: number; lng: number } => s.lat !== null && s.lng !== null
      ),
    [filtered]
  )

  const selected = useMemo(
    () =>
      filtered.find((s) => s.id === selectedId) ||
      points.find((s) => s.id === selectedId) ||
      points[0] ||
      filtered[0] ||
      stores[0] ||
      null,
    [filtered, points, stores, selectedId]
  )

  const position = useMemo<[number, number]>(
    () =>
      selected && selected.lat !== null && selected.lng !== null
        ? [selected.lat, selected.lng]
        : points[0]
        ? [points[0].lat, points[0].lng]
        : ROSARIO_CENTER,
    [selected, points]
  )

  const countsByCategoria = useMemo(() => {
    return {
      premium: stores.filter((s) => (s.categoria || s.ficha?.categoria.valor) === "premium").length,
      estandar: stores.filter((s) => (s.categoria || s.ficha?.categoria.valor) === "estandar").length,
      basico: stores.filter((s) => (s.categoria || s.ficha?.categoria.valor) === "basico").length,
    }
  }, [stores])

  function limpiarFiltros() {
    setQuery("")
    setCatFilter("todas")
    setFormatoFilter("todos")
    setNseFilter("todos")
  }

  const hayFiltrosActivos =
    query.trim() !== "" || catFilter !== "todas" || formatoFilter !== "todos" || nseFilter !== "todos"

  return (
    <main className={embedded ? "text-[#17243a]" : "min-h-[100dvh] bg-[#f5f8fc] text-[#17243a]"}>
      {!embedded && (
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-[#e6ebf2] bg-white/95 px-3 backdrop-blur sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#dce4ef] px-2.5 text-xs font-semibold text-[#17243a] hover:bg-[#f1f5fa]"
            >
              <ArrowLeft size={15} />
              <span>Volver a visitas</span>
            </Link>
            <h1 className="truncate text-sm font-bold sm:text-base">Mapa de comercios</h1>
          </div>

          <Link
            href="/settings"
            className="shrink-0 rounded-lg border border-[#dce4ef] px-2.5 py-1.5 text-xs font-semibold text-[#52627b] hover:bg-[#f5f8fc]"
          >
            Cuenta
          </Link>
        </header>
      )}

      {error && (
        <p
          role="alert"
          className="mx-auto mt-3 max-w-[1320px] rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700 sm:text-sm"
        >
          {error}
        </p>
      )}

      <div className={embedded ? "space-y-3 sm:space-y-4" : "mx-auto max-w-[1320px] space-y-3 p-2.5 sm:space-y-4 sm:p-5"}>
        {/* Barra de filtros compacta y 100% responsive */}
        <section className="rounded-2xl border border-[#dce4ef] bg-white p-3 shadow-[0_2px_12px_rgba(31,56,88,.04)] sm:p-4">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCatFilter("todas")}
                className={`rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                  catFilter === "todas"
                    ? "border-[#0b1f3a] bg-[#0b1f3a] text-white"
                    : "border-[#dce4ef] bg-[#f8fafd] text-[#52627b] hover:bg-[#eef3fb]"
                }`}
              >
                Todos ({stores.length})
              </button>

              {(["premium", "estandar", "basico"] as CategoriaValor[]).map((catKey) => {
                const meta = CATEGORIA_META[catKey]
                const active = catFilter === catKey
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCatFilter(active ? "todas" : catKey)}
                    className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                      active
                        ? `${meta.bg} ${meta.text} ${meta.border} ring-2 ring-[#2166f3]/20`
                        : "border-[#e6ebf2] bg-white text-[#17243a] hover:bg-[#f8fafd]"
                    }`}
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: meta.color }} />
                    <span className="capitalize">{catKey}</span>
                    <span className="rounded bg-black/5 px-1 text-[10px]">
                      {countsByCategoria[catKey]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <select
                aria-label="Filtrar por formato"
                value={formatoFilter}
                onChange={(e) => setFormatoFilter(e.target.value as FormatoTipo | "todos")}
                className="h-9 min-w-0 rounded-xl border border-[#dce4ef] bg-[#f8fafd] px-2 text-xs font-semibold text-[#17243a] outline-none focus:border-[#2166f3]"
              >
                <option value="todos">Formato: Todos</option>
                <option value="autoservicio">Autoservicio</option>
                <option value="almacen">Almacén</option>
                <option value="despensa">Despensa</option>
                <option value="kiosco">Kiosco</option>
                <option value="cafeteria">Cafetería</option>
                <option value="otro">Otro</option>
              </select>

              <select
                aria-label="Filtrar por NSE"
                value={nseFilter}
                onChange={(e) => setNseFilter(e.target.value as NseNivel | "todos")}
                className="h-9 min-w-0 rounded-xl border border-[#dce4ef] bg-[#f8fafd] px-2 text-xs font-semibold text-[#17243a] outline-none focus:border-[#2166f3]"
              >
                <option value="todos">NSE: Todos</option>
                <option value="alto">NSE Alto</option>
                <option value="medio">NSE Medio</option>
                <option value="bajo">NSE Bajo</option>
              </select>

              {hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="col-span-2 flex items-center justify-center gap-1 rounded-xl border border-[#dce4ef] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#2166f3] hover:bg-[#e9f0ff] sm:col-span-1"
                >
                  <RotateCcw size={12} /> Limpiar
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Grilla adaptable: Lista + Mapa + Vista Previa */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_340px]">
          {/* Columna 1: Listado de puntos de venta */}
          <section className="rounded-2xl border border-[#dce4ef] bg-white p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Puntos de venta</h2>
              <span className="text-[11px] font-medium text-slate-500">
                {loaded ? `${filtered.length} de ${stores.length}` : "Cargando..."}
              </span>
            </div>

            <label className="relative my-2.5 block">
              <Search className="absolute left-3 top-2.5 text-[#8b98aa]" size={14} />
              <input
                aria-label="Buscar comercio"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o dirección..."
                className="h-9 w-full rounded-xl border border-[#dce4ef] pl-8 pr-3 text-xs outline-none focus:border-[#2166f3]"
              />
            </label>

            <div className="max-h-52 space-y-2 overflow-auto pr-1 lg:max-h-[460px]">
              {filtered.map((s) => {
                const catVal = s.categoria || s.ficha?.categoria.valor || null
                const catMeta = getCategoriaMeta(catVal)
                const isSelected = s.id === selected?.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full rounded-xl border p-2.5 text-left transition ${
                      isSelected
                        ? "border-[#2166f3] bg-[#e9f0ff]"
                        : "border-slate-200 hover:bg-[#f8fafd]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: catMeta.color }}
                        />
                        <b className="truncate text-xs">{s.nombre}</b>
                      </div>
                      {catVal && (
                        <span
                          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                        >
                          {catVal}
                        </span>
                      )}
                    </div>
                    <span className="mt-1 block truncate text-[11px] text-slate-500">
                      {s.formato || "Sin ficha"} · NSE {s.nse || "sin estimar"}
                      {s.lat === null ? " · Sin GPS" : ""}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Columna 2: Mapa Gratuito Leaflet + CartoDB Voyager */}
          <section className="overflow-hidden rounded-2xl border border-[#dce4ef] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6ebf2] px-3.5 py-3 sm:px-4">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold">Cobertura comercial</h2>
                <p className="truncate text-[11px] text-slate-500">
                  Color por categoría · Ícono por formato
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-[#f1f5fa] px-2.5 py-1 text-[11px] font-semibold text-[#52627b]">
                <MapPin size={12} className="text-[#2166f3]" /> Rosario
              </span>
            </div>

            <div className="h-[300px] sm:h-[420px] lg:h-[500px]">
              <MapContainer center={position} zoom={13} className="z-0 h-full w-full">
                <TileLayer attribution={FREE_MAP_ATTRIBUTION} url={FREE_MAP_TILES} />
                <Recenter position={position} />
                {points.map((s) => {
                  const catVal = s.categoria || s.ficha?.categoria.valor || null
                  const fmtVal = s.formato || s.ficha?.formato.tipo || null
                  const isSelected = s.id === selected?.id
                  return (
                    <Marker
                      key={s.id}
                      position={[s.lat, s.lng]}
                      icon={buildComercioIcon(catVal, fmtVal, isSelected)}
                      eventHandlers={{ click: () => setSelectedId(s.id) }}
                    >
                      <Popup>
                        <div className="min-w-[180px] text-xs text-[#17243a]">
                          <b className="block text-sm">{s.nombre}</b>
                          <p className="mt-0.5 text-slate-600">
                            {s.formato || "Sin ficha"} · NSE {s.nse || "sin estimar"}
                          </p>
                          {s.ficha && (
                            <div className="mt-1.5 space-y-1 border-t border-slate-200 pt-1.5">
                              <p className="font-semibold">
                                Categoría: {s.categoria || s.ficha.categoria.valor}
                              </p>
                              <ul className="list-inside list-disc text-[11px]">
                                {s.ficha.ofrecer_primero.map((p) => (
                                  <li key={p.producto}>{p.producto}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>
          </section>

          {/* Columna 3: Vista previa de la Última Ficha */}
          <section className="flex flex-col justify-between rounded-2xl border border-[#dce4ef] bg-white p-3.5 sm:p-4 lg:col-span-2 xl:col-span-1">
            {selected ? (
              <>
                <div className="space-y-3">
                  <div className="border-b border-[#edf1f6] pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#2166f3]">
                        Vista previa · Última Ficha
                      </span>
                      {selected.es_demo && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                          DEMO
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-base font-bold">{selected.nombre}</h3>
                    {selected.direccion && (
                      <p className="text-xs text-[#718096]">{selected.direccion}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#e9f0ff] px-2.5 py-0.5 text-[11px] font-bold capitalize text-[#2166f3]">
                        {selected.formato || selected.ficha?.formato.tipo || "Sin formato"}
                      </span>
                      <span className="rounded-full bg-[#f1f5fa] px-2.5 py-0.5 text-[11px] font-bold uppercase text-[#52627b]">
                        NSE {selected.nse || selected.ficha?.nse.nivel || "sin estimar"}
                      </span>
                      {(selected.categoria || selected.ficha?.categoria.valor) && (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                            getCategoriaMeta(selected.categoria || selected.ficha?.categoria.valor).bg
                          } ${getCategoriaMeta(selected.categoria || selected.ficha?.categoria.valor).text} ${
                            getCategoriaMeta(selected.categoria || selected.ficha?.categoria.valor).border
                          }`}
                        >
                          {selected.categoria || selected.ficha?.categoria.valor}
                        </span>
                      )}
                      {selected.ficha && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          Confianza {Math.round(selected.ficha.confianza * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {selected.ficha ? (
                    <>
                      <div className="rounded-xl border border-[#e4eaf2] bg-[#f8fafd] p-2.5 text-xs">
                        <p className="text-[10px] font-bold uppercase text-[#718096]">
                          Motivo de clasificación
                        </p>
                        <p className="mt-1 leading-5 text-[#17243a]">
                          {selected.ficha.categoria.motivo}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                        <div className="rounded-lg border border-[#e4eaf2] bg-[#fbfcfe] p-1.5">
                          <span className="block text-[9px] uppercase text-[#718096]">Tamaño / Cajas</span>
                          <b className="text-[#17243a]">
                            {selected.ficha.formato.tamano} · {selected.ficha.formato.cajas ?? "—"}
                          </b>
                        </div>
                        <div className="rounded-lg border border-[#e4eaf2] bg-[#fbfcfe] p-1.5">
                          <span className="block text-[9px] uppercase text-[#718096]">m² estim.</span>
                          <b className="text-[#17243a]">{selected.ficha.formato.m2_estimados ?? "—"}</b>
                        </div>
                        <div className="rounded-lg border border-[#e4eaf2] bg-[#fbfcfe] p-1.5">
                          <span className="block text-[9px] uppercase text-[#718096]">Góndolas</span>
                          <b className="text-[#17243a]">{selected.ficha.formato.gondolas ?? "—"}</b>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#718096]">
                          Señales de NSE ({selected.ficha.nse.senales.length})
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selected.ficha.nse.senales.map((senal, idx) => (
                            <span
                              key={idx}
                              className="rounded-md border border-[#e4eaf2] bg-[#fbfcfe] px-2 py-0.5 text-[11px] text-[#334155]"
                            >
                              • {senal}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#2166f3]">
                          Qué ofrecer primero
                        </p>
                        <div className="mt-1.5 space-y-1.5">
                          {selected.ficha.ofrecer_primero.map((rec, idx) => (
                            <div
                              key={rec.producto}
                              className="rounded-xl border border-[#dce4ef] bg-[#f8fafd] p-2.5 text-xs"
                            >
                              <b className="text-[#17243a]">
                                {idx + 1}. {rec.producto}
                              </b>
                              <p className="mt-0.5 text-[11px] text-[#52627b]">{rec.argumento}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                        <div className="rounded-xl border border-[#d1fae5] bg-[#ecfdf5]/60 p-2">
                          <span className="font-bold text-[#047857]">Tiene en góndola: </span>
                          <span className="text-[#065f46]">
                            {selected.ficha.surtido.tiene.join(" · ") || "Sin presencia confirmada"}
                          </span>
                        </div>
                        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-2">
                          <span className="font-bold text-[#b45309]">Faltantes: </span>
                          <span className="text-[#92400e]">
                            {selected.ficha.surtido.le_falta.join(" · ") || "A confirmar en local"}
                          </span>
                        </div>
                        <div className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] p-2">
                          <span className="font-bold text-[#be123c]">Competencia: </span>
                          <span className="text-[#9f1239]">
                            Marcas: {selected.ficha.competencia.marcas ?? "—"} · Share:{" "}
                            {selected.ficha.competencia.share_frentes_pct !== null
                              ? `${selected.ficha.competencia.share_frentes_pct}%`
                              : "—"}
                            {selected.ficha.competencia.promos.length > 0
                              ? ` · Promos: ${selected.ficha.competencia.promos.join(", ")}`
                              : ""}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-[#e4eaf2] bg-[#f8fafd] p-3.5 text-xs text-[#52627b]">
                      <p className="font-semibold text-[#17243a]">Datos básicos de mapa</p>
                      <p className="mt-1 leading-5">
                        La ficha completa se habilita al analizar una visita propia o desde la vista de administración.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-[#edf1f6] pt-2.5">
                  <Link
                    href={`/?comercio=${selected.id}`}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2166f3] py-2.5 text-xs font-bold text-white transition hover:bg-[#1657da]"
                  >
                    Relevar este comercio
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Seleccioná un comercio en el listado o en el mapa.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
