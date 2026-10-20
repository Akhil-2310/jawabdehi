<p align="center"><img src="public/brand/jawabdehi-logo-on-light.png" alt="Jawabdehi — जवाबदेही" width="520"></p>

<p align="center"><b>Potholes don't fix themselves. Somebody was paid to.</b></p>

**Jawabdehi** (जवाबदेही, "accountability") lets Mumbai residents report a broken road, footpath or bridge anonymously, see who was paid to fix it, give the authority a public deadline, and act together when it's missed. Every record lives on [Arkiv](https://docs.arkiv.network/), and every anonymous action carries a [Semaphore](https://docs.semaphore.pse.dev/) zero-knowledge proof.

- **Live app:** https://jawabdehi-production.up.railway.app/
- **Video demo:** https://youtu.be/KEK9Q9vg2sw
- **Arkiv schema:** [`arkiv/schema.md`](arkiv/schema.md) · **Friction report:** [`arkiv/friction.md`](arkiv/friction.md)

[![Watch the Jawabdehi demo](https://img.youtube.com/vi/KEK9Q9vg2sw/maxresdefault.jpg)](https://youtu.be/KEK9Q9vg2sw)

## The problem

Mumbai reports the same failures every monsoon: over **59,000 potholes** in 2023 alone, by BMC's own data. Pedestrians were **44%** of the city's road deaths in 2023. In 2025 the Bombay High Court ordered **₹6 lakh** compensation for every pothole death and called BMC's repair claims "a mere eyewash".

Three things keep it from changing:
- **Nobody can see who's responsible.** Roads are built by contractors under tenders with a *defect liability period*, a warranty during which the contractor must repair defects at their own cost. Residents never see the contractor, the tender or the warranty, so repairs fall back on public money or don't happen.
- **Warnings leave no trace.** BMC's channels (the MyBMC MARG app, WhatsApp, the 1916 helpline) are run by the authority being complained about, which can close or dispute complaints.
- **Speaking up is dangerous.** Every BMC complaint is tied to a phone number through OTP. At least 107 people have been killed for seeking information under the RTI Act, Maharashtra reports the most attacks, and the Whistle Blowers Protection Act has never been brought into force.

## The solution

1. **Report.** A photo and a place, with no name, number or login. Photo metadata is stripped on the device, faces and number plates can be blurred, and personal details in notes are blocked. The report is attached to the road, never to you.
2. **See who's responsible.** Each place shows the agency, contractor, tender number and warranty, each with its source: "Under warranty until 2027. The contractor pays for this repair."
3. **Start the clock.** A notifier files the generated complaint (English and Marathi) with BMC and records the complaint number. The repair deadline is public from day one.
4. **Act together.** If the deadline passes, residents vote anonymously to escalate, invoke the warranty, file an RTI or go to the press. Each action needs 5 votes, then a partner carries it out and it's added to the record. If the authority claims a repair, residents confirm or dispute it.

**Why it's trustworthy:**
- **Nobody can trace you.** No accounts or phone numbers. Each action carries a zero-knowledge proof that a real member sent it, never which one. A relayer writes to Arkiv in shuffled batches dated by day only, so no resident wallet is involved and timing reveals nothing.
- **Nobody can fake the count.** Semaphore nullifiers allow one report per person per place per month, and one vote per action.
- **Nobody can quietly edit.** Records are written read-only to Arkiv, and contract facts count only if the curator's wallet signed them. Every visitor's browser re-verifies every proof and signature itself.

## Try it

- **Use the live app:** https://jawabdehi-production.up.railway.app/. Select **Report** to file a report and watch it go to Arkiv. Open **LBS Marg** for a place that's past its deadline, with residents voting.
- **Check the data with no keys:** `npm install && npm run inspect` reads every Jawabdehi record straight from the Arkiv Tiramisu testnet and re-verifies every Semaphore proof.
- **See the transactions:** the [relayer wallet](https://tiramisu.explorer.arkiv.network/address/0xE3dD9266BAd4eD9879FB34CdB80BbfCC1f90dAC2) writes residents' anonymous actions; the [curator wallet](https://tiramisu.explorer.arkiv.network/address/0x807A75B1981B167f06c0bC9a5B1Fa55511609A9f) writes places, contracts, members, notices and responses.

Contractors, tenders and clauses in the demo are **sample data**, marked as such throughout the app.

## Run it locally

```bash
npm install
npm run keys     # creates .env: two testnet wallets, an admin token, invite codes
npm run dev      # relayer on :8790, Next.js on :5173
npm run demo     # in another terminal: 7 anonymous residents play the full loop
```

Open http://localhost:5173. The curator console is at `#/admin` (token in `.env`). The demo uses the first two invite codes in `.env`.

By default records go to `data/local-chain.json`, a local store that behaves like Arkiv (read-only records, creator set by the writing wallet, expiry). To use the Arkiv Tiramisu testnet, fund both addresses printed by `npm run keys` at https://hub.arkiv.network/faucet, set `STORE_MODE=arkiv` in `.env`, and restart. The sample wards are seeded on first start.

For production, `npm run build` writes a static site to `out/` and `npm start` runs the relayer, which serves it on :8790. To put it online, see [DEPLOY.md](DEPLOY.md).

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

Every entity is created with `readonly: true` and `permissionlessExtension: true`, and carries `project = jawabdehi-v1-demo`. Full details in [`arkiv/schema.md`](arkiv/schema.md).

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
- Filing with BMC is manual: a curator files the complaint and records the complaint number. Automatic filing is the next build.
- Records stay owned by the wallets that wrote them, so those wallets could still delete them. Deciding between a custodian multisig and an unheld owner address is still open.
- The roster (curator and relayer addresses) comes from `/api/config`. It should be published on Arkiv and pinned in the client.
- The browser reads through the relayer's cache. A "read directly from Arkiv" mode and signed ward snapshots would remove that trust.
- Photos are on the relayer's disk. They need long-term content-addressed storage.
- Escalation levels are BMC's. Other agencies (Railways, MMRDA) need their own levels.
- The open group can be gamed with many identities. Vote counts show verified members separately, but thresholds don't require them yet.
- Not yet tested: proof time on low-end Android phones.

## Credits

Jawabdehi complements BMC's own channels and detection tools like Pothole Reporter by Gaurav Sen; any of them can write to the same open record.
