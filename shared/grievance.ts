// Complaint text that cites the asset, the contract and the count of independent reports.
import { COUNT_DISPLAY_MIN, ESCALATION_LEVELS, PROBLEMS } from "./config"
import type { AssetView } from "./model"
import { formatDay, today } from "./util"

export function grievance(v: AssetView, level = 0): { en: string; mr: string } {
  const r = v.responsibility?.data
  const problems = [...new Set(v.reports.map((x) => PROBLEMS[x.content.problem].label.toLowerCase()))]
  const what = problems.length ? problems.join(", ") : "damage"
  const people = v.people.total
  const to = ESCALATION_LEVELS[Math.min(level, ESCALATION_LEVELS.length - 1)]
  const under = v.warranty.state === "active" && v.warranty.endDay != null
  const earlier = v.notices.at(-1)

  const en = [
    `To: ${to}, ${r?.wardOffice ?? `BMC ${v.ward} ward`}`,
    ``,
    `Subject: ${what} on ${v.asset.name} (${v.asset.stretch}) — asset ${v.id}`,
    ``,
    people >= COUNT_DISPLAY_MIN
      ? `${people} residents have independently reported ${what} on this ${v.asset.kind} as of ${formatDay(today())}.`
      : `Residents have reported ${what} on this ${v.asset.kind} as of ${formatDay(today())}.`,
    r?.contractor && r.tender
      ? `The work was executed by ${r.contractor} under tender/work order ${r.tender}${r.completed ? `, completed ${r.completed}` : ""}.`
      : `Please state the agency and contractor responsible for this stretch.`,
    under
      ? `It is within the defect liability period until ${formatDay(v.warranty.endDay!)}. Under the contract the contractor must repair it at their own cost${r?.repairDays ? `, within ${r.repairDays} days of notice` : ""}.`
      : ``,
    earlier && level > 0
      ? `This was first notified on ${formatDay(earlier.day)} (complaint ${earlier.data.complaint}); the deadline of ${formatDay(earlier.deadline)} has passed without repair.`
      : ``,
    ``,
    `Please repair it, recover the cost from the contractor where the warranty applies, and record your response.`,
    `Public record: Jawabdehi asset ${v.id} on Arkiv.`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n")

  const mr = [
    `प्रति: ${to}, ${r?.wardOffice ?? `बृहन्मुंबई महानगरपालिका ${v.ward} विभाग`}`,
    ``,
    `विषय: ${v.asset.name} (${v.asset.stretch}) येथील नुकसान — मालमत्ता ${v.id}`,
    ``,
    people >= COUNT_DISPLAY_MIN
      ? `${formatDay(today())} पर्यंत ${people} नागरिकांनी स्वतंत्रपणे या ठिकाणच्या नुकसानीची तक्रार केली आहे.`
      : `${formatDay(today())} पर्यंत नागरिकांनी या ठिकाणच्या नुकसानीची तक्रार केली आहे.`,
    r?.contractor && r.tender ? `हे काम ${r.contractor} यांनी निविदा/कार्यादेश ${r.tender} अंतर्गत केले आहे.` : ``,
    under
      ? `हे काम ${formatDay(v.warranty.endDay!)} पर्यंत दोष दायित्व कालावधीत आहे. करारानुसार कंत्राटदाराने स्वखर्चाने दुरुस्ती करणे आवश्यक आहे.`
      : ``,
    ``,
    `कृपया दुरुस्ती करावी, लागू असल्यास खर्च कंत्राटदाराकडून वसूल करावा आणि आपला प्रतिसाद नोंदवावा.`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n")

  return { en, mr }
}
