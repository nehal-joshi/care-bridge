import { useEffect, useState } from 'react'
import { TIER_LABELS, api, haptic, post, relativeTime, type CardState, type Fact, type Me } from '../api'

type Item = { fact: Fact; state: CardState; changed: boolean; before?: string | null }
type BriefData = { items: Item[]; total_due: number; next_due: string | null }
type ReviewResult = {
  rating?: string
  grade?: { grade: 'correct' | 'partial' | 'incorrect'; confidence: number; by: string } | null
  answer: string
  state?: CardState
  needs_self_rating?: boolean
}

const GRADE_TEXT = { correct: 'Correct', partial: 'Partly right', incorrect: 'Not quite' }
const RATINGS = [
  { rating: 'again', label: "Didn't know" },
  { rating: 'hard', label: 'Partly' },
  { rating: 'good', label: 'Knew it' },
]

export default function Brief({ me }: { me: Me }) {
  const [data, setData] = useState<BriefData | null>(null)
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState<{ fact: Fact; rating: string }[]>([])
  const [startedAt] = useState(Date.now())

  useEffect(() => { api<BriefData>('/api/brief').then(setData) }, [])

  if (!data) return <div className="center pad"><div className="spinner" /></div>

  if (data.items.length === 0) {
    return (
      <div className="empty">
        <h2>You're all caught up</h2>
        <p>Nothing about Ruth is due for you right now.</p>
        {data.next_due && <p className="muted">Next card {relativeTime(data.next_due)}.</p>}
      </div>
    )
  }

  if (index >= data.items.length) {
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    return (
      <div className="empty">
        <div className="done-mark" aria-hidden>✓</div>
        <h2>Brief done in {seconds} seconds</h2>
        <p>{done.length} {done.length === 1 ? 'item' : 'items'} about Ruth. Care-Bridge will bring each back just before you're likely to forget it.</p>
        <ul className="done-list">
          {done.map(d => (
            <li key={d.fact.id}><span className={`dot ${d.rating === 'again' ? 'red' : d.rating === 'hard' ? 'amber' : 'green'}`} />{d.fact.text}</li>
          ))}
        </ul>
      </div>
    )
  }

  const item = data.items[index]
  return (
    <div>
      <div className="brief-head">
        <h2>{me.member.name}'s brief for Ruth</h2>
        <div className="progress" aria-label={`Card ${index + 1} of ${data.items.length}`}>
          {data.items.map((_, i) => <span key={i} className={i < index ? 'step done' : i === index ? 'step now' : 'step'} />)}
        </div>
      </div>
      <BriefCard
        key={item.fact.id}
        item={item}
        onNext={(rating) => { setDone(d => [...d, { fact: item.fact, rating }]); setIndex(i => i + 1) }}
      />
    </div>
  )
}

function BriefCard({ item, onNext }: { item: Item; onNext: (rating: string) => void }) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(item.changed)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [busy, setBusy] = useState(false)
  const { fact } = item

  async function submit(body: { rating?: string; answer_text?: string }) {
    setBusy(true)
    try {
      const r = await post<ReviewResult>('/api/reviews', { fact_id: fact.id, ...body })
      if (r.needs_self_rating) {
        setRevealed(true)
      } else {
        setResult(r)
        haptic(r.rating === 'again' ? 'warning' : 'success')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`card tier-${fact.tier}`}>
      <div className="card-meta">
        <span className={`tier tier-${fact.tier}`}>{TIER_LABELS[fact.tier]}</span>
        {fact.shifted && <span className="tag shift">Ruth isn't holding this alone</span>}
      </div>

      {item.changed ? (
        <div className="changed">
          <div className="changed-label">Changed since your last brief</div>
          {item.before && <p className="before"><s>{item.before}</s></p>}
          <p className="after">{fact.text}</p>
          <p className="muted small">Source: {fact.source}</p>
        </div>
      ) : (
        <p className="question">{fact.question}</p>
      )}

      {!revealed && !result && !item.changed && (
        <>
          <label className="field">
            <span>Your answer (optional)</span>
            <textarea rows={2} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type what you remember…" />
          </label>
          <div className="row">
            {answer.trim() ? (
              <button className="primary" disabled={busy} onClick={() => submit({ answer_text: answer })}>
                {busy ? 'Checking…' : 'Check my answer'}
              </button>
            ) : (
              <button className="primary" onClick={() => { setRevealed(true); haptic('light') }}>Show answer</button>
            )}
          </div>
        </>
      )}

      {(revealed || result) && !item.changed && (
        <div className="answer">
          <div className="answer-label">Answer</div>
          <p>{fact.answer}</p>
          <p className="muted small">Source: {fact.source}</p>
        </div>
      )}

      {result ? (
        <div className={`result ${result.rating}`}>
          {result.grade && (
            <p><strong>{GRADE_TEXT[result.grade.grade]}.</strong> <span className="muted small">Checked by Laya</span></p>
          )}
          {result.state && <p className="muted">You'll see this again {relativeTime(result.state.due)}.</p>}
          <button className="primary" onClick={() => onNext(result.rating || 'good')}>Next</button>
        </div>
      ) : revealed ? (
        <div>
          <p className="muted small">{item.changed ? 'Got it?' : 'How did you do?'}</p>
          <div className="rating-row">
            {(item.changed ? [{ rating: 'good', label: 'Got it' }] : RATINGS).map(r => (
              <button key={r.rating} className={`rate ${r.rating}`} disabled={busy} onClick={() => submit({ rating: r.rating })}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}
