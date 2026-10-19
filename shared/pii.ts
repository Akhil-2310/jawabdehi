// Personal-data filter for notes and posts. Runs in the browser before submitting, and again on
// the relayer. Hard patterns block; soft phrases only warn, because name detection is unreliable.

const BLOCK: { label: string; pattern: RegExp }[] = [
  { label: "an email address", pattern: /[\w.+-]+@[\w-]+\.[\w.]+/i },
  { label: "a phone number", pattern: /(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/ },
  { label: "an Aadhaar number", pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
  { label: "a PAN", pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/i },
  { label: "a vehicle number", pattern: /\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{3,4}\b/i },
]

const WARN: { label: string; pattern: RegExp }[] = [
  {
    label: "It mentions your own home, shop or building, which neighbours could recognise",
    pattern: /\b(my|our)\s+(shop|house|home|flat|building|society|office|gate|stall)\b/i,
  },
  {
    label: "It may name a person. Describe the problem, not people",
    pattern: /\b(mr|mrs|ms|shri|smt|dr)\.?\s+[A-Z][a-z]+/,
  },
  {
    label: "It mentions a time of day, which can link the report to your movements",
    pattern: /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i,
  },
]

export type PiiResult = { blocked: string[]; warnings: string[] }

export function checkText(text: string): PiiResult {
  return {
    blocked: BLOCK.filter((b) => b.pattern.test(text)).map((b) => b.label),
    warnings: WARN.filter((w) => w.pattern.test(text)).map((w) => w.label),
  }
}
