import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Shippe.AR — Field intelligence for every visit",
  description: "AI-powered sales assistant for La Virginia field teams.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
