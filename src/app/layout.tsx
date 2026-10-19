import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Serif, Tiro_Devanagari_Marathi } from "next/font/google"
import "./globals.css"
import "./views.css"

// next/font downloads these at build time and serves them from our own origin,
// so visitors never make a request to a third-party font host.
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" })
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
const deva = Tiro_Devanagari_Marathi({ subsets: ["devanagari"], weight: "400", variable: "--font-deva" })

export const metadata: Metadata = {
  title: "Jawabdehi — who is responsible for this road?",
  description:
    "Report a broken road, footpath or bridge in Mumbai anonymously, see the contractor and warranty, and hold them to a deadline.",
  referrer: "no-referrer",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='16' fill='%2316140f'/><text x='16' y='22' text-anchor='middle' font-family='Georgia,serif' font-size='18' fill='%23f2efe7'>J</text></svg>",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2efe7" },
    { media: "(prefers-color-scheme: dark)", color: "#12110e" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable} ${deva.variable}`}>
      <body>{children}</body>
    </html>
  )
}
