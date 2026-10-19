"use client"

// Curator console: file notices, record the authority's responses, and record actions taken.
// Everything here is written from the curator wallet, so readers can check who wrote it.
import { useCallback, useEffect, useState } from "react"
import { ACTIONS, type ActionType, ASSET_KINDS, type AssetKind, ESCALATION_LEVELS, RESPONSE_STATUSES, type ResponseStatus, WARDS } from "../../shared/config"
import { grievance } from "../../shared/grievance"
import { type AssetView, actionsOpen } from "../../shared/model"
import { dayToISO, formatDay, today } from "../../shared/util"
import { getJson, postJson, useWard } from "@/lib/api"
import { Loading, StatusTag } from "./ui"

const TOKEN_KEY = "jd.admin"

function savedToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ""
  } catch {
    return ""
  }
}

export function AdminPage() {
  const [token, setToken] = useState(savedToken)
  const [ward, setWard] = useState("S")
  const { data, error, refresh } = useWard(ward)
  const [open, setOpen] = useState<string | null>(null)

  const save = (t: string) => {
    setToken(t)
    try {
      sessionStorage.setItem(TOKEN_KEY, t)
    } catch {}
  }

  const todo = (data?.views ?? []).flatMap((v) => {
    const items: string[] = []
    if (v.status.stage === "reported") items.push("file a notice")
    if (actionsOpen(v.status))
      for (const [a, s] of Object.entries(v.votes)) if (s.passed && !s.taken) items.push(ACTIONS[a as ActionType].label.toLowerCase())
    return items.length ? [{ v, items }] : []
  })

  return (
    <>
      <div className="asphalt page-band">
        <div className="page page-head">
          <p className="eyebrow">Curators</p>
          <h1 className="display page-title">Curator console</h1>
          <p className="lede">Records written here come from the curator wallet. They can't be edited afterwards, only superseded.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input className="input" type="password" placeholder="Admin token (from .env)" value={token} onChange={(e) => save(e.target.value)} style={{ maxWidth: 320 }} aria-label="Admin token" />
            <div className="seg" role="tablist" aria-label="Ward">
              {WARDS.map((w) => (
                <button key={w.id} role="tab" aria-selected={ward === w.id} onClick={() => setWard(w.id)}>
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="hazard-tape" />
      </div>

      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="page">
          <Places token={token} onAdded={refresh} />
          {todo.length > 0 && (
            <section className="section">
              <header>
                <span className="idx">To do</span>
                <h2>Waiting on you</h2>
              </header>
              <ol className="log">
                {todo.map(({ v, items }) => (
                  <li key={v.id} style={{ gridTemplateColumns: "14px 1fr" }}>
                    <span className="mark signal" />
                    <span>
                      <button className="linkbtn" onClick={() => setOpen(v.id)}>
                        {v.asset.name}
                      </button>{" "}
                      — {items.join("; ")}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="section">
            <header>
              <span className="idx">All</span>
              <h2>Places</h2>
            </header>
            <div style={{ borderTop: "1px solid var(--rule)" }}>
              {data.views.map((v) => (
                <div key={v.id} className="admin-row">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ font: "400 22px/1.2 var(--serif)" }}>{v.asset.name}</div>
                      <div className="mono faint">{v.id}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <StatusTag status={v.status} />
                      <button className="btn sm" onClick={() => setOpen(open === v.id ? null : v.id)}>
                        {open === v.id ? "Close" : "Manage"}
                      </button>
                    </div>
                  </div>
                  {open === v.id && <Manage v={v} token={token} onDone={refresh} />}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function Manage({ v, token, onDone }: { v: AssetView; token: string; onDone: () => void }) {
  const current = v.notices.at(-1)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const call = async (path: string, body: unknown) => {
    setMsg(null)
    try {
      await postJson(path, body, { "x-admin-token": token })
      setMsg({ ok: true, text: "Written to the record." })
      onDone()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    }
  }

  const [level, setLevel] = useState(current ? Math.min(current.data.level + 1, ESCALATION_LEVELS.length - 1) : 0)
  const [channel, setChannel] = useState("MyBMC MARG")
  const [complaint, setComplaint] = useState("")
  const [filed, setFiled] = useState(dayToISO(today()))
  const [status, setStatus] = useState<ResponseStatus>("acknowledged")
  const [note, setNote] = useState("")
  const [url, setUrl] = useState("")
  const [respDay, setRespDay] = useState(dayToISO(today()))
  const [action, setAction] = useState<ActionType>("escalate")
  const [actionNote, setActionNote] = useState("")
  const [actionUrl, setActionUrl] = useState("")

  const field = (label: string, el: React.ReactNode) => (
    <label className="field">
      <span className="label">{label}</span>
      {el}
    </label>
  )

  return (
    <div style={{ display: "grid", gap: 4, marginTop: 18 }}>
      {msg && <p className={`callout ${msg.ok ? "green" : "signal"}`}>{msg.text}</p>}
      <details className="fold" open={!current}>
        <summary>{current ? "File an escalated notice" : "File a notice"}</summary>
        <div style={{ display: "grid", gap: 14, paddingBottom: 18 }}>
          <pre className="letter" style={{ fontSize: 15 }}>
            {grievance(v, level).en}
          </pre>
          <div className="admin-grid">
            {field(
              "Level",
              <select className="input" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                {ESCALATION_LEVELS.map((l, i) => (
                  <option key={l} value={i}>
                    {l}
                  </option>
                ))}
              </select>,
            )}
            {field("Channel", <input className="input" value={channel} onChange={(e) => setChannel(e.target.value)} />)}
            {field("Complaint number", <input className="input" value={complaint} onChange={(e) => setComplaint(e.target.value)} />)}
            {field("Filed on", <input className="input" type="date" value={filed} onChange={(e) => setFiled(e.target.value)} />)}
          </div>
          <div>
            <button
              className="btn solid"
              disabled={!complaint.trim()}
              onClick={() => call("/api/admin/notice", { asset: v.id, channel, complaint, level, filed, text: grievance(v, level).en })}
            >
              Write notice — starts the clock
            </button>
          </div>
        </div>
      </details>

      {current && (
        <details className="fold">
          <summary>Record the authority's response</summary>
          <div style={{ display: "grid", gap: 14, paddingBottom: 18 }}>
            <p className="small faint">
              To the notice filed {formatDay(current.day)} ({current.data.complaint}).
            </p>
            <div className="admin-grid">
              {field(
                "Status",
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ResponseStatus)}>
                  {Object.entries(RESPONSE_STATUSES).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>,
              )}
              {field("Date", <input className="input" type="date" value={respDay} onChange={(e) => setRespDay(e.target.value)} />)}
            </div>
            {field("What they said", <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />)}
            {field("Source link", <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />)}
            <div>
              <button className="btn" onClick={() => call("/api/admin/response", { asset: v.id, notice: current.rec.key, status, note, sourceUrl: url, day: respDay })}>
                Write response
              </button>
            </div>
          </div>
        </details>
      )}

      {current && (
        <details className="fold">
          <summary>Record an action taken</summary>
          <div style={{ display: "grid", gap: 14, paddingBottom: 18 }}>
            {field(
              "Action",
              <select className="input" value={action} onChange={(e) => setAction(e.target.value as ActionType)}>
                {(Object.keys(ACTIONS) as ActionType[]).map((a) => (
                  <option key={a} value={a}>
                    {ACTIONS[a].label} — {v.votes[a].count.total} votes{v.votes[a].passed ? " (passed)" : ""}
                  </option>
                ))}
              </select>,
            )}
            {field("What was done", <input className="input" value={actionNote} onChange={(e) => setActionNote(e.target.value)} />)}
            {field("Source link", <input className="input" type="url" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} />)}
            {action === "escalate" && <p className="small faint">Then file an escalated notice above to start the new deadline.</p>}
            <div>
              <button
                className="btn"
                disabled={!actionNote.trim()}
                onClick={() => call("/api/admin/action", { asset: v.id, notice: current.rec.key, action, note: actionNote, sourceUrl: actionUrl })}
              >
                Write action
              </button>
            </div>
          </div>
        </details>
      )}
    </div>
  )
}

// ---------- Places: suggestions from residents, and adding new places ----------

type Suggestion = { id: string; ward: string; kind: AssetKind; name: string; stretch: string; area: string; day: number }
type Draft = { ward: string; kind: AssetKind; name: string; stretch: string; area: string; agency: string; wardOffice: string; officer: string; suggestion?: string }

const blank = (ward = "S"): Draft => ({ ward, kind: "road", name: "", stretch: "", area: "", agency: "BMC", wardOffice: "", officer: "" })

function Places({ token, onAdded }: { token: string; onAdded: () => void }) {
  const [list, setList] = useState<Suggestion[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const headers = { "x-admin-token": token }

  const load = useCallback(() => {
    if (!token) return setList(null)
    getJson<Suggestion[]>("/api/admin/suggestions", { headers: { "x-admin-token": token } }).then(setList, () => setList(null))
  }, [token])
  useEffect(load, [load])

  const add = async () => {
    if (!draft) return
    setMsg(null)
    try {
      const { id } = await postJson<{ id: string }>("/api/admin/asset", draft, headers)
      setMsg({ ok: true, text: `Added ${draft.name} as ${id}. Residents can report it now.` })
      setDraft(null)
      load()
      onAdded()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    }
  }

  const dismiss = async (id: string) => {
    await postJson("/api/admin/suggestions/dismiss", { id }, headers).catch(() => {})
    load()
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => (d ? { ...d, [k]: e.target.value } : d))

  return (
    <section className="section">
      <header>
        <span className="idx">Places</span>
        <h2>Suggested by residents</h2>
        <p>Check each one, then add it to the ledger or dismiss it. Suggestions never go on Arkiv.</p>
      </header>
      <div style={{ display: "grid", gap: 16 }}>
        {!token ? (
          <p className="muted">Enter the admin token to see suggestions.</p>
        ) : list === null ? (
          <p className="muted">Couldn't load suggestions — check the token.</p>
        ) : list.length === 0 ? (
          <p className="muted">No suggestions waiting.</p>
        ) : (
          <ol className="log">
            {list.map((x) => (
              <li key={x.id} style={{ gridTemplateColumns: "120px 16px 1fr" }}>
                <time>{formatDay(x.day)}</time>
                <span className="mark ink" />
                <div style={{ display: "grid", gap: 8 }}>
                  <span>
                    <strong>{x.name}</strong> — {x.stretch}
                    {x.area && `, ${x.area}`} <span className="faint">({ASSET_KINDS[x.kind]}, {WARDS.find((w) => w.id === x.ward)?.name})</span>
                  </span>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn sm solid" onClick={() => setDraft({ ...blank(x.ward), kind: x.kind, name: x.name, stretch: x.stretch, area: x.area, suggestion: x.id })}>
                      Check & add
                    </button>
                    <button className="btn sm quiet" onClick={() => dismiss(x.id)}>
                      Dismiss
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}

        {msg && <p className={`callout ${msg.ok ? "green" : "signal"}`}>{msg.text}</p>}

        {draft ? (
          <div className="suggest" style={{ marginTop: 0 }}>
            <h3 className="display" style={{ fontSize: 26 }}>
              {draft.suggestion ? "Add the suggested place" : "Add a place"}
            </h3>
            <div className="admin-grid">
              <label className="field">
                <span className="label">Ward</span>
                <select className="input" value={draft.ward} onChange={set("ward")}>
                  {WARDS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Kind</span>
                <select className="input" value={draft.kind} onChange={set("kind")}>
                  {(Object.keys(ASSET_KINDS) as AssetKind[]).map((k) => (
                    <option key={k} value={k}>
                      {ASSET_KINDS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Name</span>
                <input className="input" value={draft.name} onChange={set("name")} />
              </label>
              <label className="field">
                <span className="label">Stretch</span>
                <input className="input" value={draft.stretch} onChange={set("stretch")} />
              </label>
              <label className="field">
                <span className="label">Area</span>
                <input className="input" value={draft.area} onChange={set("area")} />
              </label>
              <label className="field">
                <span className="label">Responsible agency</span>
                <input className="input" value={draft.agency} onChange={set("agency")} />
              </label>
              <label className="field">
                <span className="label">Ward office</span>
                <input className="input" value={draft.wardOffice} onChange={set("wardOffice")} placeholder="e.g. BMC S ward office, Bhandup" />
              </label>
              <label className="field">
                <span className="label">Officer (designation)</span>
                <input className="input" value={draft.officer} onChange={set("officer")} placeholder="e.g. Assistant Engineer (Roads)" />
              </label>
            </div>
            <p className="small faint">The contractor and warranty stay “unknown” until you find the tender and add them.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn solid" disabled={draft.name.trim().length < 3 || draft.stretch.trim().length < 3} onClick={add}>
                Add to the ledger
              </button>
              <button className="btn quiet" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          token && (
            <div>
              <button className="btn" onClick={() => setDraft(blank())}>
                Add a place yourself
              </button>
            </div>
          )
        )}
      </div>
    </section>
  )
}
