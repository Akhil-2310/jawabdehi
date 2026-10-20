// Read-only: pulls Jawabdehi's records straight from the Arkiv Tiramisu testnet and verifies them
// the way every visitor's browser does. Needs no keys and no relayer. Run: npm run inspect
import { WARDS } from "../shared/config"
import { buildGroups, buildWard, type Roster } from "../shared/model"
import { queryArkiv } from "../server/store"

const roster: Roster = {
  curator: process.env.CURATOR_ADDRESS ?? "0x807A75B1981B167f06c0bC9a5B1Fa55511609A9f",
  relayer: process.env.RELAYER_ADDRESS ?? "0xE3dD9266BAd4eD9879FB34CdB80BbfCC1f90dAC2",
}

const all = await queryArkiv()
const byType = new Map<string, number>()
for (const r of all) byType.set(String(r.attrs.type), (byType.get(String(r.attrs.type)) ?? 0) + 1)
console.log(`${all.length} live records with project = jawabdehi-v1-demo on Arkiv Tiramisu`)
console.log([...byType].map(([t, n]) => `  ${t}: ${n}`).join("\n"))

const strangers = all.filter((r) => ![roster.curator, roster.relayer].some((a) => a.toLowerCase() === r.creator.toLowerCase()))
console.log(`\nWritten by the curator or relayer wallet: ${all.length - strangers.length}; by anyone else (ignored): ${strangers.length}`)

const groups = buildGroups(all.filter((r) => r.attrs.type === "member"), roster)
console.log(`Semaphore groups rebuilt from member records: open ${groups.members.open.length}, verified ${groups.members.verified.length}\n`)

for (const w of WARDS) {
  const views = await buildWard(all.filter((r) => r.attrs.ward === w.id), groups, roster)
  console.log(`${w.name}`)
  for (const v of views) {
    const votes = Object.entries(v.votes).filter(([, x]) => x.count.total).map(([a, x]) => `${a} ${x.count.total}${x.passed ? " (passed)" : ""}`)
    console.log(
      `  ${v.id.padEnd(10)} ${v.asset.name.padEnd(34)} ${v.status.stage.padEnd(9)} people ${String(v.people.total).padStart(2)}` +
        `  proofs ok ${v.reports.length + v.seen.length + v.posts.length + Object.values(v.votes).reduce((n, x) => n + x.count.total, 0)}` +
        `  rejected ${v.rejected.length}${votes.length ? `  votes: ${votes.join(", ")}` : ""}`,
    )
  }
}
console.log("\nEvery anonymous action above passed Semaphore proof verification on this machine.")
process.exit(0)
