"use client"

import "leaflet/dist/leaflet.css"

import Link from "next/link"
import L from "leaflet"
import {
  ArrowLeft,
  ArrowUpRight,
  Filter,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react"
import { Marker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet"
import { useEffect, useMemo, useState } from "react"
import { api } from "../../lib/client-api"
import type { MapStore } from "../../types/api"

type CategoriaValor = "premium" | "estandar" | "basico"
type FormatoTipo = "almacen" | "autoservicio" | "kiosco" | "despensa" | "cafeteria" | "otro"
type NseNivel = "bajo" | "medio" | "alto"
type TileStyle = "voyager" | "positron"

const ROSARIO_CENTER: [number, number] = [-32.9468, -60.6393]

const TILE_URLS: Record<TileStyle, { url: string; label: string; attribution: string }> = {
  voyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    label: "CartoDB Voyager",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  positron: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    label: "CartoDB Positron",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
}

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

const FORMATO_META: Record<FormatoTipo, { label: string; short: string; borderRadius: string; svgPath: string }> = {
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
  const size = isSelected ? 40 : 32
  const ring = isSelected
    ? `box-shadow: 0 0 0 6px ${cat.color}38, 0 8px 18px rgba(11,31,58,0.28); transform: scale(1.08);`
    : `box-shadow: 0 4px 12px rgba(11,31,58,0.22);`

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
        <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? 19 : 15}" height="${
    isSelected ? 19 : 15
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
    iconSize: [size + 14, size + 20],
    iconAnchor: [(size + 14) / 2, (size + 20) / 2],
    popupAnchor: [0, -(size / 2)],
  })
}

function Recenter({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(position, 14, { duration: 0.6 })
  }, [map, position])
  return null
}

export default function CustomerMapPage({ embedded = false }: { embedded?: boolean }) {
  const [stores, setStores] = useState<MapStore[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [query, setQuery] = useState("")
  const [catFilter, setCatFilter] = useState<CategoriaValor | "todas">("todas")
  const [formatoFilter, setFormatoFilter] = useState<FormatoTipo | "todos">("todos")
  const [nseFilter, setNseFilter] = useState<NseNivel | "todos">("todos")
  const [tileStyle, setTileStyle] = useState<TileStyle>("voyager")
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#e6ebf2] bg-white/95 px-3 backdrop-blur sm:h-[72px] sm:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/"
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#dce4ef] text-[#52627b] hover:bg-[#f1f5fa]"
              aria-label="Volver a nueva visita"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium text-[#718096] sm:text-xs">
                Shippe.AR · Inteligencia Geográfica
              </p>
              <h1 className="truncate text-sm font-bold sm:text-[19px]">
                Mapa de comercios y categorías
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <Link
              href="/"
              className="flex items-center gap-1 rounded-lg bg-[#2166f3] px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#1657da] sm:px-3 sm:py-2 sm:text-xs"
            >
              <Sparkles size={13} />
              <span>Nueva visita</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 rounded-lg border border-[#dce4ef] px-2.5 py-1.5 text-[11px] font-semibold text-[#52627b] hover:bg-[#f5f8fc] sm:px-3 sm:py-2 sm:text-xs"
            >
              <UserRound size={13} />
              <span className="hidden sm:inline">Cuenta</span>
            </Link>
          </div>
        </header>
      )}

      {error && (
        <p
          role="alert"
          className="mx-auto mt-3 max-w-[1320px] rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 sm:text-sm"
        >
          {error}
        </p>
      )}

      <div className={embedded ? "space-y-4" : "mx-auto max-w-[1320px] space-y-4 p-3 sm:space-y-5 sm:p-6"}>
        {/* Barra superior de filtros por Categoría, Formato, NSE y Estilo CartoDB */}
        <section className="rounded-2xl border border-[#dce4ef] bg-white p-3.5 shadow-[0_2px_12px_rgba(31,56,88,.04)] sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setCatFilter("todas")}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
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
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                      active
                        ? `${meta.bg} ${meta.text} ${meta.border} ring-2 ring-[#2166f3]/20`
                        : "border-[#e6ebf2] bg-white text-[#17243a] hover:bg-[#f8fafd]"
                    }`}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                    <span className="capitalize">{catKey}</span>
                    <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px]">
                      {countsByCategoria[catKey]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filtrar por formato"
                value={formatoFilter}
                onChange={(e) => setFormatoFilter(e.target.value as FormatoTipo | "todos")}
                className="h-9 rounded-xl border border-[#dce4ef] bg-[#f8fafd] px-2.5 text-xs font-semibold text-[#17243a] outline-none focus:border-[#2166f3]"
              >
                <option value="todos">Formato: Todos</option>
                <option value="autoservicio">Autoservicio (🛒)</option>
                <option value="almacen">Almacén (🏪)</option>
                <option value="despensa">Despensa (📦)</option>
                <option value="kiosco">Kiosco (⚡)</option>
                <option value="cafeteria">Cafetería (☕)</option>
                <option value="otro">Otro</option>
              </select>

              <select
                aria-label="Filtrar por NSE"
                value={nseFilter}
                onChange={(e) => setNseFilter(e.target.value as NseNivel | "todos")}
                className="h-9 rounded-xl border border-[#dce4ef] bg-[#f8fafd] px-2.5 text-xs font-semibold text-[#17243a] outline-none focus:border-[#2166f3]"
              >
                <option value="todos">NSE: Todos</option>
                <option value="alto">NSE Alto</option>
                <option value="medio">NSE Medio</option>
                <option value="bajo">NSE Bajo</option>
              </select>

              <div className="flex items-center rounded-xl border border-[#dce4ef] bg-[#f8fafd] p-0.5">
                <button
                  type="button"
                  onClick={() => setTileStyle("voyager")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    tileStyle === "voyager" ? "bg-[#2166f3] text-white shadow-xs" : "text-[#52627b]"
                  }`}
                >
                  Voyager
                </button>
                <button
                  type="button"
                  onClick={() => setTileStyle("positron")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    tileStyle === "positron" ? "bg-[#2166f3] text-white shadow-xs" : "text-[#52627b]"
                  }`}
                >
                  Positron
                </button>
              </div>

              {hayFiltrosActivos && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="flex items-center gap-1 rounded-xl border border-[#dce4ef] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#2166f3] hover:bg-[#e9f0ff]"
                >
                  <RotateCcw size={12} /> Limpiar
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Grilla: Lista + Mapa CartoDB Voyager/Positron + Vista Previa Última Ficha */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr_350px]">
          {/* Columna 1: Puntos de venta */}
          <section className="rounded-2xl border border-[#dce4ef] bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold sm:text-base">Puntos de venta</h2>
              <Filter size={15} className="text-[#8b98aa]" />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {loaded
                ? `${stores.length} comercios · ${stores.filter((s) => s.es_demo).length} DEMO`
                : "Cargando..."}
            </p>

            <label className="relative my-3 block">
              <Search className="absolute left-3 top-2.5 text-[#8b98aa]" size={15} />
              <input
                aria-label="Buscar comercio"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar comercio"
                className="h-9 w-full rounded-xl border border-[#dce4ef] pl-9 pr-3 text-xs outline-none focus:border-[#2166f3]"
              />
            </label>

            <div className="max-h-[380px] space-y-2 overflow-auto pr-1 lg:max-h-[480px]">
              {filtered.map((s) => {
                const catVal = s.categoria || s.ficha?.categoria.valor || null
                const catMeta = getCategoriaMeta(catVal)
                const isSelected = s.id === selected?.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-[#2166f3] bg-[#e9f0ff]"
                        : "border-slate-200 hover:bg-[#f8fafd]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: catMeta.color }}
                        />
                        <b className="truncate text-xs sm:text-sm">{s.nombre}</b>
                      </div>
                      {catVal && (
                        <span
                          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}
                        >
                          {catVal}
                        </span>
                      )}
                    </div>
                    <span className="mt-1 block text-xs text-slate-500">
                      {s.formato || "Sin ficha"} · NSE {s.nse || "sin estimar"}
                      {s.categoria ? ` · ${s.categoria}` : ""}
                      {s.lat === null ? " · Sin ubicación" : ""}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Columna 2: Mapa Leaflet con CartoDB Voyager / Positron */}
          <section className="overflow-hidden rounded-2xl border border-[#dce4ef] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6ebf2] p-4">
              <div>
                <h2 className="text-sm font-bold sm:text-base">
                  Cobertura comercial ({TILE_URLS[tileStyle].label})
                </h2>
                <p className="text-xs text-slate-500">
                  Color por categoría (`premium | estandar | basico`) · Ícono por `formato`.
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-[#f1f5fa] px-2.5 py-1 text-[11px] font-semibold text-[#52627b]">
                <MapPin size={12} className="text-[#2166f3]" /> Rosario / Región
              </span>
            </div>

            <div className="h-[360px] sm:h-[500px]">
              <MapContainer center={position} zoom={13} className="z-0 h-full w-full">
                <TileLayer
                  key={tileStyle}
                  attribution={TILE_URLS[tileStyle].attribution}
                  url={TILE_URLS[tileStyle].url}
                />
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
                        <div className="min-w-[200px] text-xs text-[#17243a]">
                          <b className="block text-sm">{s.nombre}</b>
                          <p className="mt-0.5 text-slate-600">
                            {s.formato || "Sin ficha"} · NSE {s.nse || "sin estimar"}
                          </p>
                          {s.es_demo && (
                            <p className="mt-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              Datos ficticios DEMO
                            </p>
                          )}
                          {s.ficha && (
                            <div className="mt-2 space-y-1 border-t border-slate-200 pt-1.5">
                              <p className="font-semibold">Categoría: {s.categoria || s.ficha.categoria.valor}</p>
                              <ul className="list-inside list-disc text-[11px]">
                                {s.ficha.ofrecer_primero.map((p) => (
                                  <li key={p.producto}>{p.producto}</li>
                                ))}
                              </ul>
                              <p className="text-[10px] text-slate-500">{s.ficha.limitaciones}</p>
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
          <section className="flex flex-col justify-between rounded-2xl border border-[#dce4ef] bg-white p-4">
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
                    <h3 className="mt-1.5 text-base font-bold">{selected.nombre}</h3>
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
                    </div>
                  </div>

                  {selected.ficha ? (
                    <>
                      <div className="rounded-xl border border-[#e4eaf2] bg-[#f8fafd] p-3 text-xs">
                        <p className="text-[10px] font-bold uppercase text-[#718096]">
                          Motivo de clasificación
                        </p>
                        <p className="mt-1 leading-5 text-[#17243a]">
                          {selected.ficha.categoria.motivo}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase text-[#718096]">
                          Señales de NSE ({selected.ficha.nse.senales.length})
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
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

                      <div className="grid grid-cols-1 gap-2 text-[11px]">
                        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-2.5">
                          <span className="font-bold text-[#b45309]">Faltantes respaldados: </span>
                          <span className="text-[#92400e]">
                            {selected.ficha.surtido.le_falta.join(" · ") || "A confirmar en local"}
                          </span>
                        </div>
                        <div className="rounded-xl bg-amber-50 p-2.5 text-amber-900">
                          <span className="font-bold">Limitaciones: </span>
                          {selected.ficha.limitaciones}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-[#e4eaf2] bg-[#f8fafd] p-4 text-xs text-[#52627b]">
                      <p className="font-semibold text-[#17243a]">Datos básicos de mapa</p>
                      <p className="mt-1 leading-5">
                        Los argumentos detallados y la ficha completa se habilitan al analizar una visita propia o desde la vista de administración (§5 RLS).
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-[#edf1f6] pt-3">
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
