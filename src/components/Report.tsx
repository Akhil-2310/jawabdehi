"use client"

import { useEffect, useRef, useState } from "react"
import { PROBLEMS, type ProblemType } from "../../shared/config"
import { checkText } from "../../shared/pii"
import { today } from "../../shared/util"
import { useWard } from "@/lib/api"
import { type Stage, submit } from "@/lib/identity"
import { loadToCanvas, pixelate, uploadCanvas } from "@/lib/photo"
import { wardOf } from "./Asset"
import { Icon, Loading, Spinner } from "./ui"

type Step = "uploading" | Stage
const STEPS: { id: Step; label: string }[] = [
  { id: "uploading", label: "Upload the cleaned photo" },
  { id: "joining", label: "Join anonymously (first time only)" },
  { id: "proving", label: "Make a zero-knowledge proof" },
  { id: "sending", label: "Hand it to the relayer" },
]
const SEVERITY = ["Minor", "Noticeable", "Bad", "Serious", "Dangerous"]

export function ReportPage({ id }: { id: string }) {
  const { data, error } = useWard(wardOf(id))
  const v = data?.views.find((x) => x.id === id)
  const problems = v ? (Object.keys(PROBLEMS) as ProblemType[]).filter((p) => (PROBLEMS[p].kinds as readonly string[]).includes(v.asset.kind)) : []

  const [problem, setProblem] = useState<ProblemType | null>(null)
  const [severity, setSeverity] = useState(3)
  const [note, setNote] = useState("")
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [blurs, setBlurs] = useState(0)
  const [loadingPhoto, setLoadingPhoto] = useState(false)
  const [step, setStep] = useState<Step | null>(null)
  const [passed, setPassed] = useState<Step[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const holder = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (problems.length && !problem) setProblem(problems[0])
  }, [problems.length, problem, problems])

  useEffect(() => {
    holder.current?.replaceChildren(...(canvas ? [canvas] : []))
  }, [canvas])

  if (!data) return <Loading error={error} />
  if (!v)
    return (
      <div className="page" style={{ padding: "64px 20px" }}>
        <p className="callout signal">There's no place with the ID {id}.</p>
      </div>
    )

  const pii = checkText(note)
  const ready = problem && canvas && !pii.blocked.length && !step

  const pick = async (file?: File) => {
    if (!file) return
    setErr(null)
    setLoadingPhoto(true)
    try {
      const c = await loadToCanvas(file)
      c.onclick = (e) => {
        const r = c.getBoundingClientRect()
        pixelate(c, ((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height)
        setBlurs((n) => n + 1)
      }
      setCanvas(c)
      setBlurs(0)
    } catch {
      setErr("Couldn't read that photo. Try a JPEG or PNG.")
    } finally {
      setLoadingPhoto(false)
    }
  }

  const advance = (s: Step) => {
    setStep((prev) => {
      if (prev) setPassed((p) => [...p, prev])
      return s
    })
  }

  const send = async () => {
    if (!problem || !canvas) return
    setErr(null)
    setPassed([])
    try {
      advance("uploading")
      const photo = await uploadCanvas(canvas)
      await submit({ kind: "report", asset: v.id, ward: v.ward, day: today(), problem, severity, note: note.trim(), photo }, advance)
      setDone(true)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setStep(null)
    }
  }

  if (done)
    return (
      <div className="page page-head" style={{ paddingBottom: 40 }}>
        <span className="done-mark">
          <Icon name="check" size={30} />
        </span>
        <h1 className="display page-title">Reported.</h1>
        <p className="lede">
          Your report is in the relayer's queue. It goes onto the public record in the next batch, shuffled in with everyone
          else's and dated by day only, so it can't be matched to when you were here.
        </p>
        <p className="muted">
          It carries a proof that a real member sent it, but not which one. Nothing links it to you or to anything else you do
          here.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          <a className="btn solid" href={`#/asset/${v.id}`}>
            Back to {v.asset.name} <Icon name="arrow" />
          </a>
          <a className="btn" href="#/">
            The ledger
          </a>
        </div>
      </div>
    )

  return (
    <>
      <div className="page page-head">
        <nav className="crumbs eyebrow" style={{ paddingTop: 0 }}>
          <a href={`#/asset/${v.id}`}>
            <Icon name="back" size={13} /> {v.asset.name}
          </a>
        </nav>
        <h1 className="display page-title">Report a problem</h1>
        <p className="lede">
          {v.asset.name}, {v.asset.stretch}. No name, number or login — the report is attached to this place, not to you.
        </p>
      </div>

      <div className="page form-page">
        <div className="form-steps">
          <div className="step">
            <div className="step-head">
              <span className="n">i.</span>
              <h2>A photo</h2>
            </div>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            {canvas ? (
              <div className="editor">
                <div ref={holder} />
                <div className="editor-bar">
                  <span>
                    <strong>Tap faces, number plates or signs to blur them.</strong>
                    {blurs > 0 && <span className="faint"> {blurs} blurred.</span>}
                  </span>
                  <button className="linkbtn small" onClick={() => fileInput.current?.click()}>
                    Use a different photo
                  </button>
                </div>
              </div>
            ) : (
              <button className="drop" onClick={() => fileInput.current?.click()} disabled={loadingPhoto}>
                <span style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                  {loadingPhoto ? <Spinner /> : <Icon name="camera" size={28} />}
                  <span className="big">{loadingPhoto ? "Cleaning the photo…" : "Add a photo of the damage"}</span>
                  <span className="small faint">Location, phone model and time are removed on your device before upload.</span>
                </span>
              </button>
            )}
          </div>

          <div className="step">
            <div className="step-head">
              <span className="n">ii.</span>
              <h2>What's wrong?</h2>
            </div>
            <div className="options">
              {problems.map((p) => (
                <button key={p} className="option" aria-pressed={problem === p} onClick={() => setProblem(p)}>
                  <strong>{PROBLEMS[p].label}</strong>
                  <span className="tiny faint">Usual repair limit: {PROBLEMS[p].slaDays} days</span>
                </button>
              ))}
            </div>
          </div>

          <div className="step">
            <div className="step-head">
              <span className="n">iii.</span>
              <h2>How bad is it?</h2>
            </div>
            <div className="scale" role="group" aria-label="Severity">
              {SEVERITY.map((w, i) => (
                <button key={w} aria-pressed={severity === i + 1} onClick={() => setSeverity(i + 1)}>
                  <span className="n">{i + 1}</span>
                  <span className="w">{w}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="step">
            <div className="step-head">
              <span className="n">iv.</span>
              <h2>
                A short note <span className="faint" style={{ fontSize: 18 }}>(optional)</span>
              </h2>
            </div>
            <textarea
              className="input"
              value={note}
              maxLength={280}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Deep pothole in the left lane, fills with water when it rains."
            />
            <div className="faint tiny" style={{ textAlign: "right" }}>
              {note.length}/280
            </div>
            {pii.blocked.length > 0 && <p className="callout signal">Remove {pii.blocked.join(", ")} from the note.</p>}
            {pii.warnings.map((w) => (
              <p key={w} className="callout ochre">
                {w}.
              </p>
            ))}
          </div>

          {err && <p className="callout signal">{err}</p>}
          <button className="btn signal block" style={{ minHeight: 54, fontSize: 16 }} disabled={!ready} onClick={send}>
            {step ? (
              <>
                <Spinner /> Sending anonymously…
              </>
            ) : canvas ? (
              "Report anonymously"
            ) : (
              "Add a photo to continue"
            )}
          </button>
        </div>

        <aside className="aside">
          {step || passed.length ? (
            <div className="aside-box">
              <h3>Sending</h3>
              <ol className="progress">
                {STEPS.map((s) => {
                  const state = passed.includes(s.id) ? "done" : step === s.id ? "now" : ""
                  return (
                    <li key={s.id} className={state}>
                      <span className="box">{state === "done" ? <Icon name="check" size={14} /> : state === "now" ? <Spinner /> : "·"}</span>
                      {s.label}
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : null}
          <div className="aside-box">
            <h3>What stays private</h3>
            <p>Your name, number and location are never asked for. Photo metadata is stripped twice: here, then again by the relayer.</p>
            <p>Reports are published in shuffled daily batches, dated by day only.</p>
          </div>
          <div className="aside-box">
            <h3>What you control</h3>
            <p>
              Jawabdehi protects <em>how</em> you report, not <em>what</em> you say. Avoid details only you would know, like
              “outside my shop”.
            </p>
            <p>Stay safe near traffic. If anyone is in danger, call 112 first.</p>
          </div>
        </aside>
      </div>
    </>
  )
}
