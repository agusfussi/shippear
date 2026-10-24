"use client"

import { FormEvent, useState } from "react"
import { ArrowRight, LockKeyhole, Sparkles, UserPlus } from "lucide-react"

export default function LoginPage() {
  const [createUser, setCreateUser] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSubmitted(true) }
  return <main className="flex min-h-screen items-center justify-center bg-[#f5f8fc] px-5 py-10 text-[#17243a]">
    <section className="w-full max-w-[430px]">
      <div className="mb-8 flex items-center justify-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#2166f3] text-white"><Sparkles size={20}/></div><span className="text-2xl font-bold tracking-tight">Shippe<span className="text-[#2166f3]">.AR</span></span></div>
      <div className="rounded-2xl border border-[#dce4ef] bg-white p-6 shadow-[0_12px_40px_rgba(31,56,88,.08)] sm:p-8">
        {submitted ? <div className="py-8 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#e6f7ef] text-[#32a269]"><ArrowRight size={21}/></div><h1 className="text-xl font-bold">Listo para continuar</h1><p className="mt-2 text-sm leading-6 text-[#718096]">Esta demo no conecta cuentas todavía. Podés volver a la pantalla de visitas.</p><a href="/" className="mt-6 inline-flex rounded-lg bg-[#2166f3] px-4 py-2.5 text-sm font-bold text-white">Ir a nueva visita</a></div> : <><div className="mb-7"><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#2166f3]">Acceso de equipo</p><h1 className="text-2xl font-bold">{createUser ? "Crear usuario" : "Bienvenido de vuelta"}</h1><p className="mt-2 text-sm leading-6 text-[#718096]">{createUser ? "Sumá un representante al equipo de ventas." : "Ingresá para continuar con tus visitas."}</p></div><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold">Nombre de usuario<input required type="text" placeholder={createUser ? "Martina Ríos" : "martina@shippear.ar"} className="mt-2 h-11 w-full rounded-lg border border-[#dce4ef] px-3 text-sm outline-none focus:border-[#2166f3] focus:ring-4 focus:ring-[#e9f0ff]"/></label><label className="block text-sm font-semibold">Contraseña<input required type="password" placeholder="••••••••" className="mt-2 h-11 w-full rounded-lg border border-[#dce4ef] px-3 text-sm outline-none focus:border-[#2166f3] focus:ring-4 focus:ring-[#e9f0ff]"/></label>{createUser && <label className="block text-sm font-semibold">Zona de trabajo<select className="mt-2 h-11 w-full rounded-lg border border-[#dce4ef] bg-white px-3 text-sm outline-none focus:border-[#2166f3]"><option>Zona Norte</option><option>Zona Centro</option><option>Zona Sur</option></select></label>}<button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2166f3] text-sm font-bold text-white shadow-[0_5px_12px_rgba(33,102,243,.25)] hover:bg-[#1959d6]">{createUser ? <UserPlus size={17}/> : <LockKeyhole size={17}/>} {createUser ? "Crear usuario" : "Ingresar"}</button></form><button onClick={()=>setCreateUser(!createUser)} className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-semibold text-[#2166f3]">{createUser ? "Ya tengo una cuenta" : "Crear un usuario nuevo"}</button></>}
      </div><p className="mt-5 text-center text-xs text-[#8b98aa]">Panel de demostración · Shippe.AR</p>
    </section>
  </main>
}
