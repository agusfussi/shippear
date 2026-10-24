"use client"

import { useRouter } from "next/navigation"

import Link from "next/link"

import { useEffect, useState, type FormEvent } from "react"
import { getSession, updateName } from "../../lib/auth"
import type { AppUser } from "../../types/api"

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AppUser | null>(null)
  const [nombre, setNombre] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  useEffect(()=>{getSession().then(u=>{if(!u) router.replace("/login"); else {setUser(u);setNombre(u.name)}}).catch(e=>setError(e.message))},[router])
  async function save(e: FormEvent) {
    e.preventDefault();setBusy(true);setError("");setMensaje("")
    try {await updateName(nombre);setMensaje("Nombre guardado en Supabase")} catch(e){setError(e instanceof Error?e.message:"No se pudo guardar")} finally{setBusy(false)}
  }
  return <main className="min-h-screen bg-[#f5f8fc] p-6 text-[#17243a]"><div className="mx-auto max-w-2xl">
    <Link className="text-sm text-[#2166f3]" href={user?.role==="admin"?"/admin":"/"}>← Volver</Link>
    <h1 className="my-6 text-2xl font-bold">Configuración de cuenta</h1>
    {error&&<p role="alert" className="mb-4 text-red-700">{error}</p>}
    {user?<form onSubmit={save} className="space-y-5 rounded-2xl border border-[#dce4ef] bg-white p-6">
      <label className="block text-sm font-semibold">Nombre<input required maxLength={200} value={nombre} onChange={e=>setNombre(e.target.value)} className="mt-2 h-11 w-full rounded-lg border px-3"/></label>
      <label className="block text-sm font-semibold">Correo<input disabled value={user.email} className="mt-2 h-11 w-full rounded-lg border bg-slate-50 px-3"/></label>
      <p className="text-sm text-slate-600">Rol: {user.role==="admin"?"Administrador":"Vendedor"}. El correo y los permisos se administran en Supabase Auth.</p>
      <button disabled={busy} className="rounded-lg bg-[#2166f3] px-4 py-2.5 font-semibold text-white disabled:opacity-50">{busy?"Guardando...":"Guardar nombre"}</button>
      {mensaje&&<p role="status" className="text-green-700">{mensaje}</p>}
    </form>:<p>Verificando acceso...</p>}
  </div></main>
}
