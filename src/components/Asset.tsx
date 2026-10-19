"use client"

import { useState } from "react"
import {
  ACTION_VOTES_NEEDED,
  ACTIONS,
  type ActionType,
  ASSET_KINDS,
  COUNT_DISPLAY_MIN,
  ESCALATION_LEVELS,
  PROBLEMS,
  RESPONSE_STATUSES,
  WARDS,
} from "../../shared/config"
import { grievance } from "../../shared/grievance"
import { type AssetView, actionsOpen, type NoticeView, type Status } from "../../shared/model"
import { checkText } from "../../shared/pii"
import { formatDay, today } from "../../shared/util"
import { useWard } from "@/lib/api"
import { type Stage, submitPost } from "@/lib/identity"
import { photoUrl } from "@/lib/photo"
import { ConeIcon } from "./Art"
import { SignalButton, stageLabel } from "./Signal"
import { describe, Icon, Loading, shown, Spinner, Tag, WarrantyTag } from "./ui"

export const wardOf = (assetId: string) => assetId.split("-")[0]

export function AssetPage({ id }: { id: string }) {
  const { data, error, refresh } = useWard(wardOf(id))
  if (!data) return <Loading error={error} />
  const v = data.views.find((x) => x.id === id)
  if (!v)
    return (
      <div className="page" style={{ padding: "64px 20px" }}>
        <p className="callout signal">There's no place with the ID {id}.</p>
      </div>
    )

  const s = v.status
  const sections: { title: string; note?: string; body: React.ReactNode }[] = []
  if (actionsOpen(s))
    sections.push({
      title: "What happens next",
      note: `The deadline passed. Each action needs ${ACTION_VOTES_NEEDED} votes; a partner carries it out and it's added to this record.`,
      body: <Ballots v={v} notice={s.notice} onDone={refresh} />,
    })
  if (s.stage === "claimed" || s.stage === "fixed" || s.stage === "disputed")
    sections.push({ title: "Is it really fixed?", note: "One answer per person, proven anonymously.", body: <RepairCheck v={v} status={s} onDone={refresh} /> })
  sections.push({ title: "Who's responsible", note: "Every fact links to its source.", body: <Responsible v={v} /> })
  sections.push({ title: "The terms", note: "What the contract says about repairs.", body: <Terms v={v} /> })
  sections.push({ title: "What residents report", note: "This month. Each person counts once.", body: <Reports v={v} /> })
  if (v.notices.length || v.reports.length) sections.push({ title: "Duty clock", note: "Everything that happened, in order.", body: <History v={v} /> })
  if (v.reports.length)
    sections.push({
      title: "The complaint",
      note: "Cites the contract and the count of reports. Filed by a Jawabdehi notifier, so your number never reaches BMC.",
      body: <Letter v={v} />,
    })
  sections.push({ title: "Discussion", note: "Text only. Up to three posts per person per day.", body: <Discussion v={v} onDone={refresh} /> })
  sections.push({ title: "Check this record", note: "Don't trust us. Your browser verified all of this.", body: <Integrity v={v} total={data.recordCount} mode={data.config.mode} /> })

  return (
    <>
      <div className="asphalt case-band">
      <div className="page">
        <nav className="crumbs eyebrow" aria-label="Breadcrumb">
          <a href="#/">
            <Icon name="back" size={13} /> Ledger
          </a>
          <span>/</span>
          <span>{WARDS.find((w) => w.id === v.ward)?.name}</span>
          <span>/</span>
          <span>{ASSET_KINDS[v.asset.kind]}</span>
          <span>/</span>
          <span>{v.id}</span>
        </nav>
        <h1 className="display case-title">{v.asset.name}</h1>
        <p className="case-sub">
          {v.asset.stretch} · {v.asset.area}
        </p>
        <Verdict v={v} onDone={refresh} />
      </div>
      <div className="hazard-tape" />
      </div>

      <div className="page">
        {sections.map((sec, i) => (
          <section className="section" key={sec.title}>
            <header>
              <span className="idx">{String(i + 1).padStart(2, "0")}</span>
              <h2>{sec.title}</h2>
              {sec.note && <p>{sec.note}</p>}
            </header>
            <div>{sec.body}</div>
          </section>
        ))}
      </div>
    </>
  )
}

// ---------- Verdict band ----------

function Verdict({ v, onDone }: { v: AssetView; onDone: () => void }) {
  const d = describe(v.status)
  const s = v.status
  const notice = "notice" in s ? s.notice : null
  return (
    <div className={`verdict tone-${d.tone}`}>
      {d.figure ? (
        <div className="verdict-fig">
          <span className="num">{d.figure}</span>
          <span className="verdict-unit">{d.unit}</span>
        </div>
      ) : (
        <div className="verdict-fig" aria-hidden>
          <StatusGlyph tone={d.tone} />
        </div>
      )}
      <div className="verdict-text">
        <h2>{d.headline}</h2>
        <p className="muted">{d.detail}</p>
        {notice && (
          <p className="faint small">
            With: {ESCALATION_LEVELS[notice.data.level] ?? "escalated"} · {notice.data.slaDays}-day limit
            {notice.data.slaSource === "contract" ? ", from the contract" : ", Jawabdehi default"}
          </p>
        )}
      </div>
      <div className="verdict-actions">
        <a className="btn solid" href={`#/report/${v.id}`}>
          <Icon name="camera" /> Report a problem
        </a>
        <SignalButton
          className="btn"
          label="I've seen this too"
          content={{ kind: "seen", asset: v.id, ward: v.ward, day: today() }}
          disabled={!v.reports.length}
          onDone={onDone}
        />
      </div>
      {notice && <Track notice={notice} />}
    </div>
  )
}

function StatusGlyph({ tone }: { tone: string }) {
  const color = tone === "green" ? "var(--green)" : tone === "blue" ? "var(--blue)" : tone === "ochre" ? "var(--ochre)" : "var(--ink-3)"
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="48" cy="48" r="44" />
      {tone === "green" ? <path d="m30 49 12 12 25-26" strokeWidth="2" /> : <path d="M48 24v26l14 10" strokeWidth="2" />}
    </svg>
  )
}

function Track({ notice }: { notice: NoticeView }) {
  const elapsed = Math.max(0, today() - notice.day)
  const sla = notice.data.slaDays
  const total = Math.min(Math.max(sla, elapsed), 45)
  const todayAt = Math.min(elapsed, total)
  return (
    <div className="track" aria-label={`Day ${elapsed} of a ${sla}-day limit`}>
      <div className="road">
        {Array.from({ length: total }, (_, i) => {
          const day = i + 1
          const cls = day > elapsed ? "" : day > sla ? "late" : "done"
          return <i key={i} className={`${cls} ${day === elapsed ? "today" : ""}`} />
        })}
        {todayAt > 0 && (
          <span className="cone" style={{ left: `calc(10px + (100% - 20px) * ${(todayAt - 0.5) / total})` }}>
            <ConeIcon size={26} />
          </span>
        )}
      </div>
      <div className="track-legend">
        <span>Notified {formatDay(notice.day)}</span>
        {sla < total && (
          <span className="due-mid" style={{ position: "absolute", left: `${(sla / total) * 100}%` }}>
            Due {formatDay(notice.deadline)}
          </span>
        )}
        <span>
          {sla >= total ? `Due ${formatDay(notice.deadline)} · ` : ""}Today · day {elapsed}
        </span>
      </div>
    </div>
  )
}

// ---------- Responsibility & terms ----------

function Responsible({ v }: { v: AssetView }) {
  const r = v.responsibility?.data
  if (!r) return <p className="muted">Nobody has recorded who is responsible yet.</p>
  const row = (label: string, value: React.ReactNode) => (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="board">
        <div className="board-head">
          <span>Details of work</span>
          <span>{v.id}</span>
        </div>
        <div className="board-title">{v.asset.name}</div>
        <dl>
          {row("Agency", r.agency)}
          {row("Office", r.wardOffice)}
          {row("Officer", r.officer)}
          {row("Contractor", r.contractor ?? "Unknown — help us find the tender")}
          {r.tender && row("Tender / work order", <span className="mono">{r.tender}</span>)}
          {r.cost && row("Sanctioned cost", r.cost)}
          {r.completed && row("Completed", r.completed)}
          {r.otherAgencies.length > 0 && row("Others working here", r.otherAgencies.join("; "))}
        </dl>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        {r.sources.map((s) => (
          <a key={s.url} className="small" href={s.url} target="_blank" rel="noreferrer noopener" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {s.label} <Icon name="external" size={13} />
          </a>
        ))}
        {r.sample && <Tag tone="ochre">Sample data — not a real contract</Tag>}
      </div>
    </div>
  )
}

function Terms({ v }: { v: AssetView }) {
  const r = v.responsibility?.data
  const w = v.warranty
  return (
    <div>
      <p className="terms-lead">
        {w.state === "active" ? (
          <>
            Under warranty until {formatDay(w.endDay!)}. <em>The contractor pays for this repair</em>, not the taxpayer.
          </>
        ) : w.state === "ended" ? (
          <>The warranty ended {formatDay(w.endDay!)}. Repairs are now paid by {r?.agency ?? "the agency"}.</>
        ) : (
          <>No contract on file, so {r?.agency ?? "the agency"} is responsible by default.</>
        )}
      </p>
      <dl className="facts">
        <dt>Status</dt>
        <dd>
          <WarrantyTag v={v} />
        </dd>
        {r?.surface && (
          <>
            <dt>Surface</dt>
            <dd>{r.surface}</dd>
          </>
        )}
        {r?.dlpYears && (
          <>
            <dt>Defect liability</dt>
            <dd>{r.dlpYears} years</dd>
          </>
        )}
        {r?.repairClause && (
          <>
            <dt>Repair time</dt>
            <dd>{r.repairClause}</dd>
          </>
        )}
        {r?.penaltyClause && (
          <>
            <dt>Penalty</dt>
            <dd>{r.penaltyClause}</dd>
          </>
        )}
        {r?.lastAudit && (
          <>
            <dt>Last structural audit</dt>
            <dd>{r.lastAudit}</dd>
          </>
        )}
      </dl>
    </div>
  )
}

// ---------- Reports ----------

function Reports({ v }: { v: AssetView }) {
  const [showPhotos, setShowPhotos] = useState(false)
  if (!v.reports.length)
    return (
      <div style={{ display: "grid", gap: 16, justifyItems: "start" }}>
        <p className="muted">No reports this month.</p>
        <a className="btn" href={`#/report/${v.id}`}>
          <Icon name="camera" /> Be the first to report
        </a>
      </div>
    )
  const problems = [...new Set(v.reports.map((r) => r.content.problem))]
  const worst = Math.max(...v.reports.map((r) => r.content.severity))
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div className="counts">
        <div className="count">
          <span className="num">{shown(v.people.total)}</span>
          <span>residents</span>
        </div>
        {v.people.total >= COUNT_DISPLAY_MIN && (
          <div className="count">
            <span className="num">{v.people.byGroup.verified}</span>
            <span>verified residents</span>
          </div>
        )}
        <div className="count">
          <span className="num">
            {worst}
            <span className="faint" style={{ fontSize: 22 }}>/5</span>
          </span>
          <span>worst severity</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {problems.map((p) => (
          <Tag key={p} tone="signal">
            {PROBLEMS[p].label}
          </Tag>
        ))}
      </div>
      {v.reports
        .filter((r) => r.content.note)
        .map((r) => (
          <blockquote key={r.rec.key} className="quote">
            “{r.content.note}”
            <footer>
              {r.group === "verified" ? "Verified resident" : "Citizen"} · {formatDay(r.content.day)}
            </footer>
          </blockquote>
        ))}
      {showPhotos ? (
        <div className="photos">
          {v.reports.map((r) => (
            <a key={r.rec.key} href={photoUrl(r.content.photo)} target="_blank" rel="noreferrer">
              <img src={photoUrl(r.content.photo)} alt={`Reported ${PROBLEMS[r.content.problem].label.toLowerCase()}`} loading="lazy" />
            </a>
          ))}
        </div>
      ) : (
        <div className="photo-gate">
          <span className="small muted">
            {v.reports.length} photo{v.reports.length === 1 ? "" : "s"}, cleaned of location data. Loaded only when you ask.
          </span>
          <button className="btn sm" onClick={() => setShowPhotos(true)}>
            Show photos
          </button>
        </div>
      )}
      <p className="faint tiny">
        Counts below {COUNT_DISPLAY_MIN} aren't shown exactly, so nobody in a quiet lane can be singled out.
      </p>
    </div>
  )
}

// ---------- Ballots ----------

function Ballots({ v, notice, onDone }: { v: AssetView; notice: NoticeView; onDone: () => void }) {
  return (
    <div className="ballots">
      {(Object.keys(ACTIONS) as ActionType[]).map((a) => {
        const s = v.votes[a]
        const n = s.count.total
        return (
          <div key={a} className={`ballot ${s.passed ? "passed" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
              <h3>{ACTIONS[a].label}</h3>
              {s.taken ? <Tag tone="green">Done</Tag> : s.passed ? <Tag tone="signal">Passed</Tag> : null}
            </div>
            <p className="small muted">{ACTIONS[a].detail}</p>
            <div className="ballot-foot">
              <span className="pips" aria-label={`${n} of ${ACTION_VOTES_NEEDED} votes`}>
                {Array.from({ length: ACTION_VOTES_NEEDED }, (_, i) => (
                  <i key={i} className={i < n ? "on" : ""} />
                ))}
                {n > ACTION_VOTES_NEEDED && <span className="more">+{n - ACTION_VOTES_NEEDED}</span>}
              </span>
              {!s.taken && (
                <SignalButton
                  className="btn sm"
                  label={s.passed ? "Add your vote" : "Vote"}
                  content={{ kind: "vote", asset: v.id, ward: v.ward, day: today(), notice: notice.rec.key, action: a }}
                  onDone={onDone}
                />
              )}
            </div>
            {s.passed && !s.taken && <p className="tiny faint">Passed — waiting for a partner to carry it out.</p>}
            {s.taken && (
              <p className="tiny muted">
                {s.taken.data.note}{" "}
                {s.taken.data.sourceUrl && (
                  <a href={s.taken.data.sourceUrl} target="_blank" rel="noreferrer noopener">
                    Source
                  </a>
                )}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Repair check ----------

function RepairCheck({
  v,
  status,
  onDone,
}: {
  v: AssetView
  status: Extract<Status, { stage: "claimed" | "fixed" | "disputed" }>
  onDone: () => void
}) {
  const base = { kind: "check" as const, asset: v.id, ward: v.ward, day: today(), response: status.response.rec.key }
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <p className="verify-q">
        {v.responsibility?.data.agency ?? "The authority"} says this was repaired on {formatDay(status.response.day)}. Was it?
      </p>
      {status.response.data.note && <p className="callout">“{status.response.data.note}”</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <SignalButton className="btn" label="Yes, it's fixed" content={{ ...base, fixed: true }} onDone={onDone} />
        <SignalButton className="btn" label="No, it isn't" content={{ ...base, fixed: false }} onDone={onDone} />
      </div>
      <div className="tally">
        <div>
          <span className="num" style={{ color: "var(--green)" }}>{shown(status.checks.fixed)}</span>
          <span className="small faint">say it's fixed</span>
        </div>
        <div>
          <span className="num" style={{ color: "var(--signal)" }}>{shown(status.checks.notFixed)}</span>
          <span className="small faint">say it isn't</span>
        </div>
      </div>
    </div>
  )
}

// ---------- Duty clock ----------

function History({ v }: { v: AssetView }) {
  type Item = { day: number; order: number; mark: string; title: string; detail?: string }
  const items: Item[] = []
  const first = v.reports.reduce<number | null>((m, r) => (m === null || r.content.day < m ? r.content.day : m), null)
  if (first !== null) items.push({ day: first, order: 0, mark: "", title: "First report this month" })
  for (const n of v.notices) {
    items.push({
      day: n.day,
      order: 1,
      mark: "ink",
      title: `Notified · ${ESCALATION_LEVELS[n.data.level] ?? "escalated"}`,
      detail: `${n.data.channel}, complaint ${n.data.complaint}. Due ${formatDay(n.deadline)}.`,
    })
    if (n.deadline < today()) items.push({ day: n.deadline, order: 2, mark: "signal", title: "Deadline passed" })
  }
  const s = v.status
  if ("response" in s)
    items.push({
      day: s.response.day,
      order: 3,
      mark: s.response.data.status === "repaired" ? "green" : "",
      title: `Response · ${RESPONSE_STATUSES[s.response.data.status]}`,
      detail: s.response.data.note,
    })
  for (const [a, x] of Object.entries(v.votes)) {
    if (x.passed && !x.taken) items.push({ day: today(), order: 4, mark: "signal", title: `Residents voted: ${ACTIONS[a as ActionType].label.toLowerCase()}` })
    if (x.taken)
      items.push({ day: Number(x.taken.rec.attrs.day), order: 5, mark: "ink", title: `Action taken · ${ACTIONS[a as ActionType].label}`, detail: x.taken.data.note })
  }
  items.sort((a, b) => a.day - b.day || a.order - b.order)
  return (
    <ol className="log">
      {items.map((i, k) => (
        <li key={k}>
          <time>{formatDay(i.day)}</time>
          <span className={`mark ${i.mark}`} />
          <div>
            <strong>{i.title}</strong>
            {i.detail && <div className="small muted">{i.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

// ---------- The complaint ----------

function Letter({ v }: { v: AssetView }) {
  const [lang, setLang] = useState<"en" | "mr">("en")
  const [copied, setCopied] = useState(false)
  const level = v.notices.length ? Math.min(v.notices.at(-1)!.data.level + (actionsOpen(v.status) ? 1 : 0), ESCALATION_LEVELS.length - 1) : 0
  const text = grievance(v, level)[lang]
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div className="seg" role="tablist" aria-label="Language">
          <button role="tab" aria-selected={lang === "en"} onClick={() => setLang("en")}>
            English
          </button>
          <button role="tab" aria-selected={lang === "mr"} onClick={() => setLang("mr")}>
            मराठी
          </button>
        </div>
        <button
          className="btn sm quiet"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "Copied" : "Copy text"}
        </button>
      </div>
      <pre className="letter" lang={lang}>
        {text}
      </pre>
      <p className="tiny faint">Filing it yourself through MyBMC links the complaint to your phone number.</p>
    </div>
  )
}

// ---------- Discussion ----------

function Discussion({ v, onDone }: { v: AssetView; onDone: () => void }) {
  const [text, setText] = useState("")
  const [stage, setStage] = useState<Stage | "done" | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const pii = checkText(text)
  const busy = stage !== null && stage !== "done"

  const send = async () => {
    setErr(null)
    try {
      const res = await submitPost({ kind: "post", asset: v.id, ward: v.ward, day: today(), text: text.trim() }, setStage)
      setStage("done")
      setText("")
      setTimeout(onDone, Math.max(0, res.nextBatchAt - Date.now()) + 1500)
    } catch (e) {
      setStage(null)
      setErr((e as Error).message)
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {v.posts.length > 0 ? (
        <div className="thread">
          {v.posts.map((p) => (
            <article key={p.rec.key} className="post">
              <p>{p.content.text}</p>
              <span className="post-meta">
                {p.group === "verified" ? "Verified resident" : "Citizen"} · {formatDay(p.content.day)}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No posts yet.</p>
      )}
      <div className="field">
        <span className="label">Add to the discussion</span>
        <textarea
          className="input"
          placeholder="Describe the problem, not people."
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {pii.blocked.length > 0 && <p className="callout signal">Remove {pii.blocked.join(", ")} before posting.</p>}
      {pii.warnings.map((w) => (
        <p key={w} className="callout ochre">
          {w}.
        </p>
      ))}
      {err && <p className="callout signal">{err}</p>}
      {stage === "done" && <p className="callout green">Posted anonymously. It appears after the relayer's next batch.</p>}
      <div>
        <button className="btn" disabled={text.trim().length < 2 || pii.blocked.length > 0 || busy} onClick={send}>
          {busy ? (
            <>
              <Spinner /> {stageLabel[stage as Stage]}…
            </>
          ) : (
            "Post anonymously"
          )}
        </button>
      </div>
    </div>
  )
}

// ---------- Integrity ----------

function Integrity({ v, total, mode }: { v: AssetView; total: number; mode: string }) {
  const signals = v.reports.length + v.seen.length + v.posts.length + Object.values(v.votes).reduce((n, x) => n + x.count.total, 0)
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="seal">
        <span className="seal-mark">
          <Icon name="check" size={20} />
        </span>
        <div className="prose small muted">
          <p>
            <strong style={{ color: "var(--ink)" }}>{signals} anonymous actions verified</strong>
            {v.rejected.length > 0 && <span style={{ color: "var(--signal)" }}> · {v.rejected.length} rejected</span>}
          </p>
          <p>
            Your browser downloaded all {total} records for this ward from {mode === "arkiv" ? "the Arkiv testnet" : "the local demo store"} and
            checked each one. Contract facts count only if the curator's wallet wrote them. Each anonymous action counts only if its
            zero-knowledge proof shows a distinct member sent it, unaltered.
          </p>
        </div>
      </div>
      {v.rejected.map((r) => (
        <p key={r.rec.key} className="callout signal small">
          Rejected <span className="mono">{r.rec.key.slice(0, 10)}…</span> — {r.reason}
        </p>
      ))}
      <details>
        <summary className="small" style={{ cursor: "pointer" }}>
          Record keys
        </summary>
        <div className="keys" style={{ marginTop: 10 }}>
          asset {v.rec.key}
          {v.responsibility && (
            <>
              <br />
              responsibility {v.responsibility.rec.key}
            </>
          )}
          {v.notices.map((n) => (
            <span key={n.rec.key}>
              <br />
              notice {n.rec.key}
            </span>
          ))}
        </div>
      </details>
    </div>
  )
}
