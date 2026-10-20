// Place search that forgives how people actually type Mumbai road names: "svroad", "S V Rd",
// "swami vivekanand" and "S.V. Road" should all find the same place. Runs on the device only.
import type { AssetView } from "./model"

/** Common short forms and their full names. Either side finds the other. */
const ALIASES: [string, string][] = [
  ["sv road", "swami vivekanand road"],
  ["lbs marg", "lal bahadur shastri marg"],
  ["jvlr", "jogeshwari vikhroli link road"],
  ["jvlr", "jogeshwari-vikhroli link road"],
  ["weh", "western express highway"],
  ["eeh", "eastern express highway"],
  ["fob", "foot overbridge"],
  ["rob", "road overbridge"],
  ["mg road", "mahatma gandhi road"],
  ["sv rd", "swami vivekanand road"],
]

/** Lowercase letters and digits only, in any script, so punctuation and spaces never matter. */
export function squash(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(rd)\b/g, "road")
    .replace(/[^\p{L}\p{N}]+/gu, "")
}

function expand(text: string): string {
  const low = text.toLowerCase()
  const extra = ALIASES.filter(([short, long]) => squash(low).includes(squash(short)) || squash(low).includes(squash(long))).flatMap(
    ([short, long]) => [short, long],
  )
  return [text, ...extra].join(" ")
}

/** Everything a person might search a place by, squashed. */
export function haystack(v: AssetView): string {
  return squash(
    expand(
      [v.asset.name, v.asset.stretch, v.asset.area, v.id, v.responsibility?.data.contractor, v.responsibility?.data.agency]
        .filter(Boolean)
        .join(" "),
    ),
  )
}

/** True when every word of the query appears somewhere in the place, ignoring punctuation and spacing. */
export function matches(v: AssetView, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  const hay = haystack(v)
  // The whole query squashed ("svroad"), or each word on its own ("road irla").
  if (hay.includes(squash(q))) return true
  const words = q.split(/\s+/).map(squash).filter(Boolean)
  return words.length > 1 && words.every((w) => hay.includes(w))
}
