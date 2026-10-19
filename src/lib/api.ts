// Loads a ward's records and turns them into verified views, entirely in the browser. We always
// download the whole ward, so the server can't tell which road a visitor cares about.
import { useCallback, useEffect, useState } from "react"
import { type AssetView, buildGroups, buildWard, type GroupState, type Roster } from "../../shared/model"
import type { Rec } from "../../shared/records"

export type Config = {
  mode: "local" | "arkiv"
  project: string
  roster: Roster
  batchSeconds: number
  nextBatchAt: number
  rpc: string | null
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status)
  return body as T
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export const postJson = <T>(path: string, body: unknown, headers: Record<string, string> = {}) =>
  getJson<T>(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) })

let configPromise: Promise<Config> | null = null
export function getConfig() {
  configPromise ??= getJson<Config>("/api/config")
  configPromise.catch(() => (configPromise = null))
  return configPromise
}

export async function loadGroups(): Promise<GroupState> {
  const [config, members] = await Promise.all([getConfig(), getJson<Rec[]>("/api/members")])
  return buildGroups(members, config.roster)
}

export type WardData = { views: AssetView[]; recordCount: number; groups: GroupState; config: Config }

export function useWard(ward: string) {
  const [data, setData] = useState<WardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [config, groups, recs] = await Promise.all([getConfig(), loadGroups(), getJson<Rec[]>(`/api/ward/${ward}`)])
        const views = await buildWard(recs, groups, config.roster)
        if (live) {
          setData({ views, recordCount: recs.length, groups, config })
          setError(null)
        }
      } catch (e) {
        if (live) setError((e as Error).message)
      }
    })()
    return () => {
      live = false
    }
  }, [ward, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, refresh }
}
