"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft } from "lucide-react"
import { getSession, updateName } from "../../lib/auth"
import type { AppUser } from "../../types/api"

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AppUser | null>(null)
  const [nombre, setNombre] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSession()
      .then((u) => {
        if (!u) router.replace("/login")
        else {
          setUser(u)
          setNombre(u.name)
        }
      })
      .catch((e) => setError(e.message))
  }, [router])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    setMensaje("")
    try {
      await updateName(nombre)
      setMensaje("Nombre guardado en Supabase")
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8fc] p-3.5 text-[#17243a] sm:p-6">
      <div className="mx-auto max-w-2xl">
        <Link
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#dce4ef] bg-white px-2.5 text-xs font-semibold text-[#17243a] hover:bg-[#f1f5fa]"
          href={user?.role === "admin" ? "/admin" : "/"}
        >
          <ArrowLeft size={14} /> Volver
        </Link>
        <h1 className="my-4 text-xl font-bold sm:my-6 sm:text-2xl">Configuración de cuenta</h1>
        {error && (
          <p role="alert" className="mb-4 text-xs font-semibold text-red-700 sm:text-sm">
            {error}
          </p>
        )}
        {user ? (
          <form
            onSubmit={save}
            className="space-y-4 rounded-2xl border border-[#dce4ef] bg-white p-4 sm:space-y-5 sm:p-6"
          >
            <label className="block text-xs font-semibold sm:text-sm">
              Nombre
              <input
                required
                maxLength={200}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] sm:h-11 sm:text-sm"
              />
            </label>
            <label className="block text-xs font-semibold sm:text-sm">
              Correo
              <input
                disabled
                value={user.email}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#dce4ef] bg-slate-50 px-3 text-xs sm:h-11 sm:text-sm"
              />
            </label>
            <p className="text-xs text-slate-500 sm:text-sm">
              Rol: {user.role === "admin" ? "Administrador" : "Vendedor"}. El correo y los permisos se administran en Supabase Auth.
            </p>
            <button
              disabled={busy}
              className="rounded-lg bg-[#2166f3] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 sm:text-sm"
            >
              {busy ? "Guardando..." : "Guardar nombre"}
            </button>
            {mensaje && (
              <p role="status" className="text-xs font-semibold text-green-700 sm:text-sm">
                {mensaje}
              </p>
            )}
          </form>
        ) : (
          <p className="text-xs text-slate-500">Verificando acceso...</p>
        )}
      </div>
    </main>
  )
}
