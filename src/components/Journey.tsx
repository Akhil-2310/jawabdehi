"use client"

import { Icon, Spinner } from "./ui"

export type StepState = "done" | "now" | "next"

/** What happens to a report, from the moment it's sent. */
export const JOURNEY = [
  {
    title: "Checked and queued",
    text: "The relayer verifies your anonymous proof and holds the report. It keeps no logs.",
  },
  {
    title: "Published to Arkiv",
    text: "In the next batch — shuffled with everyone else's, dated by day only. Nobody can edit it after that.",
  },
  {
    title: "Counted on the place",
    text: "It shows on the place's page. Others who've seen it add “I've seen this too”.",
  },
  {
    title: "The authority is told",
    text: "A Jawabdehi notifier files the complaint with BMC, citing the contract. The repair deadline starts.",
  },
  {
    title: "Deadline missed? Act",
    text: "Residents vote to escalate, invoke the warranty, file an RTI or take it to the press.",
  },
]

export function Journey({ states, notes }: { states?: StepState[]; notes?: (React.ReactNode | null)[] }) {
  return (
    <ol className="journey">
      {JOURNEY.map((s, i) => {
        const state = states?.[i] ?? "next"
        return (
          <li key={s.title} className={states ? state : ""}>
            <span className="journey-mark" aria-hidden>
              {state === "done" ? <Icon name="check" size={14} /> : state === "now" ? <Spinner /> : i + 1}
            </span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
              {notes?.[i] && <p className="journey-note">{notes[i]}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
