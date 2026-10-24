"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react"
import { signIn, signUp } from "../../lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [registro, setRegistro] = useState(false)
  const [email, setEmail] = useState("")
  const [nombre, setNombre] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setAviso("")
    setBusy(true)
    try {
      if (registro) {
        const result = await signUp(nombre, email, password)
        setAviso(result.mensaje)
        setRegistro(false)
        setPassword("")
      } else {
        const user = await signIn(email, password)
        router.replace(user.role === "admin" ? "/admin" : "/")
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ingresar")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f5f8fc] px-3 py-4 text-[#17243a] sm:px-5 sm:py-10">
      <section className="w-full max-w-[420px]">
        <div className="mb-4 flex items-center justify-center gap-2.5 sm:mb-7">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#2166f3] text-white shadow-[0_4px_12px_rgba(33,102,243,.3)] sm:size-10">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight sm:text-2xl">
              Shippe<span className="text-[#2166f3]">.AR</span>
            </span>
            <span className="ml-2 rounded-full bg-[#e9f0ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2166f3]">
              La Virginia
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#dce4ef] bg-white p-4 shadow-[0_12px_40px_rgba(31,56,88,.08)] sm:p-7">
          <div className="mb-4 sm:mb-6">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#2166f3] sm:text-xs">
              Acceso de equipo · Perfil PDV
            </p>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {registro ? "Crear cuenta de vendedor" : "Bienvenido de vuelta"}
            </h1>
            <p className="mt-1 text-xs leading-5 text-[#718096] sm:text-sm sm:leading-6">
              Ingresá con tu cuenta de Supabase. El rol se verifica en el servidor.
            </p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3 sm:gap-4">
            {registro && (
              <label className="block text-xs font-semibold sm:text-sm">
                Nombre completo
                <input
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name"
                  placeholder="Ej: Martina Ríos"
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] focus:ring-3 focus:ring-[#e9f0ff] sm:h-11 sm:text-sm"
                />
              </label>
            )}

            <label className="block text-xs font-semibold sm:text-sm">
              Correo electrónico
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="vendedor@shippear.ar"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] focus:ring-3 focus:ring-[#e9f0ff] sm:h-11 sm:text-sm"
              />
            </label>

            <label className="block text-xs font-semibold sm:text-sm">
              Contraseña
              <input
                required
                type="password"
                minLength={registro ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={registro ? "new-password" : "current-password"}
                placeholder="••••••••"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] focus:ring-3 focus:ring-[#e9f0ff] sm:h-11 sm:text-sm"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-[#fff0f0] px-3 py-2 text-xs font-semibold text-red-700"
              >
                {error}
              </p>
            )}

            {aviso && (
              <p
                role="status"
                className="flex items-center gap-1.5 rounded-lg bg-[#e6f7ef] px-3 py-2 text-xs font-semibold text-green-700"
              >
                <CheckCircle2 size={14} className="shrink-0" />
                {aviso}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2166f3] text-xs font-bold text-white shadow-[0_5px_12px_rgba(33,102,243,.25)] transition hover:bg-[#1854d1] disabled:opacity-50 sm:h-11 sm:text-sm"
            >
              {busy ? "Procesando..." : registro ? "Registrarme" : "Ingresar"}
              <ArrowRight size={16} />
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setRegistro(!registro)
              setError("")
              setAviso("")
            }}
            className="mt-4 w-full py-1 text-center text-xs font-semibold text-[#2166f3] hover:underline sm:text-sm"
          >
            {registro ? "Ya tengo una cuenta" : "Crear cuenta de vendedor"}
          </button>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#e6ebf2] bg-[#f8fafd] p-2.5 text-[11px] text-[#52627b]">
            <ShieldCheck size={15} className="shrink-0 text-[#2166f3]" />
            <span>Autenticación protegida con Supabase Auth y RLS por rol (`vendedor` | `admin`).</span>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-[#8b98aa] sm:mt-5 sm:text-xs">
          Hackathon Shippe.AR #3 · Track La Virginia
        </p>
      </section>
    </main>
  )
}
