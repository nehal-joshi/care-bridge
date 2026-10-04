import { useEffect, useState } from 'react'
import { api, haptic, post, relativeTime } from '../api'

type Guide = {
  id: string
  fact_id: string | null
  fact_text: string
  title: string
  steps: number
  last_sent: string | null
  last_done: string | null
  custom?: boolean
  created_by?: string
}

export default function Guides() {
  const [guides, setGuides] = useState<Guide[] | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState('')
  const [topic, setTopic] = useState('')
  const load = () => api<Guide[]>('/api/explainers').then(setGuides).catch(() => setGuides([]))
  useEffect(() => { load() }, [])
  if (!guides) return null

  async function create() {
    setBusy('create'); setStatus('')
    try {
      const r = await post<{ title: string }>('/api/explainers/custom', { topic })
      setStatus(`Made "${r.title}". Preview it below, then send it to Ruth.`)
      setTopic(''); haptic('success'); load()
    } catch (e) { setStatus((e as Error).message) } finally { setBusy('') }
  }

  function preview(g: Guide) {
    // Keep Telegram's launch data (in the URL hash) so the guide can verify who is viewing it.
    window.location.href = `/explain/?id=${encodeURIComponent(g.id)}&preview=1${window.location.hash}`
  }

  async function send(g: Guide) {
    setBusy(g.fact_id || g.id); setStatus('')
    try {
      await post(g.custom ? `/api/explainers/${g.id}/send` : `/api/explainers/send/${g.fact_id}`)
      setStatus(`Sent "${g.title}" to Ruth. She'll see a "Show me" button in her chat.`)
      haptic('success'); load()
    } catch (e) { setStatus((e as Error).message) } finally { setBusy('') }
  }

  return (
    <section>
      <h3>Ruth's guides</h3>
      <p className="muted small">Short 3D step-by-step guides for Ruth. The bot also sends one when she asks about these topics.</p>
      <div className="panel">
        <label className="field"><span>Create a guide for any everyday task</span>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Using the phone to call Priya" />
        </label>
        <button className="primary" disabled={!!busy || topic.trim().length < 3} onClick={create}>
          {busy === 'create' ? 'Making the guide… (up to a minute)' : 'Make guide'}
        </button>
      </div>
      <ul className="plain">
        {guides.map(g => (
          <li key={g.id} className="guide">
            <span>
              <strong>{g.title}</strong>
              <span className="muted small"> · {g.steps} steps</span>
              <span className="small block">{g.custom ? `${g.fact_text}${g.created_by ? ` (by ${g.created_by})` : ''}` : `For: ${g.fact_text.length > 80 ? `${g.fact_text.slice(0, 80)}…` : g.fact_text}`}</span>
              <span className="muted small block">
                {g.last_done ? `Ruth finished it ${relativeTime(g.last_done)}` : g.last_sent ? `Sent ${relativeTime(g.last_sent)}` : 'Not sent yet'}
              </span>
            </span>
            <span className="row tight">
              <button className="ghost small" onClick={() => preview(g)}>Preview</button>
              <button className="primary small" disabled={busy === (g.fact_id || g.id)} onClick={() => send(g)}>Send to Ruth</button>
            </span>
          </li>
        ))}
      </ul>
      {status && <p className="muted small" role="status">{status}</p>}
    </section>
  )
}
