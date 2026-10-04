import { useEffect, useState } from 'react'
import { api } from '../api'

type Finding = { name: string; value: string; unit: string; reference_range: string; flag: string }
type HealthRecord = {
  id: string
  record_type: string
  record_date: string
  source: string
  ordered_by: string
  summary: string
  shared_by: string
  origin: string
  findings: Finding[]
  flagged: Finding[]
}

export default function HealthRecords() {
  const [records, setRecords] = useState<HealthRecord[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { api<HealthRecord[]>('/api/records').then(setRecords).catch(() => setRecords([])) }, [])
  if (!records) return null

  return (
    <section>
      <h3>Health records</h3>
      {records.length === 0 && (
        <p className="muted small">Send a photo of a lab report or doctor's letter to the bot, or upload one in Handbook → Add.</p>
      )}
      <ul className="plain records">
        {records.map(r => (
          <li key={r.id} className="record">
            <button className="record-head" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span>
                <strong>{r.record_type}</strong>
                <span className="muted small"> · {r.record_date}{r.source ? ` · ${r.source}` : ''}</span>
              </span>
              <span className={r.flagged.length ? 'tag warn' : 'tag ok'}>
                {r.flagged.length ? `${r.flagged.length} out of range` : 'All in range'}
              </span>
            </button>
            {r.flagged.length > 0 && (
              <ul className="flags">
                {r.flagged.map(f => (
                  <li key={f.name}><strong>{f.name}</strong> {f.value} {f.unit}
                    <span className={`flag ${f.flag}`}> {f.flag}</span>
                    <span className="muted small"> (range {f.reference_range})</span></li>
                ))}
              </ul>
            )}
            {open === r.id && (
              <div className="record-all">
                <table>
                  <thead><tr><th>Test</th><th>Result</th><th>Range</th></tr></thead>
                  <tbody>
                    {r.findings.map(f => (
                      <tr key={f.name} className={f.flag !== 'normal' ? 'out' : ''}>
                        <td>{f.name}</td><td>{f.value} {f.unit}</td><td>{f.reference_range}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted small">
                  Shared by {r.shared_by} {r.origin === 'chat' ? 'in Telegram chat' : 'in Care-Bridge'}
                  {r.ordered_by ? ` · ordered by ${r.ordered_by}` : ''}. Read by Gemma from the photo; check the original
                  and ask her doctor what the results mean.
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
