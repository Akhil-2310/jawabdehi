"use client"

import { useMemo, useState } from "react"
import { ASSET_KINDS, WARDS } from "../../shared/config"
import type { AssetView } from "../../shared/model"
import { useWard } from "@/lib/api"
import { describe, Icon, Loading, StatusTag, WarrantyTag } from "./ui"

const WARD_KEY = "jd.ward"
const urgency: Record<string, number> = { overdue: 0, disputed: 1, responded: 2, clock: 3, claimed: 4, reported: 5, fixed: 6, quiet: 7 }

function savedWard() {
  try {
    return localStorage.getItem(WARD_KEY) ?? "S"
  } catch {
    return "S"
  }
}

export function Home() {
  const [ward, setWard] = useState(savedWard)
  const [q, setQ] = useState("")
  const { data, error } = useWard(ward)

  const pick = (id: string) => {
    setWard(id)
    try {
      localStorage.setItem(WARD_KEY, id)
    } catch {}
  }

  const views = data?.views ?? []
  const sorted = useMemo(
    () => [...views].sort((a, b) => urgency[a.status.stage] - urgency[b.status.stage] || a.asset.name.localeCompare(b.asset.name)),
    [views],
  )
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return sorted
    return sorted.filter((v) =>
      [v.asset.name, v.asset.stretch, v.asset.area, v.responsibility?.data.contractor, v.responsibility?.data.agency, v.id]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    )
  }, [sorted, q])

  const late = views.filter((v) => ["overdue", "disputed"].includes(v.status.stage) || (v.status.stage === "responded" && v.status.daysOver > 0))
  const running = views.filter((v) => v.status.stage === "clock")
  const warranty = views.filter((v) => v.warranty.state === "active")
  const wardInfo = WARDS.find((w) => w.id === ward)!

  return (
    <>
      <section className="page hero">
        <div className="hero-copy">
          <p className="eyebrow">Mumbai · roads, footpaths &amp; bridges</p>
          <h1 className="display hero-title">
            Every broken road has a contractor. <em>Now it has a deadline.</em>
          </h1>
          <p className="hero-lede">
            Report a pothole, a broken footpath or a damaged bridge without a name, number or login. See who was paid to build it,
            whether it's still under warranty, and what happens when they ignore it.
          </p>
          <div className="hero-cta">
            <a
              className="btn solid"
              href="#/"
              onClick={(e) => {
                // Routes live in the hash, so scroll instead of jumping to an anchor.
                e.preventDefault()
                document.getElementById("ledger")?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Find your road <Icon name="arrow" />
            </a>
            <a className="btn quiet" href="#/privacy">
              <Icon name="shield" /> How you stay anonymous
            </a>
          </div>
        </div>
        <NoticeCard v={sorted[0]} />
      </section>

      <section className="page">
        <ol className="how">
          <li>
            <span className="how-n">i.</span>
            <strong>Report</strong>
            <span>A photo and a place. Your report is tied to the road, never to you.</span>
          </li>
          <li>
            <span className="how-n">ii.</span>
            <strong>See who</strong>
            <span>Agency, contractor, tender and warranty, each with a source.</span>
          </li>
          <li>
            <span className="how-n">iii.</span>
            <strong>Start the clock</strong>
            <span>Once the authority is told, the repair deadline is public.</span>
          </li>
          <li>
            <span className="how-n">iv.</span>
            <strong>Act together</strong>
            <span>Deadline missed? Residents vote to escalate, invoke the warranty, file an RTI or go to the press.</span>
          </li>
        </ol>
      </section>

      <section className="page" id="ledger">
        <div className="ledger-head">
          <div>
            <p className="eyebrow">The ledger</p>
            <h2 className="display ledger-title">{wardInfo.name}</h2>
            <p className="faint small">{wardInfo.area}</p>
          </div>
          <div className="seg" role="tablist" aria-label="Ward">
            {WARDS.map((w) => (
              <button key={w.id} role="tab" aria-selected={ward === w.id} onClick={() => pick(w.id)}>
                {w.name}
              </button>
            ))}
          </div>
        </div>

        <div className="figures">
          <Figure n={views.length} label="places on record" />
          <Figure n={late.length} label="past their deadline" tone="signal" />
          <Figure n={running.length} label="with the clock running" tone="ochre" />
          <Figure n={warranty.length} label="still under warranty" tone="green" />
        </div>

        <div className="toolbar">
          <input
            className="input"
            type="search"
            placeholder="Search a road, area, contractor or ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search the ledger"
          />
          <p className="faint tiny">
            The whole ward is downloaded and checked on your device, so nobody can tell which road you looked up.
          </p>
        </div>

        {!data ? (
          <Loading error={error} />
        ) : (
          <div className="ledger" role="list">
            <div className="ledger-row ledger-cols" aria-hidden>
              <span>Place</span>
              <span>Responsible</span>
              <span>Warranty</span>
              <span>Status</span>
            </div>
            {list.map((v) => (
              <Row key={v.id} v={v} />
            ))}
            {!list.length && <p className="muted" style={{ padding: "24px 0" }}>Nothing matches “{q}”.</p>}
          </div>
        )}
      </section>
    </>
  )
}

function Figure({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div className={`figure ${tone ?? ""}`}>
      <span className="figure-n num">{n}</span>
      <span className="figure-l">{label}</span>
    </div>
  )
}

function Row({ v }: { v: AssetView }) {
  const d = describe(v.status)
  const r = v.responsibility?.data
  return (
    <a className="ledger-row" href={`#/asset/${v.id}`} role="listitem">
      <span className="lr-place">
        <span className="lr-name">{v.asset.name}</span>
        <span className="lr-sub">
          {ASSET_KINDS[v.asset.kind]} · {v.asset.stretch}
        </span>
      </span>
      <span className="lr-resp">
        <span>{r?.contractor ?? <span className="faint">Contractor unknown</span>}</span>
        <span className="lr-sub">{r?.agency}</span>
      </span>
      <span className="lr-warranty">
        <WarrantyTag v={v} />
      </span>
      <span className="lr-status">
        {d.figure && <span className={`lr-fig num tone-${d.tone}`}>{d.figure}</span>}
        <StatusTag status={v.status} />
      </span>
    </a>
  )
}

function NoticeCard({ v }: { v?: AssetView }) {
  if (!v) return <div className="notice-card notice-empty" aria-hidden />
  const d = describe(v.status)
  const r = v.responsibility?.data
  return (
    <a className={`notice-card tone-${d.tone}`} href={`#/asset/${v.id}`}>
      <div className="nc-top">
        <span className="eyebrow">Public notice</span>
        <span className="eyebrow">{v.id}</span>
      </div>
      <div className="nc-body">
        {d.figure ? (
          <div className="nc-fig">
            <span className="num">{d.figure}</span>
            <span className="nc-unit">{d.unit}</span>
          </div>
        ) : (
          <div className="nc-headline">{d.headline}</div>
        )}
        <div className="nc-name">{v.asset.name}</div>
        <div className="nc-sub">{v.asset.stretch}</div>
      </div>
      <dl className="nc-facts">
        <dt>Contractor</dt>
        <dd>{r?.contractor ?? "Unknown"}</dd>
        <dt>Tender</dt>
        <dd className="mono">{r?.tender ?? "—"}</dd>
        <dt>Residents</dt>
        <dd>{v.people.total >= 3 ? v.people.total : "Fewer than 3"}</dd>
      </dl>
      <span className="nc-open">
        Open the case <Icon name="arrow" />
      </span>
    </a>
  )
}
