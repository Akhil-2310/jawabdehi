# Deploying Jawabdehi

Jawabdehi runs as **one always-on container**. The relayer serves the static site (built by `next build` into `out/`), answers `/api/*`, and writes batches to Arkiv on a timer. It keeps photos, place suggestions and used invite codes on disk, so it needs a **persistent volume**. Serverless hosts (Vercel, Netlify) can't run it.

The repo has a [`Dockerfile`](Dockerfile), so any host that builds Dockerfiles works. These steps use **Railway**, the quickest from GitHub.

## Railway (about 10 minutes)

1. Sign in at https://railway.com with GitHub.
2. **New Project → Deploy from GitHub repo →** `Akhil-2310/jawabdehi`. Railway finds the Dockerfile and starts building. The first build fails or idles until the variables below are set; that's fine.
3. Open the service → **Variables** and add these, copying the values from your local `.env` (never commit them):

   | Variable | Value |
   |---|---|
   | `STORE_MODE` | `arkiv` |
   | `CURATOR_KEY` | from `.env` |
   | `RELAYER_KEY` | from `.env` |
   | `ADMIN_TOKEN` | from `.env` |
   | `INVITE_CODES` | from `.env` |
   | `BATCH_SECONDS` | `20` for live demos (`86400` = daily, the real privacy setting) |

   | `ARKIV_RPC_URL` | optional but recommended: the Tiramisu RPC URL with your access key from https://hub.arkiv.network/api-keys appended to the path. It raises Arkiv's rate limits. Shared cloud IPs hit the public limit quickly. |

   Railway sets `PORT` itself; the server reads it. `DATA_DIR` is already `/data` in the image.
4. Service → **Settings → Volumes → Add volume**, mount path **`/data`**.
5. Service → **Settings → Networking → Generate Domain**. That's your live link, e.g. `https://jawabdehi-production.up.railway.app`.
6. Optional: **Settings → Healthcheck path** `/api/health`.
7. Redeploy once. Open the link: the yellow strip should say **"● Live on Arkiv testnet"** and the ledger should show the same places as your local app.

## Before and after you deploy

- **Run only one relayer against the testnet.** Stop your local `npm run dev` (or set `STORE_MODE=local` in your local `.env`) while the live one runs. Two relayers with the same keys would collide on transaction nonces and split the queue.
- **Photos of existing demo reports** are on your Mac (`data/photos/`), not on the server. Their records and hashes are on Arkiv, so the live site shows "Photo not stored on this server" for them. New reports made on the live site store their photos on the volume.
- **Invite codes** already used locally are tracked in your local `data/`. On the server the list starts empty, so every code in `INVITE_CODES` works once there.
- **Wallet balance.** Each write costs about 0.00015 GLM. Top up the relayer and curator at https://hub.arkiv.network/faucet if they run low.
- **Privacy caveat.** The app logs no IP addresses, but the host's proxy keeps request logs. Fine for a demo; for a real launch, check the host's log settings or put a no-logs proxy in front.

## Other hosts

Any Docker host with a volume works the same way: Render (a persistent disk needs a paid plan), Fly.io (`fly launch`, then `fly volumes create data` mounted at `/data`), or a small VPS:

```bash
docker build -t jawabdehi .
docker run -d --name jawabdehi -p 80:8790 -v jawabdehi-data:/data --env-file .env jawabdehi
```

## Running the production build locally

```bash
npm run build && npm start
```

The site and API are then both at http://localhost:8790.
