"use client"

import { useEffect, useState } from "react"
import { type Config, getConfig } from "@/lib/api"
import { AdminPage } from "./Admin"
import { AssetPage } from "./Asset"
import { Home } from "./Home"
import { MePage } from "./Me"
import { PrivacyPage } from "./Privacy"
import { ReportPage } from "./Report"
import { useHash } from "./ui"

export function Shell() {
  const path = useHash()
  const [config, setConfig] = useState<Config | null>(null)
  useEffect(() => {
    getConfig().then(setConfig, () => {})
  }, [])

  const [, section = "", id] = path.split("/")
  let page: React.ReactNode
  if (section === "asset" && id) page = <AssetPage key={id} id={id} />
  else if (section === "report" && id) page = <ReportPage key={id} id={id} />
  else if (section === "me") page = <MePage />
  else if (section === "privacy") page = <PrivacyPage />
  else if (section === "admin") page = <AdminPage />
  else page = <Home />

  const current = section === "asset" || section === "report" ? "" : section
  const link = (href: string, label: string, match: string) => (
    <a href={href} aria-current={current === match ? "page" : undefined}>
      {label}
    </a>
  )

  return (
    <>
      <div className="strip">
        <div className="page">
          <span>
            <b>Demo</b> · contractors, tenders &amp; clauses are sample data
          </span>
          <span className="hide-sm">
            {config ? (config.mode === "arkiv" ? "Ledger · Arkiv testnet" : "Ledger · local store") : " "}
          </span>
        </div>
      </div>
      <header className="masthead">
        <div className="page">
          <a className="wordmark" href="#/">
            <span className="en">Jawabdehi</span>
            <span className="hi" lang="hi">
              जवाबदेही
            </span>
          </a>
          <nav className="nav" aria-label="Main">
            {link("#/", "Ledger", "")}
            {link("#/privacy", "Privacy", "privacy")}
            {link("#/me", "You", "me")}
          </nav>
        </div>
      </header>

      <main key={section + (id ?? "")} className="rise">
        {page}
      </main>

      <footer className="colophon">
        <div className="page">
          <div className="prose">
            <p>
              <strong>Jawabdehi</strong> holds the people paid to maintain Mumbai's roads, footpaths and bridges to their contracts.
              It records places and public duties, never individuals.
            </p>
            <p className="faint">
              Complements BMC's own channels and detection tools like Pothole Reporter by Gaurav Sen; anyone can write to the same
              open record.
            </p>
          </div>
          <div className="prose">
            <p>
              Records are read-only and checked on your device. Anonymous actions carry Semaphore zero-knowledge proofs.
            </p>
            <p>
              <a href="#/privacy">How you stay anonymous</a> · <a href="#/admin">Curators</a>
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
