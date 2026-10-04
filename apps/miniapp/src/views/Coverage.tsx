import { useEffect, useState } from 'react'
import { api, relativeTime, type CardState } from '../api'

type Cell = CardState & { member_id: string; name: string; role: string }
type CoverageData = {
  members: { id: string; name: string; role: string }[]
  rows: { fact: { id: string; text: string; shifted: boolean }; ruth_signal: string | null; cells: Cell[] }[]
  alerts: { fact_id: string; text: string; message: string }[]
  thresholds: { green: number; amber: number }
}

const STATUS_TEXT = { green: 'Knows it', amber: 'Fading', red: 'Likely forgotten' }

export default function Coverage() {
  const [data, setData] = useState<CoverageData | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { api<CoverageData>('/api/coverage').then(setData) }, [])
  if (!data) return <div className="center pad"><div className="spinner" /></div>

  return (
    <div>
      <h2>Who remembers Ruth's warning signs?</h2>
      <p className="muted small">Each dot is Care-Bridge's estimate, from FSRS, of whether that person would remember the warning sign today.</p>

      {data.alerts.map(a => (
        <div key={a.fact_id} className="alert" role="alert">
          <strong>Coverage gap</strong>
          <p>{a.message}</p>
          <p className="small">"{a.text}"</p>
        </div>
      ))}

      <div className="coverage">
        <div className="cov-head">
          <span />
          {data.members.map(m => <span key={m.id} className="cov-name">{m.name}</span>)}
        </div>
        {data.rows.map(r => (
          <div key={r.fact.id} className="cov-row-wrap">
            <button className="cov-row" onClick={() => setOpen(open === r.fact.id ? null : r.fact.id)} aria-expanded={open === r.fact.id}>
              <span className="cov-fact">{r.fact.text}</span>
              {r.cells.map(c => (
                <span key={c.member_id} className="cov-cell" title={`${c.name}: ${STATUS_TEXT[c.status]}`}>
                  <span className={`dot big ${c.status}`} />
                  <span className="pct">{Math.floor(c.retrievability * 100)}%</span>
                </span>
              ))}
            </button>
            {r.fact.shifted && (
              <div className="shift-note">
                <strong>Responsibility shifted to caregivers.</strong> {r.ruth_signal || 'Ruth is no longer reliably holding this.'} Care-Bridge now aims for 99% recall in the circle and shows it in briefs more often.
              </div>
            )}
            {open === r.fact.id && (
              <ul className="cov-detail">
                {r.cells.map(c => (
                  <li key={c.member_id}>
                    <span className={`dot ${c.status}`} /> <strong>{c.name}</strong>: {STATUS_TEXT[c.status]}
                    {c.last_review ? `, last reviewed ${relativeTime(c.last_review)}` : ', never reviewed'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="legend">
        <span><span className="dot green" /> Knows it ({Math.round(data.thresholds.green * 100)}%+)</span>
        <span><span className="dot amber" /> Fading</span>
        <span><span className="dot red" /> Likely forgotten (under {Math.round(data.thresholds.amber * 100)}%)</span>
      </div>
    </div>
  )
}
