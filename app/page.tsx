"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  Bot,
  Camera,
  CheckCircle2,
  Copy,
  ImagePlus,
  MapPin,
  Navigation,
  Plus,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Store,
  X,
} from "lucide-react"
import { getSession, signOut } from "../lib/auth"
import { api, post } from "../lib/client-api"
import { subirFotos } from "../lib/db/browser"
import type { AppUser, VisitSummary } from "../types/api"
import type { Ficha } from "../types/ficha"

type Comercio = { id: string; nombre: string; direccion: string | null; es_demo: boolean }
type FotoTipo = "fachada" | "gondola" | "extra"
type FotoRegistro = Awaited<ReturnType<typeof subirFotos>>[number]

const fecha = (s: string) =>
  new Date(s).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  })

const PHOTO_SLOTS_CONFIG: Array<{
  tipo: FotoTipo
  titulo: string
  subtitulo: string
  badge: string
}> = [
  {
    tipo: "fachada",
    titulo: "1. Fachada",
    subtitulo: "Frente del local, cartel y acceso (formato y NSE)",
    badge: "fachada",
  },
  {
    tipo: "gondola",
    titulo: "2. Góndola",
    subtitulo: "Estanterías de infusiones, precios y frentes",
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
  "¿Con cuál producto conviene empezar y por qué?",
  "¿Cómo rebato una objeción de precio en este local?",
  "Armar combo inicial con los faltantes detectados",
  "¿Cómo ganarle frentes a la competencia?",
  "¿Qué exhibidor le conviene por su formato?",
]

function getCategoriaBadge(valor: Ficha["categoria"]["valor"]) {
  if (valor === "premium") {
    return "border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]"
  }
  if (valor === "estandar") {
    return "border-[#bfdbfe] bg-[#e9f0ff] text-[#1d4ed8]"
  }
  return "border-[#fde68a] bg-[#fffbeb] text-[#b45309]"
}

export default function SellerPage() {
  const router = useRouter()
  const [user, setUser] = useState<AppUser | null>(null)
  const [comercios, setComercios] = useState<Comercio[]>([])
  const [comercioId, setComercioId] = useState("")
  const [visitas, setVisitas] = useState<VisitSummary[]>([])
  const [notas, setNotas] = useState("")

  // Slots de fotos (fachada, gondola, extra) + soporte de input general
  const [filesBySlot, setFilesBySlot] = useState<Record<FotoTipo, File[]>>({
    fachada: [],
    gondola: [],
    extra: [],
  })
  const [activeSlot, setActiveSlot] = useState<FotoTipo>("gondola")

  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [fichaMeta, setFichaMeta] = useState<{ modelo?: string; prompt_version?: string } | null>(
    null
  )
  const [pregunta, setPregunta] = useState("")
  const [chat, setChat] = useState<{ rol: string; contenido: string }[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [nuevo, setNuevo] = useState(false)
  const [latInput, setLatInput] = useState("")
  const [lngInput, setLngInput] = useState("")
  const [draftId, setDraftId] = useState("")
  const [aviso, setAviso] = useState("")

  const draft = useRef<{
    id?: string
    requestId?: string
    fotos?: FotoRegistro[]
    registradas?: boolean
  }>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const chatDraft = useRef<{ texto: string; requestId: string } | null>(null)

  // Cada archivo viaja con el tipo de su slot: la IA necesita saber cual es la fachada.
  const filesWithSlot = useMemo(
    () =>
      (["fachada", "gondola", "extra"] as FotoTipo[]).flatMap((tipo) =>
        filesBySlot[tipo].map((file) => ({ file, tipo }))
      ),
    [filesBySlot]
  )

  const slotPreviews = useMemo(() => {
    const entries: Array<{ slot: FotoTipo; indexInSlot: number; url: string; name: string }> = []
    ;(["fachada", "gondola", "extra"] as FotoTipo[]).forEach((slot) => {
      filesBySlot[slot].forEach((file, indexInSlot) => {
        entries.push({
          slot,
          indexInSlot,
          url: URL.createObjectURL(file),
          name: file.name,
        })
      })
    })
    return entries
  }, [filesBySlot])

  useEffect(
    () => () => {
      slotPreviews.forEach((item) => URL.revokeObjectURL(item.url))
    },
    [slotPreviews]
  )

  useEffect(() => {
    getSession()
      .then(async (u) => {
        if (!u) {
          router.replace("/login")
          return
        }
        setUser(u)
        const [stores, history] = await Promise.all([
          api<Comercio[]>("/api/comercios"),
          api<VisitSummary[]>("/api/visitas"),
        ])
        setComercios(stores)
        const params = new URLSearchParams(window.location.search)
        const qComercio = params.get("comercio")
        const initialId =
          qComercio && stores.some((s) => s.id === qComercio)
            ? qComercio
            : stores[0]?.id || ""
        setComercioId(initialId)
        setVisitas(history)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo verificar el acceso"))
  }, [router])

  function reset(id = comercioId) {
    draft.current = {}
    chatDraft.current = null
    if (fileRef.current) fileRef.current.value = ""
    setDraftId("")
    setFicha(null)
    setFichaMeta(null)
    setFilesBySlot({ fachada: [], gondola: [], extra: [] })
    setNotas("")
    setChat([])
    setError("")
    setAviso("")
    setComercioId(id)
  }

  function openSlotPicker(slot: FotoTipo) {
    setActiveSlot(slot)
    setTimeout(() => fileRef.current?.click(), 0)
  }

  function onFilesChosen(selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) return
    const incoming = Array.from(selectedFiles)
    setFilesBySlot((prev) => ({
      ...prev,
      [activeSlot]: [...prev[activeSlot], ...incoming],
    }))
    if (fileRef.current) fileRef.current.value = ""
  }

  function removeFileFromSlot(slot: FotoTipo, indexInSlot: number) {
    setFilesBySlot((prev) => ({
      ...prev,
      [slot]: prev[slot].filter((_, idx) => idx !== indexInSlot),
    }))
  }

  async function analizar() {
    if (!comercioId || (!filesWithSlot.length && !draft.current.registradas)) {
      setError("Elegí un comercio y adjuntá al menos una foto")
      return
    }
    setBusy(true)
    setError("")
    try {
      draft.current.requestId ||= crypto.randomUUID()
      if (!draft.current.id) {
        const visit = await post<{ visita_id: string }>("/api/visitas", {
          comercio_id: comercioId,
          client_request_id: draft.current.requestId,
          notas,
        })
        draft.current.id = visit.visita_id
        setDraftId(visit.visita_id)
      }
      if (!draft.current.registradas) {
        draft.current.fotos ||= await subirFotos(comercioId, draft.current.id, filesWithSlot)
        await post("/api/visitas/" + draft.current.id + "/fotos", {
          fotos: draft.current.fotos,
        })
        draft.current.registradas = true
      }
      const result = await post<{ ficha: Ficha }>(
        "/api/visitas/" + draft.current.id + "/analizar",
        { request_id: draft.current.requestId }
      )
      setFicha(result.ficha)
      const [updatedHistory, storedFicha] = await Promise.all([
        api<VisitSummary[]>("/api/visitas"),
        api<{ data: Ficha; modelo?: string; prompt_version?: string } | null>(
          "/api/visitas/" + draft.current.id + "/ficha"
        ).catch(() => null),
      ])
      setVisitas(updatedHistory)
      if (storedFicha) {
        setFichaMeta({
          modelo: storedFicha.modelo,
          prompt_version: storedFicha.prompt_version,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar")
    } finally {
      setBusy(false)
    }
  }

  async function abrirVisita(v: VisitSummary) {
    setBusy(true)
    setError("")
    setAviso("")
    try {
      const [stored, messages] = await Promise.all([
        api<{ data: Ficha; modelo?: string; prompt_version?: string } | null>(
          "/api/visitas/" + v.id + "/ficha"
        ),
        api<{ rol: string; contenido: string }[]>("/api/visitas/" + v.id + "/chat"),
      ])
      draft.current = { id: v.id, requestId: crypto.randomUUID() }
      setDraftId(v.id)
      setComercioId(v.comercio_id)
      setNotas(v.notas || "")
      setFilesBySlot({ fachada: [], gondola: [], extra: [] })
      setFicha(stored?.data || null)
      setFichaMeta(
        stored ? { modelo: stored.modelo, prompt_version: stored.prompt_version } : null
      )
      setChat(messages)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir")
    } finally {
      setBusy(false)
    }
  }

  async function enviarMensajeChat(textoRaw: string) {
    const texto = textoRaw.trim()
    if (!texto || !draft.current.id || busy) return
    setBusy(true)
    setError("")
    if (chatDraft.current?.texto !== texto) {
      chatDraft.current = { texto, requestId: crypto.randomUUID() }
    }
    try {
      const result = await post<{ contenido: string }>(
        "/api/visitas/" + draft.current.id + "/chat",
        { contenido: texto, request_id: chatDraft.current.requestId }
      )
      setChat((c) => [
        ...c,
        { rol: "user", contenido: texto },
        { rol: "assistant", contenido: result.contenido },
      ])
      setPregunta("")
      chatDraft.current = null
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo responder")
    } finally {
      setBusy(false)
    }
  }

  async function conversar(e: FormEvent) {
    e.preventDefault()
    await enviarMensajeChat(pregunta)
  }

  // Si no hay GPS no se inventan coordenadas: un punto falso ensucia el mapa.
  function capturarGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Este dispositivo no permite obtener la ubicación. Cargá las coordenadas a mano o dejalas vacías")
      return
    }
    setError("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatInput(pos.coords.latitude.toFixed(5))
        setLngInput(pos.coords.longitude.toFixed(5))
      },
      () => setError("No se pudo obtener la ubicación. Revisá el permiso de GPS o cargá las coordenadas a mano")
    )
  }

  async function crearComercio(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      const store = await post<Comercio>("/api/comercios", {
        nombre: form.get("nombre"),
        direccion: form.get("direccion") || null,
        lat: form.get("lat") ? Number(form.get("lat")) : null,
        lng: form.get("lng") ? Number(form.get("lng")) : null,
      })
      setComercios((c) => [...c, store])
      reset(store.id)
      setNuevo(false)
      setLatInput("")
      setLngInput("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear")
    } finally {
      setBusy(false)
    }
  }

  const selected = comercios.find((c) => c.id === comercioId)

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8fc] p-6">
        {error ? (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        ) : (
          <p>Verificando acceso...</p>
        )}
      </main>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[#f5f8fc] pb-16 text-[#17243a] lg:pb-0">
      {/* Header adaptable hasta 320px (iPhone SE) */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[#e6ebf2] bg-white/95 px-3 py-3 backdrop-blur sm:px-6 sm:py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold sm:text-xl">
          <div className="grid size-8 place-items-center rounded-xl bg-[#2166f3] text-white">
            <Sparkles size={17} />
          </div>
          <span>
            Shippe<span className="text-[#2166f3]">.AR</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 text-xs font-semibold sm:gap-3 sm:text-sm">
          <Link href="/map" className="hidden rounded-lg px-2 py-1 text-[#52627b] hover:bg-[#f1f5fa] sm:inline-block">
            Mapa
          </Link>
          {user.role === "admin" && (
            <Link href="/admin" className="rounded-lg px-2 py-1 text-[#2166f3] hover:bg-[#e9f0ff]">
              Admin
            </Link>
          )}
          <Link href="/settings" className="hidden rounded-lg px-2 py-1 text-[#52627b] hover:bg-[#f1f5fa] sm:inline-block">
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
            className="rounded-lg border border-[#dce4ef] px-2.5 py-1 text-xs font-semibold text-[#52627b] hover:bg-[#f5f8fc]"
          >
            Cerrar sesión
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-[1040px] space-y-5 px-3 py-4 sm:space-y-6 sm:px-8 sm:py-7">
        {/* Encabezado de visita + botón Nuevo Comercio */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500">{user.name}</p>
            <h1 className="mt-0.5 text-xl font-bold sm:text-2xl">Nueva visita</h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Fotos por sector y contexto para decidir qué productos de La Virginia ofrecer.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => setNuevo(!nuevo)}
            className="flex items-center gap-1 rounded-xl bg-[#e9f0ff] px-3 py-2 text-xs font-bold text-[#2166f3] transition hover:bg-[#dce8ff] sm:text-sm"
          >
            <Plus size={16} />
            {nuevo ? "Cerrar alta" : "Nuevo comercio"}
          </button>
        </div>

        {/* Formulario de Alta de Comercio (§5 POST /api/comercios) */}
        {nuevo && (
          <form
            onSubmit={crearComercio}
            className="grid gap-3 rounded-2xl border border-[#dce4ef] bg-white p-4 shadow-xs sm:grid-cols-2 sm:p-5"
          >
            <label className="text-xs font-semibold sm:text-sm">
              Nombre
              <input
                name="nombre"
                required
                maxLength={200}
                placeholder="Ej: Autoservicio El Encuentro"
                className="mt-1 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] sm:text-sm"
              />
            </label>
            <label className="text-xs font-semibold sm:text-sm">
              Dirección
              <input
                name="direccion"
                maxLength={500}
                placeholder="Ej: Av. San Martín 1842"
                className="mt-1 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] sm:text-sm"
              />
            </label>
            <label className="text-xs font-semibold sm:text-sm">
              Latitud (opcional)
              <input
                name="lat"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] sm:text-sm"
              />
            </label>
            <label className="text-xs font-semibold sm:text-sm">
              Longitud (opcional)
              <input
                name="lng"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] sm:text-sm"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#2166f3] px-4 py-2 text-xs font-bold text-white hover:bg-[#1657da] sm:text-sm"
              >
                Guardar comercio
              </button>
              <button
                type="button"
                onClick={capturarGps}
                className="flex items-center gap-1 rounded-lg border border-[#dce4ef] px-3 py-2 text-xs font-semibold text-[#2166f3] hover:bg-[#f5f8fc]"
              >
                <Navigation size={13} /> Usar mi GPS
              </button>
              <p className="text-xs text-slate-500">
                Sin coordenadas se guarda el comercio, pero no aparece como punto en el mapa.
              </p>
            </div>
          </form>
        )}

        {/* Selector de Comercio */}
        <label className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#dce4ef] bg-white p-3.5 shadow-[0_2px_8px_rgba(31,56,88,.03)] sm:p-4">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e9f0ff] text-[#2166f3]">
            <Store size={18} />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#52627b] sm:text-sm">
            Comercio
          </span>
          <select
            aria-label="Comercio seleccionado"
            disabled={busy}
            value={comercioId}
            onChange={(e) => reset(e.target.value)}
            className="w-full rounded-lg border border-[#e6ebf2] bg-[#f8fafd] px-2.5 py-2 text-xs font-semibold text-[#17243a] outline-none focus:border-[#2166f3] sm:min-w-0 sm:w-auto sm:flex-1 sm:text-sm"
          >
            <option value="" disabled>
              Elegí un comercio
            </option>
            {comercios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} {s.direccion ? `· ${s.direccion}` : ""}
              </option>
            ))}
          </select>
          {selected?.es_demo && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">
              DEMO
            </span>
          )}
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700 sm:p-4 sm:text-sm"
          >
            {error}
          </p>
        )}

        {/* Input oculto de fotos JPEG/PNG/WebP */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => onFilesChosen(e.target.files)}
        />

        {!ficha ? (
          /* SECCIÓN DE CARGA DE FOTOS POR SLOTS (fachada, gondola, extra) + NOTAS */
          <section className="rounded-2xl border border-[#dce4ef] bg-white p-4 shadow-[0_6px_24px_rgba(31,56,88,.05)] sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base">
              <Sparkles size={19} className="text-[#2166f3]" />
              Contale a la IA sobre tu visita
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Subí fotos organizadas por sector (`fachada`, `gondola`, `extra`) y sumá observaciones del local.
            </p>

            {/* 3 Slots de Fotos del Contrato (§3) */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {PHOTO_SLOTS_CONFIG.map((slot) => {
                const count = filesBySlot[slot.tipo].length
                return (
                  <div
                    key={slot.tipo}
                    className={`flex flex-col justify-between rounded-xl border p-3 transition ${
                      count > 0
                        ? "border-[#9cb9f9] bg-[#f5f9ff]"
                        : "border-[#e4eaf2] bg-[#fbfcfe]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#17243a]">{slot.titulo}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            count > 0 ? "bg-[#2166f3] text-white" : "bg-[#eef3fb] text-[#52627b]"
                          }`}
                        >
                          {count > 0 ? `${count} foto(s)` : slot.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-[#718096]">{slot.subtitulo}</p>
                    </div>

                    <button
                      type="button"
                      disabled={busy || !!draftId}
                      onClick={() => openSlotPicker(slot.tipo)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#dce4ef] bg-white py-1.5 text-xs font-semibold text-[#2166f3] hover:border-[#2166f3] disabled:opacity-50"
                    >
                      <ImagePlus size={14} />
                      {count > 0 ? "Sumar otra" : `Adjuntar ${slot.badge}`}
                    </button>
                  </div>
                )
              })}
            </div>

            <textarea
              aria-label="Notas de la visita"
              disabled={busy || !!draftId}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={10000}
              placeholder={"Respuestas del dueño (guía La Virginia):\n¿Cuántas cajas tenés? ¿Quién te repone? ¿Cuántos trabajan acá?\n¿Hacés delivery o vendés por apps? ¿Qué te pide la gente que no tenés? ¿Cuánto se lleva cada cliente?"}
              className="mt-4 min-h-28 w-full rounded-xl border border-[#dce4ef] bg-[#fbfcfe] p-3 text-xs outline-none focus:border-[#2166f3] sm:p-4 sm:text-sm"
            />

            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                disabled={busy || !comercioId}
                onClick={analizar}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2166f3] px-4 py-2.5 text-xs font-bold text-white shadow-[0_5px_12px_rgba(33,102,243,.25)] hover:bg-[#1657da] disabled:opacity-50 sm:w-auto sm:text-sm"
              >
                {busy ? "Procesando..." : draftId ? "Reintentar análisis" : "Analizar visita"}
                <Send size={15} />
              </button>
            </div>

            {slotPreviews.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2.5">
                {slotPreviews.map((item, i) => (
                  <div key={item.url} className="relative">
                    <Image
                      unoptimized
                      width={80}
                      height={80}
                      src={item.url}
                      alt={"Foto adjunta " + (i + 1)}
                      className="size-20 rounded-lg border border-[#dce4ef] object-cover"
                    />
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                      {item.slot}
                    </span>
                    <button
                      type="button"
                      aria-label={"Quitar foto " + (i + 1)}
                      disabled={busy || !!draftId}
                      onClick={() => removeFileFromSlot(item.slot, item.indexInSlot)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs text-slate-500">
              Hasta 6 fotos JPEG/PNG/WebP y 12 MiB en total. Video y audio se incorporarán en otro flujo.
            </p>
            {draftId && (
              <button
                type="button"
                onClick={() => reset()}
                disabled={busy}
                className="mt-3 text-xs font-semibold text-[#2166f3] sm:text-sm"
              >
                Empezar otra visita
              </button>
            )}
          </section>
        ) : (
          /* SECCIÓN DE FICHA COMPLETA DEL CONTRATO (§4) + CHAT AGÉNTICO */
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dce4ef] bg-white p-4">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e6f7ef] text-[#238451]">
                  <CheckCircle2 size={19} />
                </div>
                <div>
                  <h2 className="text-base font-bold sm:text-xl">Ficha del local</h2>
                  <p className="text-xs text-slate-500">
                    Confianza IA: {Math.round(ficha.confianza * 100)}% · Clasificación validada (§4)
                    {fichaMeta?.modelo
                      ? ` · ${fichaMeta.modelo}${fichaMeta.prompt_version ? ` (${fichaMeta.prompt_version})` : ""}`
                      : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => reset()}
                className="flex items-center gap-1 rounded-lg bg-[#e9f0ff] px-3 py-1.5 text-xs font-bold text-[#2166f3] hover:bg-[#dce8ff] sm:text-sm"
              >
                <RotateCcw size={14} />
                Nueva visita
              </button>
            </div>

            {/* Tarjetas de Categoría, Formato y NSE con señales */}
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
              {/* Categoría del Cliente */}
              <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b98aa]">
                    Categoría Cliente
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-extrabold uppercase ${getCategoriaBadge(
                      ficha.categoria.valor
                    )}`}
                  >
                    {ficha.categoria.valor}
                  </span>
                </div>
                <p className="mt-2.5 text-xs leading-5 text-[#17243a] sm:text-sm">
                  {ficha.categoria.motivo}
                </p>
              </div>

              {/* Formato del PDV */}
              <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b98aa]">
                    Formato
                  </span>
                  <span className="rounded-full bg-[#e9f0ff] px-2.5 py-0.5 text-xs font-bold capitalize text-[#2166f3]">
                    {ficha.formato.tipo} · {ficha.formato.tamano}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-[#f5f8fc] p-2">
                    <span className="block text-[10px] text-slate-500">Cajas</span>
                    <b className="text-sm">{ficha.formato.cajas ?? "—"}</b>
                  </div>
                  <div className="rounded-xl bg-[#f5f8fc] p-2">
                    <span className="block text-[10px] text-slate-500">m² estim.</span>
                    <b className="text-sm">{ficha.formato.m2_estimados ?? "—"}</b>
                  </div>
                  <div className="rounded-xl bg-[#f5f8fc] p-2">
                    <span className="block text-[10px] text-slate-500">Góndolas</span>
                    <b className="text-sm">{ficha.formato.gondolas ?? "—"}</b>
                  </div>
                </div>
              </div>

              {/* NSE + Señales */}
              <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b98aa]">
                    Nivel Socioeconómico
                  </span>
                  <span className="rounded-full bg-[#f1f5fa] px-2.5 py-0.5 text-xs font-bold uppercase text-[#17243a]">
                    NSE {ficha.nse.nivel}
                  </span>
                </div>
                <ul className="mt-2.5 list-inside list-disc space-y-1 text-xs text-slate-600">
                  {ficha.nse.senales.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Limitaciones del análisis */}
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 sm:text-sm">
              <b>Limitaciones observadas:</b> {ficha.limitaciones}
            </p>

            {/* Qué ofrecer primero */}
            <div className="rounded-2xl border border-[#dce4ef] bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold sm:text-base">Qué ofrecer primero</h3>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        ficha.ofrecer_primero
                          .map((p) => p.producto + " · cantidad a confirmar")
                          .join("\n")
                      )
                      setAviso("Propuesta copiada")
                    } catch {
                      setAviso("No se pudo acceder al portapapeles")
                    }
                  }}
                  className="flex items-center gap-1 rounded-lg border border-[#dce4ef] px-2.5 py-1.5 text-xs font-semibold text-[#2166f3] hover:bg-[#f5f8fc]"
                >
                  <Copy size={13} />
                  Copiar propuesta de pedido
                </button>
              </div>
              {aviso && (
                <p role="status" className="mb-3 text-xs font-semibold text-green-700">
                  {aviso}
                </p>
              )}

              <div className="space-y-2.5">
                {ficha.ofrecer_primero.map((p, i) => (
                  <article
                    key={p.producto}
                    className="flex gap-3 rounded-xl border border-[#e4eaf2] bg-[#fbfcfe] p-3.5 sm:gap-4"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#2166f3] text-xs font-bold text-white sm:size-9 sm:text-sm">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold">{p.producto}</h4>
                      <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
                        {p.argumento}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Surtido (Tiene / Faltantes) + Competencia */}
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div className="rounded-xl border border-[#d1fae5] bg-white p-4">
                <b className="text-xs uppercase tracking-wider text-[#047857]">Tiene en góndola</b>
                <p className="mt-2 text-xs text-slate-700 sm:text-sm">
                  {ficha.surtido.tiene.join(", ") || "Sin presencia confirmada"}
                </p>
              </div>
              <div className="rounded-xl border border-[#fde68a] bg-white p-4">
                <b className="text-xs uppercase tracking-wider text-[#b45309]">
                  Faltantes respaldados
                </b>
                <p className="mt-2 text-xs text-slate-700 sm:text-sm">
                  {ficha.surtido.le_falta.join(", ") || "A confirmar en el local"}
                </p>
              </div>
              <div className="rounded-xl border border-[#fecdd3] bg-white p-4">
                <b className="text-xs uppercase tracking-wider text-[#be123c]">Competencia</b>
                <p className="mt-1 text-xs text-slate-700">
                  Marcas: <b>{ficha.competencia.marcas ?? "—"}</b> · Share frentes:{" "}
                  <b>
                    {ficha.competencia.share_frentes_pct !== null
                      ? `${ficha.competencia.share_frentes_pct}%`
                      : "—"}
                  </b>
                </p>
                {ficha.competencia.promos.length > 0 && (
                  <p className="mt-1 text-xs text-[#9f1239]">
                    Promos: {ficha.competencia.promos.join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Chat Agéntico con Chips de Repregunta Rápida */}
            <div className="rounded-2xl border border-[#9cb9f9] bg-white p-4 shadow-[0_6px_20px_rgba(33,102,243,.07)] sm:p-5">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-[#2166f3] text-white">
                  <Bot size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold sm:text-base">Repreguntale al asistente</h3>
                  <p className="text-[11px] text-slate-500">
                    Usá un chip rápido o escribí tu consulta con la ficha y las fotos como contexto.
                  </p>
                </div>
              </div>

              {/* Chips de repregunta rápida */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {CHIPS_REPREGUNTA.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={busy}
                    onClick={() => enviarMensajeChat(chip)}
                    className="rounded-full border border-[#cfe0ff] bg-[#f0f6ff] px-2.5 py-1 text-[11px] font-semibold text-[#1d4ed8] transition hover:bg-[#2166f3] hover:text-white disabled:opacity-50"
                  >
                    ✨ {chip}
                  </button>
                ))}
              </div>

              <div className="mt-3 space-y-2.5">
                {chat.map((m, i) => (
                  <p
                    key={i}
                    className={
                      "whitespace-pre-wrap rounded-xl p-3 text-xs leading-5 sm:text-sm " +
                      (m.rol === "user"
                        ? "bg-[#e9f0ff] font-medium text-[#17243a]"
                        : "border border-[#e6ebf2] bg-slate-50 text-[#17243a]")
                    }
                  >
                    {m.contenido}
                  </p>
                ))}
              </div>

              <form onSubmit={conversar} className="mt-4 flex gap-2">
                <input
                  aria-label="Pregunta al asistente"
                  maxLength={10000}
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value)}
                  placeholder="¿Con cuál conviene empezar?"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !pregunta.trim()}
                  className="rounded-xl bg-[#2166f3] px-4 text-xs font-bold text-white transition hover:bg-[#1657da] disabled:opacity-50 sm:text-sm"
                >
                  Enviar
                </button>
              </form>
            </div>
          </section>
        )}

        {/* Historial de visitas */}
        <section id="historial">
          <h2 className="mb-3 text-sm font-bold sm:text-base">Historial de visitas</h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {visitas.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={busy}
                onClick={() => abrirVisita(v)}
                className="rounded-xl border border-[#dce4ef] bg-white p-3.5 text-left transition hover:border-[#2166f3]"
              >
                <MapPin size={15} className="mb-1.5 text-[#2166f3]" />
                <b className="block truncate text-xs sm:text-sm">
                  {v.comercios?.nombre || "Comercio"}
                </b>
                <span className="mt-1 block text-[11px] text-slate-500">
                  {fecha(v.fecha_visita)}
                </span>
              </button>
            ))}
          </div>
          {!visitas.length && (
            <p className="text-xs text-slate-500 sm:text-sm">
              Todavía no hay visitas para tu cuenta.
            </p>
          )}
        </section>
      </main>

      {/* Navegación móvil inferior para pantallas chicas (iPhone SE) */}
      <nav
        aria-label="Navegación móvil"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-14 items-center justify-around border-t border-[#dce4ef] bg-white/95 px-1 backdrop-blur lg:hidden"
      >
        <button
          type="button"
          onClick={() => reset()}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-bold text-[#2166f3]"
        >
          <Camera size={16} />
          <span className="mt-0.5">Nueva visita</span>
        </button>
        <a
          href="#historial"
          className="flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-bold text-[#52627b]"
        >
          <Store size={16} />
          <span className="mt-0.5">Historial</span>
        </a>
        <Link
          href="/map"
          className="flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-bold text-[#52627b]"
        >
          <MapPin size={16} />
          <span className="mt-0.5">Mapa</span>
        </Link>
        <Link
          href="/settings"
          className="flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-bold text-[#52627b]"
        >
          <Settings size={16} />
          <span className="mt-0.5">Cuenta</span>
        </Link>
      </nav>
    </div>
  )
}
