// The Arkiv schema: what each record type looks like, and how anonymous signals are scoped.
import type { SemaphoreProof } from "@semaphore-protocol/core"
import {
  ACTIONS,
  type ActionType,
  type AssetKind,
  type GroupId,
  POST_SLOTS,
  PROBLEMS,
  type ProblemType,
  PROJECT,
  type RecordType,
  type ResponseStatus,
} from "./config"
import { fieldToHex, monthOf } from "./util"

export type AttrValue = string | number | boolean

/** A record as read back from Arkiv (or the local store), normalised to plain values. */
export type Rec = {
  key: string
  creator: string
  /** Block number on Arkiv; milliseconds in the local store. Only used for ordering. */
  createdAt: number
  expiresAt?: number
  attrs: Record<string, AttrValue>
  payload: unknown
}

/** A record to write. Every record is created read-only, and anyone may extend its life. */
export type NewRec = { attrs: Record<string, AttrValue>; payload: unknown; days: number }

/** Arkiv attribute types. Anything not listed is a `str`. */
export const ATTR_TYPES: Record<string, "u64" | "i32" | "bytes32" | "key" | "bool"> = {
  day: "u64",
  deadline: "u64",
  dlp_end: "u64",
  idx: "u64",
  severity: "i32",
  level: "i32",
  repair_days: "i32",
  nullifier: "bytes32",
  root: "bytes32",
  photo: "bytes32",
  commitment: "bytes32",
  notice: "key",
  response: "key",
  fixed: "bool",
}

// ---------- Curator records ----------

export type AssetPayload = {
  name: string
  kind: AssetKind
  stretch: string
  area: string
}

export type Source = { label: string; url: string }

export type ResponsibilityPayload = {
  agency: string
  wardOffice: string
  contractor: string | null
  tender: string | null
  cost: string | null
  completed: string | null
  surface: string | null
  dlpEnd: string | null
  dlpYears: number | null
  repairDays: number | null
  repairClause: string | null
  penaltyClause: string | null
  officer: string
  otherAgencies: string[]
  lastAudit: string | null
  sources: Source[]
  /** True for the demo seed: illustrative, not taken from a real tender. */
  sample: boolean
}

export type NoticePayload = {
  channel: string
  complaint: string
  level: number
  slaDays: number
  slaSource: "contract" | "default"
  text: string
}

export type ResponsePayload = { status: ResponseStatus; note: string; sourceUrl: string }

export type ActionPayload = { action: ActionType; note: string; sourceUrl: string }

// ---------- Anonymous signals (written by the relayer, each with a Semaphore proof) ----------

type SignalBase = { asset: string; ward: string; day: number }

export type SignalContent =
  | (SignalBase & { kind: "report"; problem: ProblemType; severity: number; note: string; photo: string })
  | (SignalBase & { kind: "seen" })
  | (SignalBase & { kind: "vote"; notice: string; action: ActionType })
  | (SignalBase & { kind: "check"; response: string; fixed: boolean })
  | (SignalBase & { kind: "post"; text: string; slot: number })

export type SignalKind = SignalContent["kind"]

export type SignalPayload = { content: SignalContent; proof: SemaphoreProof }

/**
 * The Semaphore scope for a signal. One person gets one nullifier per scope, so this is what
 * limits them to one report per asset per month, one vote per action, and so on. Different
 * scopes give unlinkable nullifiers, so nobody can tell the same person reported two roads.
 */
export function scopeOf(c: SignalContent): string {
  switch (c.kind) {
    // Reporting and "I've seen this too" share a scope: one or the other, once a month.
    case "report":
    case "seen":
      return `report:${c.asset}:${monthOf(c.day)}`
    case "vote":
      return `vote:${c.notice}:${c.action}`
    case "check":
      return `check:${c.response}`
    case "post":
      return `post:${c.asset}:${c.day}:${c.slot}`
  }
}

const HEX32 = /^0x[0-9a-f]{64}$/

/** Shape check for signal content. Returns an error message, or null when valid. */
export function validateContent(c: SignalContent): string | null {
  if (!c || typeof c !== "object") return "missing content"
  if (typeof c.asset !== "string" || !/^[A-Z0-9-]{3,32}$/.test(c.asset)) return "bad asset"
  if (typeof c.ward !== "string" || c.ward.length > 8) return "bad ward"
  if (!Number.isInteger(c.day)) return "bad day"
  switch (c.kind) {
    case "report":
      if (!(c.problem in PROBLEMS)) return "bad problem type"
      if (!Number.isInteger(c.severity) || c.severity < 1 || c.severity > 5) return "severity must be 1–5"
      if (typeof c.note !== "string" || c.note.length > 280) return "note must be under 280 characters"
      if (typeof c.photo !== "string" || !HEX32.test(c.photo)) return "a photo is required"
      return null
    case "seen":
      return null
    case "vote":
      if (!HEX32.test(c.notice)) return "bad notice"
      if (!(c.action in ACTIONS)) return "bad action"
      return null
    case "check":
      if (!HEX32.test(c.response)) return "bad response"
      if (typeof c.fixed !== "boolean") return "bad answer"
      return null
    case "post":
      if (typeof c.text !== "string" || c.text.trim().length < 2 || c.text.length > 500) return "post must be 2–500 characters"
      if (!Number.isInteger(c.slot) || c.slot < 1 || c.slot > POST_SLOTS) return "bad slot"
      return null
    default:
      return "unknown kind"
  }
}

/** Free text in a signal, for the personal-data filter. */
export function textOf(c: SignalContent): string {
  return c.kind === "report" ? c.note : c.kind === "post" ? c.text : ""
}

/** The record the relayer writes for a verified signal. */
export function signalRecord(payload: SignalPayload, days: number): NewRec {
  const { content: c, proof } = payload
  const attrs: Record<string, AttrValue> = {
    project: PROJECT,
    type: c.kind,
    ward: c.ward,
    asset: c.asset,
    day: c.day,
    nullifier: fieldToHex(proof.nullifier),
    root: fieldToHex(proof.merkleTreeRoot),
  }
  if (c.kind === "report") Object.assign(attrs, { problem: c.problem, severity: c.severity, photo: c.photo })
  if (c.kind === "vote") Object.assign(attrs, { notice: c.notice, action: c.action })
  if (c.kind === "check") Object.assign(attrs, { response: c.response, fixed: c.fixed })
  return { attrs, payload, days }
}

export const SIGNAL_KINDS: SignalKind[] = ["report", "seen", "vote", "check", "post"]
export const CURATOR_TYPES: RecordType[] = ["asset", "responsibility", "member", "notice", "response", "action"]

export type MemberAttrs = { group: GroupId; idx: number; commitment: string }
