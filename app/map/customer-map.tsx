"use client"

import Link from "next/link"

import "leaflet/dist/leaflet.css"
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet"
import { useEffect, useMemo, useState } from "react"
import { api } from "../../lib/client-api"
import type { MapStore } from "../../types/api"

function Recenter({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(()=>{map.flyTo(position,14,{duration:.6})},[map,position])
  return null
}
const rosario: [number,number]=[-32.9468,-60.6393]
const colores: Record<string,string>={premium:"#9b6ee5",estandar:"#2166f3",basico:"#32a269"}
export default function CustomerMapPage({embedded=false}:{embedded?:boolean}) {
  const [stores,setStores]=useState<MapStore[]>([])
  const [selectedId,setSelectedId]=useState("")
  const [query,setQuery]=useState("")
  const [error,setError]=useState("")
  const [loaded,setLoaded]=useState(false)
  useEffect(()=>{let live=true;api<MapStore[]>("/api/mapa").then(rows=>{if(live){setStores(rows);setLoaded(true)}}).catch(e=>{if(live){setError(e.message);setLoaded(true)}});return()=>{live=false}},[])
  const filtered=useMemo(()=>stores.filter(s=>s.nombre.toLowerCase().includes(query.toLowerCase())),[stores,query])
  const points=filtered.filter((s):s is MapStore & {lat:number;lng:number}=>s.lat!==null&&s.lng!==null)
  const selected=points.find(s=>s.id===selectedId)||points[0]
  const position: [number,number]=selected?[selected.lat,selected.lng]:rosario
  return <main className="min-h-[500px] bg-[#f5f8fc] text-[#17243a]">
    {!embedded&&<header className="flex items-center justify-between border-b bg-white p-5"><Link href="/" className="text-sm text-[#2166f3]">← Nueva visita</Link><h1 className="text-xl font-bold">Mapa de comercios</h1><Link href="/settings">Cuenta</Link></header>}
    {error&&<p role="alert" className="p-5 text-red-700">{error}</p>}
    <div className="mx-auto grid max-w-[1250px] gap-5 p-5 lg:grid-cols-[300px_1fr]">
      <section className="rounded-2xl border border-[#dce4ef] bg-white p-4"><h2 className="font-bold">Puntos de venta</h2><p className="mt-1 text-xs text-slate-500">{loaded?stores.length+" comercios · "+stores.filter(s=>s.es_demo).length+" DEMO":"Cargando..."}</p>
        <input aria-label="Buscar comercio" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar comercio" className="my-4 h-10 w-full rounded-lg border px-3"/>
        <div className="max-h-[520px] space-y-2 overflow-auto">{filtered.map(s=><button key={s.id} onClick={()=>setSelectedId(s.id)} className={"w-full rounded-xl border p-3 text-left "+(s.id===selected?.id?"border-[#2166f3] bg-[#e9f0ff]":"border-slate-200")}>
          <b className="block text-sm">{s.nombre}</b><span className="mt-1 block text-xs text-slate-500">{s.formato||"Sin ficha"} · NSE {s.nse||"sin estimar"}{s.categoria?" · "+s.categoria:""}{s.lat===null?" · Sin ubicación":""}</span>
        </button>)}</div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-[#dce4ef] bg-white"><div className="border-b p-4"><h2 className="font-bold">Cobertura comercial · Rosario</h2><p className="text-xs text-slate-500">Las fichas y ofertas ampliadas se muestran según tu rol.</p></div>
        <div className="h-[520px]"><MapContainer center={position} zoom={13} className="z-0 h-full w-full"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Recenter position={position}/>
          {points.map(s=><CircleMarker key={s.id} center={[s.lat,s.lng]} radius={s.id===selected?.id?12:9} pathOptions={{color:"white",weight:2,fillColor:colores[s.categoria||""]||"#2166f3",fillOpacity:1}} eventHandlers={{click:()=>setSelectedId(s.id)}}>
            <Popup><b>{s.nombre}</b><p>{s.formato||"Sin ficha"} · NSE {s.nse||"sin estimar"}</p>{s.es_demo&&<p>Datos ficticios DEMO</p>}{s.ficha&&<><p>Categoría: {s.categoria}</p><ul>{s.ficha.ofrecer_primero.map(p=><li key={p.producto}>{p.producto}</li>)}</ul><p>{s.ficha.limitaciones}</p></>}</Popup>
          </CircleMarker>)}
        </MapContainer></div>
      </section>
    </div>
  </main>
}
