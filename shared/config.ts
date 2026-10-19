// Product constants shared by the relayer and the web app.

/** Every Arkiv entity and query carries this, so we never mix with other projects' data. */
export const PROJECT = "jawabdehi-v1-demo"

/** Votes needed before an action counts as passed. */
export const ACTION_VOTES_NEEDED = 5

/** Report counts below this are shown as "fewer than N", so a quiet lane can't single anyone out. */
export const COUNT_DISPLAY_MIN = 3

/** Max posts per person per asset per day (Semaphore post slots). */
export const POST_SLOTS = 3

export const WARDS = [
  { id: "S", name: "S ward", area: "Bhandup, Powai, Kanjurmarg, Vikhroli" },
  { id: "KW", name: "K-West ward", area: "Andheri West, Juhu, Versova" },
] as const

export type WardId = (typeof WARDS)[number]["id"]

export const ASSET_KINDS = {
  road: "Road",
  footpath: "Footpath",
  bridge: "Bridge / foot overbridge",
} as const

export type AssetKind = keyof typeof ASSET_KINDS

export const PROBLEMS = {
  pothole: { label: "Pothole", kinds: ["road"], slaDays: 7 },
  surface: { label: "Surface damage", kinds: ["road"], slaDays: 15 },
  footpath_broken: { label: "Broken or missing footpath", kinds: ["footpath"], slaDays: 15 },
  footpath_blocked: { label: "Footpath obstruction", kinds: ["footpath"], slaDays: 7 },
  bridge_damage: { label: "Visible bridge damage", kinds: ["bridge"], slaDays: 3 },
} as const satisfies Record<string, { label: string; kinds: AssetKind[]; slaDays: number }>

export type ProblemType = keyof typeof PROBLEMS

/** The fixed menu of things residents can vote to do once a deadline is missed. */
export const ACTIONS = {
  escalate: {
    label: "Escalate to the next officer",
    detail: "A complaint goes one level up, citing the missed deadline. A new deadline starts.",
  },
  warranty: {
    label: "Invoke the warranty",
    detail: "A formal demand that the contractor repairs at their own cost under the defect liability clause.",
  },
  rti: {
    label: "File an RTI request",
    detail: "A partner organisation (never a reporter) asks for inspection and repair records.",
  },
  press: {
    label: "Take it to the press",
    detail: "A ready-made summary with a link to this record goes to partner journalists.",
  },
} as const

export type ActionType = keyof typeof ACTIONS

export const ESCALATION_LEVELS = [
  "Ward office (Assistant Engineer, Roads)",
  "Assistant Commissioner of the ward",
  "Deputy Municipal Commissioner of the zone",
] as const

export const RESPONSE_STATUSES = {
  acknowledged: "Acknowledged",
  repaired: "Says repaired",
  disputed: "Disputed the complaint",
} as const

export type ResponseStatus = keyof typeof RESPONSE_STATUSES

export const GROUPS = {
  open: "Citizen-reported",
  verified: "Verified resident",
} as const

export type GroupId = keyof typeof GROUPS

/** Semaphore tree depth we prove at; one fixed artifact set, up to 65,536 members per group. */
export const TREE_DEPTH = 16

/** How long each record type lives on Arkiv, in days. */
export const LIFETIME_DAYS = {
  asset: 365 * 5,
  responsibility: 365 * 5,
  member: 365 * 5,
  notice: 365 * 5,
  response: 365 * 5,
  action: 365 * 5,
  report: 365,
  seen: 365,
  vote: 365,
  check: 365,
  post: 90,
} as const

export type RecordType = keyof typeof LIFETIME_DAYS
