// The relayer and curator API. It never logs IPs or keeps request data: anonymous signals are
// checked, queued, shuffled and written to Arkiv in batches from the relayer wallet.
import { createHash } from "node:crypto"
import os from "node:os"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { verifyProof } from "@semaphore-protocol/core"
import { Hono, type Context } from "hono"
import type { Hex } from "viem"
import { privateKeyToAddress } from "viem/accounts"
import {
  ACTIONS,
  type ActionType,
  type AssetKind,
  LIFETIME_DAYS,
  PROBLEMS,
  PROJECT,
  RESPONSE_STATUSES,
  type ResponseStatus,
  WARDS,
} from "../shared/config"
import { buildGroups, type Roster } from "../shared/model"
import { checkText } from "../shared/pii"
import {
  type ActionPayload,
  type AssetPayload,
  type NewRec,
  type NoticePayload,
  type Rec,
  type ResponsePayload,
  type ResponsibilityPayload,
  type SignalPayload,
  scopeOf,
  signalRecord,
  textOf,
  validateContent,
} from "../shared/records"
import { SEED } from "../shared/seed"
import { canonical, dayFromISO, fieldToHex, hashToField, today } from "../shared/util"
import { ArkivStore, LocalStore, type Store } from "./store"
import { stripJpegMetadata } from "./jpeg"

// The proof library (snarkjs/ffjavascript) starts one worker thread per CPU it sees, up to 64, each
// with its own WebAssembly memory. In a cloud container os.cpus() reports the whole host, so it ran
// out of memory and crashed on the first proof. Cap what it sees; it reads os.cpus() lazily.
const VERIFY_THREADS = Math.max(1, Number(process.env.VERIFY_THREADS ?? 2))
const allCpus = os.cpus.bind(os)
os.cpus = () => allCpus().slice(0, VERIFY_THREADS)

// One verification at a time, so concurrent requests never race to build the curve.
let verifying: Promise<boolean> = Promise.resolve(true)
const verify = (proof: Parameters<typeof verifyProof>[0]) =>
  (verifying = verifying.then(() => verifyProof(proof)).catch(() => false))

if (existsSync(".env")) process.loadEnvFile(".env")
const env = (name: string) => {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is missing — run "npm run keys" first`)
  return v
}

const keys = { curator: env("CURATOR_KEY") as Hex, relayer: env("RELAYER_KEY") as Hex }
const roster: Roster = { curator: privateKeyToAddress(keys.curator), relayer: privateKeyToAddress(keys.relayer) }
const ADMIN_TOKEN = env("ADMIN_TOKEN")
const BATCH_SECONDS = Number(process.env.BATCH_SECONDS ?? 20)
const INVITES = new Set((process.env.INVITE_CODES ?? "").split(",").map((s) => s.trim()).filter(Boolean))
// Hosts like Railway and Render set PORT; local dev sets RELAYER_PORT so it never collides with Next.
const PORT = Number(process.env.RELAYER_PORT ?? process.env.PORT ?? 8790)
// Where photos, suggestions and used invite codes live. On a host, point this at a persistent volume.
const DATA = (process.env.DATA_DIR ?? "data").replace(/\/$/, "")

const fromCurator = (r: Rec) => r.creator.toLowerCase() === roster.curator.toLowerCase()

const store: Store =
  process.env.STORE_MODE === "arkiv" ? new ArkivStore(keys) : new LocalStore(`${DATA}/local-chain.json`, roster)

mkdirSync(`${DATA}/photos`, { recursive: true })

// ---------- Cached reads ----------

const cache = new Map<string, { at: number; recs: Promise<Rec[]> }>()
function cached(name: string, filter: Record<string, string>) {
  const hit = cache.get(name)
  if (hit && Date.now() - hit.at < 10_000) return hit.recs
  const recs = store.query(filter)
  cache.set(name, { at: Date.now(), recs })
  recs.catch(() => cache.delete(name))
  return recs
}
const members = () => cached("members", { type: "member" })
const ward = (id: string) => cached(`ward:${id}`, { ward: id })
const forget = (name: string) => cache.delete(name)

// ---------- Seed ----------

async function seedIfEmpty() {
  const existing = await store.query({ type: "asset" })
  if (existing.length) return
  const recs: NewRec[] = []
  for (const s of SEED) {
    recs.push({
      attrs: { project: PROJECT, type: "asset", ward: s.ward, asset: s.id, kind: s.asset.kind },
      payload: s.asset,
      days: LIFETIME_DAYS.asset,
    })
    const attrs: NewRec["attrs"] = {
      project: PROJECT,
      type: "responsibility",
      ward: s.ward,
      asset: s.id,
      agency: s.resp.agency,
      dlp_end: s.resp.dlpEnd ? dayFromISO(s.resp.dlpEnd) : 0,
    }
    if (s.resp.contractor) attrs.contractor = s.resp.contractor
    if (s.resp.tender) attrs.tender = s.resp.tender
    if (s.resp.repairDays) attrs.repair_days = s.resp.repairDays
    recs.push({ attrs, payload: s.resp, days: LIFETIME_DAYS.responsibility })
  }
  await store.write("curator", recs)
  console.log(`Seeded ${SEED.length} sample assets`)
}

// ---------- Relayer queue ----------

const queue: NewRec[] = []
const pendingNullifiers = new Set<string>()
let nextBatchAt = Date.now() + BATCH_SECONDS * 1000

async function flush() {
  nextBatchAt = Date.now() + BATCH_SECONDS * 1000
  if (!queue.length) return
  const batch = queue.splice(0)
  // Shuffle so the order inside a batch says nothing about the order people submitted.
  for (let i = batch.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[batch[i], batch[j]] = [batch[j], batch[i]]
  }
  try {
    await store.write("relayer", batch)
    for (const r of batch) {
      pendingNullifiers.delete(String(r.attrs.nullifier))
      forget(`ward:${r.attrs.ward}`)
    }
    console.log(`Wrote a batch of ${batch.length}`)
  } catch (e) {
    queue.unshift(...batch)
    console.error("Batch failed, will retry:", (e as Error).message)
  }
}
setInterval(flush, BATCH_SECONDS * 1000)

// ---------- API ----------

const app = new Hono()

// Abuse limits for the public endpoints: the relayer pays gas for every write. Counts are kept in
// memory for one minute and never written anywhere; the address is used only as a counter key.
const LIMITS: Record<string, number> = { "/api/photo": 10, "/api/signal": 30, "/api/join": 5, "/api/suggest": 5 }
const hits = new Map<string, { n: number; until: number }>()
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of hits) if (v.until < now) hits.delete(k)
}, 60_000)
app.use("/api/*", async (c, next) => {
  const max = c.req.method === "POST" ? LIMITS[c.req.path] : undefined
  if (max) {
    const who = (c.req.header("x-forwarded-for") ?? "").split(",")[0].trim() || "local"
    const key = `${c.req.path}|${who}`
    const now = Date.now()
    const h = hits.get(key)
    if (!h || h.until < now) hits.set(key, { n: 1, until: now + 60_000 })
    else if (++h.n > max) return c.json({ error: "Too many requests — please wait a minute and try again." }, 429)
  }
  await next()
})

app.get("/api/health", (c) => c.json({ ok: true, mode: store.mode, queued: queue.length }))

const fail = (c: Context, status: 400 | 401 | 404 | 409, error: string) => c.json({ error }, status)

app.get("/api/config", (c) =>
  c.json({
    mode: store.mode,
    project: PROJECT,
    roster,
    batchSeconds: BATCH_SECONDS,
    nextBatchAt,
    rpc: store.mode === "arkiv" ? "https://rpc.tiramisu.db-chain.testnet.arkiv.network" : null,
  }),
)

app.get("/api/members", async (c) => c.json(await members()))

app.get("/api/ward/:ward", async (c) => {
  const id = c.req.param("ward")
  if (!WARDS.some((w) => w.id === id)) return fail(c, 404, "unknown ward")
  return c.json(await ward(id))
})

// Joining: the browser sends only its public commitment. With a valid one-time invite code it
// joins the verified-resident group; otherwise the open group.
let joining: Promise<unknown> = Promise.resolve()
const usedInvitesFile = `${DATA}/used-invites.${store.mode}.json`
const usedInvites = new Set<string>(existsSync(usedInvitesFile) ? JSON.parse(readFileSync(usedInvitesFile, "utf8")) : [])

app.post("/api/join", async (c) => {
  const body = await c.req.json<{ commitment?: string; invite?: string }>().catch(() => ({}) as never)
  let commitment: bigint
  try {
    commitment = BigInt(body.commitment ?? "")
  } catch {
    return fail(c, 400, "bad commitment")
  }
  if (commitment <= 0n || commitment >= 2n ** 254n) return fail(c, 400, "bad commitment")
  const invite = body.invite?.trim()
  if (invite && (!INVITES.has(invite) || usedInvites.has(invite))) return fail(c, 400, "That invite code isn't valid or was already used")

  const run = async () => {
    const all = await store.query({ type: "member" })
    const hex = fieldToHex(commitment)
    const mine = all.filter((r) => String(r.attrs.commitment).toLowerCase() === hex)
    const group = invite ? "verified" : "open"
    if (mine.some((r) => r.attrs.group === group) || (!invite && mine.length)) {
      return { group: mine.some((r) => r.attrs.group === "verified") ? "verified" : "open" }
    }
    await store.write("curator", [
      {
        attrs: { project: PROJECT, type: "member", group, idx: all.length, commitment: hex },
        payload: {},
        days: LIFETIME_DAYS.member,
      },
    ])
    if (invite) {
      usedInvites.add(invite)
      writeFileSync(usedInvitesFile, JSON.stringify([...usedInvites]))
    }
    forget("members")
    return { group }
  }
  const result = joining.then(run, run)
  joining = result.catch(() => {})
  return c.json(await result)
})

app.post("/api/photo", async (c) => {
  const raw = new Uint8Array(await c.req.arrayBuffer())
  if (raw.length > 2_000_000) return fail(c, 400, "photo too large")
  const clean = stripJpegMetadata(raw)
  if (!clean) return fail(c, 400, "only JPEG photos are accepted")
  const hash = createHash("sha256").update(clean).digest("hex")
  writeFileSync(`${DATA}/photos/${hash}.jpg`, clean)
  return c.json({ hash: `0x${hash}` })
})

app.get("/photos/:name", (c) => {
  const name = c.req.param("name")
  if (!/^[0-9a-f]{64}\.jpg$/.test(name) || !existsSync(`${DATA}/photos/${name}`)) return fail(c, 404, "not found")
  return c.body(readFileSync(`${DATA}/photos/${name}`), 200, {
    "content-type": "image/jpeg",
    "cache-control": "public, max-age=31536000, immutable",
  })
})

app.post("/api/signal", async (c) => {
  const body = await c.req.json<SignalPayload>().catch(() => null)
  const content = body?.content
  const proof = body?.proof
  if (!content || !proof) return fail(c, 400, "missing content or proof")
  const invalid = validateContent(content)
  if (invalid) return fail(c, 400, invalid)
  const pii = checkText(textOf(content))
  if (pii.blocked.length) return fail(c, 400, `Remove ${pii.blocked.join(", ")} before posting`)
  const now = today()
  if (content.day !== now && content.day !== now - 1) return fail(c, 400, "date must be today")

  // The thing being signalled about must exist.
  const recs = await ward(content.ward)
  const curated = recs.filter((r) => fromCurator(r))
  if (!curated.some((r) => r.attrs.type === "asset" && r.attrs.asset === content.asset)) return fail(c, 404, "unknown asset")
  if (content.kind === "report") {
    const assetRec = curated.find((r) => r.attrs.type === "asset" && r.attrs.asset === content.asset)!
    const kinds: readonly AssetKind[] = PROBLEMS[content.problem].kinds
    if (!kinds.includes((assetRec.payload as AssetPayload).kind)) return fail(c, 400, "that problem doesn't apply here")
    if (!existsSync(`${DATA}/photos/${content.photo.slice(2)}.jpg`)) return fail(c, 400, "upload the photo first")
  }
  if (content.kind === "vote" && !curated.some((r) => r.key === content.notice && r.attrs.type === "notice" && r.attrs.asset === content.asset))
    return fail(c, 404, "unknown notice")
  if (
    content.kind === "check" &&
    !curated.some((r) => r.key === content.response && r.attrs.type === "response" && r.attrs.status === "repaired")
  )
    return fail(c, 404, "unknown repair claim")

  // The proof must be over exactly this content and scope, from a current member.
  if (proof.scope !== hashToField(scopeOf(content)).toString()) return fail(c, 400, "wrong scope")
  if (proof.message !== hashToField(canonical(content)).toString()) return fail(c, 400, "proof doesn't match content")
  const groups = buildGroups(await members(), roster)
  if (!groups.roots.has(fieldToHex(proof.merkleTreeRoot))) return fail(c, 400, "unknown group root — rejoin and retry")
  if (!(await verify(proof))) return fail(c, 400, "invalid proof")

  const nullifier = fieldToHex(proof.nullifier)
  if (pendingNullifiers.has(nullifier) || (await store.query({ nullifier })).length)
    return fail(c, 409, content.kind === "post" ? "slot used" : "You've already done this here")

  pendingNullifiers.add(nullifier)
  queue.push(signalRecord({ content, proof }, LIFETIME_DAYS[content.kind]))
  return c.json({ queued: true, nextBatchAt })
})

// ---------- Curator (admin) ----------

app.use("/api/admin/*", async (c, next) => {
  if (c.req.header("x-admin-token") !== ADMIN_TOKEN) return fail(c, 401, "wrong admin token")
  await next()
})

async function assetOf(id: string) {
  for (const w of WARDS) {
    const recs = await ward(w.id)
    const asset = recs.find((r) => fromCurator(r) && r.attrs.type === "asset" && r.attrs.asset === id)
    if (asset) return { asset, recs, ward: w.id }
  }
  return null
}

app.post("/api/admin/notice", async (c) => {
  const b = await c.req.json<{ asset: string; channel: string; complaint: string; level?: number; filed?: string; text: string }>()
  const found = await assetOf(b.asset)
  if (!found) return fail(c, 404, "unknown asset")
  if (!b.channel?.trim() || !b.complaint?.trim()) return fail(c, 400, "channel and complaint number are required")
  const resp = found.recs
    .filter((r) => fromCurator(r) && r.attrs.type === "responsibility" && r.attrs.asset === b.asset)
    .at(-1)?.payload as ResponsibilityPayload | undefined
  const kind = (found.asset.payload as AssetPayload).kind
  const fallback = Object.values(PROBLEMS).find((p) => (p.kinds as readonly string[]).includes(kind))!.slaDays
  const slaDays = resp?.repairDays ?? fallback
  const day = b.filed ? dayFromISO(b.filed) : today()
  const payload: NoticePayload = {
    channel: b.channel.trim().slice(0, 60),
    complaint: b.complaint.trim().slice(0, 60),
    level: b.level ?? 0,
    slaDays,
    slaSource: resp?.repairDays ? "contract" : "default",
    text: String(b.text ?? "").slice(0, 4000),
  }
  const [key] = await store.write("curator", [
    {
      attrs: {
        project: PROJECT,
        type: "notice",
        ward: found.ward,
        asset: b.asset,
        day,
        deadline: day + slaDays,
        level: payload.level,
        complaint: payload.complaint,
      },
      payload,
      days: LIFETIME_DAYS.notice,
    },
  ])
  forget(`ward:${found.ward}`)
  return c.json({ key })
})

app.post("/api/admin/response", async (c) => {
  const b = await c.req.json<{ asset: string; notice: string; status: ResponseStatus; note: string; sourceUrl: string; day?: string }>()
  const found = await assetOf(b.asset)
  if (!found) return fail(c, 404, "unknown asset")
  if (!(b.status in RESPONSE_STATUSES)) return fail(c, 400, "bad status")
  if (!found.recs.some((r) => r.key === b.notice && r.attrs.type === "notice")) return fail(c, 404, "unknown notice")
  const payload: ResponsePayload = { status: b.status, note: String(b.note ?? "").slice(0, 1000), sourceUrl: String(b.sourceUrl ?? "") }
  const [key] = await store.write("curator", [
    {
      attrs: {
        project: PROJECT,
        type: "response",
        ward: found.ward,
        asset: b.asset,
        notice: b.notice,
        status: b.status,
        day: b.day ? dayFromISO(b.day) : today(),
      },
      payload,
      days: LIFETIME_DAYS.response,
    },
  ])
  forget(`ward:${found.ward}`)
  return c.json({ key })
})

app.post("/api/admin/action", async (c) => {
  const b = await c.req.json<{ asset: string; notice: string; action: ActionType; note: string; sourceUrl: string }>()
  const found = await assetOf(b.asset)
  if (!found) return fail(c, 404, "unknown asset")
  if (!(b.action in ACTIONS)) return fail(c, 400, "bad action")
  if (!found.recs.some((r) => r.key === b.notice && r.attrs.type === "notice")) return fail(c, 404, "unknown notice")
  const payload: ActionPayload = { action: b.action, note: String(b.note ?? "").slice(0, 1000), sourceUrl: String(b.sourceUrl ?? "") }
  const [key] = await store.write("curator", [
    {
      attrs: { project: PROJECT, type: "action", ward: found.ward, asset: b.asset, notice: b.notice, action: b.action, day: today() },
      payload,
      days: LIFETIME_DAYS.action,
    },
  ])
  forget(`ward:${found.ward}`)
  return c.json({ key })
})

// ---------- Place suggestions ----------
// A resident can suggest a road, footpath or bridge that isn't in the ledger yet. Suggestions stay
// on the relayer (never on Arkiv) until a curator checks them and adds the place as an asset.

type Suggestion = { id: string; ward: string; kind: AssetKind; name: string; stretch: string; area: string; day: number }
const suggestionsFile = `${DATA}/suggestions.${store.mode}.json`
let suggestions: Suggestion[] = existsSync(suggestionsFile) ? JSON.parse(readFileSync(suggestionsFile, "utf8")) : []
const saveSuggestions = () => writeFileSync(suggestionsFile, JSON.stringify(suggestions))
const KINDS: AssetKind[] = ["road", "footpath", "bridge"]
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max)

app.post("/api/suggest", async (c) => {
  const b = await c.req.json<Partial<Suggestion>>().catch(() => ({}) as Partial<Suggestion>)
  const s = {
    ward: clean(b.ward, 8),
    kind: b.kind as AssetKind,
    name: clean(b.name, 80),
    stretch: clean(b.stretch, 120),
    area: clean(b.area, 60),
  }
  if (!WARDS.some((w) => w.id === s.ward)) return fail(c, 400, "pick a ward")
  if (!KINDS.includes(s.kind)) return fail(c, 400, "pick road, footpath or bridge")
  if (s.name.length < 3 || s.stretch.length < 3) return fail(c, 400, "add a name and the stretch")
  const pii = checkText(`${s.name} ${s.stretch} ${s.area}`)
  if (pii.blocked.length) return fail(c, 400, `Remove ${pii.blocked.join(", ")}`)
  if (suggestions.length >= 500) return fail(c, 409, "The curators' queue is full. Please try again later.")
  const dup = suggestions.find((x) => x.ward === s.ward && x.name.toLowerCase() === s.name.toLowerCase() && x.stretch.toLowerCase() === s.stretch.toLowerCase())
  if (!dup) {
    suggestions.push({ id: createHash("sha256").update(`${Date.now()}${Math.random()}`).digest("hex").slice(0, 12), day: today(), ...s })
    saveSuggestions()
  }
  return c.json({ ok: true })
})

app.get("/api/admin/suggestions", (c) => c.json(suggestions))

app.post("/api/admin/suggestions/dismiss", async (c) => {
  const { id } = await c.req.json<{ id: string }>()
  suggestions = suggestions.filter((x) => x.id !== id)
  saveSuggestions()
  return c.json({ ok: true })
})

// Adds a place to the ledger: an asset record plus a first responsibility record (agency only,
// until a curator finds the tender).
app.post("/api/admin/asset", async (c) => {
  const b = await c.req.json<{ ward: string; kind: AssetKind; name: string; stretch: string; area: string; agency: string; wardOffice: string; officer: string; suggestion?: string }>()
  const w = WARDS.find((x) => x.id === b.ward)
  if (!w) return fail(c, 400, "unknown ward")
  if (!KINDS.includes(b.kind)) return fail(c, 400, "bad kind")
  const name = clean(b.name, 80)
  const stretch = clean(b.stretch, 120)
  if (name.length < 3 || stretch.length < 3) return fail(c, 400, "name and stretch are required")
  const recs = await store.query({ ward: w.id })
  const prefix = `${w.id}-${{ road: "RD", footpath: "FP", bridge: "BR" }[b.kind]}-`
  const taken = recs.filter((r) => fromCurator(r) && r.attrs.type === "asset" && String(r.attrs.asset).startsWith(prefix))
  const id = `${prefix}${String(taken.length + 1).padStart(3, "0")}`
  const asset: AssetPayload = { name, kind: b.kind, stretch, area: clean(b.area, 60) || w.area.split(",")[0] }
  const resp: ResponsibilityPayload = {
    agency: clean(b.agency, 60) || "BMC",
    wardOffice: clean(b.wardOffice, 80) || `BMC ${w.name} office`,
    contractor: null,
    tender: null,
    cost: null,
    completed: null,
    surface: null,
    dlpEnd: null,
    dlpYears: null,
    repairDays: null,
    repairClause: null,
    penaltyClause: null,
    officer: clean(b.officer, 80) || `Assistant Engineer, ${w.name}`,
    otherAgencies: [],
    lastAudit: null,
    sources: [],
    sample: false,
  }
  await store.write("curator", [
    { attrs: { project: PROJECT, type: "asset", ward: w.id, asset: id, kind: b.kind }, payload: asset, days: LIFETIME_DAYS.asset },
    {
      attrs: { project: PROJECT, type: "responsibility", ward: w.id, asset: id, agency: resp.agency, dlp_end: 0 },
      payload: resp,
      days: LIFETIME_DAYS.responsibility,
    },
  ])
  if (b.suggestion) {
    suggestions = suggestions.filter((x) => x.id !== b.suggestion)
    saveSuggestions()
  }
  forget(`ward:${w.id}`)
  return c.json({ id })
})

// In production the relayer also serves the static site built by `next build` (out/).
if (existsSync("out")) app.use("/*", serveStatic({ root: "./out" }))

await seedIfEmpty()
serve({ fetch: app.fetch, port: PORT })
console.log(`Relayer on http://localhost:${PORT} — store: ${store.mode}, batch every ${BATCH_SECONDS}s`)
console.log(`Curator ${roster.curator} · Relayer ${roster.relayer}`)
