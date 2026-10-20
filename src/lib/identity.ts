// The resident's anonymous Semaphore identity. Its secret never leaves this browser: we only ever
// send the public commitment (to join) and zero-knowledge proofs (to act).
import { Group, Identity, generateProof } from "@semaphore-protocol/core"
import { type GroupId, POST_SLOTS, TREE_DEPTH } from "../../shared/config"
import { type SignalContent, scopeOf } from "../../shared/records"
import { canonical, fieldToHex, hashToField } from "../../shared/util"
import { ApiError, loadGroups, postJson } from "./api"

const ID_KEY = "jd.identity"
const GROUP_KEY = "jd.group"
const RECEIPTS_KEY = "jd.receipts"

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode: identity lives for this tab only */
  }
}

let memoryIdentity: Identity | null = null

export function getIdentity(): Identity {
  if (memoryIdentity) return memoryIdentity
  const saved = read(ID_KEY)
  memoryIdentity = saved ? Identity.import(saved) : new Identity()
  if (!saved) write(ID_KEY, memoryIdentity.export())
  return memoryIdentity
}

export const hasIdentity = () => read(ID_KEY) !== null
export const currentGroup = () => read(GROUP_KEY) as GroupId | null

export async function join(invite?: string): Promise<GroupId> {
  const { group } = await postJson<{ group: GroupId }>("/api/join", {
    commitment: getIdentity().commitment.toString(),
    invite: invite || undefined,
  })
  write(GROUP_KEY, group)
  return group
}

export type Stage = "joining" | "proving" | "sending"

/** Proves membership over this exact content and scope, and hands it to the relayer. */
export async function submit(content: SignalContent, onStage: (s: Stage) => void = () => {}) {
  const identity = getIdentity()
  let group = currentGroup()
  let groups = await loadGroups()
  if (!group || !groups.members[group].includes(identity.commitment)) {
    onStage("joining")
    group = await join()
    // A new member takes a few seconds to show up on Arkiv; a proof made before then would be
    // for a group that doesn't include us yet.
    for (let tries = 0; ; tries++) {
      groups = await loadGroups()
      if (groups.members[group].includes(identity.commitment)) break
      if (tries >= 20) throw new Error("Joining is taking longer than usual. Please try again in a minute.")
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  onStage("proving")
  const proof = await generateProof(
    identity,
    new Group(groups.members[group]),
    hashToField(canonical(content)),
    hashToField(scopeOf(content)),
    TREE_DEPTH,
    { wasm: "/artifacts/semaphore-16.wasm", zkey: "/artifacts/semaphore-16.zkey" },
  )
  onStage("sending")
  const res = await postJson<{ queued: boolean; nextBatchAt: number }>("/api/signal", { content, proof })
  addReceipt({ kind: content.kind, asset: content.asset, day: content.day })
  // The nullifier lets this browser spot its own record once it lands, without revealing anything.
  return { ...res, nullifier: fieldToHex(proof.nullifier) }
}

/** Posts use up to three slots per asset per day; try the next slot when one is used. */
export async function submitPost(content: Omit<Extract<SignalContent, { kind: "post" }>, "slot">, onStage?: (s: Stage) => void) {
  for (let slot = 1; slot <= POST_SLOTS; slot++) {
    try {
      return await submit({ ...content, slot }, onStage)
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) throw e
    }
  }
  throw new Error(`You've used your ${POST_SLOTS} posts for this place today`)
}

export type Receipt = { kind: string; asset: string; day: number }

export function receipts(): Receipt[] {
  try {
    return JSON.parse(read(RECEIPTS_KEY) ?? "[]")
  } catch {
    return []
  }
}

function addReceipt(r: Receipt) {
  write(RECEIPTS_KEY, JSON.stringify([r, ...receipts()].slice(0, 100)))
}

export function exportBackup(): string {
  return JSON.stringify({ identity: getIdentity().export(), group: currentGroup() })
}

export function importBackup(text: string) {
  const { identity, group } = JSON.parse(text)
  Identity.import(identity)
  write(ID_KEY, identity)
  write(GROUP_KEY, group ?? null)
  memoryIdentity = null
}

/** Forget everything on this device. A fresh identity can't be linked to the old one. */
export function wipe() {
  for (const k of [ID_KEY, GROUP_KEY, RECEIPTS_KEY]) write(k, null)
  memoryIdentity = null
}
