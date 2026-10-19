// Plays the full loop against a running relayer, as several anonymous residents and the curator:
// reports and "seen it too", a notice whose deadline has passed, votes on actions, a disputed
// repair claim and a discussion. Doubles as an end-to-end test. Run: npm run demo
import { readFileSync } from "node:fs"
import { Group, Identity, generateProof } from "@semaphore-protocol/core"
import { TREE_DEPTH } from "../shared/config"
import { buildGroups, type Roster } from "../shared/model"
import { type SignalContent, scopeOf } from "../shared/records"
import { canonical, dayToISO, hashToField, today } from "../shared/util"

process.loadEnvFile(".env")
const API = process.env.API ?? "http://localhost:8790"
const ADMIN = process.env.ADMIN_TOKEN!
const invites = (process.env.INVITE_CODES ?? "").split(",").filter(Boolean)

async function call<T>(path: string, body?: unknown, admin = false): Promise<T> {
  const res = await fetch(API + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(admin ? { "x-admin-token": ADMIN } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${path}: ${json.error}`)
  return json as T
}

const { roster } = await call<{ roster: Roster }>("/api/config")
const day = today()

// Seven residents: five in the open group, two verified with invite codes.
const people = Array.from({ length: 7 }, () => new Identity())
const groupOf: string[] = []
for (const [i, p] of people.entries()) {
  const invite = i >= 5 ? invites[i - 5] : undefined
  const { group } = await call<{ group: string }>("/api/join", { commitment: p.commitment.toString(), invite })
  groupOf.push(group)
}
console.log("Joined:", groupOf.join(", "))

async function signal(who: number, content: SignalContent) {
  const groups = buildGroups(await call("/api/members"), roster)
  const g = groupOf[who] as "open" | "verified"
  const proof = await generateProof(
    people[who],
    new Group(groups.members[g]),
    hashToField(canonical(content)),
    hashToField(scopeOf(content)),
    TREE_DEPTH,
    { wasm: "public/artifacts/semaphore-16.wasm", zkey: "public/artifacts/semaphore-16.zkey" },
  )
  return call("/api/signal", { content, proof })
}

const photo = await fetch(`${API}/api/photo`, { method: "POST", body: readFileSync("scripts/demo-photo.jpg") })
const { hash } = (await photo.json()) as { hash: string }

// 1. LBS Marg: reported, notified 10 days ago with a 7-day limit → overdue; residents vote.
const A = { asset: "S-RD-001", ward: "S", day }
await signal(0, { ...A, kind: "report", problem: "pothole", severity: 4, note: "Deep pothole in the left lane near the bus stop, fills with water when it rains.", photo: hash })
for (const i of [1, 2, 3, 4, 5]) await signal(i, { ...A, kind: "seen" })
const notice = await call<{ key: string }>(
  "/api/admin/notice",
  { asset: A.asset, channel: "MyBMC MARG", complaint: "DEMO-2026-10-4471", filed: dayToISO(day - 10), text: "Filed by Jawabdehi notifier (demo)" },
  true,
)
for (const i of [0, 1, 2, 3, 5, 6]) await signal(i, { ...A, kind: "vote", notice: notice.key, action: "escalate" })
for (const i of [0, 2, 6]) await signal(i, { ...A, kind: "vote", notice: notice.key, action: "warranty" })
await signal(2, { ...A, kind: "post", text: "Two-wheelers swerve into the next lane to avoid it. Worse after every rain.", slot: 1 })
await signal(6, { ...A, kind: "post", text: "The gas trench from last year was never resurfaced properly; that's where it started.", slot: 1 })
console.log("LBS Marg: overdue, escalation passed")

// 2. Bhandup FOB: authority says repaired, residents say it isn't.
const B = { asset: "S-BR-001", ward: "S", day }
await signal(1, { ...B, kind: "report", problem: "bridge_damage", severity: 5, note: "Railing missing on the north stairs, exposed rusted steel under the deck edge.", photo: hash })
for (const i of [3, 4]) await signal(i, { ...B, kind: "seen" })
const notice2 = await call<{ key: string }>(
  "/api/admin/notice",
  { asset: B.asset, channel: "Central Railway grievance portal", complaint: "DEMO-CR-88120", filed: dayToISO(day - 6), text: "Filed by Jawabdehi notifier (demo)" },
  true,
)
const response = await call<{ key: string }>(
  "/api/admin/response",
  { asset: B.asset, notice: notice2.key, status: "repaired", note: "Reply on the portal says the railing was fixed (demo).", sourceUrl: "https://example.org/demo-reply", day: dayToISO(day - 2) },
  true,
)
for (const i of [1, 3, 4, 5]) await signal(i, { ...B, kind: "check", response: response.key, fixed: false })
await signal(0, { ...B, kind: "check", response: response.key, fixed: true })
console.log("Bhandup FOB: repair claimed, disputed by residents")

// 3. Adi Shankaracharya Marg: notified yesterday, clock running.
const C = { asset: "S-RD-002", ward: "S", day }
await signal(5, { ...C, kind: "report", problem: "surface", severity: 3, note: "Concrete panel cracked across the lane, edge breaking up.", photo: hash })
for (const i of [0, 6]) await signal(i, { ...C, kind: "seen" })
await call("/api/admin/notice", { asset: C.asset, channel: "MyBMC MARG", complaint: "DEMO-2026-10-5120", filed: dayToISO(day - 1), text: "Filed by Jawabdehi notifier (demo)" }, true)
console.log("Adi Shankaracharya Marg: clock running")

// Duplicate check: the same person can't report the same asset twice in a month.
try {
  await signal(0, { ...A, kind: "seen" })
  throw new Error("duplicate was accepted")
} catch (e) {
  console.log("Duplicate rejected:", (e as Error).message)
}

console.log("Done. Signals appear after the next relayer batch.")
process.exit(0)
