export type UserRole = "admin" | "seller"

export type DemoUser = {
  email: string
  name: string
  role: UserRole
  zone?: string
}

const SESSION_KEY = "shippear-session"
const USERS_KEY = "shippear-users"

export const demoUsers: DemoUser[] = [
  { email: "admin@shippear.ar", name: "Agustín Fussi", role: "admin" },
  { email: "martina@shippear.ar", name: "Martina Ríos", role: "seller", zone: "Zona Norte" },
]

export function getUsers(): DemoUser[] {
  if (typeof window === "undefined") return demoUsers
  try {
    const stored = window.sessionStorage.getItem(USERS_KEY)
    return stored ? JSON.parse(stored) : demoUsers
  } catch {
    return demoUsers
  }
}

export function saveUsers(users: DemoUser[]) {
  window.sessionStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getSession(): DemoUser | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function signIn(email: string): DemoUser | null {
  const user = getUsers().find((candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase() && !(candidate as DemoUser & { disabled?: boolean }).disabled)
  if (user) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  return user ?? null
}

export function signOut() {
  window.sessionStorage.removeItem(SESSION_KEY)
}
