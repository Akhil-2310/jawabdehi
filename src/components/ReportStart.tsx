"use client"

import { useMemo, useState } from "react"
import { ASSET_KINDS, type AssetKind, WARDS } from "../../shared/config"
import type { AssetView } from "../../shared/model"
import { matches } from "../../shared/search"
import { checkText } from "../../shared/pii"
import { postJson, useAllWards } from "@/lib/api"
import { SignNumber } from "./Art"
import { Icon, Loading, Spinner, StatusTag, WarrantyTag } from "./ui"

type KindFilter = AssetKind | "all"

/** Step one of reporting: find the place. Reports attach to a public place, never to you. */
export function ReportStart() {
  const { views, error } = useAllWards()
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<KindFilter>("all")
  const [ward, setWard] = useState<string>("all")

  const results = useMemo(() => {
    return (views ?? [])
      .filter((v) => kind === "all" || v.asset.kind === kind)
      .filter((v) => ward === "all" || v.ward === ward)
      .filter((v) => matches(v, q))
      .sort((a, b) => a.asset.name.localeCompare(b.asset.name))
  }, [views, q, kind, ward])

  return (
    <>
      <div className="asphalt page-band">
        <div className="page page-head">
          <p className="eyebrow">Report a problem</p>
          <h1 className="display page-title">
            Where is it <em>broken?</em>
          </h1>
          <ol className="report-steps">
            <li className="now">
              <SignNumber n={1} /> Find the place
            </li>
            <li>
              <SignNumber n={2} /> Add a photo
            </li>
            <li>
              <SignNumber n={3} /> Send anonymously
            </li>
          </ol>
          <input
            className="input big-search"
            type="search"
            autoFocus
            placeholder="Road, junction, bridge or area — e.g. LBS Marg"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search for the place"
          />
          <p className="tiny" style={{ color: "#b4b1a9" }}>
            Search happens on your device. We never see what you typed or which place you picked.
          </p>
        </div>
        <div className="hazard-tape" />
      </div>

      <div className="page" style={{ paddingTop: 28 }}>
        <div className="filters">
          <div className="seg" role="group" aria-label="Kind of place">
            {(["all", ...Object.keys(ASSET_KINDS)] as KindFilter[]).map((k) => (
              <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {k === "all" ? "Everything" : k === "bridge" ? "Bridges" : `${ASSET_KINDS[k]}s`}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Ward">
            <button aria-pressed={ward === "all"} onClick={() => setWard("all")}>
              All wards
            </button>
            {WARDS.map((w) => (
              <button key={w.id} aria-pressed={ward === w.id} onClick={() => setWard(w.id)}>
                {w.name}
              </button>
            ))}
          </div>
        </div>

        {!views ? (
          <Loading error={error} />
        ) : (
          <div className="pick-list" role="list">
            {results.map((v) => (
              <PickRow key={v.id} v={v} />
            ))}
            {!results.length && (
              <p className="muted" style={{ padding: "20px 0" }}>
                No place matches{q ? ` “${q}”` : ""}. Suggest it below.
              </p>
            )}
          </div>
        )}

        <Suggest initialName={q} />
      </div>
    </>
  )
}

function PickRow({ v }: { v: AssetView }) {
  return (
    <a className="pick-row" href={`#/report/${v.id}`} role="listitem">
      <span className="pick-main">
        <span className="lr-name">{v.asset.name}</span>
        <span className="lr-sub">
          {ASSET_KINDS[v.asset.kind]} · {v.asset.stretch} · {v.asset.area}
        </span>
      </span>
      <span className="pick-tags">
        <StatusTag status={v.status} />
        <WarrantyTag v={v} />
      </span>
      <span className="pick-go">
        Report here <Icon name="arrow" />
      </span>
    </a>
  )
}

function Suggest({ initialName }: { initialName: string }) {
  const [open, setOpen] = useState(false)
  const [ward, setWard] = useState<string>(WARDS[0].id)
  const [kind, setKind] = useState<AssetKind>("road")
  const [name, setName] = useState("")
  const [stretch, setStretch] = useState("")
  const [area, setArea] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const pii = checkText(`${name} ${stretch} ${area}`)
  const ready = name.trim().length >= 3 && stretch.trim().length >= 3 && !pii.blocked.length && !busy

  const send = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await postJson("/api/suggest", { ward, kind, name: name.trim(), stretch: stretch.trim(), area: area.trim() })
      setMsg({ ok: true, text: "Sent to the curators. Once they check it and add it, it appears in the ledger and you can report it." })
      setName("")
      setStretch("")
      setArea("")
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="suggest">
      <div className="suggest-head">
        <div>
          <h2 className="display" style={{ fontSize: 34 }}>
            Can't find it?
          </h2>
          <p className="muted small">Suggest the place. A curator checks it and adds it to the ledger — then anyone can report it.</p>
        </div>
        {!open && (
          <button
            className="btn"
            onClick={() => {
              setOpen(true)
              if (initialName && !name) setName(initialName)
            }}
          >
            Suggest a place
          </button>
        )}
      </div>

      {open && (
        <div className="suggest-form">
          <div className="admin-grid">
            <label className="field">
              <span className="label">Ward</span>
              <select className="input" value={ward} onChange={(e) => setWard(e.target.value)}>
                {WARDS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.area}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span className="label">What is it?</span>
              <div className="seg">
                {(Object.keys(ASSET_KINDS) as AssetKind[]).map((k) => (
                  <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
                    {k === "bridge" ? "Bridge" : ASSET_KINDS[k]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="field">
            <span className="label">Name of the road, footpath or bridge</span>
            <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tembipada Road" />
          </label>
          <label className="field">
            <span className="label">Which stretch? Between which junctions or landmarks</span>
            <input className="input" value={stretch} maxLength={120} onChange={(e) => setStretch(e.target.value)} placeholder="e.g. Bhandup station to Tembipada junction" />
          </label>
          <label className="field">
            <span className="label">Area (optional)</span>
            <input className="input" value={area} maxLength={60} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Bhandup West" />
          </label>
          {pii.blocked.length > 0 && <p className="callout signal">Remove {pii.blocked.join(", ")}.</p>}
          <p className="callout">
            Describe a public place, not your home or shop. Suggestions go only to the curators — they aren't published as you wrote
            them, and nothing links them to you.
          </p>
          {msg && <p className={`callout ${msg.ok ? "green" : "signal"}`}>{msg.text}</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn solid" disabled={!ready} onClick={send}>
              {busy ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : (
                "Send to curators"
              )}
            </button>
            <button className="btn quiet" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
