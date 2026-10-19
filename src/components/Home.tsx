"use client"

import { useMemo, useState } from "react"
import { ASSET_KINDS, WARDS } from "../../shared/config"
import type { AssetView } from "../../shared/model"
import { useWard } from "@/lib/api"
import { BridgeArt, FootpathArt, GarbageArt, HeroScene, PotholeArt, SignNumber } from "./Art"
import { describe, Icon, Loading, StatusTag, Tag, WarrantyTag } from "./ui"

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
      {/* ---------- Hero ---------- */}
      <section className="hero asphalt">
        <div className="page hero-grid">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">Mumbai · roads · footpaths · bridges</p>
            <h1 className="display hero-title">
              Potholes don't fix themselves. <em>Somebody was paid to.</em>
            </h1>
            <p className="hero-lede">
              Snap the pothole, the broken footpath, the cracked bridge. See the contractor, the tender and the warranty — then
              give them a deadline the whole city can watch. No name, no number, no login.
            </p>
            <div className="hero-cta">
              <a className="btn solid" href="#/report">
                Report a problem <Icon name="arrow" />
              </a>
              <a className="btn" href="#/privacy">
                <Icon name="shield" /> Why it's anonymous
              </a>
            </div>
          </div>
          <div className="hero-art">
            <HeroScene />
            <SiteBoard v={sorted[0]} />
          </div>
        </div>
      </section>

      <Ticker views={sorted} />

      {/* ---------- The numbers ---------- */}
      <section className="page stats">
        <Stat n="59,000+" label="potholes reported in Mumbai in 2023" source="BMC data via Newslaundry" />
        <Stat n="44%" label="of Mumbai's road deaths in 2023 were pedestrians" source="Free Press Journal" />
        <Stat n="₹6 lakh" label="compensation per pothole death, ordered by the Bombay High Court" source="Moneylife, Oct 2025" />
        <Stat n="0" label="reporters Jawabdehi can identify — by design" source="No accounts, no numbers, no logs" tone="ok" />
      </section>

      {/* ---------- What you can report ---------- */}
      <section className="page block">
        <div className="block-head">
          <p className="eyebrow">What you can report</p>
          <h2 className="display block-title">If it's broken and public, it's on record.</h2>
        </div>
        <div className="kinds">
          <Kind art={<PotholeArt />} title="Potholes & road damage" text="Craters, sunken patches, surfaces that broke up after one monsoon." />
          <Kind art={<FootpathArt />} title="Broken footpaths" text="Missing paver blocks, open trenches, footpaths you can't walk on." />
          <Kind art={<BridgeArt />} title="Bridges & foot overbridges" text="Cracks, exposed rusting steel, missing railings." />
          <Kind art={<GarbageArt />} title="Garbage & dumping spots" text="Uncollected bins and recurring dumping spots — places, never people." soon />
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="page block">
        <div className="block-head">
          <p className="eyebrow">How it works</p>
          <h2 className="display block-title">Report once. The clock does the rest.</h2>
        </div>
        <ol className="how">
          <li>
            <SignNumber n={1} />
            <strong>Report</strong>
            <span>A photo and a place. The report is tied to the road, never to you.</span>
          </li>
          <li>
            <SignNumber n={2} />
            <strong>See who</strong>
            <span>Agency, contractor, tender number and warranty — each with its source.</span>
          </li>
          <li>
            <SignNumber n={3} />
            <strong>Start the clock</strong>
            <span>Once the authority is told, the repair deadline is public.</span>
          </li>
          <li>
            <SignNumber n={4} />
            <strong>Act together</strong>
            <span>Deadline missed? Vote to escalate, invoke the warranty, file an RTI or call the press.</span>
          </li>
        </ol>
      </section>

      {/* ---------- The ledger ---------- */}
      <section className="page block" id="ledger">
        <div className="ledger-head">
          <div>
            <p className="eyebrow">The ledger</p>
            <h2 className="display block-title">{wardInfo.name}</h2>
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
          <Figure n={late.length} label="past their deadline" tone="late" />
          <Figure n={running.length} label="clock running" tone="clock" />
          <Figure n={warranty.length} label="under warranty" tone="ok" />
        </div>

        <div className="toolbar">
          <input
            className="input"
            type="search"
            placeholder="Find your road, area, contractor or ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search the ledger"
          />
          <p className="faint tiny">The whole ward is downloaded and checked on your device, so nobody can tell which road you looked up.</p>
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

      {/* ---------- Privacy band ---------- */}
      <section className="asphalt band">
        <div className="hazard-tape" />
        <div className="page band-grid">
          <div>
            <p className="eyebrow">Built for people who get threatened for asking</p>
            <h2 className="display block-title">Report it. Nobody can trace it back to you.</h2>
          </div>
          <ul className="band-points">
            <li>
              <strong>No account, ever.</strong> No phone number, OTP or email.
            </li>
            <li>
              <strong>Zero-knowledge proofs.</strong> Each report proves a real person sent it — not which one.
            </li>
            <li>
              <strong>Clean photos.</strong> Location and phone details stripped before upload. Tap to blur faces and plates.
            </li>
            <li>
              <a href="#/privacy">
                Everything we do, and its limits <Icon name="arrow" />
              </a>
            </li>
          </ul>
        </div>
      </section>
    </>
  )
}

function Stat({ n, label, source, tone }: { n: string; label: string; source: string; tone?: string }) {
  return (
    <div className={`stat ${tone ?? ""}`}>
      <span className="stat-n">{n}</span>
      <span className="stat-l">{label}</span>
      <span className="stat-s">{source}</span>
    </div>
  )
}

function Kind({ art, title, text, soon }: { art: React.ReactNode; title: string; text: string; soon?: boolean }) {
  return (
    <article className="kind">
      <div className="kind-art">
        {art}
        {soon && <span className="kind-soon">Coming next</span>}
      </div>
      <h3>{title}</h3>
      <p className="small muted">{text}</p>
    </article>
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

function Ticker({ views }: { views: AssetView[] }) {
  const items = views
    .filter((v) => v.status.stage !== "quiet")
    .map((v) => {
      const d = describe(v.status)
      return `${v.asset.name} — ${d.figure ? `${d.figure} ${d.unit}` : d.label}`
    })
  if (!items.length) return <div className="hazard-tape" />
  const run = [...items, ...items]
  return (
    <div className="ticker" aria-label="Latest from the ledger">
      <div className="ticker-track">
        {run.map((t, i) => (
          <span key={i} className="ticker-item" aria-hidden={i >= items.length}>
            <span className="ticker-mark">▲</span> {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function Row({ v }: { v: AssetView }) {
  const d = describe(v.status)
  const r = v.responsibility?.data
  return (
    <a className={`ledger-row tone-${d.tone}`} href={`#/asset/${v.id}`} role="listitem">
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
        {d.figure && <span className="lr-fig num">{d.figure}</span>}
        <StatusTag status={v.status} />
      </span>
    </a>
  )
}

/** The kind of board every Mumbai work site has to put up — filled with what the contract says. */
function SiteBoard({ v }: { v?: AssetView }) {
  if (!v) return null
  const d = describe(v.status)
  const r = v.responsibility?.data
  return (
    <a className="site-board" href={`#/asset/${v.id}`}>
      <div className="sb-head">
        <span>Work details</span>
        <span className="mono">{v.id}</span>
      </div>
      <div className="sb-name">{v.asset.name}</div>
      <dl className="sb-facts">
        <dt>Contractor</dt>
        <dd>{r?.contractor ?? "Unknown"}</dd>
        <dt>Tender</dt>
        <dd className="mono">{r?.tender ?? "—"}</dd>
        <dt>Warranty</dt>
        <dd>{v.warranty.state === "active" ? `Until ${new Date(v.warranty.endDay! * 864e5).getUTCFullYear()} — contractor pays` : v.warranty.state === "ended" ? "Ended" : "Unknown"}</dd>
      </dl>
      <div className={`sb-status tone-${d.tone}`}>
        {d.figure ? (
          <>
            <span className="sb-fig">{d.figure}</span> {d.unit}
          </>
        ) : (
          d.label
        )}
        <Tag tone="ochre">Open case</Tag>
      </div>
    </a>
  )
}
