"use client"

import { useRouter } from "next/navigation"

import Link from "next/link"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { getSession, signOut } from "../../lib/auth"
import { api } from "../../lib/client-api"

const CoverageMap=dynamic(()=>import("../map/customer-map"),{ssr:false})
type Metricas={comercios:number;visitas:number;fichas:number;recomendaciones:number;comercios_demo:number;categorias:Record<string,number>}
type Persona={id:string;nombre:string;rol:string;activo:boolean}
type Producto={id:string;nombre:string;categoria:string;presentacion:string;gama:string;es_demo:boolean}
export default function AdminPage(){
  const router = useRouter()
  const [ready,setReady]=useState(false)
  const [section,setSection]=useState("map")
  const [metrics,setMetrics]=useState<Metricas|null>(null)
  const [team,setTeam]=useState<Persona[]>([])
  const [products,setProducts]=useState<Producto[]>([])
  const [error,setError]=useState("")
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    getSession().then(async u=>{
      if(!u){router.replace("/login");return}
      if(u.role!=="admin"){router.replace("/");return}
      setReady(true)
      const [m,t,p]=await Promise.all([api<Metricas>("/api/metricas"),api<Persona[]>("/api/equipo"),api<Producto[]>("/api/productos")])
      setMetrics(m);setTeam(t);setProducts(p)
    }).catch(e=>setError(e.message))
  },[router])
  async function toggle(p:Persona){
    setBusy(true);setError("")
    try{await api("/api/equipo",{method:"PATCH",body:JSON.stringify({id:p.id,activo:!p.activo})});setTeam(t=>t.map(u=>u.id===p.id?{...u,activo:!u.activo}:u))}
    catch(e){setError(e instanceof Error?e.message:"No se pudo guardar")}finally{setBusy(false)}
  }
  if(!ready)return <main className="grid min-h-screen place-items-center bg-[#f5f8fc]">{error?<p role="alert">{error}</p>:<p>Verificando acceso...</p>}</main>
  return <main className="min-h-screen bg-[#f5f8fc] text-[#17243a]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-5"><h1 className="text-xl font-bold">Shippe.AR · Administración</h1><nav className="flex gap-4 text-sm"><Link href="/">Nueva visita</Link><Link href="/settings">Cuenta</Link><button onClick={async()=>{try{await signOut();router.replace("/login")}catch(e){setError(e instanceof Error?e.message:"No se pudo cerrar sesión")}}}>Cerrar sesión</button></nav></header>
    <div className="mx-auto max-w-[1320px] p-5"><nav className="mb-5 flex flex-wrap gap-2">{[["map","Mapa"],["analytics","Métricas"],["team","Equipo"],["products","Productos"]].map(([key,label])=><button key={key} onClick={()=>setSection(key)} className={"rounded-lg px-4 py-2 text-sm font-semibold "+(section===key?"bg-[#2166f3] text-white":"border bg-white")}>{label}</button>)}</nav>
      {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {section==="map"&&<CoverageMap embedded/>}
      {section==="analytics"&&<section><h2 className="text-2xl font-bold">Actividad registrada</h2><p className="mt-2 text-sm text-slate-500">Totales de Supabase. Las recomendaciones no representan ventas confirmadas.</p>{metrics?<><div className="mt-6 grid gap-4 sm:grid-cols-4">{[["Comercios",metrics.comercios],["Visitas",metrics.visitas],["Fichas",metrics.fichas],["Recomendaciones",metrics.recomendaciones]].map(([label,value])=><div key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><strong className="mt-2 block text-3xl">{value}</strong></div>)}</div><div className="mt-5 rounded-2xl border bg-white p-6"><h3 className="font-bold">Categorías de las fichas</h3>{Object.entries(metrics.categorias).map(([c,n])=><div key={c} className="mt-4 flex items-center gap-4"><span className="w-24 text-sm">{c}</span><div className="h-4 rounded bg-[#2166f3]" style={{width:Math.max(3,Math.round(n/Math.max(metrics.fichas,1)*60))+"%"}}/><b>{n}</b></div>)}<p className="mt-6 text-xs text-amber-800">{metrics.comercios_demo} comercios con datos ficticios DEMO. Una ficha por visita; un comercio puede tener varias visitas.</p></div></>:<p className="mt-4">Cargando métricas...</p>}</section>}
      {section==="team"&&<section className="rounded-2xl border bg-white p-6"><h2 className="text-2xl font-bold">Equipo de ventas</h2><p className="mt-2 text-sm text-slate-500">Las cuentas se registran desde la pantalla de acceso o se crean en Supabase Auth. Los permisos se guardan en profiles.</p><div className="mt-6 space-y-3">{team.map(p=><div key={p.id} className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><b>{p.nombre||"Cuenta "+p.id.slice(0,8)}</b><p className="text-xs text-slate-500">{p.rol} · {p.activo?"Acceso habilitado":"Sin acceso"}</p></div>{p.rol==="vendedor"&&<button disabled={busy} onClick={()=>toggle(p)} className="rounded-lg border px-3 py-2 text-sm">{p.activo?"Bloquear":"Habilitar"}</button>}</div>)}</div></section>}
      {section==="products"&&<section><h2 className="mb-5 text-2xl font-bold">Catálogo activo</h2><div className="grid gap-3 sm:grid-cols-3">{products.map(p=><article key={p.id} className="rounded-xl border bg-white p-4"><h3 className="font-bold">{p.nombre}</h3><p className="mt-2 text-sm text-slate-500">{p.categoria} · {p.presentacion}</p><p className="mt-2 text-xs font-semibold text-[#2166f3]">{p.gama}{p.es_demo?" · DEMO":""}</p></article>)}</div></section>}
    </div>
  </main>
}
