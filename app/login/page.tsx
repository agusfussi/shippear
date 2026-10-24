"use client"

import { useRouter } from "next/navigation"

import { type FormEvent, useState } from "react"
import { ArrowRight, Sparkles } from "lucide-react"
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
    setError(""); setAviso(""); setBusy(true)
    try {
      if (registro) {
        const result = await signUp(nombre, email, password)
        setAviso(result.mensaje); setRegistro(false); setPassword("")
      } else {
        const user = await signIn(email, password)
        router.replace(user.role === "admin" ? "/admin" : "/"); router.refresh()
      }
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo ingresar") }
    finally { setBusy(false) }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f5f8fc] px-5 py-10 text-[#17243a]">
    <section className="w-full max-w-[430px]">
      <div className="mb-8 flex items-center justify-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#2166f3] text-white"><Sparkles size={20}/></div><span className="text-2xl font-bold">Shippe<span className="text-[#2166f3]">.AR</span></span></div>
      <div className="rounded-2xl border border-[#dce4ef] bg-white p-8 shadow-lg">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#2166f3]">Acceso de equipo</p>
        <h1 className="text-2xl font-bold">{registro ? "Crear cuenta de vendedor" : "Bienvenido de vuelta"}</h1>
        <p className="mt-2 text-sm text-[#718096]">Ingresá con tu cuenta de Supabase. El rol se verifica en el servidor.</p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {registro && <label className="text-sm font-semibold">Nombre completo<input required value={nombre} onChange={e=>setNombre(e.target.value)} autoComplete="name" className="mt-2 h-11 w-full rounded-lg border border-[#dce4ef] px-3"/></label>}
          <label className="text-sm font-semibold">Correo electrónico<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="mt-2 h-11 w-full rounded-lg border border-[#dce4ef] px-3"/></label>
          <label className="text-sm font-semibold">Contraseña<input required type="password" minLength={registro ? 8 : 1} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={registro ? "new-password" : "current-password"} className="mt-2 h-11 w-full rounded-lg border border-[#dce4ef] px-3"/></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {aviso && <p role="status" className="text-sm text-green-700">{aviso}</p>}
          <button disabled={busy} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#2166f3] text-sm font-bold text-white disabled:opacity-50">{busy ? "Procesando..." : registro ? "Registrarme" : "Ingresar"}<ArrowRight size={17}/></button>
        </form>
        <button onClick={()=>{setRegistro(!registro);setError("");setAviso("")}} className="mt-5 w-full text-sm font-semibold text-[#2166f3]">{registro ? "Ya tengo una cuenta" : "Crear cuenta de vendedor"}</button>
      </div>
    </section>
  </main>
}
