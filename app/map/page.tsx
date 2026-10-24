"use client"

import dynamic from "next/dynamic"

const CustomerMapPage = dynamic(() => import("./customer-map"), { ssr: false })

export default function MapPage() {
  return <CustomerMapPage />
}
