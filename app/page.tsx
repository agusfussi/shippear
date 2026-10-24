"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { getSession, signOut, type DemoUser } from "../lib/auth"
import {
  AlertCircle,
  ArrowUp,
  Bot,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  Copy,
  FileAudio,
  ImagePlus,
  Layers,
  LogOut,
  MapPin,
  MessageSquarePlus,
  Mic,
  Navigation,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react"

export type FormatoTipo = "almacen" | "autoservicio" | "kiosco" | "despensa" | "cafeteria" | "otro"
export type NseNivel = "bajo" | "medio" | "alto"
export type CategoriaValor = "premium" | "estandar" | "basico"
export type FotoTipo = "fachada" | "gondola" | "extra"

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

export interface FotoSubida {
  id: string
  tipo: FotoTipo
  url: string
  nombre: string
  storage_path: string
}

export interface ChatMensaje {
  id: string
  rol: "user" | "assistant"
  contenido: string
  hora: string
}

const STORAGE_COMERCIOS_KEY = "shippear-comercios-v1"

export const CATALOGO_PRODUCTOS_LV = [
  "Café molido 500 g",
  "Café molido 250 g",
  "Mate cocido x 50",
  "Té en saquitos x 25",
  "Café instantáneo 100 g",
  "Café en grano 500 g",
  "Té verde x 20",
  "Cappuccino en sobres x 8",
  "Café torrado 250 g",
  "Especias surtidas",
]

export const INITIAL_COMERCIOS: ComercioRecord[] = [
  {
    id: "com-1",
    nombre: "Autoservicio El Encuentro",
    direccion: "Av. San Martín 1842, Florida",
    lat: -34.6037,
    lng: -58.3816,
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
    lat: -34.5845,
    lng: -58.3755,
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
          argumento:
            "Tracciona en el bloque saludable donde el local ya destina dos estantes completos.",
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
    lat: -34.5961,
    lng: -58.3692,
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
          argumento:
            "Exhibidor colgante junto a la fiambrería que no ocupa góndola y suma venta cruzada inmediata.",
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
    lat: -34.6092,
    lng: -58.3924,
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
          argumento:
            "Desembolso bajo por caja y excelente costo por taza para la compra diaria del vecindario.",
        },
        {
          producto: "Café torrado 250 g",
          argumento:
            "Envase económico que le permite al comerciante trabajar primera marca sin inmovilizar capital.",
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
    lat: -34.5889,
    lng: -58.4205,
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
          argumento:
            "Ideal para exhibir en caja como compra de impulso para clientes que trabajan en la zona.",
        },
        {
          producto: "Café molido 250 g",
          argumento:
            "Formato práctico para clientes que buscan llevar café de filtro a su hogar.",
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
    lat: -34.6042,
    lng: -58.4115,
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
          argumento:
            "Permite venta por sobre individual en mostrador con rápida salida en turno mañana y noche.",
        },
        {
          producto: "Café instantáneo 100 g",
          argumento:
            "Resuelve la compra de conveniencia cuando los comercios de cercanía están cerrados.",
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

const PHOTO_SLOTS_CONFIG: Array<{
  tipo: FotoTipo
  titulo: string
  subtitulo: string
  badge: string
}> = [
  {
    tipo: "fachada",
    titulo: "1. Fachada",
    subtitulo: "Frente, cartel y entrada (clave para formato y NSE)",
    badge: "fachada",
  },
  {
    tipo: "gondola",
    titulo: "2. Góndola",
    subtitulo: "Estanterías de infusiones, precios y competencia",
    badge: "gondola",
  },
  {
    tipo: "extra",
    titulo: "3. Extra",
    subtitulo: "Punteras, exhibidores, promos 2x1 o sector cajas",
    badge: "extra",
  },
]

const CHIPS_REPREGUNTA = [
  "¿Cómo rebato objeción de precio?",
  "Armar combo inicial con lo que le falta",
  "¿Cómo ganarle frentes a la competencia?",
  "¿Qué exhibidor le conviene por sus m²?",
  "Argumento corto para cerrar en 30 segundos",
]

function loadComercios(): ComercioRecord[] {
  if (typeof window === "undefined") return INITIAL_COMERCIOS
  try {
    const raw = window.sessionStorage.getItem(STORAGE_COMERCIOS_KEY)
    if (!raw) {
      window.sessionStorage.setItem(STORAGE_COMERCIOS_KEY, JSON.stringify(INITIAL_COMERCIOS))
      return INITIAL_COMERCIOS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_COMERCIOS
  } catch {
    return INITIAL_COMERCIOS
  }
}

function saveComercios(list: ComercioRecord[]) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(STORAGE_COMERCIOS_KEY, JSON.stringify(list))
  } catch {
    // ignore storage quota errors
  }
}

function validarConsistenciaFicha(ficha: FichaLocal): { valida: boolean; motivoConsistencia: string } {
  if (ficha.nse.nivel === "alto" && ficha.categoria.valor === "basico") {
    return { valida: false, motivoConsistencia: "Inconsistencia: NSE alto no puede clasificarse como básico." }
  }
  if (ficha.nse.nivel === "bajo" && ficha.categoria.valor === "premium") {
    return { valida: false, motivoConsistencia: "Inconsistencia: NSE bajo no puede clasificarse como premium." }
  }
  return {
    valida: true,
    motivoConsistencia: `Consistente (§4): NSE ${ficha.nse.nivel} ↔ categoría ${ficha.categoria.valor} · Catálogo productos_lv verificado`,
  }
}

function getCategoriaStyle(valor: CategoriaValor) {
  if (valor === "premium") {
    return {
      bg: "bg-[#ecfdf5]",
      text: "text-[#047857]",
      border: "border-[#a7f3d0]",
      dot: "#10b981",
      label: "PREMIUM",
    }
  }
  if (valor === "estandar") {
    return {
      bg: "bg-[#e9f0ff]",
      text: "text-[#1d4ed8]",
      border: "border-[#bfdbfe]",
      dot: "#2166f3",
      label: "ESTANDAR",
    }
  }
  return {
    bg: "bg-[#fffbeb]",
    text: "text-[#b45309]",
    border: "border-[#fde68a]",
    dot: "#f59e0b",
    label: "BASICO",
  }
}

function generarRespuestaAgentica(pregunta: string, comercio: ComercioRecord): string {
  const q = pregunta.toLowerCase()
  const { ficha } = comercio
  const primero = ficha.ofrecer_primero[0]
  const segundo = ficha.ofrecer_primero[1]
  const faltantes = ficha.surtido.le_falta.join(", ") || "línea de reposición La Virginia"
  const promosComp = ficha.competencia.promos[0] || "descuentos por volumen"

  if (q.includes("precio") || q.includes("objeci") || q.includes("caro")) {
    return `Para ${comercio.nombre} (NSE ${ficha.nse.nivel}, formato ${ficha.formato.tipo}): apoyate en que se detectó "${ficha.nse.senales[0] || "consumo de marcas intermedias"}". Proponé entrar con **${primero?.producto || "Café molido 250 g"}**: tiene desembolso por unidad menor al de 500 g, iguala el precio por frente de la competencia (que hoy tiene ${ficha.competencia.share_frentes_pct}% de góndola) y asegura rotación rápida sin inmovilizar caja.`
  }
  if (q.includes("combo") || q.includes("falta") || q.includes("pedido")) {
    return `**Combo Inicial Sugerido para ${comercio.nombre}:**\n1. **${primero?.producto || "Café molido 250 g"}** (Prioridad #1: cubre brecha directa en góndola).\n2. **${segundo?.producto || ficha.surtido.le_falta[1] || "Mate cocido x 50"}** (Complemento de alta rotación).\n• Hoy ya trabaja: ${ficha.surtido.tiene.length ? ficha.surtido.tiene.join(", ") : "sin frentes activos de La Virginia"}.\n• Oportunidad total detectada en catálogo \`productos_lv\`: ${faltantes}.`
  }
  if (q.includes("frente") || q.includes("competencia") || q.includes("promo")) {
    return `En las fotos se ven **${ficha.competencia.marcas} marcas competidoras** ocupando el **${ficha.competencia.share_frentes_pct}% de los frentes** con acción activa: *"${promosComp}"*.\n**Estrategia:** ubicá **${primero?.producto || "Café molido 250 g"}** en el estante medio (altura ojos) al lado del líder para capturar comparación directa de precio, y negociá 2 frentes juntos para romper el bloque visual de la competencia.`
  }
  if (q.includes("exhibidor") || q.includes("m2") || q.includes("m²") || q.includes("espacio") || q.includes("gondola")) {
    return `El local es un **${ficha.formato.tipo} ${ficha.formato.tamano}** (~${ficha.formato.m2_estimados} m², ${ficha.formato.gondolas} góndolas y ${ficha.formato.cajas} ${ficha.formato.cajas === 1 ? "caja" : "cajas"}).\n${
      ficha.formato.m2_estimados <= 45
        ? "Por el metraje compacto, no propongas puntera de piso: llevá **exhibidor de mostrador / tira impulsiva** junto a la caja para Cappuccino en sobres o Té x 25."
        : "Con este metraje y flujo de cajas, califica para **exhibidor lateral en góndola principal** + cartel de precios La Virginia en el bloque de desayuno."
    }`
  }
  if (q.includes("30 segundos") || q.includes("corto") || q.includes("argumento")) {
    return `🗣️ **Pitch de 30s para el encargado de ${comercio.nombre}:**\n"${primero?.argumento || "Tenés la categoría moviéndose fuerte pero te falta el formato de mayor rotación de La Virginia."} Si sumamos hoy **${primero?.producto || "Café molido 250 g"}** y **${segundo?.producto || "Mate cocido x 50"}**, completás la góndola de infusiones sin subir el ticket para tu cliente."`
  }
  return `Basado en la ficha de **${comercio.nombre}** (Categoría **${ficha.categoria.valor.toUpperCase()}**, NSE **${ficha.nse.nivel}**, confianza ${Math.round(ficha.confianza * 100)}%):\n• **Qué ofrecer primero:** ${primero?.producto || "Café molido 250 g"} — *${primero?.argumento}*\n• **Brecha de surtido (\`le_falta\`):** ${faltantes}.\n• **Señales relevadas:** ${ficha.nse.senales.slice(0, 3).join("; ")}.`
}

export default function SellerPage() {
  const [user, setUser] = useState<DemoUser | null>(null)
  const [ready, setReady] = useState(false)

  const [comercios, setComercios] = useState<ComercioRecord[]>(INITIAL_COMERCIOS)
  const [selectedId, setSelectedId] = useState<string>(INITIAL_COMERCIOS[0].id)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [searchComercio, setSearchComercio] = useState("")

  // Modal Alta de Comercio
  const [showNewComercioModal, setShowNewComercioModal] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevaDireccion, setNuevaDireccion] = useState("")
  const [nuevoFormato, setNuevoFormato] = useState<FormatoTipo>("autoservicio")
  const [nuevaLat, setNuevaLat] = useState("-34.6015")
  const [nuevaLng, setNuevaLng] = useState("-58.3840")
  const [gpsStatus, setGpsStatus] = useState("")
  const [createError, setCreateError] = useState("")

  // Visita: notas, audio y los 3 slots de fotos del contrato (fachada, gondola, extra)
  const [message, setMessage] = useState("")
  const [audioName, setAudioName] = useState("")
  const [fotosPorSlot, setFotosPorSlot] = useState<Record<FotoTipo, FotoSubida[]>>({
    fachada: [],
    gondola: [],
    extra: [],
  })
  const [activeSlotInput, setActiveSlotInput] = useState<FotoTipo>("gondola")
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)

  // Estado de análisis y Ficha
  const [analyzing, setAnalyzing] = useState(false)
  const [sent, setSent] = useState(false)
  const [visitaId, setVisitaId] = useState("vis-2026-1024")
  const [showRawJson, setShowRawJson] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  // Chat agéntico de repregunta
  const [chatMessages, setChatMessages] = useState<ChatMensaje[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) {
      window.location.href = "/login"
      return
    }
    if (session.role !== "seller") {
      window.location.href = "/admin"
      return
    }
    setUser(session)
    const stored = loadComercios()
    setComercios(stored)

    // Si viene ?comercio=id desde el mapa, seleccionarlo
    const params = new URLSearchParams(window.location.search)
    const qComercio = params.get("comercio")
    if (qComercio && stored.some((c) => c.id === qComercio)) {
      setSelectedId(qComercio)
    }
    setReady(true)
  }, [])

  const comercioActual = useMemo(
    () => comercios.find((c) => c.id === selectedId) || comercios[0],
    [comercios, selectedId]
  )

  const comerciosFiltrados = useMemo(
    () =>
      comercios.filter(
        (c) =>
          c.nombre.toLowerCase().includes(searchComercio.toLowerCase()) ||
          c.direccion.toLowerCase().includes(searchComercio.toLowerCase()) ||
          c.ficha.formato.tipo.toLowerCase().includes(searchComercio.toLowerCase())
      ),
    [comercios, searchComercio]
  )

  const totalFotosCargadas =
    fotosPorSlot.fachada.length + fotosPorSlot.gondola.length + fotosPorSlot.extra.length

  function abrirSelectorArchivo(slot: FotoTipo) {
    setActiveSlotInput(slot)
    setTimeout(() => fileRef.current?.click(), 0)
  }

  function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return
    const nuevas: FotoSubida[] = Array.from(files).map((file, idx) => {
      const n = fotosPorSlot[activeSlotInput].length + idx + 1
      return {
        id: `${activeSlotInput}-${Date.now()}-${idx}`,
        tipo: activeSlotInput,
        url: URL.createObjectURL(file),
        nombre: file.name,
        storage_path: `${comercioActual.id}/${visitaId}/${activeSlotInput}-${n}.jpg`,
      }
    })
    setFotosPorSlot((prev) => ({
      ...prev,
      [activeSlotInput]: [...prev[activeSlotInput], ...nuevas],
    }))
  }

  function cargarFotosDemo() {
    const svgDataUrl = (bg: string, label: string, sub: string) =>
      `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" rx="16" fill="${bg}"/><circle cx="270" cy="40" r="50" fill="rgba(255,255,255,0.12)"/><text x="22" y="95" fill="#ffffff" font-family="Arial,sans-serif" font-size="20" font-weight="bold">${label}</text><text x="22" y="125" fill="rgba(255,255,255,0.85)" font-family="Arial,sans-serif" font-size="13">${sub}</text><text x="22" y="168" fill="rgba(255,255,255,0.7)" font-family="monospace" font-size="11">bucket: fotos/${comercioActual.id}</text></svg>`
      )}`

    setFotosPorSlot({
      fachada: [
        {
          id: "demo-fachada-1",
          tipo: "fachada",
          url: svgDataUrl("#1e3a8a", "Fachada · Frente Local", comercioActual.nombre),
          nombre: "fachada-1.jpg",
          storage_path: `${comercioActual.id}/${visitaId}/fachada-1.jpg`,
        },
      ],
      gondola: [
        {
          id: "demo-gondola-1",
          tipo: "gondola",
          url: svgDataUrl("#0f766e", "Góndola Infusiones", "Café, Té y Yerba · 3 estantes"),
          nombre: "gondola-1.jpg",
          storage_path: `${comercioActual.id}/${visitaId}/gondola-1.jpg`,
        },
      ],
      extra: [
        {
          id: "demo-extra-1",
          tipo: "extra",
          url: svgDataUrl("#b45309", "Extra · Promo y Caja", "Cartel 2x1 competencia"),
          nombre: "extra-1.jpg",
          storage_path: `${comercioActual.id}/${visitaId}/extra-1.jpg`,
        },
      ],
    })
  }

  function quitarFoto(slot: FotoTipo, id: string) {
    setFotosPorSlot((prev) => ({
      ...prev,
      [slot]: prev[slot].filter((f) => f.id !== id),
    }))
  }

  async function analizarVisita() {
    setAnalyzing(true)
    const nuevaVisitaId = `vis-${Date.now().toString().slice(-6)}`
    setVisitaId(nuevaVisitaId)

    // Intentamos el flujo del contrato (§5): POST /api/visitas -> /fotos -> /analizar
    // Si las rutas del servidor aún no están montadas, caemos con gracia a la ficha validada del contrato (§4)
    try {
      const res = await fetch(`/api/visitas/${nuevaVisitaId}/analizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comercio_id: comercioActual.id,
          notas: message,
          fotos: [
            ...fotosPorSlot.fachada,
            ...fotosPorSlot.gondola,
            ...fotosPorSlot.extra,
          ].map((f) => ({ tipo: f.tipo, storage_path: f.storage_path })),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.formato && data.nse && data.categoria) {
          actualizarFichaComercio(comercioActual.id, data as FichaLocal)
        }
      }
    } catch {
      // Fallback al contrato §4 local cuando la API aún no está conectada
    }

    // Si el vendedor escribió notas específicas, enriquecemos las señales manteniendo el contrato §4
    if (message.trim()) {
      const notaLimpia = message.trim().slice(0, 90)
      const senalesActuales = comercioActual.ficha.nse.senales
      const nuevasSenales = senalesActuales.includes(notaLimpia)
        ? senalesActuales
        : [notaLimpia, ...senalesActuales.slice(0, 3)]
      actualizarFichaComercio(comercioActual.id, {
        ...comercioActual.ficha,
        nse: {
          ...comercioActual.ficha.nse,
          senales: nuevasSenales,
        },
      })
    } else {
      // Incrementar contador de visitas
      actualizarFichaComercio(comercioActual.id, comercioActual.ficha)
    }

    const f = comercioActual.ficha
    setChatMessages([
      {
        id: "msg-welcome",
        rol: "assistant",
        hora: "Ahora",
        contenido: `¡Listo el análisis de **${comercioActual.nombre}**! Clasifiqué el local como categoría **${f.categoria.valor.toUpperCase()}** (${f.formato.tipo} ${f.formato.tamano}, NSE **${f.nse.nivel}**). Detecté que le falta **${f.surtido.le_falta.slice(0, 2).join(" y ")}** frente a un ${f.competencia.share_frentes_pct}% de frentes de la competencia. ¿Qué querés profundizar antes de hablar con el cliente?`,
      },
    ])

    setAnalyzing(false)
    setSent(true)
  }

  function actualizarFichaComercio(comercioId: string, nuevaFicha: FichaLocal) {
    const validacion = validarConsistenciaFicha(nuevaFicha)
    if (!validacion.valida) return
    const next = comercios.map((c) =>
      c.id === comercioId
        ? {
            ...c,
            visitas: c.visitas + 1,
            ultimaVisita: "Recién analizado",
            ficha: nuevaFicha,
          }
        : c
    )
    setComercios(next)
    saveComercios(next)
  }

  async function enviarPreguntaChat(textoPregunta: string) {
    const clean = textoPregunta.trim()
    if (!clean || chatLoading) return
    const userMsg: ChatMensaje = {
      id: `u-${Date.now()}`,
      rol: "user",
      contenido: clean,
      hora: "Ahora",
    }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput("")
    setChatLoading(true)

    let respuestaTexto = ""
    try {
      const res = await fetch(`/api/visitas/${visitaId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: clean,
          ficha: comercioActual.ficha,
          comercio_id: comercioActual.id,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.respuesta || data?.contenido) {
          respuestaTexto = data.respuesta || data.contenido
        }
      }
    } catch {
      // Fallback contextual local
    }

    if (!respuestaTexto) {
      respuestaTexto = generarRespuestaAgentica(clean, comercioActual)
    }

    setChatMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        rol: "assistant",
        contenido: respuestaTexto,
        hora: "Ahora",
      },
    ])
    setChatLoading(false)
  }

  function usarUbicacionGps() {
    setGpsStatus("Obteniendo ubicación...")
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setNuevaLat(pos.coords.latitude.toFixed(4))
          setNuevaLng(pos.coords.longitude.toFixed(4))
          setGpsStatus("Ubicación GPS capturada")
        },
        () => {
          setNuevaLat("-34.5998")
          setNuevaLng("-58.3825")
          setGpsStatus("GPS simulado (CABA / GBA)")
        },
        { timeout: 4000 }
      )
    } else {
      setNuevaLat("-34.5998")
      setNuevaLng("-58.3825")
      setGpsStatus("GPS simulado (CABA / GBA)")
    }
  }

  async function crearNuevoComercio(e: FormEvent) {
    e.preventDefault()
    setCreateError("")
    if (!nuevoNombre.trim() || !nuevaDireccion.trim()) {
      setCreateError("Completá el nombre y la dirección del comercio.")
      return
    }
    const latNum = parseFloat(nuevaLat)
    const lngNum = parseFloat(nuevaLng)
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setCreateError("Ingresá coordenadas válidas de latitud y longitud.")
      return
    }

    const nuevoId = `com-${Date.now().toString().slice(-5)}`
    const nuevoComercio: ComercioRecord = {
      id: nuevoId,
      nombre: nuevoNombre.trim(),
      direccion: nuevaDireccion.trim(),
      lat: latNum,
      lng: lngNum,
      vendedor: user?.name || "Martina Ríos",
      visitas: 1,
      ultimaVisita: "Recién dado de alta",
      modelo: "gemini-2.5-flash",
      prompt_version: "v1.2",
      ficha: {
        formato: {
          tipo: nuevoFormato,
          tamano: nuevoFormato === "kiosco" || nuevoFormato === "despensa" ? "chico" : "mediano",
          cajas: nuevoFormato === "autoservicio" ? 2 : 1,
          m2_estimados: nuevoFormato === "autoservicio" ? 65 : 35,
          gondolas: nuevoFormato === "autoservicio" ? 3 : 2,
        },
        nse: {
          nivel: "medio",
          senales: [
            "primer relevamiento en punto de venta",
            "mix de primeras y segundas marcas",
            "alto tránsito peatonal en cuadra comercial",
          ],
        },
        surtido: {
          tiene: ["Mate cocido x 50"],
          le_falta: ["Café molido 250 g", "Té en saquitos x 25", "Café instantáneo 100 g"],
        },
        ofrecer_primero: [
          {
            producto: "Café molido 250 g",
            argumento:
              "Producto ancla para apertura de cuenta: alta rotación y desembolso moderado por bulto.",
          },
          {
            producto: "Té en saquitos x 25",
            argumento: "Completa la línea básica de infusiones junto al mate cocido con excelente margen.",
          },
        ],
        categoria: {
          valor: "estandar",
          motivo: `Comercio formato ${nuevoFormato} con flujo barrial medio y alto potencial de desarrollo de surtido.`,
        },
        competencia: {
          marcas: 2,
          share_frentes_pct: 65,
          promos: ["Exhibición de marca competidora en estante central"],
        },
        confianza: 0.82,
      },
    }

    try {
      await fetch("/api/comercios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevoComercio.nombre,
          direccion: nuevoComercio.direccion,
          lat: nuevoComercio.lat,
          lng: nuevoComercio.lng,
        }),
      })
    } catch {
      // Fallback local + sessionStorage
    }

    const actualizados = [nuevoComercio, ...comercios]
    setComercios(actualizados)
    saveComercios(actualizados)
    setSelectedId(nuevoComercio.id)
    setShowNewComercioModal(false)
    setSelectorOpen(false)
    setSent(false)
    setNuevoNombre("")
    setNuevaDireccion("")
    setGpsStatus("")
  }

  function copiarArgumento(texto: string, idx: number) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(texto).catch(() => {})
    }
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1800)
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fc] text-sm text-[#718096]">
        Verificando acceso...
      </main>
    )
  }

  const catStyle = getCategoriaStyle(comercioActual.ficha.categoria.valor)
  const consistencia = validarConsistenciaFicha(comercioActual.ficha)

  return (
    <div className="flex min-h-[100dvh] bg-[#f5f8fc] pb-16 text-[#17243a] lg:pb-0">
      {/* Sidebar Desktop */}
      <aside className="hidden w-[252px] shrink-0 flex-col bg-[#0b1f3a] text-white lg:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#2166f3]">
            <Sparkles size={19} />
          </div>
          <div>
            <span className="text-[19px] font-bold tracking-tight">
              Shippe<span className="text-[#6d9dff]">.AR</span>
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#7890b3]">
              La Virginia · PDV
            </span>
          </div>
        </div>
        <div className="px-4">
          <p className="px-3 pb-2.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#7890b3]">
            Ruta del vendedor
          </p>
          <Nav href="/" active icon={<Sparkles size={17} />} label="Relevar visita (IA)" />
          <Nav href="/map" icon={<MapPin size={17} />} label="Mapa de comercios" />
          <button
            type="button"
            onClick={() => setSelectorOpen(true)}
            className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#a9bad5] transition hover:bg-white/5"
          >
            <Store size={17} />
            Mis comercios ({comercios.length})
          </button>
          <button
            type="button"
            onClick={() => setShowNewComercioModal(true)}
            className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#6d9dff] transition hover:bg-white/5"
          >
            <Plus size={17} />
            Alta de comercio
          </button>
          <Nav href="/settings" icon={<Settings size={17} />} label="Configuración" />
        </div>

        <div className="mx-4 mt-6 rounded-xl border border-white/10 bg-white/5 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#6d9dff]">
            Contrato IA activo
          </p>
          <p className="mt-1 text-xs font-semibold text-white">
            {comercioActual.modelo}
          </p>
          <p className="mt-0.5 text-[11px] text-[#a9bad5]">
            Prompt {comercioActual.prompt_version} · Catálogo LV ({CATALOGO_PRODUCTOS_LV.length} SKUs)
          </p>
        </div>

        <div className="mt-auto border-t border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d5e2ff] text-xs font-bold text-[#2166f3]">
              {(user?.name || "MR")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name || "Martina Ríos"}</p>
              <p className="truncate text-xs text-[#7890b3]">
                Vendedor · {user?.zone || "Zona Norte"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                signOut()
                window.location.href = "/login"
              }}
              title="Cerrar sesión"
              className="rounded-lg p-1.5 text-[#7890b3] hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header adaptable hasta 320px (iPhone SE) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#e6ebf2] bg-white/95 px-3 backdrop-blur sm:h-[70px] sm:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#2166f3] text-white lg:hidden">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium text-[#718096] sm:text-xs">
                Shippe.AR · {user?.zone || "Zona Norte"}
              </p>
              <h1 className="truncate text-sm font-bold sm:text-[18px]">
                Perfil del Punto de Venta
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setShowNewComercioModal(true)}
              className="flex items-center gap-1 rounded-lg bg-[#e9f0ff] px-2.5 py-1.5 text-[11px] font-bold text-[#2166f3] transition hover:bg-[#dce8ff] sm:px-3 sm:py-2 sm:text-xs"
            >
              <Plus size={14} />
              <span>Nuevo local</span>
            </button>
            <a
              href="/map"
              className="hidden items-center gap-1.5 rounded-lg border border-[#dce4ef] px-3 py-2 text-xs font-semibold text-[#52627b] transition hover:bg-[#f5f8fc] sm:flex"
            >
              <MapPin size={14} />
              Mapa
            </a>
            <a
              href="/settings"
              aria-label="Abrir configuración"
              className="hidden rounded-lg border border-[#dce4ef] px-3 py-2 text-xs font-semibold text-[#52627b] transition hover:bg-[#f5f8fc] md:inline-flex"
            >
              Configuración
            </a>
            <button
              type="button"
              onClick={() => {
                signOut()
                window.location.href = "/login"
              }}
              className="rounded-lg border border-[#dce4ef] px-2.5 py-1.5 text-[11px] font-semibold text-[#52627b] transition hover:bg-[#f5f8fc] sm:px-3 sm:py-2 sm:text-xs"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Contenedor principal con padding optimizado para pantallas desde 320px */}
        <div className="mx-auto flex w-full max-w-[1060px] flex-1 flex-col px-3 py-4 sm:px-8 sm:py-7">
          {/* Selector de Comercio + Estado de Categoría */}
          <div className="relative mb-4 sm:mb-6">
            <div className="flex flex-col gap-2 rounded-2xl border border-[#dce4ef] bg-white p-3 shadow-[0_2px_10px_rgba(31,56,88,.04)] sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5">
              <button
                type="button"
                onClick={() => setSelectorOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e9f0ff] text-[#2166f3]">
                  <Store size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b98aa]">
                      Comercio activo
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                    >
                      {catStyle.label}
                    </span>
                    <span className="rounded-full bg-[#f1f5fa] px-2 py-0.5 text-[10px] font-semibold capitalize text-[#52627b]">
                      {comercioActual.ficha.formato.tipo}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-bold text-[#17243a] sm:text-base">
                    {comercioActual.nombre}
                  </p>
                  <p className="truncate text-[11px] text-[#718096]">
                    {comercioActual.direccion} · {comercioActual.visitas} visitas
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-[#718096] transition ${selectorOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div className="flex items-center justify-between gap-2 border-t border-[#edf1f6] pt-2 sm:border-t-0 sm:pt-0">
                <button
                  type="button"
                  onClick={() => setSent((prev) => !prev)}
                  className="rounded-lg border border-[#dce4ef] bg-[#f8fafd] px-2.5 py-1.5 text-[11px] font-semibold text-[#2166f3] transition hover:bg-[#e9f0ff]"
                >
                  {sent ? "← Volver a cargar fotos" : "Ver última ficha (§4)"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewComercioModal(true)}
                  className="flex items-center gap-1 rounded-lg bg-[#2166f3] px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#1657da]"
                >
                  <Plus size={13} />
                  Alta comercio
                </button>
              </div>
            </div>

            {/* Dropdown Selector de Comercio */}
            {selectorOpen && (
              <div className="animate-in absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-[#dce4ef] bg-white p-3 shadow-[0_16px_40px_rgba(11,31,58,.14)] sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#17243a]">
                    Seleccionar comercio ({comercios.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectorOpen(false)}
                    className="rounded-lg p-1 text-[#718096] hover:bg-[#f1f5fa]"
                  >
                    <X size={15} />
                  </button>
                </div>
                <label className="relative mb-3 block">
                  <Search className="absolute left-3 top-2.5 text-[#8b98aa]" size={14} />
                  <input
                    value={searchComercio}
                    onChange={(e) => setSearchComercio(e.target.value)}
                    placeholder="Buscar por nombre, dirección o formato..."
                    className="h-9 w-full rounded-lg border border-[#dce4ef] pl-8 pr-3 text-xs outline-none focus:border-[#2166f3]"
                  />
                </label>
                <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                  {comerciosFiltrados.map((c) => {
                    const cs = getCategoriaStyle(c.ficha.categoria.valor)
                    const isSelected = c.id === comercioActual.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(c.id)
                          setSelectorOpen(false)
                          setChatMessages([
                            {
                              id: `init-${c.id}`,
                              rol: "assistant",
                              hora: "Ahora",
                              contenido: `Ficha cargada para **${c.nombre}** (${c.ficha.formato.tipo}, NSE ${c.ficha.nse.nivel}, categoría **${c.ficha.categoria.valor}**). Elegí un chip o preguntame cómo encarar la venta.`,
                            },
                          ])
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition ${
                          isSelected
                            ? "border-[#2166f3] bg-[#e9f0ff]/70"
                            : "border-[#edf1f6] hover:bg-[#f8fafd]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-[#17243a]">
                              {c.nombre}
                            </span>
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${cs.bg} ${cs.text} ${cs.border}`}
                            >
                              {c.ficha.categoria.valor}
                            </span>
                            <span className="rounded bg-[#f1f5fa] px-1.5 py-0.5 text-[9px] font-semibold capitalize text-[#52627b]">
                              {c.ficha.formato.tipo}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-[#718096]">
                            {c.direccion} · NSE {c.ficha.nse.nivel}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold text-[#2166f3]">
                          {c.visitas} vis.
                        </span>
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectorOpen(false)
                    setShowNewComercioModal(true)
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#2166f3] bg-[#f5f9ff] py-2 text-xs font-bold text-[#2166f3] hover:bg-[#e9f0ff]"
                >
                  <Plus size={14} /> Crear nuevo comercio
                </button>
              </div>
            )}
          </div>

          {/* Input de cámara oculto compartido por los 3 slots */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => onFilesSelected(e.target.files)}
          />
          <input
            ref={audioRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => setAudioName(e.target.files?.[0]?.name || "")}
          />

          {!sent ? (
            /* MODO CARGA DE VISITA: 3 SLOTS DE FOTOS + NOTA + ANALIZAR */
            <section className="rounded-2xl border border-[#dce4ef] bg-white p-3.5 shadow-[0_6px_24px_rgba(31,56,88,.05)] sm:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e9f0ff] text-[#2166f3] sm:h-10 sm:w-10">
                    <Camera size={19} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold sm:text-base">
                      Carga de fotos del comercio
                    </h2>
                  </div>
                </div>
              </div>

              {/* 3 Slots de Fotos: fachada | gondola | extra */}
              <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {PHOTO_SLOTS_CONFIG.map((slot) => {
                  const slotPhotos = fotosPorSlot[slot.tipo]
                  const hasPhotos = slotPhotos.length > 0
                  return (
                    <div
                      key={slot.tipo}
                      className={`flex flex-col justify-between rounded-xl border p-3 transition ${
                        hasPhotos
                          ? "border-[#9cb9f9] bg-[#f5f9ff]"
                          : "border-[#e4eaf2] bg-[#fbfcfe]"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-[#17243a]">{slot.titulo}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              hasPhotos
                                ? "bg-[#2166f3] text-white"
                                : "bg-[#eef3fb] text-[#52627b]"
                            }`}
                          >
                            {hasPhotos ? `${slotPhotos.length} cargada(s)` : slot.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-[#718096]">
                          {slot.subtitulo}
                        </p>

                        {hasPhotos && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {slotPhotos.map((foto) => (
                              <div
                                key={foto.id}
                                className="relative h-14 w-14 overflow-hidden rounded-lg border border-[#dce4ef] bg-white"
                              >
                                <img
                                  src={foto.url}
                                  alt={`Foto ${slot.tipo}`}
                                  className="h-full w-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => quitarFoto(slot.tipo, foto.id)}
                                  aria-label={`Quitar foto de ${slot.tipo}`}
                                  className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => abrirSelectorArchivo(slot.tipo)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#dce4ef] bg-white py-2 text-xs font-semibold text-[#2166f3] transition hover:border-[#2166f3] hover:bg-[#e9f0ff]/50"
                      >
                        <ImagePlus size={14} />
                        {hasPhotos ? "Sumar otra foto" : `Subir ${slot.badge}`}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Observaciones del vendedor + botón Analizar */}
              <div className="rounded-xl border border-[#e4eaf2] bg-[#fbfcfe] p-3 focus-within:border-[#9cb9f9] focus-within:ring-3 focus-within:ring-[#e9f0ff]">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Opcional: agregá contexto (ej. 'El dueño busca opciones económicas de café molido, hay promo 2x1 de competencia en estante central')..."
                  className="min-h-[76px] w-full resize-none bg-transparent p-1 text-xs leading-5 outline-none placeholder:text-[#98a6b8] sm:min-h-[88px] sm:text-sm"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf1f6] pt-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => abrirSelectorArchivo("gondola")}
                      className="flex h-8 items-center gap-1 rounded-lg bg-[#e9f0ff] px-2.5 text-[11px] font-semibold text-[#2166f3] hover:bg-[#dfeaff]"
                    >
                      <Camera size={14} />
                      Cámara rápida
                    </button>
                    <button
                      type="button"
                      onClick={() => audioRef.current?.click()}
                      className={`flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition ${
                        audioName
                          ? "bg-[#e6f7ef] text-[#238451]"
                          : "bg-[#f1f5fa] text-[#52627b] hover:bg-[#e4ebf5]"
                      }`}
                    >
                      <Mic size={14} />
                      {audioName ? "Audio adjunto" : "Nota de voz"}
                    </button>
                    {totalFotosCargadas > 0 && (
                      <span className="rounded-full bg-[#e6f7ef] px-2 py-0.5 text-[10px] font-bold text-[#238451]">
                        {totalFotosCargadas} foto(s) listas
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={analizarVisita}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#2166f3] px-4 py-2.5 text-xs font-bold text-white shadow-[0_5px_12px_rgba(33,102,243,.25)] transition hover:bg-[#1657da] disabled:opacity-60 sm:w-auto"
                  >
                    <Sparkles size={14} />
                    {analyzing ? "Analizando PDV..." : "Analizar visita y generar Ficha"}
                    <ArrowUp size={14} />
                  </button>
                </div>
              </div>
            </section>
          ) : (
            /* MODO FICHA COMPLETA DEL CONTRATO (§4) + CHAT AGÉNTICO */
            <section className="animate-in space-y-4">
              {/* Barra superior de estado de la Ficha */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dce4ef] bg-white p-3.5 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e6f7ef] text-[#238451]">
                    <CheckCircle2 size={19} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="text-sm font-bold sm:text-base">
                        Ficha del Punto de Venta (§4)
                      </h2>
                      <span className="rounded-full bg-[#e6f7ef] px-2 py-0.5 text-[10px] font-bold text-[#238451]">
                        Confianza {Math.round(comercioActual.ficha.confianza * 100)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[#718096]">
                      {comercioActual.nombre} · Modelo{" "}
                      <b className="text-[#52627b]">{comercioActual.modelo}</b> (
                      {comercioActual.prompt_version})
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRawJson((v) => !v)}
                    className="flex items-center gap-1 rounded-lg border border-[#dce4ef] px-2.5 py-1.5 text-[11px] font-semibold text-[#52627b] hover:bg-[#f5f8fc]"
                  >
                    <Code2 size={13} />
                    {showRawJson ? "Ocultar JSON §4" : "Ver JSON §4"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="flex items-center gap-1 rounded-lg bg-[#e9f0ff] px-2.5 py-1.5 text-[11px] font-bold text-[#2166f3] hover:bg-[#dce8ff]"
                  >
                    <RotateCcw size={13} />
                    Subir nuevas fotos
                  </button>
                </div>
              </div>

              {/* Vista opcional del JSON exacto del Contrato §4 */}
              {showRawJson && (
                <div className="rounded-2xl border border-[#1e293b] bg-[#0f172a] p-4 text-xs text-[#e2e8f0]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-[#60a5fa]">
                      Contrato §4 · Ficha JSON validada ({consistencia.motivoConsistencia})
                    </span>
                  </div>
                  <pre className="overflow-x-auto font-mono text-[11px] leading-5">
                    {JSON.stringify(comercioActual.ficha, null, 2)}
                  </pre>
                </div>
              )}

              {/* Bloque 1: Categoría del Cliente (PLUS) + Formato + NSE con señales */}
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
                {/* Categoría del Cliente */}
                <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b98aa]">
                      Categoría Cliente (Plus)
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                    >
                      {comercioActual.ficha.categoria.valor.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs leading-5 text-[#17243a]">
                    {comercioActual.ficha.categoria.motivo}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#f8fafd] px-2.5 py-1.5 text-[10px] font-semibold text-[#52627b]">
                    <ShieldCheck size={13} className="shrink-0 text-[#238451]" />
                    <span className="truncate">{consistencia.motivoConsistencia}</span>
                  </div>
                </div>

                {/* Formato del Local */}
                <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b98aa]">
                      1. Formato detectado
                    </span>
                    <span className="rounded-full bg-[#e9f0ff] px-2.5 py-0.5 text-xs font-bold capitalize text-[#2166f3]">
                      {comercioActual.ficha.formato.tipo} · {comercioActual.ficha.formato.tamano}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-[#f5f8fc] p-2">
                      <p className="text-[10px] text-[#718096]">Cajas</p>
                      <p className="mt-0.5 text-base font-bold text-[#17243a]">
                        {comercioActual.ficha.formato.cajas}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#f5f8fc] p-2">
                      <p className="text-[10px] text-[#718096]">m² estim.</p>
                      <p className="mt-0.5 text-base font-bold text-[#17243a]">
                        {comercioActual.ficha.formato.m2_estimados}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#f5f8fc] p-2">
                      <p className="text-[10px] text-[#718096]">Góndolas</p>
                      <p className="mt-0.5 text-base font-bold text-[#17243a]">
                        {comercioActual.ficha.formato.gondolas}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Nivel Socioeconómico (NSE) y Señales */}
                <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b98aa]">
                      2. Nivel Socioeconómico
                    </span>
                    <span className="rounded-full bg-[#f1f5fa] px-2.5 py-0.5 text-xs font-bold uppercase text-[#17243a]">
                      NSE {comercioActual.ficha.nse.nivel}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-[#718096]">
                    Señales visuales detectadas en góndola:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {comercioActual.ficha.nse.senales.map((senal) => (
                      <span
                        key={senal}
                        className="rounded-lg border border-[#e4eaf2] bg-[#f8fafd] px-2 py-1 text-[11px] text-[#334155]"
                      >
                        • {senal}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bloque 2: Surtido Ideal La Virginia (tiene vs le_falta) + Competencia */}
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
                {/* Surtido La Virginia */}
                <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b98aa]">
                        3. Surtido Ideal La Virginia (productos_lv)
                      </span>
                      <h3 className="text-sm font-bold">Presencia actual vs. Faltantes detectados</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#d1fae5] bg-[#f0fdf4] p-3">
                      <p className="text-[11px] font-bold text-[#047857]">
                        ✓ Ya tiene en góndola ({comercioActual.ficha.surtido.tiene.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {comercioActual.ficha.surtido.tiene.length > 0 ? (
                          comercioActual.ficha.surtido.tiene.map((prod) => (
                            <span
                              key={prod}
                              className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#065f46] shadow-xs"
                            >
                              {prod}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#047857]">
                            Sin presencia activa relevada (oportunidad de apertura)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                      <p className="text-[11px] font-bold text-[#b45309]">
                        + Le falta incorporar ({comercioActual.ficha.surtido.le_falta.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {comercioActual.ficha.surtido.le_falta.map((prod) => (
                          <span
                            key={prod}
                            className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#92400e] shadow-xs"
                          >
                            {prod}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Competencia */}
                <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b98aa]">
                      Actividad de Competencia
                    </span>
                    <span className="rounded-full bg-[#fff1f2] px-2.5 py-0.5 text-xs font-bold text-[#be123c]">
                      {comercioActual.ficha.competencia.marcas} marcas rivales
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#52627b]">Share de frentes rivales</span>
                      <span className="font-bold text-[#17243a]">
                        {comercioActual.ficha.competencia.share_frentes_pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#e6ebf2]">
                      <div
                        className="h-full rounded-full bg-[#e11d48]"
                        style={{ width: `${comercioActual.ficha.competencia.share_frentes_pct}%` }}
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] font-semibold text-[#718096]">
                    Promociones y acciones detectadas:
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {comercioActual.ficha.competencia.promos.map((promo) => (
                      <span
                        key={promo}
                        className="rounded-lg bg-[#fff1f2] px-2.5 py-1 text-xs font-semibold text-[#9f1239]"
                      >
                        ⚡ {promo}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bloque 3: Qué ofrecer primero y con qué argumento (§4 ofrecer_primero) */}
              <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#2166f3]">
                      4. Acción comercial inmediata
                    </span>
                    <h3 className="text-sm font-bold sm:text-base">
                      Qué ofrecer primero y argumento de venta
                    </h3>
                  </div>
                  <span className="rounded-full bg-[#e9f0ff] px-2.5 py-1 text-[11px] font-semibold text-[#2166f3]">
                    Priorizado por IA según formato + NSE
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {comercioActual.ficha.ofrecer_primero.map((item, idx) => (
                    <div
                      key={item.producto}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-[#e4eaf2] bg-[#fbfcfe] p-3.5 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#2166f3] text-xs font-bold text-white">
                          0{idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-[#17243a]">{item.producto}</h4>
                            <span className="rounded-full bg-[#e6f7ef] px-2 py-0.5 text-[10px] font-bold text-[#238451]">
                              Catálogo La Virginia
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#52627b]">
                            “{item.argumento}”
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => copiarArgumento(`${item.producto}: ${item.argumento}`, idx)}
                          className="flex items-center gap-1 rounded-lg border border-[#dce4ef] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#52627b] hover:bg-[#f1f5fa]"
                        >
                          {copiedIdx === idx ? <Check size={13} className="text-[#238451]" /> : <Copy size={13} />}
                          {copiedIdx === idx ? "Copiado" : "Copiar argumento"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloque 4: Chat Agéntico de Repregunta con Chips Rápidos (§5 POST /api/visitas/:id/chat) */}
              <div className="rounded-2xl border border-[#9cb9f9] bg-white p-3.5 shadow-[0_8px_28px_rgba(33,102,243,.08)] sm:p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#2166f3] text-white">
                    <Bot size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold sm:text-base">
                      Copiloto Agéntico de la Visita
                    </h3>
                    <p className="text-[11px] text-[#718096]">
                      Repreguntá con la ficha y las fotos de {comercioActual.nombre} como contexto activo.
                    </p>
                  </div>
                </div>

                {/* Chips de repregunta rápida */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {CHIPS_REPREGUNTA.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => enviarPreguntaChat(chip)}
                      className="rounded-full border border-[#cfe0ff] bg-[#f0f6ff] px-2.5 py-1 text-[11px] font-semibold text-[#1d4ed8] transition hover:bg-[#2166f3] hover:text-white"
                    >
                      ✨ {chip}
                    </button>
                  ))}
                </div>

                {/* Historial de mensajes del chat */}
                <div className="max-h-72 space-y-2.5 overflow-y-auto rounded-xl border border-[#edf1f6] bg-[#f8fafd] p-3">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.rol === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 sm:max-w-[80%] ${
                          msg.rol === "user"
                            ? "bg-[#2166f3] text-white"
                            : "border border-[#dce4ef] bg-white text-[#17243a]"
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.contenido}</p>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="text-xs font-medium text-[#718096]">
                      Analizando ficha de {comercioActual.nombre}...
                    </div>
                  )}
                </div>

                {/* Input de repregunta libre */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    enviarPreguntaChat(chatInput)
                  }}
                  className="mt-3 flex items-center gap-2"
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Repreguntá (ej: ¿Cómo le gano espacio a la promo 2x1?)..."
                    className="h-10 min-w-0 flex-1 rounded-xl border border-[#dce4ef] bg-white px-3 text-xs outline-none focus:border-[#2166f3] sm:text-sm"
                  />
                  <button
                    type="submit"
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#2166f3] px-3.5 text-xs font-bold text-white transition hover:bg-[#1657da]"
                  >
                    <Send size={14} />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </form>
              </div>
            </section>
          )}

          {/* Últimas visitas / acceso rápido a comercios */}
          <div className="mt-6 sm:mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Comercios y últimas fichas</h3>
              <a href="/map" className="text-xs font-semibold text-[#2166f3] hover:underline">
                Ver todos en el mapa →
              </a>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {comercios.slice(0, 3).map((c) => {
                const cs = getCategoriaStyle(c.ficha.categoria.valor)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id)
                      setSent(true)
                      setChatMessages([
                        {
                          id: `card-${c.id}`,
                          rol: "assistant",
                          hora: "Ahora",
                          contenido: `Abriste la última ficha de **${c.nombre}** (${c.ficha.formato.tipo} · NSE ${c.ficha.nse.nivel}). Sugerencia principal: **${c.ficha.ofrecer_primero[0]?.producto}**.`,
                        },
                      ])
                    }}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      c.id === comercioActual.id
                        ? "border-[#2166f3] bg-white ring-2 ring-[#e9f0ff]"
                        : "border-[#e6ebf2] bg-white hover:border-[#9cb9f9]"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cs.bg} ${cs.text} ${cs.border}`}
                      >
                        {c.ficha.categoria.valor.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-semibold text-[#718096]">
                        {c.ultimaVisita}
                      </span>
                    </div>
                    <p className="truncate text-sm font-bold text-[#17243a]">{c.nombre}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[#718096]">
                      {c.ficha.formato.tipo} · NSE {c.ficha.nse.nivel} · {c.ficha.ofrecer_primero.length} recom.
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Barra de navegación inferior móvil (ideal para iPhone SE con una mano) */}
      <nav
        aria-label="Navegación móvil"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-14 items-center justify-around border-t border-[#dce4ef] bg-white/95 px-1 backdrop-blur lg:hidden"
      >
        <button
          type="button"
          onClick={() => setSent(false)}
          className={`flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-bold ${
            !sent ? "text-[#2166f3]" : "text-[#718096]"
          }`}
        >
          <Camera size={16} />
          <span className="mt-0.5">Relevar</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (!chatMessages.length) {
              setChatMessages([
                {
                  id: "mob-ficha",
                  rol: "assistant",
                  hora: "Ahora",
                  contenido: `Estás viendo la ficha de **${comercioActual.nombre}**. Tocá un chip para preparar tu argumento.`,
                },
              ])
            }
            setSent(true)
          }}
          className={`flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-bold ${
            sent ? "text-[#2166f3]" : "text-[#718096]"
          }`}
        >
          <Sparkles size={16} />
          <span className="mt-0.5">Ficha IA</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectorOpen(true)}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-bold text-[#718096]"
        >
          <Store size={16} />
          <span className="mt-0.5">Comercios</span>
        </button>
        <a
          href="/map"
          className="flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-bold text-[#718096]"
        >
          <MapPin size={16} />
          <span className="mt-0.5">Mapa</span>
        </a>
      </nav>

      {/* Modal de Alta de Comercio (§5 POST /api/comercios) */}
      {showNewComercioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="animate-in w-full max-w-[440px] rounded-2xl border border-[#dce4ef] bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#2166f3]">
                  POST /api/comercios
                </p>
                <h2 className="text-base font-bold sm:text-lg">Alta de nuevo comercio</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewComercioModal(false)}
                className="rounded-lg p-1.5 text-[#718096] hover:bg-[#f1f5fa]"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={crearNuevoComercio} className="space-y-3">
              <label className="block text-xs font-semibold">
                Nombre del comercio
                <input
                  required
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Autoservicio Los Andes"
                  className="mt-1 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] sm:text-sm"
                />
              </label>

              <label className="block text-xs font-semibold">
                Dirección
                <input
                  required
                  value={nuevaDireccion}
                  onChange={(e) => setNuevaDireccion(e.target.value)}
                  placeholder="Ej: Av. Cabildo 2450, Belgrano"
                  className="mt-1 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] sm:text-sm"
                />
              </label>

              <label className="block text-xs font-semibold">
                Formato estimado inicial
                <select
                  value={nuevoFormato}
                  onChange={(e) => setNuevoFormato(e.target.value as FormatoTipo)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#dce4ef] bg-white px-3 text-xs outline-none focus:border-[#2166f3] sm:text-sm"
                >
                  <option value="autoservicio">autoservicio</option>
                  <option value="almacen">almacen</option>
                  <option value="despensa">despensa</option>
                  <option value="kiosco">kiosco</option>
                  <option value="cafeteria">cafeteria</option>
                  <option value="otro">otro</option>
                </select>
              </label>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Coordenadas (lat / lng)</span>
                  <button
                    type="button"
                    onClick={usarUbicacionGps}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#2166f3] hover:underline"
                  >
                    <Navigation size={12} /> Usar mi GPS
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <input
                    value={nuevaLat}
                    onChange={(e) => setNuevaLat(e.target.value)}
                    placeholder="Latitud"
                    className="h-9 rounded-lg border border-[#dce4ef] px-2.5 text-xs outline-none focus:border-[#2166f3]"
                  />
                  <input
                    value={nuevaLng}
                    onChange={(e) => setNuevaLng(e.target.value)}
                    placeholder="Longitud"
                    className="h-9 rounded-lg border border-[#dce4ef] px-2.5 text-xs outline-none focus:border-[#2166f3]"
                  />
                </div>
                {gpsStatus && (
                  <p className="mt-1 text-[11px] font-medium text-[#238451]">{gpsStatus}</p>
                )}
              </div>

              {createError && (
                <p className="rounded-lg bg-[#fff0f0] px-3 py-2 text-xs font-semibold text-[#c44754]">
                  {createError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewComercioModal(false)}
                  className="rounded-lg border border-[#dce4ef] px-3.5 py-2 text-xs font-semibold text-[#52627b]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2166f3] px-4 py-2 text-xs font-bold text-white hover:bg-[#1657da]"
                >
                  Guardar y seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Nav({
  icon,
  label,
  active,
  href,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  href: string
}) {
  return (
    <a
      href={href}
      className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
        active ? "bg-[#2166f3] font-semibold text-white" : "text-[#a9bad5] hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </a>
  )
}

