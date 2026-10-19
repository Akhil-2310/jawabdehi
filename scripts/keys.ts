// Creates .env with fresh testnet wallets and an admin token, if .env does not exist yet.
import { existsSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts"

if (existsSync(".env")) {
  console.log(".env already exists — leaving it alone.")
  process.exit(0)
}

const curator = generatePrivateKey()
const relayer = generatePrivateKey()
writeFileSync(
  ".env",
  `# local = JSON file that mimics Arkiv; arkiv = Arkiv Tiramisu testnet (fund both addresses first)
STORE_MODE=local

# Testnet-only wallets. Curator writes assets, responsibility, members, notices, responses, actions.
# Relayer writes anonymous signals (reports, votes, posts, repair checks).
CURATOR_KEY=${curator}
RELAYER_KEY=${relayer}

# Token for the curator admin page (#/admin)
ADMIN_TOKEN=${randomBytes(18).toString("base64url")}

# How often the relayer writes its queue as one batch. Use 86400 (daily) in production.
BATCH_SECONDS=20

# One-time invite codes for the "verified resident" group, comma-separated
INVITE_CODES=${Array.from({ length: 5 }, () => randomBytes(4).toString("hex")).join(",")}
`,
)
console.log("Wrote .env")
console.log("Curator address:", privateKeyToAddress(curator))
console.log("Relayer address:", privateKeyToAddress(relayer))
console.log("Fund both at https://hub.arkiv.network/faucet to use STORE_MODE=arkiv.")
