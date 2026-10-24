"use client"

import { useRouter } from "next/navigation"

import Link from "next/link"
import Image from "next/image"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Camera, MapPin, Plus, Send, Sparkles, Store, X } from "lucide-react"
import { getSession, signOut } from "../lib/auth"
import { api, post } from "../lib/client-api"
import { subirFotos } from "../lib/db/browser"
import type { AppUser, VisitSummary } from "../types/api"
import type { Ficha } from "../types/ficha"

type Comercio = { id:string; nombre:string; direccion:string|null; es_demo:boolean }
type FotoRegistro = Awaited<ReturnType<typeof subirFotos>>[number]
const fecha=(s:string)=>new Date(s).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires",dateStyle:"short",timeStyle:"short"})

export default function SellerPage() {
  const router = useRouter()
  const [user,setUser]=useState<AppUser|null>(null)
  const [comercios,setComercios]=useState<Comercio[]>([])
  const [comercioId,setComercioId]=useState("")
  const [visitas,setVisitas]=useState<VisitSummary[]>([])
  const [notas,setNotas]=useState("")
  const [files,setFiles]=useState<File[]>([])
  const [ficha,setFicha]=useState<Ficha|null>(null)
  const [pregunta,setPregunta]=useState("")
  const [chat,setChat]=useState<{rol:string;contenido:string}[]>([])
  const [error,setError]=useState("")
  const [busy,setBusy]=useState(false)
  const [nuevo,setNuevo]=useState(false)
  const [draftId,setDraftId]=useState("")
  const [aviso,setAviso]=useState("")
  const draft=useRef<{id?:string;requestId?:string;fotos?:FotoRegistro[];registradas?:boolean}>({})
  const fileRef=useRef<HTMLInputElement>(null)
  const chatDraft=useRef<{texto:string;requestId:string}|null>(null)
  const previews=useMemo(()=>files.map(file=>URL.createObjectURL(file)),[files])
  useEffect(()=>()=>{previews.forEach(url=>URL.revokeObjectURL(url))},[previews])
  useEffect(()=>{
    getSession().then(async u=>{
      if(!u){router.replace("/login");return}
      setUser(u)
      const [stores,history]=await Promise.all([api<Comercio[]>("/api/comercios"),api<VisitSummary[]>("/api/visitas")])
      setComercios(stores);setComercioId(stores[0]?.id||"");setVisitas(history)
    }).catch(e=>setError(e.message))
  },[router])

  function reset(id=comercioId) {draft.current={};chatDraft.current=null;if(fileRef.current)fileRef.current.value="";setDraftId("");setFicha(null);setFiles([]);setNotas("");setChat([]);setError("");setAviso("");setComercioId(id)}
  async function analizar() {
    if(!comercioId||(!files.length&&!draft.current.registradas)){setError("Elegí un comercio y adjuntá al menos una foto");return}
    setBusy(true);setError("")
    try {
      draft.current.requestId ||= crypto.randomUUID()
      if(!draft.current.id) {
        const visit=await post<{visita_id:string}>("/api/visitas",{comercio_id:comercioId,client_request_id:draft.current.requestId,notas})
        draft.current.id=visit.visita_id;setDraftId(visit.visita_id)
      }
      if(!draft.current.registradas) {
        draft.current.fotos ||= await subirFotos(comercioId,draft.current.id,files)
        await post("/api/visitas/"+draft.current.id+"/fotos",{fotos:draft.current.fotos})
        draft.current.registradas=true
      }
      const result=await post<{ficha:Ficha}>("/api/visitas/"+draft.current.id+"/analizar",{request_id:draft.current.requestId})
      setFicha(result.ficha)
      setVisitas(await api<VisitSummary[]>("/api/visitas"))
    } catch(e){setError(e instanceof Error?e.message:"No se pudo analizar")} finally{setBusy(false)}
  }
  async function abrirVisita(v:VisitSummary) {
    setBusy(true);setError("");setAviso("")
    try{
      const [stored,messages]=await Promise.all([api<{data:Ficha}|null>("/api/visitas/"+v.id+"/ficha"),api<{rol:string;contenido:string}[]>("/api/visitas/"+v.id+"/chat")])
      draft.current={id:v.id,requestId:crypto.randomUUID()};setDraftId(v.id);setComercioId(v.comercio_id);setNotas(v.notas||"");setFiles([]);setFicha(stored?.data||null);setChat(messages)
    }catch(e){setError(e instanceof Error?e.message:"No se pudo abrir")}finally{setBusy(false)}
  }
  async function conversar(e:FormEvent) {
    e.preventDefault();if(!pregunta.trim()||!draft.current.id)return
    setBusy(true);setError("")
    const texto=pregunta.trim()
    if(chatDraft.current?.texto!==texto)chatDraft.current={texto,requestId:crypto.randomUUID()}
    try{
      const result=await post<{contenido:string}>("/api/visitas/"+draft.current.id+"/chat",{contenido:texto,request_id:chatDraft.current.requestId})
      setChat(c=>[...c,{rol:"user",contenido:texto},{rol:"assistant",contenido:result.contenido}]);setPregunta("");chatDraft.current=null
    }catch(e){setError(e instanceof Error?e.message:"No se pudo responder")}finally{setBusy(false)}
  }
  async function crearComercio(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError("")
    const form=new FormData(e.currentTarget)
    try{
      const store=await post<Comercio>("/api/comercios",{nombre:form.get("nombre"),direccion:form.get("direccion")||null,lat:form.get("lat")?Number(form.get("lat")):null,lng:form.get("lng")?Number(form.get("lng")):null})
      setComercios(c=>[...c,store]);reset(store.id);setNuevo(false)
    }catch(e){setError(e instanceof Error?e.message:"No se pudo crear")}finally{setBusy(false)}
  }
  const selected=comercios.find(c=>c.id===comercioId)
  if(!user)return <main className="grid min-h-screen place-items-center bg-[#f5f8fc] p-6">{error?<p role="alert" className="text-red-700">{error}</p>:<p>Verificando acceso...</p>}</main>
  return <div className="min-h-screen bg-[#f5f8fc] text-[#17243a]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-5"><Link href="/" className="flex items-center gap-2 text-xl font-bold"><Sparkles className="text-[#2166f3]"/>Shippe.AR</Link><nav className="flex gap-4 text-sm"><Link href="/map">Mapa</Link>{user.role==="admin"&&<Link href="/admin">Administración</Link>}<Link href="/settings">Cuenta</Link><button onClick={async()=>{try{await signOut();router.replace("/login")}catch(e){setError(e instanceof Error?e.message:"No se pudo cerrar sesión")}}}>Cerrar sesión</button></nav></header>
    <main className="mx-auto max-w-[1040px] space-y-6 px-5 py-8 sm:px-9">
      <div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">{user.name}</p><h1 className="mt-1 text-2xl font-bold">Nueva visita</h1><p className="mt-1 text-sm text-slate-500">Fotos y contexto para decidir qué ofrecer.</p></div><button disabled={busy} onClick={()=>setNuevo(!nuevo)} className="flex items-center gap-1 text-sm font-bold text-[#2166f3]"><Plus size={17}/>Nuevo comercio</button></div>
      {nuevo&&<form onSubmit={crearComercio} className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2"><label className="text-sm">Nombre<input name="nombre" required maxLength={200} className="mt-1 h-10 w-full rounded border px-3"/></label><label className="text-sm">Dirección<input name="direccion" maxLength={500} className="mt-1 h-10 w-full rounded border px-3"/></label><label className="text-sm">Latitud (opcional)<input name="lat" type="number" step="any" min="-90" max="90" className="mt-1 h-10 w-full rounded border px-3"/></label><label className="text-sm">Longitud (opcional)<input name="lng" type="number" step="any" min="-180" max="180" className="mt-1 h-10 w-full rounded border px-3"/></label><button disabled={busy} className="rounded-lg bg-[#2166f3] px-4 py-2 text-white">Guardar comercio</button><p className="text-xs text-slate-500">Sin coordenadas se guarda el comercio, pero no aparece como punto en el mapa.</p></form>}
      <label className="flex items-center gap-3 rounded-xl border border-[#dce4ef] bg-white p-4"><Store size={20} className="text-[#2166f3]"/><span className="text-sm font-semibold">Comercio</span><select aria-label="Comercio seleccionado" disabled={busy} value={comercioId} onChange={e=>reset(e.target.value)} className="min-w-0 flex-1 bg-white p-2"><option value="" disabled>Elegí un comercio</option>{comercios.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select>{selected?.es_demo&&<span className="rounded-full bg-amber-100 px-2 py-1 text-xs">DEMO</span>}</label>
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!ficha?<section className="rounded-2xl border border-[#dce4ef] bg-white p-6"><h2 className="flex items-center gap-2 font-bold"><Sparkles size={20} className="text-[#2166f3]"/>Contale a la IA sobre tu visita</h2><textarea aria-label="Notas de la visita" disabled={busy||!!draftId} value={notas} onChange={e=>setNotas(e.target.value)} maxLength={10000} placeholder="Ej: autoservicio con dos cajas. Adjunto fotos de las góndolas..." className="mt-5 min-h-32 w-full rounded-xl border bg-[#fbfcfe] p-4 text-sm"/>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button disabled={busy||!!draftId} onClick={()=>fileRef.current?.click()} className="flex items-center gap-2 rounded-lg bg-[#e9f0ff] px-4 py-2.5 text-sm font-bold text-[#2166f3]"><Camera size={17}/>Adjuntar fotos</button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e=>setFiles(Array.from(e.target.files||[]))}/><button disabled={busy||!comercioId} onClick={analizar} className="flex items-center gap-2 rounded-lg bg-[#2166f3] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"Procesando...":draftId?"Reintentar análisis":"Analizar visita"}<Send size={15}/></button></div>
        <div className="mt-4 flex flex-wrap gap-3">{previews.map((src,i)=><div key={src} className="relative"><Image unoptimized width={80} height={80} src={src} alt={"Foto adjunta "+(i+1)} className="size-20 rounded-lg object-cover"/><button aria-label={"Quitar foto "+(i+1)} disabled={busy||!!draftId} onClick={()=>setFiles(f=>f.filter((_,n)=>n!==i))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X size={12}/></button></div>)}</div>
        <p className="mt-4 text-xs text-slate-500">Hasta 6 fotos JPEG/PNG/WebP y 12 MiB en total. Video y audio se incorporarán en otro flujo.</p>
        {draftId&&<button onClick={()=>reset()} disabled={busy} className="mt-4 text-sm text-[#2166f3]">Empezar otra visita</button>}
      </section>:<section className="space-y-4"><div className="flex justify-between"><h2 className="text-xl font-bold">Ficha del local</h2><button disabled={busy} onClick={()=>reset()} className="text-sm text-[#2166f3]">Nueva visita</button></div><div className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap gap-2">{[ficha.formato.tipo,"NSE "+ficha.nse.nivel,ficha.categoria.valor].map(t=><span key={t} className="rounded-full bg-[#e9f0ff] px-3 py-1.5 text-sm">{t}</span>)}</div><p className="mt-3 text-sm">{ficha.categoria.motivo}</p><ul className="mt-3 list-inside list-disc text-sm text-slate-600">{ficha.nse.senales.map((s,i)=><li key={i}>{s}</li>)}</ul><p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{ficha.limitaciones}</p></div>
        <h3 className="font-bold">Qué ofrecer primero</h3>{ficha.ofrecer_primero.map((p,i)=><article key={p.producto} className="flex gap-4 rounded-xl border bg-white p-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#2166f3] font-bold text-white">{i+1}</span><div><h4 className="font-bold">{p.producto}</h4><p className="mt-1 text-sm text-slate-500">{p.argumento}</p></div></article>)}
        <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border bg-white p-4"><b>Tiene</b><p className="mt-2 text-sm">{ficha.surtido.tiene.join(", ")||"Sin presencia confirmada"}</p></div><div className="rounded-xl border bg-white p-4"><b>Faltantes respaldados</b><p className="mt-2 text-sm">{ficha.surtido.le_falta.join(", ")||"A confirmar en el local"}</p></div></div>
        <button onClick={async()=>{try{await navigator.clipboard.writeText(ficha.ofrecer_primero.map(p=>p.producto+" · cantidad a confirmar").join("\n"));setAviso("Propuesta copiada")}catch{setAviso("No se pudo acceder al portapapeles")}}} className="text-sm font-semibold text-[#2166f3]">Copiar propuesta de pedido</button>{aviso&&<p role="status" className="text-sm">{aviso}</p>}
        <div className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Repreguntale al asistente</h3><div className="mt-3 space-y-3">{chat.map((m,i)=><p key={i} className={"whitespace-pre-wrap rounded-lg p-3 text-sm "+(m.rol==="user"?"bg-[#e9f0ff]":"bg-slate-50")}>{m.contenido}</p>)}</div><form onSubmit={conversar} className="mt-4 flex gap-2"><input aria-label="Pregunta al asistente" maxLength={10000} value={pregunta} onChange={e=>setPregunta(e.target.value)} placeholder="¿Con cuál conviene empezar?" className="min-w-0 flex-1 rounded-lg border px-3 py-2"/><button disabled={busy||!pregunta.trim()} className="rounded-lg bg-[#2166f3] px-4 text-sm font-bold text-white disabled:opacity-50">Enviar</button></form></div>
      </section>}
      <section id="historial"><h2 className="mb-3 font-bold">Historial de visitas</h2><div className="grid gap-3 sm:grid-cols-3">{visitas.map(v=><button key={v.id} disabled={busy} onClick={()=>abrirVisita(v)} className="rounded-xl border bg-white p-4 text-left hover:border-[#2166f3]"><MapPin size={16} className="mb-2 text-[#2166f3]"/><b className="block text-sm">{v.comercios?.nombre||"Comercio"}</b><span className="mt-1 block text-xs text-slate-500">{fecha(v.fecha_visita)}</span></button>)}</div>{!visitas.length&&<p className="text-sm text-slate-500">Todavía no hay visitas para tu cuenta.</p>}</section>
    </main>
  </div>
}
