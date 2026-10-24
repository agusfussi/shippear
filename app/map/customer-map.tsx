"use client"

import "leaflet/dist/leaflet.css"

import { ArrowLeft, MapPin, Search, UserRound } from "lucide-react"
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet"
import { useEffect, useMemo, useState } from "react"

const customers = [
  { name: "Autoservicio El Encuentro", type: "Almacén", seller: "Martina Ríos", visits: 8, color: "#2166f3", position: [-34.6037, -58.3816] as [number, number] },
  { name: "Despensa Don Carlos", type: "Despensa", seller: "Lucas Vega", visits: 5, color: "#32a269", position: [-34.6092, -58.3924] as [number, number] },
  { name: "Almacén La Esquina", type: "Almacén", seller: "Martina Ríos", visits: 7, color: "#f0a529", position: [-34.5961, -58.3692] as [number, number] },
  { name: "Supermercado Norte", type: "Supermercado", seller: "Sofía Cruz", visits: 11, color: "#9b6ee5", position: [-34.5845, -58.3755] as [number, number] },
]

function RecenterMap({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => { map.flyTo(position, 14, { duration: 0.6 }) }, [map, position])
  return null
}

export default function CustomerMapPage() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(customers[0])
  const filtered = useMemo(() => customers.filter((customer) => customer.name.toLowerCase().includes(query.toLowerCase()) || customer.seller.toLowerCase().includes(query.toLowerCase())), [query])

  return (
    <main className="min-h-screen bg-[#f5f8fc] text-[#17243a]">
      <header className="flex h-[73px] items-center justify-between border-b border-[#e6ebf2] bg-white px-5 sm:px-9"><div className="flex items-center gap-3"><a href="/" className="grid size-8 place-items-center rounded-lg text-[#718096] hover:bg-[#f1f5fa]" aria-label="Volver"><ArrowLeft size={17} /></a><div><p className="text-xs text-[#718096]">Shippe.AR / Clientes</p><h1 className="text-[19px] font-bold">Mapa de comercios</h1></div></div><a href="/settings" className="flex items-center gap-2 rounded-lg border border-[#dce4ef] px-3 py-2 text-xs font-semibold text-[#52627b] hover:bg-[#f5f8fc]"><UserRound size={14} /> Configuración</a></header>
      <div className="mx-auto grid max-w-[1250px] gap-5 p-5 sm:p-8 lg:grid-cols-[300px_1fr]"><section className="rounded-2xl border border-[#dce4ef] bg-white p-4"><div className="mb-5"><h2 className="font-bold">Clientes y comercios</h2><p className="mt-1 text-xs text-[#718096]">{customers.length} puntos de venta registrados</p></div><label className="relative block"><Search className="absolute left-3 top-3 text-[#8b98aa]" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar comercio o vendedor" className="h-10 w-full rounded-lg border border-[#dce4ef] pl-9 pr-3 text-xs outline-none focus:border-[#2166f3]" /></label><div className="mt-4 flex flex-col gap-2">{filtered.map((customer) => <button key={customer.name} onClick={() => setSelected(customer)} className={`w-full rounded-xl border p-3 text-left transition ${selected.name === customer.name ? "border-[#2166f3] bg-[#e9f0ff]" : "border-[#e6ebf2] hover:bg-[#f5f8fc]"}`}><div className="flex items-start gap-3"><span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: customer.color }} /><span className="min-w-0"><strong className="block truncate text-xs">{customer.name}</strong><span className="mt-1 block text-[11px] text-[#718096]">{customer.seller} · {customer.visits} visitas</span></span></div></button>)}</div></section><section className="overflow-hidden rounded-2xl border border-[#dce4ef] bg-white"><div className="flex items-center justify-between border-b border-[#e6ebf2] px-5 py-4"><div><h2 className="font-bold">Mapa de cobertura</h2><p className="mt-1 text-xs text-[#718096]">Seleccioná un punto para ver el detalle del comercio.</p></div><span className="flex items-center gap-1.5 rounded-full bg-[#f1f5fa] px-3 py-1.5 text-[11px] font-semibold text-[#52627b]"><MapPin size={13} /> Buenos Aires</span></div><div className="h-[520px] w-full"><MapContainer center={selected.position} zoom={14} scrollWheelZoom className="z-0 h-full w-full"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><RecenterMap position={selected.position} />{customers.map((customer) => <CircleMarker key={customer.name} center={customer.position} radius={10} pathOptions={{ color: "#ffffff", weight: 3, fillColor: customer.color, fillOpacity: 1 }} eventHandlers={{ click: () => setSelected(customer) }}><Popup><strong>{customer.name}</strong><br />{customer.type} · {customer.seller}<br />{customer.visits} visitas registradas</Popup></CircleMarker>)}</MapContainer></div></section></div>
    </main>
  )
}
