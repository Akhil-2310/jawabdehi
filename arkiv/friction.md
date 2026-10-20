# Arkiv friction report

What we ran into building Jawabdehi on Arkiv. Versions for everything below unless noted:

- `@arkiv-network/sdk` **0.8.1**, `viem` **2.57.7**, Node **23.7.0**, macOS
- Network: **Tiramisu testnet**, chain id 7738577, public RPC `https://rpc.tiramisu.db-chain.testnet.arkiv.network`
- Docs read on 20 Oct 2026: https://docs.arkiv.network

Overall the SDK was pleasant: typed attributes, atomic `executeBatch`, block-pinned paging and the creation flags did exactly what we needed. The issues below are what cost us time or forced a design workaround.

---

## 1. "Read-only" entities can still be deleted by their owner

**Expected.** Our product promise is "a record nobody can quietly erase". Creating entities with `flags: { readonly: true }` sounded like that.

**What happened.** `readonly` only blocks patches. The owner can still `deleteEntity` (and transfer it). The docs do say this, but the flag name suggests more, and there is no flag for "undeletable". We confirmed it on the testnet:

```ts
const { createdEntities } = await wallet.executeBatch({ creates: [{
  payload: jsonToPayload({ x: 1 }), contentType: "application/json",
  attributes: { project: str("jawabdehi-friction-test") },
  expires: ExpirationTime.fromHours(1), flags: { readonly: true },
}] })
await wallet.deleteEntity({ entityKey: createdEntities[0] })   // succeeds
```

**Steps to reproduce.** Run the snippet above with any funded Tiramisu wallet; the delete succeeds and `getEntity` then returns `null`.

**Workaround / impact.** To make a record truly permanent we'd have to transfer ownership to an address nobody holds a key for, which also gives up the ability to remove personal data posted by mistake. We had to design around this ("who owns reports?") instead of just setting a flag. An `undeletable` (append-only) creation flag would remove the dilemma for accountability apps.

---

## 2. Entities don't expose the transaction that created them

**Expected.** We wanted every report page to link to its transaction on the block explorer, as proof it's on chain.

**What happened.** An entity exposes `$createdAt` (a block number) but not the transaction hash, and there's no query field for it. To find the transaction for a given entity we had to fetch the block with `eth_getBlockByNumber` and filter its transactions by sender (our relayer). That only works because we know the sender, and it breaks if one wallet sends several transactions in a block.

**Steps to reproduce.**
1. `publicClient.select({ key: true, createdAt: true }).where(eq("project", str("jawabdehi-v1-demo"))).fetch()`
2. There is no field or select option that returns the creating `txHash`.

**Impact.** Our "Published to Arkiv" step shows the entity key, not an explorer link. A `$txHash` (or `$createdTx`) system attribute would fix it.

---

## 3. The block explorer has no documented API

**Expected.** The explorer at `tiramisu.explorer.arkiv.network` decodes Arkiv operations nicely, so we assumed a Blockscout-style API for "transactions by address".

**What happened.**

```
GET https://tiramisu.explorer.arkiv.network/api/v2/addresses/0xE3dD…dAC2/transactions
→ {"error":"Not found: /v2/addresses/…/transactions"}
GET https://tiramisu.explorer.arkiv.network/api/v2/transactions/0xe47dc8…a450
→ {"error":"Not found: /v2/transactions/…"}
```

The HTML page `/tx/<hash>` works and is excellent (it shows the decoded CREATE, attributes and expiry), but there's no API to link from or automate against.

**Steps to reproduce.** Either `curl` above.

---

## 4. Writes take ~7 seconds; block time is 2 seconds

**Expected.** The docs say one block is 2 seconds, so we expected a write to confirm in a few seconds.

**What happened.** Measured on the testnet, each `executeBatch` with one create took **8.1 s, 6.7 s and 6.7 s** to resolve. Reads, by contrast, were consistent immediately: the new entity was returned by a query on the first try, about 0.4 s after the write resolved.

**Steps to reproduce.** Time `await wallet.executeBatch({ creates: [ … ] })` in a loop against the public RPC.

**Impact.** Fine for our daily batches, but a resident joining for the first time waits for the curator's member write before they can make a proof. We added a "Joining anonymously…" state and a retry loop. Documenting typical confirmation time (and that `executeBatch` waits for the receipt) would have set expectations.

---

## 5. Docs and SDK disagree on the attribute limit

**Expected.** The "Mutating data" docs page says entities have "up to 30 typed attributes".

**What happened.** The SDK enforces `MAX_ATTRIBUTES = 32` (`src/attr/attributes.ts`). The API reference lists `MAX_ATTRIBUTES`, `MAX_PAYLOAD_BYTES` and `MAX_STRING_BYTES` by name only, without values, so we had to read the SDK source to plan our schema (we use at most 11).

**Steps to reproduce.** Compare https://docs.arkiv.network/typescript-sdk/mutating-data/ with `node_modules/@arkiv-network/sdk/src/attr/attributes.ts`.

---

## 6. Public RPC rate limits aren't stated

**Expected.** A number, since our design has every visitor's browser read a whole ward, and the spec we started from warned about "about 100 queries per hour" from another team's experience.

**What happened.** The Access Keys page says the public RPC works "at the default rate limit" and that keys raise it, but gives no figures. It also (rightly) warns that a key used in a browser can be copied. So for a browser-first app there's no way to plan capacity without testing until it breaks.

**Impact.** We put a 10-second cache in our relayer and read through it, instead of having browsers read Arkiv directly, which weakens our "don't trust the relayer" story. Published limits (per IP, per method) would let apps choose.

---

## 7. Smaller things

- **Expiry isn't observable.** The docs note no event is emitted when an entity expires. We compute "still live" ourselves from `$expiresAt` for anything we cache.
- **No `!=` and no `exists`.** `NOT (a = b)` works. The SDK exports `ne()` and `exists()` helpers that the docs say the engine doesn't support yet, which is confusing.
- **Values in `entity.attributes`** come back as `{ type, value }` with `bigint` for `u64`, so every reader needs a small normaliser. A `toPlain()` helper would be nice.
