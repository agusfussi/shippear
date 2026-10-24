"use client"

import "leaflet/dist/leaflet.css"

import L from "leaflet"
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Filter,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react"
import { Marker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet"
import { useEffect, useMemo, useState } from "react"
import { getSession, type DemoUser } from "../../lib/auth"

export type FormatoTipo = "almacen" | "autoservicio" | "kiosco" | "despensa" | "cafeteria" | "otro"
export type NseNivel = "bajo" | "medio" | "alto"
export type CategoriaValor = "premium" | "estandar" | "basico"
export type TileStyle = "voyager" | "positron"

export interface FichaLocal {
  formato: {
    tipo: FormatoTipo
    tamano: "chico" | "mediano" | "grande"
    cajas: number
    m2_estimados: number
    gondolas: number
  }
  nse: {
    nivel: NseNivel
    senales: string[]
  }
  surtido: {
    tiene: string[]
    le_falta: string[]
  }
  ofrecer_primero: Array<{
    producto: string
    argumento: string
  }>
  categoria: {
    valor: CategoriaValor
    motivo: string
  }
  competencia: {
    marcas: number
    share_frentes_pct: number
    promos: string[]
  }
  confianza: number
}

export interface ComercioRecord {
  id: string
  nombre: string
  direccion: string
  lat: number
  lng: number
  vendedor: string
  visitas: number
  ultimaVisita: string
  modelo: string
  prompt_version: string
  ficha: FichaLocal
}

const STORAGE_COMERCIOS_KEY = "shippear-comercios-v1"

const TILE_URLS: Record<TileStyle, { url: string; label: string; attribution: string }> = {
  voyager: {
    // OpenStreetMap is the free provider for the MVP; the tile contract can later be swapped for Google Maps.
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    label: "OpenStreetMap",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  positron: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    label: "OpenStreetMap",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
}

const DEFAULT_COMERCIOS: ComercioRecord[] = [
  {
    id: "com-1",
    nombre: "Autoservicio El Encuentro",
    direccion: "Av. San Martín 1842, Florida",
    lat: -32.9587,
    lng: -60.6939,
    vendedor: "Martina Ríos",
    visitas: 8,
    ultimaVisita: "Hoy · 10:15",
    modelo: "gemini-2.5-flash",
    prompt_version: "v1.2",
    ficha: {
      formato: { tipo: "autoservicio", tamano: "chico", cajas: 2, m2_estimados: 60, gondolas: 3 },
      nse: {
        nivel: "medio",
        senales: [
          "gaseosas de 1ª y 2ª marca",
          "papel doble y simple hoja",
          "vino en botella $4.000–9.000",
          "sin premium (oliva, frutos secos)",
        ],
      },
      surtido: {
        tiene: ["Café molido 500 g"],
        le_falta: ["Café molido 250 g", "Mate cocido x 50", "Té en saquitos x 25", "Café instantáneo 100 g"],
      },
      ofrecer_primero: [
        {
          producto: "Café molido 250 g",
          argumento:
            "La categoría está en góndola y nuestra marca no; ocupa el espacio de la competencia a precio similar.",
        },
        {
          producto: "Mate cocido x 50",
          argumento:
            "Alta rotación matutina en familias del barrio; permite mejorar margen frente a segundas marcas.",
        },
        {
          producto: "Café instantáneo 100 g",
          argumento:
            "Complementa el frente de desayuno rápido y aprovecha el hueco en el estante a la altura de los ojos.",
        },
      ],
      categoria: {
        valor: "estandar",
        motivo: "Autoservicio chico de barrio con público medio: compra marcas de primera pero sin premium.",
      },
      competencia: { marcas: 2, share_frentes_pct: 70, promos: ["2x1 visible en café torrado"] },
      confianza: 0.8,
    },
  },
  {
    id: "com-2",
    nombre: "Supermercado Norte",
    direccion: "Av. del Libertador 4920, Palermo",
    lat: -32.9475,
    lng: -60.6393,
    vendedor: "Sofía Cruz",
    visitas: 11,
    ultimaVisita: "20 oct · 09:15",
    modelo: "gemini-2.5-flash",
    prompt_version: "v1.2",
    ficha: {
      formato: { tipo: "autoservicio", tamano: "grande", cajas: 4, m2_estimados: 180, gondolas: 7 },
      nse: {
        nivel: "alto",
        senales: [
          "aceite de oliva extra virgen y frutos secos",
          "vinos reserva >$12.000",
          "lácteos funcionales y descremados",
          "góndola dedicada a infusiones especiales",
        ],
      },
      surtido: {
        tiene: ["Café molido 500 g", "Café molido 250 g", "Té en saquitos x 25"],
        le_falta: ["Café en grano 500 g", "Té verde x 20", "Cappuccino en sobres x 8"],
      },
      ofrecer_primero: [
        {
          producto: "Café en grano 500 g",
          argumento:
            "El público NSE alto demanda café de molienda propia; hay 3 competidores premium y entramos con mejor precio-calidad.",
        },
        {
          producto: "Té verde x 20",
          argumento: "Tracciona en el bloque saludable donde el local ya destina dos estantes completos.",
        },
      ],
      categoria: {
        valor: "premium",
        motivo: "Autoservicio grande de 4 cajas con público NSE alto y fuerte rotación en infusiones seleccionadas.",
      },
      competencia: {
        marcas: 4,
        share_frentes_pct: 55,
        promos: ["2da unidad 50% en cápsulas", "Puntera de marca importada"],
      },
      confianza: 0.92,
    },
  },
  {
    id: "com-3",
    nombre: "Almacén La Esquina",
    direccion: "Gral. Paz 740, Vicente López",
    lat: -32.9512,
    lng: -60.6571,
    vendedor: "Martina Ríos",
    visitas: 7,
    ultimaVisita: "22 oct · 16:08",
    modelo: "gemini-2.5-flash",
    prompt_version: "v1.2",
    ficha: {
      formato: { tipo: "almacen", tamano: "mediano", cajas: 1, m2_estimados: 45, gondolas: 2 },
      nse: {
        nivel: "medio",
        senales: [
          "fiambrería asistida con marcas líderes",
          "gaseosas 1ª marca retornables",
          "galletitas surtidas familiares",
          "precios cuidados en pizarrón de entrada",
        ],
      },
      surtido: {
        tiene: ["Té en saquitos x 25", "Mate cocido x 50"],
        le_falta: ["Café molido 250 g", "Café instantáneo 100 g", "Especias surtidas"],
      },
      ofrecer_primero: [
        {
          producto: "Café instantáneo 100 g",
          argumento:
            "Compra de reposición diaria en mostrador; el frasco de 100 g se exhibe detrás de caja con alta visibilidad.",
        },
        {
          producto: "Especias surtidas",
          argumento: "Exhibidor colgante junto a la fiambrería que no ocupa góndola y suma venta cruzada inmediata.",
        },
      ],
      categoria: {
        valor: "estandar",
        motivo: "Almacén tradicional con clientela fiel de NSE medio y espacio ideal para exhibidor de mostrador.",
      },
      competencia: { marcas: 2, share_frentes_pct: 60, promos: ["Combo desayuno con galletitas"] },
      confianza: 0.85,
    },
  },
  {
    id: "com-4",
    nombre: "Despensa Don Carlos",
    direccion: "Av. Belgrano 2310, Balvanera",
    lat: -32.9651,
    lng: -60.6504,
    vendedor: "Lucas Vega",
    visitas: 5,
    ultimaVisita: "Ayer · 11:42",
    modelo: "gemini-2.5-flash",
    prompt_version: "v1.2",
    ficha: {
      formato: { tipo: "despensa", tamano: "chico", cajas: 1, m2_estimados: 28, gondolas: 1 },
      nse: {
        nivel: "bajo",
        senales: [
          "predominio de 2ª y 3ª marca en bebidas",
          "envases chicos de compra diaria",
          "papel higiénico simple hoja por unidad",
          "cartelería manuscrita de ofertas económicas",
        ],
      },
      surtido: {
        tiene: ["Mate cocido x 50"],
        le_falta: ["Té en saquitos x 25", "Café torrado 250 g"],
      },
      ofrecer_primero: [
        {
          producto: "Té en saquitos x 25",
          argumento: "Desembolso bajo por caja y excelente costo por taza para la compra diaria del vecindario.",
        },
        {
          producto: "Café torrado 250 g",
          argumento: "Envase económico que le permite al comerciante trabajar primera marca sin inmovilizar capital.",
        },
      ],
      categoria: {
        valor: "basico",
        motivo: "Despensa chica de compra diaria enfocada en precio accesible y presentaciones chicas.",
      },
      competencia: { marcas: 1, share_frentes_pct: 80, promos: ["Precio oferta en yerba económica"] },
      confianza: 0.78,
    },
  },
  {
    id: "com-5",
    nombre: "Cafetería & Deli Botánico",
    direccion: "Thames 2140, Palermo",
    lat: -32.9396,
    lng: -60.6632,
    vendedor: "Sofía Cruz",
    visitas: 6,
    ultimaVisita: "19 oct · 14:20",
    modelo: "gemini-2.5-flash",
    prompt_version: "v1.2",
    ficha: {
      formato: { tipo: "cafeteria", tamano: "mediano", cajas: 1, m2_estimados: 55, gondolas: 2 },
      nse: {
        nivel: "alto",
        senales: [
          "pastelería artesanal y opciones sin TACC",
          "sector deli con productos gourmet",
          "ticket promedio alto en mostrador",
        ],
      },
      surtido: {
        tiene: ["Café en grano 500 g", "Té verde x 20"],
        le_falta: ["Cappuccino en sobres x 8", "Café molido 250 g", "Té en saquitos x 25"],
      },
      ofrecer_primero: [
        {
          producto: "Cappuccino en sobres x 8",
          argumento: "Ideal para exhibir en caja como compra de impulso para clientes que trabajan en la zona.",
        },
        {
          producto: "Café molido 250 g",
          argumento: "Formato práctico para clientes que buscan llevar café de filtro a su hogar.",
        },
      ],
      categoria: {
        valor: "premium",
        motivo: "Cafetería y tienda deli en corredor NSE alto con foco en productos de mayor valor agregado.",
      },
      competencia: { marcas: 3, share_frentes_pct: 50, promos: ["Degustación en barra matutina"] },
      confianza: 0.88,
    },
  },
  {
    id: "com-6",
    nombre: "Kiosco El Paso 24hs",
    direccion: "Av. Corrientes 3410, Abasto",
    lat: -32.9745,
    lng: -60.6426,
    vendedor: "Lucas Vega",
    visitas: 4,
    ultimaVisita: "18 oct · 17:30",
    modelo: "gemini-2.5-flash",
    prompt_version: "v1.2",
    ficha: {
      formato: { tipo: "kiosco", tamano: "chico", cajas: 1, m2_estimados: 18, gondolas: 1 },
      nse: {
        nivel: "bajo",
        senales: [
          "espacio reducido de paso rápido",
          "venta unitaria y golosinas",
          "heladera única con bebidas individuales",
        ],
      },
      surtido: {
        tiene: [],
        le_falta: ["Cappuccino en sobres x 8", "Café instantáneo 100 g", "Té en saquitos x 25"],
      },
      ofrecer_primero: [
        {
          producto: "Cappuccino en sobres x 8",
          argumento: "Permite venta por sobre individual en mostrador con rápida salida en turno mañana y noche.",
        },
        {
          producto: "Café instantáneo 100 g",
          argumento: "Resuelve la compra de conveniencia cuando los comercios de cercanía están cerrados.",
        },
      ],
      categoria: {
        valor: "basico",
        motivo: "Kiosco de paso con espacio acotado; prioriza exhibición en mostrador y desembolso bajo.",
      },
      competencia: { marcas: 1, share_frentes_pct: 85, promos: ["Tira colgable de saquitos competidor"] },
      confianza: 0.76,
    },
  },
]

const CATEGORIA_META: Record<
  CategoriaValor,
  { color: string; bg: string; text: string; border: string; label: string; desc: string }
> = {
  premium: {
    color: "#10b981",
    bg: "bg-[#ecfdf5]",
    text: "text-[#047857]",
    border: "border-[#a7f3d0]",
    label: "Premium",
    desc: "Surtido amplio y alto valor",
  },
  estandar: {
    color: "#2166f3",
    bg: "bg-[#e9f0ff]",
    text: "text-[#1d4ed8]",
    border: "border-[#bfdbfe]",
    label: "Estándar",
    desc: "Rotación media de barrio",
  },
  basico: {
    color: "#f59e0b",
    bg: "bg-[#fffbeb]",
    text: "text-[#b45309]",
    border: "border-[#fde68a]",
    label: "Básico",
    desc: "Desembolso bajo / envase chico",
  },
}

const FORMATO_META: Record<FormatoTipo, { label: string; short: string; borderRadius: string; svgPath: string }> = {
  autoservicio: {
    label: "Autoservicio",
    short: "AUTO",
    borderRadius: "10px",
    // Carrito de compras
    svgPath:
      '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 7H6"/>',
  },
  almacen: {
    label: "Almacén",
    short: "ALM",
    borderRadius: "9999px",
    // Tienda / toldo
    svgPath: '<path d="M3 9l2-5h14l2 5"/><path d="M5 9v10h14V9"/><path d="M10 19v-5h4v5"/>',
  },
  despensa: {
    label: "Despensa",
    short: "DESP",
    borderRadius: "12px 4px 12px 4px",
    // Caja / paquete
    svgPath: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5"/><path d="M12 12v9"/><path d="M12 12L4 7.5"/>',
  },
  kiosco: {
    label: "Kiosco",
    short: "KIOS",
    borderRadius: "6px",
    // Rayo / conveniencia
    svgPath: '<polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/>',
  },
  cafeteria: {
    label: "Cafetería",
    short: "CAFE",
    borderRadius: "14px 14px 6px 14px",
    // Taza de café
    svgPath: '<path d="M17 8h1a3 3 0 0 1 0 6h-1"/><path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><line x1="6" y1="3" x2="6" y2="5"/><line x1="10" y1="3" x2="10" y2="5"/><line x1="14" y1="3" x2="14" y2="5"/>',
  },
  otro: {
    label: "Otro",
    short: "OTRO",
    borderRadius: "50%",
    svgPath: '<circle cx="12" cy="12" r="7"/>',
  },
}

function buildComercioIcon(categoria: CategoriaValor, formato: FormatoTipo, isSelected: boolean) {
  const cat = CATEGORIA_META[categoria] || CATEGORIA_META.estandar
  const fmt = FORMATO_META[formato] || FORMATO_META.otro
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
        <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? 19 : 15}" height="${isSelected ? 19 : 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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

function RecenterMap({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(position, 14, { duration: 0.65 })
  }, [map, position])
  return null
}

function loadComercios(): ComercioRecord[] {
  if (typeof window === "undefined") return DEFAULT_COMERCIOS
  try {
    const raw = window.sessionStorage.getItem(STORAGE_COMERCIOS_KEY)
    if (!raw) {
      window.sessionStorage.setItem(STORAGE_COMERCIOS_KEY, JSON.stringify(DEFAULT_COMERCIOS))
      return DEFAULT_COMERCIOS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COMERCIOS
  } catch {
    return DEFAULT_COMERCIOS
  }
}

export default function CustomerMapPage() {
  const [user, setUser] = useState<DemoUser | null>(null)
  const [comercios, setComercios] = useState<ComercioRecord[]>(DEFAULT_COMERCIOS)
  const [query, setQuery] = useState("")
  const [catFilter, setCatFilter] = useState<CategoriaValor | "todas">("todas")
  const [formatoFilter, setFormatoFilter] = useState<FormatoTipo | "todos">("todos")
  const [nseFilter, setNseFilter] = useState<NseNivel | "todos">("todos")
  const [tileStyle] = useState<TileStyle>("voyager")
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_COMERCIOS[0].id)

  useEffect(() => {
    const session = getSession()
    setUser(session)
    const localList = loadComercios()
    setComercios(localList)
    setSelectedId(localList[0]?.id || DEFAULT_COMERCIOS[0].id)

    // Intentamos GET /api/mapa (§5) con fallback a sessionStorage / datos semilla
    fetch("/api/mapa")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0 && data[0].ficha) {
          setComercios(data)
        }
      })
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    return comercios.filter((c) => {
      const matchQuery =
        c.nombre.toLowerCase().includes(query.toLowerCase()) ||
        c.direccion.toLowerCase().includes(query.toLowerCase()) ||
        c.vendedor.toLowerCase().includes(query.toLowerCase())
      const matchCat = catFilter === "todas" || c.ficha.categoria.valor === catFilter
      const matchFormato = formatoFilter === "todos" || c.ficha.formato.tipo === formatoFilter
      const matchNse = nseFilter === "todos" || c.ficha.nse.nivel === nseFilter
      return matchQuery && matchCat && matchFormato && matchNse
    })
  }, [comercios, query, catFilter, formatoFilter, nseFilter])

  const selected = useMemo(() => {
    return (
      filtered.find((c) => c.id === selectedId) ||
      comercios.find((c) => c.id === selectedId) ||
      filtered[0] ||
      comercios[0]
    )
  }, [filtered, comercios, selectedId])

  const countsByCategoria = useMemo(() => {
    return {
      premium: comercios.filter((c) => c.ficha.categoria.valor === "premium").length,
      estandar: comercios.filter((c) => c.ficha.categoria.valor === "estandar").length,
      basico: comercios.filter((c) => c.ficha.categoria.valor === "basico").length,
    }
  }, [comercios])

  function limpiarFiltros() {
    setQuery("")
    setCatFilter("todas")
    setFormatoFilter("todos")
    setNseFilter("todos")
  }

  const hayFiltrosActivos =
    query.trim() !== "" || catFilter !== "todas" || formatoFilter !== "todos" || nseFilter !== "todos"

  const selectedCatMeta = CATEGORIA_META[selected.ficha.categoria.valor]
  const selectedFmtMeta = FORMATO_META[selected.ficha.formato.tipo]
  const isAdmin = user?.role === "admin"

  return (
    <main className="min-h-[100dvh] bg-[#f5f8fc] text-[#17243a]">
      {/* Header adaptable hasta iPhone SE (320px) */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#e6ebf2] bg-white/95 px-3 backdrop-blur sm:h-[72px] sm:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <a
            href={isAdmin ? "/admin" : "/"}
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#dce4ef] text-[#52627b] hover:bg-[#f1f5fa]"
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </a>
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
          <a
            href={`/?comercio=${selected.id}`}
            className="flex items-center gap-1 rounded-lg bg-[#2166f3] px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#1657da] sm:px-3 sm:py-2 sm:text-xs"
          >
            <Sparkles size={13} />
            <span className="hidden min-[360px]:inline">Relevar</span>
            <span className="hidden sm:inline">comercio</span>
          </a>
          <a
            href="/settings"
            className="flex items-center gap-1.5 rounded-lg border border-[#dce4ef] px-2.5 py-1.5 text-[11px] font-semibold text-[#52627b] hover:bg-[#f5f8fc] sm:px-3 sm:py-2 sm:text-xs"
          >
            <UserRound size={13} />
            <span className="hidden sm:inline">Configuración</span>
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-4 p-3 sm:space-y-5 sm:p-7">
        {/* Mapa gratuito de OpenStreetMap y listado compacto de locales */}
        <div className="grid grid-cols-1 gap-4">
          <section className="flex flex-col rounded-2xl border border-[#dce4ef] bg-white p-3.5 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold">Locales</h2>
              <span className="text-xs text-[#718096]">{filtered.length} locales</span>
            </div>
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 text-[#8b98aa]" size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar local..." className="h-9 w-full rounded-xl border border-[#dce4ef] pl-9 pr-3 text-xs outline-none focus:border-[#2166f3]" />
            </label>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {filtered.map((comercio) => (
                <button key={comercio.id} type="button" onClick={() => setSelectedId(comercio.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${selected.id === comercio.id ? "border-[#2166f3] bg-[#e9f0ff] text-[#17243a]" : "border-[#e6ebf2] text-[#52627b]"}`}>
                  {comercio.nombre}
                </button>
              ))}
            </div>
          </section>
          {/* Lista detallada oculta: el mapa es la vista principal */}
          <section className="hidden">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold sm:text-base">Puntos de venta</h2>
                <p className="text-[11px] text-[#718096]">
                  Mostrando {filtered.length} de {comercios.length} comercios
                </p>
              </div>
              <Filter size={15} className="text-[#8b98aa]" />
            </div>

            <label className="relative block">
              <Search className="absolute left-3 top-2.5 text-[#8b98aa]" size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar comercio, calle o vendedor..."
                className="h-9 w-full rounded-xl border border-[#dce4ef] pl-9 pr-3 text-xs outline-none focus:border-[#2166f3]"
              />
            </label>

            <div className="mt-3 flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[470px]">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#dce4ef] p-5 text-center">
                  <p className="text-xs font-semibold text-[#52627b]">
                    Ningún comercio coincide con esos filtros.
                  </p>
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="mt-2 rounded-lg bg-[#e9f0ff] px-3 py-1.5 text-xs font-bold text-[#2166f3]"
                  >
                    Restablecer filtros
                  </button>
                </div>
              ) : (
                filtered.map((comercio) => {
                  const cat = CATEGORIA_META[comercio.ficha.categoria.valor]
                  const fmt = FORMATO_META[comercio.ficha.formato.tipo]
                  const isSelected = selected.id === comercio.id
                  return (
                    <button
                      key={comercio.id}
                      type="button"
                      onClick={() => setSelectedId(comercio.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-[#2166f3] bg-[#e9f0ff]/75 shadow-xs"
                          : "border-[#e6ebf2] hover:bg-[#f8fafd]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="mt-0.5 size-3 shrink-0 rounded-full border border-white shadow-xs"
                            style={{ background: cat.color }}
                          />
                          <strong className="truncate text-xs text-[#17243a]">
                            {comercio.nombre}
                          </strong>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${cat.bg} ${cat.text} ${cat.border}`}
                        >
                          {comercio.ficha.categoria.valor}
                        </span>
                      </div>

                      <p className="mt-1 truncate pl-5 text-[11px] text-[#718096]">
                        {comercio.direccion}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                        <span className="rounded bg-[#f1f5fa] px-1.5 py-0.5 text-[10px] font-semibold text-[#52627b]">
                          {fmt.label} ({comercio.ficha.formato.tamano})
                        </span>
                        <span className="rounded bg-[#f1f5fa] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#52627b]">
                          NSE {comercio.ficha.nse.nivel}
                        </span>
                        <span className="ml-auto text-[10px] font-semibold text-[#718096]">
                          {comercio.visitas} vis.
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          {/* Columna 2: Mapa Leaflet con CartoDB Voyager / Positron y Pines por Categoría + Formato */}
          <section className="flex flex-col overflow-hidden rounded-2xl border border-[#dce4ef] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6ebf2] px-4 py-3">
              <div>
                <h2 className="text-sm font-bold sm:text-base">
                  Cobertura geográfica ({TILE_URLS[tileStyle].label})
                </h2>
                <p className="text-[11px] text-[#718096]">
                  Comercios relevados en Rosario y alrededores
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-[#f1f5fa] px-2.5 py-1 text-[11px] font-semibold text-[#52627b]">
                <MapPin size={12} className="text-[#2166f3]" /> Rosario / Gran Rosario
              </span>
            </div>

            <div className="relative h-[340px] w-full sm:h-[510px]">
              <MapContainer
                center={[selected.lat, selected.lng]}
                zoom={14}
                scrollWheelZoom
                className="z-0 h-full w-full"
              >
                <TileLayer
                  key={tileStyle}
                  attribution={TILE_URLS[tileStyle].attribution}
                  url={TILE_URLS[tileStyle].url}
                />
                <RecenterMap position={[selected.lat, selected.lng]} />

                {filtered.map((comercio) => {
                  const isSelected = selected.id === comercio.id
                  const cat = CATEGORIA_META[comercio.ficha.categoria.valor]
                  const fmt = FORMATO_META[comercio.ficha.formato.tipo]
                  const primero = comercio.ficha.ofrecer_primero[0]
                  return (
                    <Marker
                      key={comercio.id}
                      position={[comercio.lat, comercio.lng]}
                      icon={buildComercioIcon(
                        comercio.ficha.categoria.valor,
                        comercio.ficha.formato.tipo,
                        isSelected
                      )}
                      eventHandlers={{ click: () => setSelectedId(comercio.id) }}
                    >
                      <Popup>
                        <div className="min-w-[210px] text-xs text-[#17243a]">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                              style={{ background: cat.color }}
                            >
                              {comercio.ficha.categoria.valor}
                            </span>
                            <span className="text-[10px] font-semibold text-[#718096]">
                              NSE {comercio.ficha.nse.nivel.toUpperCase()}
                            </span>
                          </div>
                          <strong className="block text-sm font-bold">{comercio.nombre}</strong>
                          <span className="block text-[11px] text-[#718096]">
                            {fmt.label} ({comercio.ficha.formato.tamano}) · {comercio.direccion}
                          </span>
                          {primero && (
                            <div className="mt-2 rounded-lg bg-[#f5f8fc] p-2 text-[11px]">
                              <span className="font-bold text-[#2166f3]">Ofrecer 1º:</span>{" "}
                              {primero.producto}
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>

            {/* Pie de leyenda de formatos e íconos */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6ebf2] bg-[#fbfcfe] px-4 py-2.5 text-[11px] text-[#52627b]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-[#17243a]">Formatos:</span>
                <span>🛒 AUTO (Autoservicio)</span>
                <span>🏪 ALM (Almacén)</span>
                <span>📦 DESP (Despensa)</span>
                <span>⚡ KIOS (Kiosco)</span>
                <span>☕ CAFE (Cafetería)</span>
              </div>
              <span className="text-[10px] text-[#8b98aa]">
                Vista: v_comercios_ultima_ficha
              </span>
            </div>
          </section>

          {/* La ficha detallada queda disponible al seleccionar un comercio desde la lista. */}
          <section className="hidden" aria-hidden="true">
            <div className="space-y-3.5">
              {/* Encabezado de la ficha seleccionada */}
              <div className="border-b border-[#edf1f6] pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#2166f3]">
                    Vista previa · Última Ficha (§4)
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${selectedCatMeta.bg} ${selectedCatMeta.text} ${selectedCatMeta.border}`}
                  >
                    {selected.ficha.categoria.valor}
                  </span>
                </div>
                <h3 className="mt-1.5 text-base font-bold text-[#17243a]">{selected.nombre}</h3>
                <p className="text-xs text-[#718096]">{selected.direccion}</p>
                <p className="mt-1 text-[11px] text-[#8b98aa]">
                  Vendedor: <b className="text-[#52627b]">{selected.vendedor}</b> ·{" "}
                  {selected.ultimaVisita}
                </p>
              </div>

              {/* Motivo de la Categoría */}
              <div className="rounded-xl border border-[#e4eaf2] bg-[#f8fafd] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#718096]">
                  Motivo de clasificación
                </p>
                <p className="mt-1 text-xs leading-5 text-[#17243a]">
                  {selected.ficha.categoria.motivo}
                </p>
              </div>

              {/* Formato + NSE */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[#f5f8fc] p-2.5">
                  <p className="text-[10px] font-bold uppercase text-[#718096]">Formato</p>
                  <p className="mt-0.5 font-bold capitalize text-[#17243a]">
                    {selectedFmtMeta.label} ({selected.ficha.formato.tamano})
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#52627b]">
                    {selected.ficha.formato.cajas} cajas · {selected.ficha.formato.m2_estimados} m² ·{" "}
                    {selected.ficha.formato.gondolas} gónd.
                  </p>
                </div>

                <div className="rounded-xl bg-[#f5f8fc] p-2.5">
                  <p className="text-[10px] font-bold uppercase text-[#718096]">NSE y Confianza</p>
                  <p className="mt-0.5 font-bold uppercase text-[#17243a]">
                    Nivel {selected.ficha.nse.nivel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#238451]">
                    Confianza IA: {Math.round(selected.ficha.confianza * 100)}%
                  </p>
                </div>
              </div>

              {/* Señales del NSE */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#718096]">
                  Señales visuales del NSE ({selected.ficha.nse.senales.length})
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {selected.ficha.nse.senales.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-[#e4eaf2] bg-[#fbfcfe] px-2 py-0.5 text-[11px] text-[#334155]"
                    >
                      • {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Qué ofrecer primero */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#2166f3]">
                  Qué ofrecer primero (Prioridad #1)
                </p>
                {selected.ficha.ofrecer_primero.slice(0, 2).map((rec, i) => (
                  <div
                    key={rec.producto}
                    className="mt-1.5 rounded-xl border border-[#dce4ef] bg-[#f8fafd] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#17243a]">
                        {i + 1}. {rec.producto}
                      </span>
                      <span className="rounded bg-[#e9f0ff] px-1.5 py-0.5 text-[9px] font-bold text-[#2166f3]">
                        productos_lv
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-[#52627b]">{rec.argumento}</p>
                  </div>
                ))}
              </div>

              {/* Surtido (tiene vs le_falta) y Competencia */}
              <div className="grid grid-cols-1 gap-2 text-[11px]">
                <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-2.5">
                  <span className="font-bold text-[#b45309]">Le falta incorporar: </span>
                  <span className="text-[#92400e]">
                    {selected.ficha.surtido.le_falta.join(" · ")}
                  </span>
                </div>
                <div className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] p-2.5">
                  <span className="font-bold text-[#be123c]">
                    Competencia ({selected.ficha.competencia.share_frentes_pct}% frentes):{" "}
                  </span>
                  <span className="text-[#9f1239]">
                    {selected.ficha.competencia.promos.join(", ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Trazabilidad + Botón para abrir en el chat de visita */}
            <div className="mt-4 border-t border-[#edf1f6] pt-3">
              <div className="mb-2.5 flex items-center justify-between text-[10px] text-[#8b98aa]">
                <span>Modelo: {selected.modelo}</span>
                <span>Prompt: {selected.prompt_version}</span>
              </div>
              <a
                href={`/?comercio=${selected.id}`}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2166f3] py-2.5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(33,102,243,.25)] transition hover:bg-[#1657da]"
              >
                Abrir en Copiloto de Visita
                <ArrowUpRight size={15} />
              </a>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

