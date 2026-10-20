"use client"

import { useMemo, useState } from "react"
import { ASSET_KINDS, PROBLEMS, WARDS } from "../../shared/config"
import { formatDay } from "../../shared/util"
import type { AssetView } from "../../shared/model"
import { matches } from "../../shared/search"
import { useWard } from "@/lib/api"
import { BridgeArt, FootpathArt, GarbageArt, HeroScene, PotholeArt, SignNumber } from "./Art"
import { Journey } from "./Journey"
import { describe, Icon, Loading, shown, Tag, WarrantyTag } from "./ui"

const WARD_KEY = "jd.ward"

const isLate = (v: AssetView) =>
  v.status.stage === "overdue" || v.status.stage === "disputed" || (v.status.stage === "responded" && v.status.daysOver > 0)

const FILTERS = [
  { id: "all", label: "Everything", tone: "none", test: () => true },
  { id: "late", label: "Past deadline", tone: "late", test: isLate },
  { id: "clock", label: "Clock running", tone: "clock", test: (v: AssetView) => v.status.stage === "clock" || (v.status.stage === "responded" && v.status.daysOver <= 0) },
  { id: "reported", label: "Reported", tone: "info", test: (v: AssetView) => v.status.stage === "reported" },
  { id: "warranty", label: "Under warranty", tone: "ok", test: (v: AssetView) => v.warranty.state === "active" },
] as const

type FilterId = (typeof FILTERS)[number]["id"]
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
  const [filter, setFilter] = useState<FilterId>("all")
  const list = useMemo(
    () => sorted.filter((v) => matches(v, q) && FILTERS.find((f) => f.id === filter)!.test(v)),
    [sorted, q, filter],
  )
  const latest = useMemo(
    () =>
      views
        .flatMap((v) => v.reports)
        .sort((a, b) => b.content.day - a.content.day || b.rec.createdAt - a.rec.createdAt)
        .slice(0, 5),
    [views],
  )
  const nameOf = (id: string) => views.find((v) => v.id === id)?.asset.name ?? id
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
            <p className="eyebrow">Live from the public record</p>
            <h2 className="display block-title">What's broken in {wardInfo.name}</h2>
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

        <div className="ledger-tools">
          <div className="chips" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f.id} className={`chip chip-${f.tone}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} <span className="chip-n num">{views.filter(f.test).length}</span>
              </button>
            ))}
          </div>
          <input
            className="input"
            type="search"
            placeholder="Find your road, area or contractor"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search the ledger"
          />
        </div>

        {!data ? (
          <Loading error={error} />
        ) : list.length ? (
          <div className="cases">
            {list.map((v) => (
              <CaseCard key={v.id} v={v} />
            ))}
          </div>
        ) : (
          <p className="muted" style={{ padding: "24px 0" }}>
            Nothing in {wardInfo.name} matches{q ? ` “${q}”` : " this filter"}. <a href="#/report">Search every ward, or suggest the place</a>.
          </p>
        )}
        <p className="faint tiny" style={{ marginTop: 14 }}>
          Your device downloaded the whole ward and checked every record itself — nobody can tell which road you looked at.
        </p>
      </section>

      {/* ---------- Where reports go ---------- */}
      <section className="page block">
        <div className="block-head">
          <p className="eyebrow">Where your report goes</p>
          <h2 className="display block-title">Sent once. On the record for good.</h2>
        </div>
        <div className="flow">
          <div className="feed">
            <h3 className="feed-title">Latest reports in {wardInfo.name}</h3>
            {latest.length ? (
              latest.map((r) => (
                <a key={r.rec.key} className="feed-item" href={`#/asset/${r.content.asset}`}>
                  <span className="feed-top">
                    <Tag tone={r.content.severity >= 4 ? "signal" : "none"}>{PROBLEMS[r.content.problem].label}</Tag>
                    <span className="sev" aria-label={`Severity ${r.content.severity} of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <i key={n} className={n <= r.content.severity ? "on" : ""} />
                      ))}
                    </span>
                  </span>
                  <strong>{nameOf(r.content.asset)}</strong>
                  {r.content.note && <span className="feed-note">“{r.content.note}”</span>}
                  <span className="feed-meta">
                    {r.group === "verified" ? "Verified resident" : "Citizen"} · {formatDay(r.content.day)} · proof checked
                  </span>
                </a>
              ))
            ) : (
              <p className="muted small">No reports in this ward yet. <a href="#/report">Be the first.</a></p>
            )}
          </div>
          <div className="flow-steps asphalt">
            <h3 className="feed-title">What happens next</h3>
            <Journey />
          </div>
        </div>
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

const STAGE_WORD: Record<string, string> = {
  quiet: "No reports",
  reported: "Reported",
  clock: "Clock running",
  overdue: "Past deadline",
  claimed: "Repair claimed",
  fixed: "Fixed",
  disputed: "Not really fixed",
}

function CaseCard({ v }: { v: AssetView }) {
  const d = describe(v.status)
  const r = v.responsibility?.data
  const last = [...v.reports.map((x) => x.content.day), ...v.notices.map((n) => n.day)].sort((a, b) => b - a)[0]
  return (
    <a className={`case tone-${d.tone}`} href={`#/asset/${v.id}`}>
      <div className="case-band">
        <span className="case-label">{STAGE_WORD[v.status.stage] ?? d.label}</span>
        {d.figure && (
          <span className="case-fig">
            <span className="num">{d.figure}</span> {d.unit.includes("left") ? "days left" : "days late"}
          </span>
        )}
      </div>
      <div className="case-body">
        <span className="case-kind">{ASSET_KINDS[v.asset.kind]}</span>
        <span className="case-name">{v.asset.name}</span>
        <span className="case-where">
          {v.asset.stretch} · {v.asset.area}
        </span>
        <dl className="case-facts">
          <dt>Contractor</dt>
          <dd>{r?.contractor ?? "Unknown"}</dd>
          <dt>Warranty</dt>
          <dd>
            <WarrantyTag v={v} />
          </dd>
          <dt>Residents</dt>
          <dd>{v.people.total ? shown(v.people.total) : "None yet"}</dd>
        </dl>
      </div>
      <div className="case-foot">
        <span className="faint tiny">{last ? `Last activity ${formatDay(last)}` : "No activity this month"}</span>
        <span className="case-open">
          Open case <Icon name="arrow" size={14} />
        </span>
      </div>
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
