"use client"

import dynamic from "next/dynamic"

// The whole app runs in the browser: it verifies every record and makes zero-knowledge proofs
// on the device, and routes live in the URL hash so the server never learns what was opened.
const Shell = dynamic(() => import("@/components/Shell").then((m) => m.Shell), { ssr: false })

export default function Page() {
  return <Shell />
}
