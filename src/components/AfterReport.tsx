"use client"

import { useEffect, useState } from "react"
import { ESCALATION_LEVELS, PROBLEMS, type ProblemType } from "../../shared/config"
import { type AssetView, actionsOpen } from "../../shared/model"
import type { Rec } from "../../shared/records"
import { formatDay } from "../../shared/util"
import { getJson } from "@/lib/api"
import { Journey, type StepState } from "./Journey"
import { Icon } from "./ui"

export type Receipt = { nextBatchAt: number; nullifier: string; problem: ProblemType; severity: number; note: string }

/**
 * Shown right after a report is sent: follows it through the relayer's batch onto Arkiv and says
 * honestly what happens next for this place. The browser recognises its own record by the proof's
 * nullifier, which it already knows — nothing extra is sent to the server.
 */
export function AfterReport({ v, receipt }: { v: AssetView; receipt: Receipt }) {
  const [now, setNow] = useState(Date.now())
  const [record, setRecord] = useState<Rec | null>(null)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (record) return
    let live = true
    const look = async () => {
      try {
        const recs = await getJson<Rec[]>(`/api/ward/${v.ward}`)
        const mine = recs.find((r) => String(r.attrs.nullifier).toLowerCase() === receipt.nullifier)
        if (live && mine) setRecord(mine)
      } catch {
        /* try again on the next poll */
      }
    }
    const poll = setInterval(look, 4000)
    look()
    return () => {
      live = false
      clearInterval(poll)
    }
  }, [record, v.ward, receipt.nullifier])

  const secs = Math.max(0, Math.round((receipt.nextBatchAt - now) / 1000))
  const notice = v.notices.at(-1)
  const late = actionsOpen(v.status)

  const states: StepState[] = [
    "done",
    record ? "done" : "now",
    record ? "done" : "next",
    notice ? "done" : record ? "now" : "next",
    late ? "now" : "next",
  ]
  const notes = [
    "Your proof checked out.",
    record ? (
      <>
        On Arkiv as record <span className="mono">{record.key.slice(0, 12)}…</span> — read-only.
      </>
    ) : secs > 0 ? (
      `Next batch in about ${secs} second${secs === 1 ? "" : "s"}.`
    ) : (
      "Writing the batch now…"
    ),
    record ? (
      <>
        Now counted on <a href={`#/asset/${v.id}`}>{v.asset.name}</a>.
      </>
    ) : null,
    notice
      ? `Already notified on ${formatDay(notice.day)} (${ESCALATION_LEVELS[notice.data.level]}). Repair due ${formatDay(notice.deadline)}.`
      : record
        ? "Waiting for a curator to file it with BMC."
        : null,
    late ? (
      <>
        The deadline has already passed. <a href={`#/asset/${v.id}`}>Vote on what happens next.</a>
      </>
    ) : null,
  ]

  return (
    <>
      <div className="asphalt page-band">
        <div className="page page-head">
          <span className="done-mark">
            <Icon name="check" size={30} />
          </span>
          <h1 className="display page-title">
            Reported. <em>It's on its way.</em>
          </h1>
          <p className="lede" style={{ color: "#cfccc3" }}>
            Follow it below. It carries a proof that a real member sent it — not which one — so nothing links it to you.
          </p>
        </div>
        <div className="hazard-tape" />
      </div>

      <div className="page block" style={{ paddingTop: 40 }}>
        <div className="flow">
          <div className="flow-steps asphalt">
            <h3 className="feed-title">Your report, live</h3>
            <Journey states={states} notes={notes} />
          </div>
          <div style={{ display: "grid", gap: 18 }}>
            <div className="feed" style={{ paddingTop: 14 }}>
              <h3 className="feed-title">What you sent</h3>
              <div className="feed-item" style={{ borderBottom: 0 }}>
                <strong>{v.asset.name}</strong>
                <span className="feed-note">
                  {PROBLEMS[receipt.problem].label} · severity {receipt.severity}/5
                </span>
                {receipt.note && <span className="feed-note">“{receipt.note}”</span>}
                <span className="feed-meta">Photo cleaned of location data · dated by day only</span>
              </div>
            </div>
            <p className="callout">
              A receipt is kept on this device only, under <a href="#/me">You</a>. If someone could take your phone, you can wipe it
              there.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="btn solid" href={`#/asset/${v.id}`}>
                Open {v.asset.name} <Icon name="arrow" />
              </a>
              <a className="btn" href="#/report">
                Report something else
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
