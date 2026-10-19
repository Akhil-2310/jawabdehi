// The reader: turns raw Arkiv records into what the app shows, trusting nothing it can't check.
// Curator records count only if the curator wallet wrote them; anonymous signals count only if
// the relayer wrote them AND their Semaphore proof verifies against a known group root.
import { Group, verifyProof } from "@semaphore-protocol/core"
import {
  ACTION_VOTES_NEEDED,
  ACTIONS,
  type ActionType,
  COUNT_DISPLAY_MIN,
  type GroupId,
} from "./config"
import {
  type ActionPayload,
  type AssetPayload,
  type NoticePayload,
  type Rec,
  type ResponsePayload,
  type ResponsibilityPayload,
  type SignalContent,
  type SignalPayload,
  scopeOf,
  validateContent,
} from "./records"
import { canonical, fieldToHex, hashToField, today } from "./util"

export type Roster = { curator: string; relayer: string }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// ---------- Groups ----------

export type GroupState = {
  /** Member commitments per group, in admission order. */
  members: Record<GroupId, bigint[]>
  /** Every root each group has had, so proofs made before later admissions still verify. */
  roots: Map<string, GroupId>
}

export function buildGroups(memberRecs: Rec[], roster: Roster): GroupState {
  const members: Record<GroupId, bigint[]> = { open: [], verified: [] }
  const roots = new Map<string, GroupId>()
  const seen = new Set<string>()
  const recs = memberRecs
    .filter((r) => same(r.creator, roster.curator) && r.attrs.type === "member")
    .sort((a, b) => Number(a.attrs.idx) - Number(b.attrs.idx))
  for (const id of Object.keys(members) as GroupId[]) {
    const group = new Group()
    for (const r of recs) {
      if (r.attrs.group !== id) continue
      const c = String(r.attrs.commitment)
      if (seen.has(c)) continue
      seen.add(c)
      group.addMember(BigInt(c))
      members[id].push(BigInt(c))
      roots.set(fieldToHex(group.root), id)
    }
  }
  return { members, roots }
}

// ---------- Signal verification ----------

export type Verified<K extends SignalContent["kind"] = SignalContent["kind"]> = {
  rec: Rec
  content: Extract<SignalContent, { kind: K }>
  group: GroupId
  nullifier: string
}

export type Rejected = { rec: Rec; reason: string }

const proofCache = new Map<string, Promise<boolean>>()
let verifying: Promise<boolean> = Promise.resolve(true)

export async function verifySignal(
  rec: Rec,
  groups: GroupState,
  roster: Roster,
): Promise<Verified | Rejected> {
  if (!same(rec.creator, roster.relayer)) return { rec, reason: "not written by the relayer" }
  const payload = rec.payload as SignalPayload
  const c = payload?.content
  const proof = payload?.proof
  if (!c || !proof) return { rec, reason: "missing content or proof" }
  const invalid = validateContent(c)
  if (invalid) return { rec, reason: invalid }
  if (c.kind !== rec.attrs.type || c.asset !== rec.attrs.asset || c.ward !== rec.attrs.ward)
    return { rec, reason: "attributes don't match content" }
  if (fieldToHex(proof.nullifier) !== String(rec.attrs.nullifier).toLowerCase())
    return { rec, reason: "nullifier doesn't match proof" }
  if (proof.scope !== hashToField(scopeOf(c)).toString()) return { rec, reason: "wrong scope" }
  if (proof.message !== hashToField(canonical(c)).toString())
    return { rec, reason: "content was changed after it was signed" }
  const group = groups.roots.get(fieldToHex(proof.merkleTreeRoot))
  if (!group) return { rec, reason: "proof is for an unknown group" }
  let check = proofCache.get(rec.key)
  if (!check) {
    // One at a time: parallel verifications each allocate their own WebAssembly memory.
    check = verifying = verifying.then(() => verifyProof(proof)).catch(() => false)
    proofCache.set(rec.key, check)
  }
  if (!(await check)) return { rec, reason: "invalid Semaphore proof" }
  return { rec, content: c as Verified["content"], group, nullifier: fieldToHex(proof.nullifier) }
}

// ---------- Per-asset view ----------

export type Count = { total: number; byGroup: Record<GroupId, number> }

export type AssetView = {
  id: string
  ward: string
  rec: Rec
  asset: AssetPayload
  responsibility: { rec: Rec; data: ResponsibilityPayload; history: Rec[] } | null
  warranty: { state: "active" | "ended" | "unknown"; endDay: number | null }
  reports: Verified<"report">[]
  seen: Verified<"seen">[]
  people: Count
  notices: { rec: Rec; data: NoticePayload; day: number; deadline: number }[]
  status: Status
  votes: Record<ActionType, { count: Count; passed: boolean; taken: { rec: Rec; data: ActionPayload } | null }>
  posts: Verified<"post">[]
  rejected: Rejected[]
}

export type NoticeView = AssetView["notices"][number]

export type Status =
  | { stage: "quiet" }
  | { stage: "reported" }
  | { stage: "clock"; notice: NoticeView; elapsed: number; daysLeft: number }
  | { stage: "overdue"; notice: NoticeView; daysOver: number }
  | {
      stage: "claimed" | "fixed" | "disputed"
      notice: NoticeView
      response: { rec: Rec; data: ResponsePayload; day: number }
      checks: { fixed: number; notFixed: number }
      daysOver: number
    }
  | {
      stage: "responded"
      notice: NoticeView
      response: { rec: Rec; data: ResponsePayload; day: number }
      elapsed: number
      daysLeft: number
      daysOver: number
    }

/** Whether residents can vote on actions: the authority missed its deadline. */
export function actionsOpen(s: Status): s is Extract<Status, { notice: NoticeView }> {
  if (s.stage === "overdue") return true
  if (s.stage === "disputed" || s.stage === "responded") return s.daysOver > 0
  return false
}

function count(items: { group: GroupId }[]): Count {
  const byGroup: Record<GroupId, number> = { open: 0, verified: 0 }
  for (const i of items) byGroup[i.group]++
  return { total: items.length, byGroup }
}

/** Shown count: exact only past the threshold, so a quiet lane doesn't single anyone out. */
export function shownCount(n: number): string {
  return n >= COUNT_DISPLAY_MIN ? String(n) : `fewer than ${COUNT_DISPLAY_MIN}`
}

export async function buildWard(
  wardRecs: Rec[],
  groups: GroupState,
  roster: Roster,
): Promise<AssetView[]> {
  const byCreated = (a: Rec, b: Rec) => a.createdAt - b.createdAt || (a.key < b.key ? -1 : 1)
  const curated = wardRecs.filter((r) => same(r.creator, roster.curator)).sort(byCreated)
  const signals = wardRecs.filter((r) => same(r.creator, roster.relayer)).sort(byCreated)

  // Verify every signal, then keep only the first use of each nullifier.
  const results = await Promise.all(signals.map((r) => verifySignal(r, groups, roster)))
  const used = new Set<string>()
  const valid: Verified[] = []
  const rejected: Rejected[] = []
  for (const r of results) {
    if ("reason" in r) rejected.push(r)
    else if (used.has(r.nullifier)) rejected.push({ rec: r.rec, reason: "duplicate (same person, same scope)" })
    else {
      used.add(r.nullifier)
      valid.push(r)
    }
  }

  const now = today()
  const views: AssetView[] = []
  for (const rec of curated.filter((r) => r.attrs.type === "asset")) {
    const id = String(rec.attrs.asset)
    const mine = (r: Rec) => r.attrs.asset === id
    const sig = <K extends SignalContent["kind"]>(k: K) =>
      valid.filter((v) => v.content.asset === id && v.content.kind === k) as unknown as Verified<K>[]

    const respRecs = curated.filter((r) => mine(r) && r.attrs.type === "responsibility")
    const latest = respRecs.at(-1)
    const responsibility = latest
      ? { rec: latest, data: latest.payload as ResponsibilityPayload, history: respRecs.slice(0, -1) }
      : null
    const endDay = latest && Number(latest.attrs.dlp_end) > 0 ? Number(latest.attrs.dlp_end) : null
    const warranty: AssetView["warranty"] = {
      state: endDay == null ? "unknown" : endDay >= now ? "active" : "ended",
      endDay,
    }

    const reports = sig("report")
    const seen = sig("seen")
    const notices = curated
      .filter((r) => mine(r) && r.attrs.type === "notice")
      .map((r) => ({
        rec: r,
        data: r.payload as NoticePayload,
        day: Number(r.attrs.day),
        deadline: Number(r.attrs.deadline),
      }))
    const current = notices.at(-1)

    let status: Status = reports.length ? { stage: "reported" } : { stage: "quiet" }
    if (current) {
      const daysOver = now - current.deadline
      const respRec = curated
        .filter((r) => r.attrs.type === "response" && r.attrs.notice === current.rec.key)
        .at(-1)
      const response = respRec
        ? { rec: respRec, data: respRec.payload as ResponsePayload, day: Number(respRec.attrs.day) }
        : null
      if (response?.data.status === "repaired") {
        const checks = sig("check").filter((c) => c.content.response === response.rec.key)
        const fixed = checks.filter((c) => c.content.fixed).length
        const notFixed = checks.length - fixed
        const stage =
          notFixed >= COUNT_DISPLAY_MIN && notFixed > fixed
            ? "disputed"
            : fixed >= COUNT_DISPLAY_MIN && fixed > notFixed
              ? "fixed"
              : "claimed"
        status = { stage, notice: current, response, checks: { fixed, notFixed }, daysOver }
      } else if (response) {
        status = {
          stage: "responded",
          notice: current,
          response,
          elapsed: now - current.day,
          daysLeft: current.deadline - now,
          daysOver,
        }
      } else if (daysOver > 0) {
        status = { stage: "overdue", notice: current, daysOver }
      } else {
        status = { stage: "clock", notice: current, elapsed: now - current.day, daysLeft: current.deadline - now }
      }
    }

    const votes = {} as AssetView["votes"]
    for (const action of Object.keys(ACTIONS) as ActionType[]) {
      const v = current
        ? sig("vote").filter((x) => x.content.notice === current.rec.key && x.content.action === action)
        : []
      const takenRec = current
        ? curated
            .filter((r) => mine(r) && r.attrs.type === "action" && r.attrs.notice === current.rec.key && r.attrs.action === action)
            .at(-1)
        : undefined
      votes[action] = {
        count: count(v),
        passed: v.length >= ACTION_VOTES_NEEDED,
        taken: takenRec ? { rec: takenRec, data: takenRec.payload as ActionPayload } : null,
      }
    }

    // Reports and "seen it too" share a scope, so each person counts once per month.
    const people = count([...reports, ...seen])

    views.push({
      id,
      ward: String(rec.attrs.ward),
      rec,
      asset: rec.payload as AssetPayload,
      responsibility,
      warranty,
      reports,
      seen,
      people,
      notices,
      status,
      votes,
      posts: sig("post").reverse(),
      rejected: rejected.filter((r) => mine(r.rec)),
    })
  }
  return views
}
