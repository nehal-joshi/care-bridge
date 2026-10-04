import { useEffect, useState } from 'react'
import { api, relativeTime } from '../api'

type Event = {
  id: number
  type: string
  actor: string
  fact_id: string | null
  fact_text: string | null
  details: Record<string, string | number | boolean | string[]>
  created_at: string
}

function describe(e: Event): { icon: string; title: string; body?: string; before?: string } {
  switch (e.type) {
    case 'fact_changed':
      return { icon: '✎', title: `${e.actor} changed a fact`, body: String(e.details.after ?? e.fact_text ?? ''),
               before: e.details.before ? String(e.details.before) : undefined }
    case 'fact_added':
      return { icon: '+', title: `${e.actor} added a fact`, body: String(e.details.text ?? e.fact_text ?? '') }
    case 'document_uploaded':
      return { icon: '⎙', title: `${e.actor} uploaded ${e.details.filename}`,
               body: `${e.details.drafts} drafts to review, ${e.details.already_known} already in the handbook` }
    case 'older_adult_message': {
      const flags = [e.details.emergency ? 'Emergency' : '', e.details.asks_for_person ? 'Asked for someone' : '',
        e.details.feeling_unwell ? 'Feeling unwell' : ''].filter(Boolean).join(' · ')
      return { icon: '!', title: `Ruth in chat${flags ? ` · ${flags}` : ''}`, body: String(e.details.summary ?? '') }
    }
    case 'circle_notified': {
      const told = Array.isArray(e.details.told) ? (e.details.told as unknown as string[]).join(', ') : ''
      return { icon: '✉', title: `${e.details.urgent ? 'Urgent: ' : ''}Circle told${told ? ` (${told})` : ''}`,
               body: String(e.details.summary ?? '') }
    }
    case 'chat_fact_draft':
      return { icon: '✎', title: `${e.actor} shared a fact in chat, waiting for Priya's approval`, body: String(e.details.text ?? '') }
    case 'schedule_added':
      return { icon: '+', title: `${e.actor} added ${e.details.time} ${e.details.title} to the daily schedule`, body: String(e.details.details ?? '') }
    case 'schedule_changed':
      return { icon: '✎', title: `${e.actor} changed a daily schedule item`, body: String(e.details.after ?? ''),
               before: e.details.before ? String(e.details.before) : undefined }
    case 'schedule_removed':
      return { icon: '−', title: `${e.actor} removed ${e.details.title} from the daily schedule` }
    case 'log_refused':
      return { icon: '!', title: `Ruth refused ${e.details.title} (logged by ${e.actor})`, body: String(e.details.note ?? '') }
    case 'older_adult_signal':
      return { icon: '!', title: 'Ruth needed help with her care plan', body: String(e.details.summary ?? '') }
    case 'responsibility_shift':
      return { icon: '⇄', title: 'Caregivers now hold this fact', body: e.fact_text ?? undefined }
    case 'explainer_done':
      return { icon: '▶', title: `${e.actor} finished a guide`, body: String(e.details.title ?? '') }
    case 'member_joined':
      return { icon: '☺', title: String(e.details.summary ?? `${e.actor} joined`) }
    default:
      return { icon: '•', title: e.type }
  }
}

export default function Changes() {
  const [events, setEvents] = useState<Event[] | null>(null)
  useEffect(() => { api<Event[]>('/api/changes').then(setEvents) }, [])
  if (!events) return <div className="center pad"><div className="spinner" /></div>
  return (
    <div>
      <h2>What changed</h2>
      {events.length === 0 && <p className="muted">No changes yet.</p>}
      <ol className="feed">
        {events.map(e => {
          const d = describe(e)
          return (
            <li key={e.id} className={`feed-item ${e.type}`}>
              <span className="feed-icon" aria-hidden>{d.icon}</span>
              <div>
                <div className="feed-title">{d.title} <span className="muted small">· {relativeTime(e.created_at)}</span></div>
                {d.before && <p className="before"><s>{d.before}</s></p>}
                {d.body && <p>{d.body}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
