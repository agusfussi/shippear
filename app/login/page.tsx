"use client"

import { FormEvent, useState } from "react"
import { ArrowRight, Check, ShieldCheck, Sparkles, UserCheck } from "lucide-react"
import { signIn, saveUsers, getUsers, type UserRole } from "../../lib/auth"

export default function LoginPage() {
  const [createUser, setCreateUser] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("demo1234")
  const [name, setName] = useState("")
  const [zone, setZone] = useState("Zona Norte")
  const [error, setError] = useState("")
  const [created, setCreated] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (createUser) {
      if (!name.trim() || !email.trim()) return setError("Completá nombre y correo.")
      const users = getUsers()
      if (users.some((user) => user.email.toLowerCase() === email.trim().toLowerCase())) return setError("Ese correo ya está registrado.")
      saveUsers([...users, { name: name.trim(), email: email.trim(), role: "seller" as UserRole, zone: zone.trim() || "Zona Norte" }])
      setCreated(true)
      return
    }
    const user = signIn(email)
    if (!user) return setError("No encontramos esa cuenta o está bloqueada. Probá con admin@shippear.ar o martina@shippear.ar.")
    window.location.href = user.role === "admin" ? "/admin" : "/"
  }

  function quickLogin(demoEmail: string) {
    setError("")
    setEmail(demoEmail)
    const user = signIn(demoEmail)
    if (!user) {
      setError("La cuenta seleccionada está deshabilitada desde el panel de administración.")
      return
    }
    window.location.href = user.role === "admin" ? "/admin" : "/"
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f5f8fc] px-3 py-4 text-[#17243a] sm:px-5 sm:py-10">
      <section className="w-full max-w-[420px]">
        <div className="mb-4 flex items-center justify-center gap-2.5 sm:mb-7">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#2166f3] text-white shadow-[0_4px_12px_rgba(33,102,243,.3)] sm:h-10 sm:w-10">
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
          {created ? (
            <div className="py-5 text-center sm:py-8">
              <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#e6f7ef] text-[#32a269] sm:mb-4 sm:h-12 sm:w-12">
                <Check size={20} />
              </div>
              <h1 className="text-lg font-bold sm:text-xl">Vendedor creado</h1>
              <p className="mt-1.5 text-xs leading-5 text-[#718096] sm:mt-2 sm:text-sm sm:leading-6">
                Ya puede ingresar con <b>{email}</b>. El acceso queda disponible en este navegador.
              </p>
              <button
                onClick={() => {
                  setCreated(false)
                  setCreateUser(false)
                }}
                className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[#2166f3] px-4 py-2.5 text-xs font-bold text-white sm:w-auto sm:text-sm"
              >
                Ir al login
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 sm:mb-6">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#2166f3] sm:text-xs">
                  Perfil del Punto de Venta
                </p>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {createUser ? "Crear cuenta de vendedor" : "Bienvenido de vuelta"}
                </h1>
                <p className="mt-1 text-xs leading-5 text-[#718096] sm:text-sm sm:leading-6">
                  {createUser
                    ? "Registrá un representante comercial para relevar comercios."
                    : "Ingresá para clasificar comercios con IA o ver el panel operativo."}
                </p>
              </div>

              <form onSubmit={submit} className="flex flex-col gap-3 sm:gap-4">
                {createUser && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold sm:text-sm">
                      Nombre completo
                      <input
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        type="text"
                        placeholder="Martina Ríos"
                        className="mt-1.5 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] focus:ring-3 focus:ring-[#e9f0ff] sm:h-11 sm:text-sm"
                      />
                    </label>
                    <label className="block text-xs font-semibold sm:text-sm">
                      Zona asignada
                      <input
                        value={zone}
                        onChange={(event) => setZone(event.target.value)}
                        type="text"
                        placeholder="Zona Norte"
                        className="mt-1.5 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] focus:ring-3 focus:ring-[#e9f0ff] sm:h-11 sm:text-sm"
                      />
                    </label>
                  </div>
                )}

                <label className="block text-xs font-semibold sm:text-sm">
                  Correo electrónico
                  <input
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder={createUser ? "vendedor@shippear.ar" : "martina@shippear.ar"}
                    className="mt-1.5 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] focus:ring-3 focus:ring-[#e9f0ff] sm:h-11 sm:text-sm"
                  />
                </label>

                {!createUser && (
                  <label className="block text-xs font-semibold sm:text-sm">
                    Contraseña
                    <input
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      placeholder="••••••••"
                      className="mt-1.5 h-10 w-full rounded-lg border border-[#dce4ef] px-3 text-xs outline-none focus:border-[#2166f3] focus:ring-3 focus:ring-[#e9f0ff] sm:h-11 sm:text-sm"
                    />
                  </label>
                )}

                {error && (
                  <p role="alert" className="rounded-lg bg-[#fff0f0] px-3 py-2 text-[11px] font-semibold text-[#d04d5b] sm:text-xs">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2166f3] text-xs font-bold text-white shadow-[0_5px_12px_rgba(33,102,243,.25)] transition hover:bg-[#1854d1] sm:h-11 sm:text-sm"
                >
                  {createUser ? "Crear usuario vendedor" : "Ingresar al panel"}
                  <ArrowRight size={16} />
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setCreateUser(!createUser)
                  setError("")
                }}
                className="mt-3.5 w-full py-1 text-center text-xs font-semibold text-[#2166f3] hover:underline sm:mt-4"
              >
                {createUser ? "← Ya tengo una cuenta" : "Crear usuario vendedor"}
              </button>

              <div className="mt-3.5 rounded-xl border border-[#e6ebf2] bg-[#f8fafd] p-2.5 sm:mt-5 sm:p-3.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#718096]">
                  Acceso rápido de demostración
                </p>
                <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => quickLogin("martina@shippear.ar")}
                    className="flex items-center gap-2 rounded-lg border border-[#dce4ef] bg-white px-2.5 py-2 text-left transition hover:border-[#2166f3] hover:bg-[#f0f5ff]"
                  >
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#e9f0ff] text-[#2166f3]">
                      <UserCheck size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-[#17243a]">Vendedor</p>
                      <p className="truncate text-[10px] text-[#718096]">martina@shippear.ar</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickLogin("admin@shippear.ar")}
                    className="flex items-center gap-2 rounded-lg border border-[#dce4ef] bg-white px-2.5 py-2 text-left transition hover:border-[#2166f3] hover:bg-[#f0f5ff]"
                  >
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#0b1f3a] text-white">
                      <ShieldCheck size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-[#17243a]">Admin</p>
                      <p className="truncate text-[10px] text-[#718096]">admin@shippear.ar</p>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-[#8b98aa] sm:mt-5 sm:text-xs">
          Hackathon Shippe.AR #3 · Track La Virginia
        </p>
      </section>
    </main>
  )
}

