import type { Metadata, Viewport } from "next"
import { Archivo, IBM_Plex_Mono, Mukta } from "next/font/google"
import "./globals.css"
import "./views.css"

// next/font downloads these at build time and serves them from our own origin,
// so visitors never make a request to a third-party font host.
const sans = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans" })
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" })
const deva = Mukta({ subsets: ["devanagari"], weight: ["500", "800"], variable: "--font-deva" })

export const metadata: Metadata = {
  title: "Jawabdehi — potholes don't fix themselves",
  description:
    "Report a broken road, footpath or bridge in Mumbai anonymously, see the contractor and warranty, and hold them to a deadline.",
  referrer: "no-referrer",
  icons: { icon: "/brand/jawabdehi-mark.svg" },
}

export const viewport: Viewport = {
  themeColor: "#1b1c1e",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${deva.variable}`}>
      <body>{children}</body>
    </html>
  )
}
