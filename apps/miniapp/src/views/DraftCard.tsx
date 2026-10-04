import { useState } from 'react'
import { CATEGORY_LABELS, TIER_LABELS, api, haptic, post, type Fact, type Tier } from '../api'

export default function DraftCard({ draft, onDone }: { draft: Fact; onDone: () => void }) {
  const [text, setText] = useState(draft.text)
  const [question, setQuestion] = useState(draft.question)
  const [answer, setAnswer] = useState(draft.answer)
  const [tier, setTier] = useState<Tier>(draft.tier)
  const [category, setCategory] = useState(draft.category)
  const [audience, setAudience] = useState(draft.audience)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function approve() {
    setBusy(true); setError('')
    try {
      await post(`/api/facts/${draft.id}/approve`, { text, question, answer, tier, category, audience })
      haptic('success')
      onDone()
    } catch (e) { setError((e as Error).message); setBusy(false) }
  }

  async function discard() {
    setBusy(true)
    await api(`/api/facts/${draft.id}`, { method: 'DELETE' })
    onDone()
  }

  return (
    <div className={`draft tier-${tier}`}>
      {draft.replaces_fact_id ? (
        <div className="update-note">
          <strong>Update to an existing fact</strong>
          <p className="before"><s>{draft.replaces_text}</s></p>
        </div>
      ) : <div className="new-note">New fact</div>}
      <label className="field"><span>Fact</span><textarea rows={2} value={text} onChange={e => setText(e.target.value)} /></label>
      <label className="field"><span>Card question</span><input value={question} onChange={e => setQuestion(e.target.value)} /></label>
      <label className="field"><span>Card answer</span><input value={answer} onChange={e => setAnswer(e.target.value)} /></label>
      <div className="selects">
        <label className="field"><span>Importance</span>
          <select value={tier} onChange={e => setTier(e.target.value as Tier)}>
            {(Object.keys(TIER_LABELS) as Tier[]).map(t => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="field"><span>Category</span>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field"><span>Who needs it</span>
          <select value={audience} onChange={e => setAudience(e.target.value as Fact['audience'])}>
            <option value="caregivers">Caregivers</option>
            <option value="everyone">Caregivers and Ruth</option>
          </select>
        </label>
      </div>
      <p className="muted small">Source: {draft.source}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button className="primary" disabled={busy || !question.trim() || !answer.trim()} onClick={approve}>
          {draft.replaces_fact_id ? 'Approve update' : 'Approve'}
        </button>
        <button className="ghost" disabled={busy} onClick={discard}>Discard</button>
      </div>
    </div>
  )
}
