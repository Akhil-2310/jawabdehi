# Jawabdehi on Arkiv: schema

Network: **Arkiv Tiramisu testnet** (chain id 7738577, RPC `https://rpc.tiramisu.db-chain.testnet.arkiv.network`).
SDK: `@arkiv-network/sdk` 0.8.1. Code: [`shared/records.ts`](../shared/records.ts), [`server/store.ts`](../server/store.ts).

## Rules that apply to every entity

| Rule | Value | Why |
|---|---|---|
| `project` attribute | `jawabdehi-v1-demo` on every entity and in every query | Arkiv is a shared database; this keeps other projects' data out |
| Creation flags | `readonly: true`, `permissionlessExtension: true` | Nobody can edit a record once it lands; anyone (an NGO, a journalist) can keep it alive |
| Content type | `application/json` | Payloads hold the full record; attributes hold what we query on |
| Trust | Records count only if `$creator` is the curator or relayer wallet | `$creator` is set by the protocol and can't be faked |
| Dates | `day` = whole days since 1970-01-01 (IST), as `u64` | Range-queryable, and never a time of day, so records can't be matched to someone's movements |

## Wallets (`$creator`)

| Role | Address | Writes |
|---|---|---|
| Curator | `0x807A75B1981B167f06c0bC9a5B1Fa55511609A9f` | `asset`, `responsibility`, `member`, `notice`, `response`, `action` |
| Relayer | `0xE3dD9266BAd4eD9879FB34CdB80BbfCC1f90dAC2` | `report`, `seen`, `vote`, `check`, `post` (anonymous, each with a Semaphore proof) |

Residents never use a wallet: their browser sends the relayer a zero-knowledge proof, and the relayer writes and pays.

## Attribute types

Anything not listed is `str` ([`ATTR_TYPES`](../shared/records.ts)).

| Attribute | Type | | Attribute | Type |
|---|---|---|---|---|
| `day`, `deadline`, `dlp_end`, `idx` | `u64` | | `nullifier`, `root`, `photo`, `commitment` | `bytes32` |
| `severity`, `level`, `repair_days` | `i32` | | `notice`, `response` | `key` |
| `fixed` | `bool` | | everything else | `str` |

## Entities written by the curator

| `type` | Attributes | Payload | Lifetime |
|---|---|---|---|
| `asset` | `project, type, ward, asset, kind` | `{ name, kind, stretch, area }` | 5 years |
| `responsibility` | `project, type, ward, asset, agency, dlp_end, contractor?, tender?, repair_days?` | agency, ward office, officer, contractor, tender, cost, warranty end, repair and penalty clauses, other agencies, sources, `sample` flag | 5 years; a correction is a new record, the latest wins |
| `member` | `project, type, group (open \| verified), idx, commitment` | `{}` | 5 years |
| `notice` | `project, type, ward, asset, day, deadline, level, complaint` | `{ channel, complaint, level, slaDays, slaSource, text }` | 5 years |
| `response` | `project, type, ward, asset, notice (key), status, day` | `{ status, note, sourceUrl }` | 5 years |
| `action` | `project, type, ward, asset, notice (key), action, day` | `{ action, note, sourceUrl }` | 5 years |

`member` records are the Semaphore groups: readers rebuild each group's Merkle tree from them in `idx` order, and keep every root it has had, so older proofs still verify ([`buildGroups`](../shared/model.ts)).

## Anonymous entities written by the relayer

Every one carries `project, type, ward, asset, day, nullifier, root` plus its own attributes, and a payload of `{ content, proof }`: the exact content the resident signed and their Semaphore v4 proof ([`signalRecord`](../shared/records.ts)).

| `type` | Extra attributes | Semaphore scope (one nullifier per person per scope) | Lifetime |
|---|---|---|---|
| `report` | `problem, severity, photo` (sha-256 of the cleaned photo; the photo itself is stored off Arkiv) | `report:<asset>:<month>` | 1 year |
| `seen` ("I've seen this too") | — | `report:<asset>:<month>`, shared with `report`, so each person counts once | 1 year |
| `vote` | `notice (key), action` | `vote:<notice>:<action>` | 1 year |
| `check` ("is it really fixed?") | `response (key), fixed` | `check:<response>` | 1 year |
| `post` | — | `post:<asset>:<day>:<1-3>` | 90 days |

The proof's `message` is `keccak(canonical JSON of content) >> 8` and its `scope` is `keccak(scope string) >> 8`, so the relayer can't change what was signed.

## Queries

| Who | Query | Purpose |
|---|---|---|
| Every visitor (via the relayer's 10-second cache) | `project = … AND ward = 'S'` | Download a whole ward, so nobody learns which road a visitor cares about |
| Every visitor | `project = … AND type = 'member'` | Rebuild the Semaphore groups |
| Relayer, before accepting a signal | `project = … AND nullifier = 0x…` | Reject a second action by the same person in the same scope |
| Relayer, on join | `project = … AND type = 'member'` | Avoid duplicate members; assign `idx` |
| `npm run inspect` | `project = …` | Fetch everything and verify it with no keys |

All queries page 200 at a time and pin every page to one block (`atBlock`) so results stay consistent ([`queryArkiv`](../server/store.ts)).

## What readers reject

A record is ignored unless all of these hold ([`verifySignal`](../shared/model.ts)):
- `$creator` is the curator (for curator types) or the relayer (for anonymous types),
- the payload's content matches its attributes,
- the proof's scope and message match the content,
- the proof's root is one of the group's roots,
- the Semaphore proof verifies,
- its nullifier hasn't been used by an earlier record.
