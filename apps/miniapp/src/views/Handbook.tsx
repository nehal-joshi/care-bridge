import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_LABELS, TIER_LABELS, api, haptic, post, type Fact, type Me } from '../api'
import DraftCard from './DraftCard'

type UploadResult = { drafts: Fact[]; already_known: string[]; cached?: boolean; record?: { record_type: string; record_date: string; flagged: unknown[] } | null; record_status?: string }

export default function Handbook({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const [facts, setFacts] = useState<Fact[] | null>(null)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const canEdit = me.member.role === 'primary' || me.member.role === 'family'
  const isPrimary = me.member.role === 'primary'

  const load = () => api<Fact[]>('/api/facts').then(setFacts)
  useEffect(() => { load() }, [])

  const approved = useMemo(() => (facts || []).filter(f => f.status === 'approved'), [facts])
  const drafts = useMemo(() => (facts || []).filter(f => f.status === 'draft'), [facts])
  const visible = approved.filter(f =>
    (!category || f.category === category) &&
    (!q || `${f.text} ${f.answer} ${f.source}`.toLowerCase().includes(q.toLowerCase())))
  const categories = Array.from(new Set(approved.map(f => f.category)))
  const grouped = categories
    .filter(c => visible.some(f => f.category === c))
    .sort((a, b) => (a === 'warning_signs' ? -1 : b === 'warning_signs' ? 1 : 0))

  const changed = () => { load(); onChanged() }

  if (!facts) return <div className="center pad"><div className="spinner" /></div>

  return (
    <div>
      <div className="section-head">
        <h2>Ruth's handbook</h2>
        {canEdit && <button className="primary small" onClick={() => setAdding(a => !a)}>{adding ? 'Close' : '+ Add'}</button>}
      </div>

      {adding && <AddPanel isPrimary={isPrimary} onDone={changed} />}

      {isPrimary && drafts.length > 0 && (
        <section className="drafts">
          <h3>Waiting for your approval ({drafts.length})</h3>
          <p className="muted small">Gemma drafted these. Nothing reaches the circle until you approve it.</p>
          {drafts.map(d => <DraftCard key={d.id} draft={d} onDone={changed} />)}
        </section>
      )}

      <input className="search" type="search" placeholder="Search the handbook" value={q} onChange={e => setQ(e.target.value)} aria-label="Search the handbook" />
      <div className="chips" role="group" aria-label="Filter by category">
        <button className={category === '' ? 'chip on' : 'chip'} onClick={() => setCategory('')}>All</button>
        {categories.map(c => (
          <button key={c} className={category === c ? 'chip on' : 'chip'} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c] || c}
          </button>
        ))}
      </div>

      {grouped.map(c => (
        <section key={c} className="group">
          <h3>{CATEGORY_LABELS[c] || c}</h3>
          {visible.filter(f => f.category === c).map(f => (
            editing === f.id
              ? <EditFact key={f.id} fact={f} onDone={() => { setEditing(null); changed() }} />
              : (
                <div key={f.id} className={`fact tier-${f.tier}`}>
                  <p>{f.text}</p>
                  <div className="fact-meta">
                    <span className={`tier tier-${f.tier}`}>{TIER_LABELS[f.tier]}</span>
                    {f.audience === 'everyone' && <span className="tag">Ruth knows too</span>}
                    {f.shifted && <span className="tag shift">Caregivers hold this</span>}
                    <span className="muted small">{f.source}{f.approved_by ? ` · approved by ${f.approved_by}` : ''}</span>
                  </div>
                  {canEdit && <button className="link" onClick={() => setEditing(f.id)}>Edit</button>}
                </div>
              )
          ))}
        </section>
      ))}
      {grouped.length === 0 && <p className="muted pad">No facts match.</p>}
    </div>
  )
}

function AddPanel({ isPrimary, onDone }: { isPrimary: boolean; onDone: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'' | 'text' | 'pdf'>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function addText() {
    setBusy('text'); setError('')
    try {
      await post<Fact>('/api/facts', { text })
      setText('')
      setMessage(isPrimary ? 'Drafted. Review it below, then approve.' : 'Sent to Priya for approval.')
      haptic('success')
      onDone()
    } catch (e) { setError((e as Error).message) } finally { setBusy('') }
  }

  async function upload(file: File) {
    setBusy('pdf'); setError(''); setMessage('')
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await api<UploadResult>('/api/documents', { method: 'POST', body: form })
      if (r.record_status) {
        setMessage(r.record
          ? `${r.record_status === 'already_saved' ? 'Already in' : 'Saved to'} Ruth's health records: ${r.record.record_type}, ${r.record.record_date}, ${r.record.flagged.length} out of range. See the Ruth tab.`
          : "That photo doesn't look like a medical document, so nothing was saved.")
        haptic('success'); onDone(); return
      }
      setMessage(`${r.drafts.length} draft ${r.drafts.length === 1 ? 'fact' : 'facts'} to review. ` +
        `${r.already_known.length} ${r.already_known.length === 1 ? 'instruction is' : 'instructions are'} already in the handbook.`)
      haptic('success')
      onDone()
    } catch (e) { setError((e as Error).message) } finally {
      setBusy('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section className="panel">
      <label className="field">
        <span>Type a fact about Ruth</span>
        <textarea rows={3} value={text} onChange={e => setText(e.target.value)}
          placeholder="e.g. Her hearing aid batteries are in the top kitchen drawer; change them every Monday." />
      </label>
      <button className="primary" disabled={!text.trim() || !!busy} onClick={addText}>
        {busy === 'text' ? 'Drafting the card…' : 'Draft card'}
      </button>
      {isPrimary && (
        <>
          <div className="or">or</div>
          <label className={`upload ${busy === 'pdf' ? 'busy' : ''}`}>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" disabled={!!busy}
              onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            {busy === 'pdf'
              ? <><div className="spinner small" /> Gemma is reading it. This takes up to a minute.</>
              : <>Upload a discharge PDF, care plan, or a photo of a lab report</>}
          </label>
        </>
      )}
      {message && <p className="ok" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

function EditFact({ fact, onDone }: { fact: Fact; onDone: () => void }) {
  const [text, setText] = useState(fact.text)
  const [question, setQuestion] = useState(fact.question)
  const [answer, setAnswer] = useState(fact.answer)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await api(`/api/facts/${fact.id}`, { method: 'PATCH', body: JSON.stringify({ text, question, answer }) })
      haptic('success')
      onDone()
    } finally { setBusy(false) }
  }

  return (
    <div className="fact editing">
      <label className="field"><span>Fact</span><textarea rows={3} value={text} onChange={e => setText(e.target.value)} /></label>
      <label className="field"><span>Card question</span><input value={question} onChange={e => setQuestion(e.target.value)} /></label>
      <label className="field"><span>Card answer</span><input value={answer} onChange={e => setAnswer(e.target.value)} /></label>
      <p className="muted small">Saving marks this as changed for everyone in Ruth's circle.</p>
      <div className="row">
        <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save change'}</button>
        <button className="ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}
