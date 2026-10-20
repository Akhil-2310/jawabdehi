// Where records live. ArkivStore writes to the Arkiv Tiramisu testnet; LocalStore is a JSON file
// with the same behaviour (read-only records, creator set by the writing wallet, expiry) so the
// app runs before the wallets are funded.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { dirname } from "node:path"
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { bool, bytes32, i32, key as keyAttr, str, u64 } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { and, eq } from "@arkiv-network/sdk/query"
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils"
import { http, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { PROJECT } from "../shared/config"
import { ATTR_TYPES, type AttrValue, type NewRec, type Rec } from "../shared/records"

export type Signer = "curator" | "relayer"

export interface Store {
  readonly mode: "local" | "arkiv"
  /** Writes records in one atomic batch from the signer's wallet; returns their keys in order. */
  write(signer: Signer, recs: NewRec[]): Promise<string[]>
  /** All live records of this project whose attributes equal every value in `filter`. */
  query(filter: Record<string, AttrValue>): Promise<Rec[]>
}

// ---------- Local ----------

export class LocalStore implements Store {
  readonly mode = "local" as const
  private recs: Rec[] = []

  constructor(
    private file: string,
    private addresses: Record<Signer, string>,
  ) {
    if (existsSync(file)) this.recs = JSON.parse(readFileSync(file, "utf8")).records
  }

  async write(signer: Signer, recs: NewRec[]) {
    const now = Date.now()
    const created = recs.map((r, i) => ({
      key: `0x${randomBytes(32).toString("hex")}`,
      creator: this.addresses[signer],
      createdAt: now + i,
      expiresAt: now + r.days * 86_400_000,
      attrs: r.attrs,
      // Round-trip through JSON, like a real payload.
      payload: JSON.parse(JSON.stringify(r.payload)),
    }))
    this.recs.push(...created)
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify({ records: this.recs }))
    return created.map((r) => r.key)
  }

  async query(filter: Record<string, AttrValue>) {
    const now = Date.now()
    const want = { project: PROJECT, ...filter }
    return this.recs.filter(
      (r) =>
        (r.expiresAt ?? Infinity) > now &&
        Object.entries(want).every(([k, v]) => normalise(k, r.attrs[k]) === normalise(k, v)),
    )
  }
}

function normalise(name: string, v: AttrValue | undefined) {
  return typeof v === "string" && ATTR_TYPES[name] ? v.toLowerCase() : v
}

// ---------- Arkiv ----------

/**
 * The Arkiv RPC transport. ARKIV_RPC_URL can carry an access key (from hub.arkiv.network), which
 * raises the public rate limits; it's only ever used here on the server, never sent to browsers.
 * Requests time out instead of hanging forever when the RPC is slow or limiting us.
 */
function rpc() {
  return http(process.env.ARKIV_RPC_URL || undefined, { timeout: 20_000, retryCount: 2 })
}

function typed(name: string, v: AttrValue) {
  switch (ATTR_TYPES[name]) {
    case "u64":
      return u64(v as number)
    case "i32":
      return i32(v as number)
    case "bytes32":
      return bytes32(v as Hex)
    case "key":
      return keyAttr(v as Hex)
    case "bool":
      return bool(v as boolean)
    default:
      return str(String(v))
  }
}

const BATCH_LIMIT = 25

export class ArkivStore implements Store {
  readonly mode = "arkiv" as const
  private pub = createPublicClient({ chain: tiramisu, transport: rpc() })
  private wallets: Record<Signer, ReturnType<typeof createWalletClient>>
  // One write at a time per wallet, so transactions don't collide on the nonce.
  private queues: Record<Signer, Promise<unknown>> = { curator: Promise.resolve(), relayer: Promise.resolve() }

  constructor(keys: Record<Signer, Hex>) {
    const wallet = (k: Hex) =>
      createWalletClient({ chain: tiramisu, transport: rpc(), account: privateKeyToAccount(k) })
    this.wallets = { curator: wallet(keys.curator), relayer: wallet(keys.relayer) }
  }

  write(signer: Signer, recs: NewRec[]) {
    const run = async () => {
      const keys: string[] = []
      for (let i = 0; i < recs.length; i += BATCH_LIMIT) {
        const { createdEntities } = await this.wallets[signer].executeBatch({
          creates: recs.slice(i, i + BATCH_LIMIT).map((r) => ({
            payload: jsonToPayload(r.payload as object),
            contentType: "application/json",
            attributes: Object.fromEntries(Object.entries(r.attrs).map(([k, v]) => [k, typed(k, v)])),
            expires: ExpirationTime.fromDays(r.days),
            // Nobody can edit a record after it lands; anyone (an NGO, a journalist) can keep it alive.
            flags: { readonly: true, permissionlessExtension: true },
          })),
        })
        keys.push(...createdEntities)
      }
      return keys
    }
    const result = this.queues[signer].then(run, run)
    this.queues[signer] = result.catch(() => {})
    return result
  }

  query(filter: Record<string, AttrValue>) {
    return queryArkiv(this.pub, filter)
  }
}

/**
 * Reads every live record of this project matching `filter` straight from Arkiv. Needs no key, so
 * anyone can run it (see scripts/inspect.ts).
 */
export async function queryArkiv(
  pub: ReturnType<typeof createPublicClient> = createPublicClient({ chain: tiramisu, transport: rpc() }),
  filter: Record<string, AttrValue> = {},
): Promise<Rec[]> {
  const where = and(
    eq("project", str(PROJECT)),
    ...Object.entries(filter).map(([k, v]) => eq(k, typed(k, v))),
  )
  // Pin every page to one block so results stay consistent while paging.
  const block = await pub.getBlockNumber()
  const out: Rec[] = []
  let page = await pub
    .select({ key: true, creator: true, createdAt: true, expiresAt: true, attributes: true, payload: true })
    .where(where)
    .atBlock(block)
    .limit(200)
    .fetch()
  for (;;) {
    for (const e of page.entities) {
      out.push({
        key: e.key,
        creator: e.creator,
        createdAt: Number(e.createdAt),
        expiresAt: Number(e.expiresAt),
        attrs: Object.fromEntries(
          Object.entries(e.attributes).map(([k, a]) => [k, typeof a.value === "bigint" ? Number(a.value) : a.value]),
        ) as Record<string, AttrValue>,
        payload: e.toJson(),
      })
    }
    if (!page.hasNextPage()) break
    page = await page.next()
  }
  return out
}
