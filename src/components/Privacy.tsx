"use client"

const OBSERVERS = [
  ["Anyone reading Arkiv", "The place, problem type, severity, date, photo hash, counts", "Who reported, from where, the exact time, which device"],
  ["The relayer", "That a report arrived and its content, before batching", "Your identity, your IP (not logged), links between your actions"],
  ["This website", "That a ward's data was downloaded", "Which road you looked at or reported"],
  ["BMC or the contractor", "The same as anyone reading Arkiv", "The same as anyone reading Arkiv"],
]

const MEASURES = [
  ["No accounts", "No login, phone number, OTP or email. Your browser makes an anonymous identity and keeps its secret."],
  ["Zero-knowledge proofs", "Every report, vote and post proves it came from one real member, without saying which. Nobody can vote twice, and actions on different places can't be linked."],
  ["Places, not people", "A report is attached to a road segment, never to your location. Jawabdehi never records individuals."],
  ["Clean photos", "Location, phone model and time are stripped on your device and again by the relayer. You can blur faces and plates."],
  ["Batches, dates only", "Reports are published in shuffled batches, dated by day, so they can't be matched to your movements."],
  ["Private reading", "The site downloads a whole ward and filters on your device. Pages live in the URL fragment, which browsers never send to a server."],
  ["A record nobody can edit", "Records are written read-only to Arkiv. Anyone can check who wrote them, and anyone can extend how long they're kept."],
]

const LIMITS = [
  "A note or photo showing something only you would know can still identify you.",
  "In a small lane, neighbours may guess who reported. Counts under three aren't shown exactly, but the risk remains.",
  "The relayer sees content before batching. It's open source and keeps no logs, but you have to trust it runs as published.",
  "Your network connection isn't hidden. Use Tor or a VPN if that matters to you.",
  "Anyone who gets your device's identity can link your past actions. You can wipe it at any time.",
  "Filing a complaint yourself through MyBMC links it to your phone number. Let the notifier file it instead.",
]

export function PrivacyPage() {
  return (
    <>
      <div className="page page-head">
        <p className="eyebrow">Privacy</p>
        <h1 className="display page-title">
          Report it. <em>Nobody can trace it back to you.</em>
        </h1>
        <p className="lede">
          People who push for answers on civic works have been threatened and worse. Jawabdehi is built so that there is nothing to
          hand over: no names, no numbers, no routes.
        </p>
      </div>
      <div className="page">
        <section className="section">
          <header>
            <span className="idx">01</span>
            <h2>What we do</h2>
          </header>
          <ul className="points">
            {MEASURES.map(([t, d]) => (
              <li key={t}>
                <strong>{t}</strong>
                <span className="muted">{d}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="section">
          <header>
            <span className="idx">02</span>
            <h2>Who sees what</h2>
          </header>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Can see</th>
                  <th>Cannot see</th>
                </tr>
              </thead>
              <tbody>
                {OBSERVERS.map(([who, can, cannot]) => (
                  <tr key={who}>
                    <td>{who}</td>
                    <td className="muted">{can}</td>
                    <td>{cannot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="section">
          <header>
            <span className="idx">03</span>
            <h2>Limits we state openly</h2>
          </header>
          <ol className="log">
            {LIMITS.map((l, i) => (
              <li key={i} style={{ gridTemplateColumns: "28px 1fr" }}>
                <span className="mono faint">{String(i + 1).padStart(2, "0")}</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )
}
