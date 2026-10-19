"use client"

import { useState } from "react"
import type { SignalContent } from "../../shared/records"
import { type Stage, submit } from "@/lib/identity"
import { Icon, Spinner } from "./ui"

export const stageLabel: Record<Stage, string> = {
  joining: "Joining anonymously",
  proving: "Making your proof",
  sending: "Sending",
}

/** A button that proves membership and sends one anonymous signal (seen, vote, check). */
export function SignalButton({
  label,
  content,
  onDone,
  disabled,
  className = "btn",
}: {
  label: string
  content: SignalContent
  onDone: () => void
  disabled?: boolean
  className?: string
}) {
  const [stage, setStage] = useState<Stage | null>(null)
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null)

  const go = async () => {
    setState(null)
    try {
      const res = await submit(content, setStage)
      setState({ ok: true, text: "Counted" })
      setTimeout(onDone, Math.max(0, res.nextBatchAt - Date.now()) + 1500)
    } catch (e) {
      setState({ ok: false, text: (e as Error).message })
    } finally {
      setStage(null)
    }
  }

  return (
    <span style={{ display: "inline-grid", gap: 6 }}>
      <button className={className} onClick={go} disabled={disabled || stage !== null || state?.ok}>
        {stage ? (
          <>
            <Spinner /> {stageLabel[stage]}…
          </>
        ) : state?.ok ? (
          <>
            <Icon name="check" /> {state.text}
          </>
        ) : (
          label
        )}
      </button>
      {state && !state.ok && <span className="tiny" style={{ color: "var(--signal)" }}>{state.text}</span>}
      {state?.ok && <span className="tiny faint">Shows after the next batch</span>}
    </span>
  )
}
