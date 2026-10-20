"use client"

import { useEffect, useState } from "react"
import { type Config, getConfig } from "@/lib/api"
import { AdminPage } from "./Admin"
import { AssetPage } from "./Asset"
import { Home } from "./Home"
import { MePage } from "./Me"
import { PrivacyPage } from "./Privacy"
import { ReportPage } from "./Report"
import { ReportStart } from "./ReportStart"
import { Icon, useHash } from "./ui"

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
  else if (section === "report") page = <ReportStart />
  else if (section === "me") page = <MePage />
  else if (section === "privacy") page = <PrivacyPage />
  else if (section === "admin") page = <AdminPage />
  else page = <Home />

  const current = section === "asset" ? "" : section
  const link = (href: string, label: string, match: string, cls = "") => (
    <a href={href} className={cls} aria-current={current === match ? "page" : undefined}>
      {label}
    </a>
  )

  return (
    <>
      <div className="strip">
        <div className="page">
          <span>Demo · contractors, tenders &amp; clauses are sample data</span>
          <span className="hide-sm">
            {config ? (config.mode === "arkiv" ? "● Live on Arkiv testnet" : "● Local store") : " "}
          </span>
        </div>
      </div>
      <header className="masthead asphalt">
        <div className="page">
          <a className="wordmark" href="#/">
            <Logo />
            <span className="en">Jawabdehi</span>
            <span className="hi" lang="hi">
              जवाबदेही
            </span>
          </a>
          <nav className="nav" aria-label="Main">
            {link("#/", "Ledger", "", "hide-sm")}
            {link("#/privacy", "Privacy", "privacy", "hide-sm")}
            {link("#/me", "You", "me")}
            <a className="nav-cta" href="#/report" aria-current={section === "report" ? "page" : undefined}>
              Report
            </a>
          </nav>
        </div>
      </header>

      <main key={section + (id ?? "")} className="rise">
        {page}
      </main>

      <Footer mode={config?.mode} />
    </>
  )
}

function Logo() {
  return <img src="/brand/jawabdehi-mark.svg" alt="" width={34} height={34} />
}

function Footer({ mode }: { mode?: string }) {
  return (
    <footer className="footer asphalt">
      <div className="hazard-tape" />
      <div className="page footer-grid">
        <div className="footer-about">
          <p className="footer-tag">
            Potholes don't fix themselves. <span>Somebody was paid to.</span>
          </p>
          <p className="muted small">
            Jawabdehi holds the people paid to maintain Mumbai's roads, footpaths and bridges to their contracts. It records places
            and public duties — never individuals.
          </p>
          <a className="btn solid" href="#/report">
            Report a problem <Icon name="arrow" />
          </a>
        </div>
        <div className="footer-col">
          <h3>Use it</h3>
          <a href="#/">The ledger</a>
          <a href="#/privacy">How you stay anonymous</a>
          <a href="#/me">Your identity</a>
        </div>
        <div className="footer-col">
          <h3>Partners</h3>
          <a href="#/admin">Curator console</a>
          <a href="#/me">Join with an invite code</a>
          <span className="faint small">Open schema for detection tools</span>
        </div>
        <div className="footer-col">
          <h3>Built on</h3>
          <span className="small">Arkiv — {mode === "arkiv" ? "Tiramisu testnet" : "local store"}</span>
          <span className="small">Semaphore zero-knowledge proofs</span>
          <span className="faint small">Complements BMC's channels and Pothole Reporter by Gaurav Sen</span>
        </div>
      </div>
      <div className="page footer-base">
        <span className="footer-big" aria-hidden>
          Jawabdehi
        </span>
        <div className="footer-meta">
          <span lang="hi" className="footer-hi">
            जवाबदेही · accountability
          </span>
          <span className="faint tiny">No accounts. No trackers. No analytics. If anyone is in danger, call 112 first.</span>
        </div>
      </div>
    </footer>
  )
}
