"use client"

import { FormEvent, useState } from "react"
import { ArrowRight, Check, Sparkles } from "lucide-react"
import { signIn, saveUsers, getUsers, type UserRole } from "../../lib/auth"

export default function LoginPage() {
  const [createUser, setCreateUser] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [created, setCreated] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (createUser) {
      if (!name.trim() || !email.trim()) return setError("Completá nombre y correo.")
      const users = getUsers()
      if (users.some((user) => user.email.toLowerCase() === email.trim().toLowerCase())) return setError("Ese correo ya está registrado.")
      saveUsers([...users, { name: name.trim(), email: email.trim(), role: "seller" as UserRole, zone: "Zona Norte" }])
      setCreated(true)
      return
    }
    const user = signIn(email)
    if (!user) return setError("No encontramos esa cuenta. Probá con admin@shippear.ar o martina@shippear.ar.")
    window.location.href = user.role === "admin" ? "/admin" : "/"
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f5f8fc] px-5 py-10 text-[#17243a]">
    <section className="w-full max-w-[430px]">
      <div className="mb-8 flex items-center justify-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#2166f3] text-white"><Sparkles size={20}/></div><span className="text-2xl font-bold tracking-tight">Shippe<span className="text-[#2166f3]">.AR</span></span></div>
      <div className="rounded-2xl border border-[#dce4ef] bg-white p-6 shadow-[0_12px_40px_rgba(31,56,88,.08)] sm:p-8">
        {created ? <div className="py-8 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#e6f7ef] text-[#32a269]"><Check size={21}/></div><h1 className="text-xl font-bold">Vendedor creado</h1><p className="mt-2 text-sm leading-6 text-[#718096]">Ya puede ingresar con su correo. El acceso queda disponible en este navegador.</p><button onClick={()=>{setCreated(false);setCreateUser(false)}} className="mt-6 inline-flex rounded-lg bg-[#2166f3] px-4 py-2.5 text-sm font-bold text-white">Ir al login</button></div> : <>
          <div className="mb-7"><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#2166f3]">Acceso de equipo</p><h1 className="text-2xl font-bold">{createUser ? "Crear vendedor" : "Bienvenido de vuelta"}</h1><p className="mt-2 text-sm leading-6 text-[#718096]">{createUser ? "El administrador podrá habilitar su acceso." : "Ingresá y te llevamos al panel correspondiente a tu rol."}</p></div>
          <form onSubmit={submit} className="flex flex-col gap-4"><label className="block text-sm font-semibold">{createUser ? "Nombre completo" : "Correo electrónico"}<input required value={createUser ? name : email} onChange={(event)=>createUser ? setName(event.target.value) : setEmail(event.target.value)} type={createUser ? "text" : "email"} placeholder={createUser ? "Martina Ríos" : "martina@shippear.ar"} className="mt-2 h-11 w-full rounded-lg border border-[#dce4ef] px-3 text-sm outline-none focus:border-[#2166f3] focus:ring-4 focus:ring-[#e9f0ff]"/></label>{createUser && <label className="block text-sm font-semibold">Correo electrónico<input required value={email} onChange={(event)=>setEmail(event.target.value)} type="email" placeholder="vendedor@shippear.ar" className="mt-2 h-11 w-full rounded-lg border border-[#dce4ef] px-3 text-sm outline-none focus:border-[#2166f3] focus:ring-4 focus:ring-[#e9f0ff]"/></label>} {!createUser && <label className="block text-sm font-semibold">Contraseña<input required type="password" placeholder="••••••••" className="mt-2 h-11 w-full rounded-lg border border-[#dce4ef] px-3 text-sm outline-none focus:border-[#2166f3] focus:ring-4 focus:ring-[#e9f0ff]"/></label>}{error && <p role="alert" className="text-xs font-semibold text-[#d04d5b]">{error}</p>}<button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2166f3] text-sm font-bold text-white shadow-[0_5px_12px_rgba(33,102,243,.25)]">{createUser ? "Crear usuario" : "Ingresar"}<ArrowRight size={17}/></button></form>
          <button onClick={()=>{setCreateUser(!createUser);setError("")}} className="mt-5 w-full text-center text-xs font-semibold text-[#2166f3]">{createUser ? "Ya tengo una cuenta" : "Crear usuario vendedor"}</button>
          <p className="mt-5 rounded-lg bg-[#f5f8fc] p-3 text-[11px] leading-5 text-[#718096]">Demo: <b>admin@shippear.ar</b> abre el panel administrador. <b>martina@shippear.ar</b> abre el panel vendedor.</p>
        </>}
      </div><p className="mt-5 text-center text-xs text-[#8b98aa]">Panel de demostración · Shippe.AR</p>
    </section>
  </main>
}
