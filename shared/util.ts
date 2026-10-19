import { keccak256, toBytes } from "viem"

/** Hash any string into the BN254 scalar field, the way Semaphore hashes messages. */
export function hashToField(text: string): bigint {
  return BigInt(keccak256(toBytes(text))) >> 8n
}

/** JSON with sorted keys, so the same content always hashes the same. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** A field element as 0x-prefixed 32-byte hex, for bytes32 attributes. */
export function fieldToHex(value: string | bigint): `0x${string}` {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`
}

// Dates are stored as whole days (IST), never times, so records can't be matched to movements.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function today(): number {
  return Math.floor((Date.now() + IST_OFFSET_MS) / DAY_MS)
}

export function dayFromISO(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS)
}

export function dayToISO(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function formatDay(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** "2026-10", used in report scopes: one report per person per asset per month. */
export function monthOf(day: number): string {
  return dayToISO(day).slice(0, 7)
}
