"use client"

import { useEffect, useState } from "react"
import { COUNT_DISPLAY_MIN } from "../../shared/config"
import type { AssetView, Status } from "../../shared/model"
import { formatDay } from "../../shared/util"

export function useHash() {
  const read = () => (typeof location === "undefined" ? "/" : location.hash.slice(1) || "/")
  const [hash, setHash] = useState(read)
  useEffect(() => {
    const on = () => {
      setHash(read())
      window.scrollTo({ top: 0 })
    }
    addEventListener("hashchange", on)
    return () => removeEventListener("hashchange", on)
  }, [])
  return hash
}

export type Tone = "signal" | "ochre" | "green" | "blue" | "none"

/** Everything the UI says about where an asset stands. */
export function describe(s: Status): {
  tone: Tone
  label: string
  figure: string | null
  unit: string
  headline: string
  detail: string
} {
  const days = (n: number) => `day${n === 1 ? "" : "s"}`
  switch (s.stage) {
    case "quiet":
      return { tone: "none", label: "No reports", figure: null, unit: "", headline: "Nothing reported this month", detail: "If something's broken here, be the first to report it." }
    case "reported":
      return {
        tone: "blue",
        label: "Reported",
        figure: null,
        unit: "",
        headline: "Reported. Waiting to be notified.",
        detail: "When the authority is formally told, the clock starts and they get a deadline.",
      }
    case "clock":
      return {
        tone: "ochre",
        label: s.daysLeft === 0 ? "Due today" : `${s.daysLeft}d left`,
        figure: String(s.daysLeft),
        unit: `${days(s.daysLeft)} left to repair`,
        headline: s.daysLeft === 0 ? "The repair is due today." : `The clock is running.`,
        detail: `Notified ${formatDay(s.notice.day)}. Due by ${formatDay(s.notice.deadline)}.`,
      }
    case "overdue":
      return {
        tone: "signal",
        label: `${s.daysOver}d overdue`,
        figure: String(s.daysOver),
        unit: `${days(s.daysOver)} past the deadline`,
        headline: "The deadline passed with no response.",
        detail: `Notified ${formatDay(s.notice.day)}. Due ${formatDay(s.notice.deadline)}. Residents can now vote on what happens next.`,
      }
    case "responded":
      return {
        tone: s.daysOver > 0 ? "signal" : "ochre",
        label: s.response.data.status === "disputed" ? "Disputed" : "Acknowledged",
        figure: s.daysOver > 0 ? String(s.daysOver) : String(Math.max(0, s.daysLeft)),
        unit: s.daysOver > 0 ? `${days(s.daysOver)} past the deadline` : `${days(s.daysLeft)} left to repair`,
        headline: s.response.data.status === "disputed" ? "The authority disputes the complaint." : "Acknowledged, but not repaired.",
        detail: `Notified ${formatDay(s.notice.day)}. Due ${formatDay(s.notice.deadline)}.`,
      }
    case "claimed":
      return {
        tone: "ochre",
        label: "Repair claimed",
        figure: null,
        unit: "",
        headline: "The authority says it's repaired.",
        detail: `Claimed ${formatDay(s.response.day)}. Residents who pass by can confirm or dispute it.`,
      }
    case "fixed":
      return {
        tone: "green",
        label: "Fixed",
        figure: null,
        unit: "",
        headline: "Repaired, and residents confirm it.",
        detail: `Claimed ${formatDay(s.response.day)}. ${s.checks.fixed} residents confirmed the repair.`,
      }
    case "disputed":
      return {
        tone: "signal",
        label: "Not really fixed",
        figure: s.daysOver > 0 ? String(s.daysOver) : null,
        unit: s.daysOver > 0 ? `${days(s.daysOver)} past the deadline` : "",
        headline: "Claimed repaired. Residents say it isn't.",
        detail: `The authority claimed a repair on ${formatDay(s.response.day)}; ${s.checks.notFixed} residents say otherwise.`,
      }
  }
}

export function Tag({ tone = "none", dot, children }: { tone?: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={`tag ${tone === "none" ? "" : tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}

export function StatusTag({ status }: { status: Status }) {
  const d = describe(status)
  return (
    <Tag tone={d.tone} dot>
      {d.label}
    </Tag>
  )
}

export function WarrantyTag({ v }: { v: AssetView }) {
  if (v.warranty.state === "active") return <Tag tone="green">Warranty to {new Date(v.warranty.endDay! * 864e5).getUTCFullYear()}</Tag>
  if (v.warranty.state === "ended") return <Tag>Warranty ended</Tag>
  return <Tag>No contract on file</Tag>
}

export const shown = (n: number) => (n >= COUNT_DISPLAY_MIN ? String(n) : `<${COUNT_DISPLAY_MIN}`)

export function Spinner() {
  return <span className="spin" aria-hidden />
}

export function Loading({ error }: { error?: string | null }) {
  return (
    <div className="page" style={{ padding: "64px 20px" }}>
      {error ? (
        <p className="callout signal">Couldn't load the ledger: {error}</p>
      ) : (
        <p className="muted small" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Spinner /> Downloading the ward and checking every record on your device…
        </p>
      )}
    </div>
  )
}

/** Small set of line icons, drawn to sit on the text baseline. */
export function Icon({ name, size = 16 }: { name: "arrow" | "back" | "camera" | "check" | "shield" | "copy" | "external"; size?: number }) {
  const p = {
    arrow: <path d="M3 8h10M9 4l4 4-4 4" />,
    back: <path d="M13 8H3M7 4 3 8l4 4" />,
    camera: (
      <>
        <path d="M2 5.5h2.5L6 3.5h4l1.5 2H14v7H2z" />
        <circle cx="8" cy="9" r="2.3" />
      </>
    ),
    check: <path d="m3 8.5 3 3 7-7" />,
    shield: <path d="M8 1.8 13 3.6v4c0 3.2-2.2 5.4-5 6.6-2.8-1.2-5-3.4-5-6.6v-4z" />,
    copy: (
      <>
        <rect x="5" y="5" width="8" height="8" rx="1" />
        <path d="M3 10.5V3h7.5" />
      </>
    ),
    external: <path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9" />,
  }[name]
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p}
    </svg>
  )
}
