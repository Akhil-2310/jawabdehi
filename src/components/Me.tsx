"use client"

import { useState } from "react"
import { GROUPS } from "../../shared/config"
import { formatDay } from "../../shared/util"
import { currentGroup, exportBackup, getIdentity, hasIdentity, importBackup, join, receipts, wipe } from "@/lib/identity"
import { Icon, Tag } from "./ui"

export function MePage() {
  const [, rerender] = useState(0)
  const refresh = () => rerender((n) => n + 1)
  const [invite, setInvite] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const exists = hasIdentity()
  const group = currentGroup()
  const mine = receipts()

  const doJoin = async () => {
    setMsg(null)
    try {
      const g = await join(invite.trim())
      setMsg({ ok: true, text: `You're now a ${GROUPS[g].toLowerCase()}.` })
      setInvite("")
      refresh()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportBackup()], { type: "application/json" }))
    Object.assign(document.createElement("a"), { href: url, download: "jawabdehi-identity.json" }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="asphalt page-band">
        <div className="page page-head">
          <p className="eyebrow">You</p>
          <h1 className="display page-title">
            An identity with <em>no name</em> on it.
          </h1>
          <p className="lede">
            It lives only in this browser. There's no account, phone number or email, and nothing on our side that knows it's you.
          </p>
        </div>
        <div className="hazard-tape" />
      </div>

      <div className="page">
        <div className="id-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span className="eyebrow">Anonymous member</span>
            {group ? <Tag tone={group === "verified" ? "green" : "none"}>{GROUPS[group]}</Tag> : <Tag>Not joined yet</Tag>}
          </div>
          {exists ? (
            <>
              <div className="keys" style={{ color: "var(--ink)", fontSize: 13 }}>
                {getIdentity().commitment.toString().replace(/(\d{6})(?=\d)/g, "$1 ")}
              </div>
              <p className="small muted">
                This is your public commitment — the only thing the group ever sees. Each action proves you're <em>a</em> member,
                without saying which, and actions on different places can't be linked.
              </p>
            </>
          ) : (
            <p className="small muted">An identity is created the first time you report, vote or post.</p>
          )}
        </div>

        <section className="section">
          <header>
            <span className="idx">01</span>
            <h2>Invite code</h2>
            <p>From a residents' association or citizen group.</p>
          </header>
          <div style={{ display: "grid", gap: 14, maxWidth: 560 }}>
            <p className="muted">
              Partners hand out one-time codes in person. With one, your reports and votes count as a verified resident. The partner
              can't link the code to anything you do afterwards.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input className="input" style={{ flex: 1, minWidth: 180 }} value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Invite code" aria-label="Invite code" />
              <button className="btn solid" disabled={!invite.trim()} onClick={doJoin}>
                Join as verified
              </button>
            </div>
            {msg && <p className={`callout ${msg.ok ? "green" : "signal"}`}>{msg.text}</p>}
          </div>
        </section>

        <section className="section">
          <header>
            <span className="idx">02</span>
            <h2>On this device</h2>
            <p>Kept here, never on a server.</p>
          </header>
          <div style={{ display: "grid", gap: 16 }}>
            {mine.length ? (
              <ol className="log">
                {mine.slice(0, 12).map((r, i) => (
                  <li key={i}>
                    <time>{formatDay(r.day)}</time>
                    <span className="mark" />
                    <span>
                      {r.kind === "seen" ? "Said “seen it too”" : r.kind[0].toUpperCase() + r.kind.slice(1)} on{" "}
                      <a href={`#/asset/${r.asset}`}>{r.asset}</a>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">Nothing yet.</p>
            )}
          </div>
        </section>

        <section className="section">
          <header>
            <span className="idx">03</span>
            <h2>Keep or destroy</h2>
            <p>Anyone holding this identity can link your past actions.</p>
          </header>
          <div style={{ display: "grid", gap: 14, maxWidth: 560 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {exists && (
                <button className="btn" onClick={download}>
                  Download a backup
                </button>
              )}
              <label className="btn">
                Restore a backup
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      importBackup(await f.text())
                      setMsg({ ok: true, text: "Identity restored." })
                      refresh()
                    } catch {
                      setMsg({ ok: false, text: "That isn't a Jawabdehi backup." })
                    }
                  }}
                />
              </label>
              {exists && (
                <button
                  className="btn"
                  style={{ borderColor: "var(--signal)", color: "var(--signal)" }}
                  onClick={() => {
                    if (confirm("Wipe this identity and its receipts from this device? Without a backup it can't be recovered.")) {
                      wipe()
                      refresh()
                    }
                  }}
                >
                  Wipe from this device
                </button>
              )}
            </div>
            <p className="small faint" style={{ display: "flex", gap: 8 }}>
              <Icon name="shield" size={15} /> If your phone might be taken, wipe it. A fresh identity can't be linked to the old one.
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
