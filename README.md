# Jawabdehi (जवाबदेही)

Report a broken road, footpath or bridge in Mumbai anonymously, see who is responsible for it, give the authority a deadline, and act together when they miss it. Every record goes to [Arkiv](https://docs.arkiv.network/), and every anonymous action carries a [Semaphore](https://docs.semaphore.pse.dev/) zero-knowledge proof.

**The loop:** photo report → contractor, tender and warranty → notice starts the duty clock → deadline missed → residents vote on an action (escalate, invoke warranty, RTI, press) → curator records the action → new deadline. When the authority claims a repair, residents confirm or dispute it.

## Run it

```bash
npm install
npm run keys     # creates .env: two testnet wallets, an admin token, invite codes
npm run dev      # relayer on :8790, Next.js on :5173
npm run demo     # in another terminal: 7 anonymous residents play the full loop
```

For production, `npm run build` writes a static site to `out/` and `npm start` runs the relayer, which serves it on :8790.

Open http://localhost:5173. The curator console is at `#/admin` (token in `.env`). The demo uses the first two invite codes in `.env`.

By default records go to `data/local-chain.json`, a local store that behaves like Arkiv (read-only records, creator set by the writing wallet, expiry). To use the Arkiv Tiramisu testnet, fund both addresses printed by `npm run keys` at https://hub.arkiv.network/faucet, set `STORE_MODE=arkiv` in `.env`, and restart. The sample wards are seeded on first start.

## How it fits together

```
browser                                relayer (server/)                 Arkiv
───────                                ─────────────────                 ─────
Semaphore identity (secret stays) ──►  /api/join ── curator wallet ──►   member
photo → canvas (metadata gone) ─────►  /api/photo  (strips again, stores by sha256)
content + proof over hash(content) ►  /api/signal  checks proof, scope, nullifier,
                                        queues → shuffled batch ─ relayer wallet ─► report/seen/vote/check/post
downloads whole ward ◄──────────────── /api/ward/:ward ◄──────────────── query
verifies every record itself (shared/model.ts)
```

- `shared/records.ts`: the Arkiv schema and Semaphore scopes.
- `shared/model.ts`: the reader. It accepts curator records only from the curator wallet. It accepts signals only from the relayer wallet, with a valid proof against a known group root, unaltered content and an unused nullifier. It also computes the duty clock and vote outcomes.
- `server/index.ts`: the relayer and curator API. `server/store.ts` holds the Arkiv and local stores.
- `src/`: the Next.js app, exported as a static site. Routes live in the URL hash, which browsers never send to a server, and fonts are self-hosted by `next/font`. `src/components/` holds the pages; `src/lib/identity.ts` handles identity and proving, and `src/lib/photo.ts` handles photo cleaning and tap-to-blur.

### Semaphore scopes (one nullifier per person per scope)

| Action | Scope | Limit |
|---|---|---|
| Report, or "I've seen this too" | `report:<asset>:<month>` | Once per person per asset per month, so counts are real people |
| Vote on an action | `vote:<notice>:<action>` | One vote per action per notice |
| Confirm a repair | `check:<response>` | One answer per repair claim |
| Post | `post:<asset>:<day>:<1-3>` | Three posts per person per asset per day |

The proof's message is `hash(canonical(content))`, so the relayer can't alter what was signed. Proofs use a fixed tree depth of 16, and the proving files are served from `public/artifacts`, so no third-party request is made.

### Arkiv records

Every entity is created with `readonly: true` and `permissionlessExtension: true`, and carries `project = jawabdehi-v1-demo`.

| type | Written by | Key attributes |
|---|---|---|
| asset | curator | ward, asset, kind |
| responsibility | curator | agency, contractor, tender, dlp_end (day), repair_days |
| member | curator | group (open/verified), idx, commitment |
| notice | curator | asset, day, deadline, level, complaint |
| response | curator | notice, status, day |
| action | curator | notice, action, day |
| report / seen / vote / check / post | relayer | asset, day, nullifier, root (+ problem, severity, photo / notice, action / response, fixed) |

Dates are day numbers (IST), never times.

## Not done yet

- Contractors, tenders, clauses and costs in `shared/seed.ts` are **sample data**. Real responsibility data needs curators working from BMC tender documents.
- Records stay owned by the wallets that wrote them, so those wallets could still delete them. Deciding between a custodian multisig and an unheld owner address is still open.
- The roster (curator and relayer addresses) comes from `/api/config`. It should be published on Arkiv and pinned in the client.
- The browser reads through the relayer's cache. A "read directly from Arkiv" mode and signed ward snapshots would remove that trust.
- Photos are on local disk and load from the relayer when tapped. They need long-term content-addressed storage.
- Escalation levels are BMC's. Other agencies (Railways, MMRDA) need their own levels.
- The open group can be gamed with many identities. Vote counts show verified members separately, but thresholds don't require them yet.
- Not yet tested: proof time on low-end Android phones.
