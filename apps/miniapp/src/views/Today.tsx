import { useCallback, useEffect, useState } from 'react'
import { api, haptic, inTelegram, localTime, post, tg, type DayView, type LogEntry, type Me, type Schedule } from '../api'

const ICONS: Record<string, string> = { medicine: '💊', food: '🍽', health: '❤', other: '•' }
const STATUS_TEXT = { done: 'Done', skipped: 'Skipped', refused: 'Refused' }
const DAY_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'mon,tue,wed,thu,fri', label: 'Weekdays' },
  { value: 'sat,sun', label: 'Weekends' },
]

function shiftDay(iso: string, by: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + by)
  return d.toISOString().slice(0, 10)
}

function dayLabel(view: DayView): string {
  const d = new Date(`${view.date}T12:00:00`)
  const label = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
  return view.is_today ? `Today, ${label}` : label
}

export default function Today({ me }: { me: Me }) {
  const [date, setDate] = useState('')
  const [view, setView] = useState<DayView | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState<'' | 'schedule' | 'entry'>('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async (d = date) => {
    setView(await api<DayView>(`/api/today${d ? `?date=${d}` : ''}`))
  }, [date])
  useEffect(() => { load() }, [load])

  if (!view) return <div className="center pad"><div className="spinner" /></div>

  async function tick(schedule: Schedule, log: LogEntry | null) {
    setBusy(schedule.id)
    try {
      if (log && log.status === 'done') await api(`/api/logs/${log.id}`, { method: 'DELETE' })
      else await post('/api/logs', { schedule_id: schedule.id, status: 'done', date: view!.date })
      haptic(log ? 'light' : 'success')
      await load()
    } finally { setBusy('') }
  }

  const pct = view.summary.total ? Math.round((100 * view.summary.done) / view.summary.total) : 0
  const groups = [
    { name: 'Morning', items: view.items.filter(i => i.schedule.time < '12:00') },
    { name: 'Afternoon', items: view.items.filter(i => i.schedule.time >= '12:00' && i.schedule.time < '17:00') },
    { name: 'Evening', items: view.items.filter(i => i.schedule.time >= '17:00') },
  ].filter(g => g.items.length)

  return (
    <div>
      <div className="day-nav">
        <button className="ghost small" aria-label="Previous day" onClick={() => { const d = shiftDay(view.date, -1); setDate(d) }}>‹</button>
        <h2>{dayLabel(view)}</h2>
        <button className="ghost small" aria-label="Next day" disabled={view.is_today}
          onClick={() => { const d = shiftDay(view.date, 1); setDate(d) }}>›</button>
      </div>

      <div className="day-progress" aria-label={`${view.summary.done} of ${view.summary.total} done`}>
        <div className="bar"><span style={{ width: `${pct}%` }} /></div>
        <span className="muted small">{view.summary.done} of {view.summary.total} done{view.summary.open ? ` · ${view.summary.open} open` : ''}</span>
      </div>

      {groups.map(g => (
        <section key={g.name} className="group">
          <h3>{g.name}</h3>
          <ul className="checklist">
            {g.items.map(({ schedule, log }) => (
              <li key={schedule.id} className={`check ${log ? log.status : 'open'}`}>
                <label className="check-row">
                  <input type="checkbox" checked={log?.status === 'done'} disabled={busy === schedule.id}
                    onChange={() => tick(schedule, log)} aria-label={`${schedule.title} done`} />
                  <span className="check-main">
                    <span className="check-title">
                      <span className="time">{schedule.time}</span> {ICONS[schedule.category]} {schedule.title}
                      {!schedule.active && <span className="tag">removed</span>}
                    </span>
                    {schedule.details && <span className="muted small">{schedule.details}</span>}
                    {log && (
                      <span className={`who ${log.status}`}>
                        {STATUS_TEXT[log.status]} by {log.logged_by_name} at {localTime(log.logged_at)}
                        {log.note ? ` · ${log.note}` : ''}
                      </span>
                    )}
                  </span>
                </label>
                <button className="link more" aria-expanded={open === schedule.id}
                  onClick={() => setOpen(open === schedule.id ? null : schedule.id)}>{open === schedule.id ? 'Close' : 'More'}</button>
                {open === schedule.id && (
                  <ItemActions schedule={schedule} log={log} date={view.date}
                    onDone={async () => { setOpen(null); await load() }} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {view.items.length === 0 && <p className="muted pad">Nothing is scheduled for this day.</p>}

      {view.extra.length > 0 && (
        <section className="group">
          <h3>Other entries</h3>
          <ul className="checklist">
            {view.extra.map(e => (
              <li key={e.id} className="check done">
                <div className="check-row">
                  <span aria-hidden>{ICONS[e.category] || '•'}</span>
                  <span className="check-main">
                    <span className="check-title">{e.title}{e.note ? `: ${e.note}` : ''}</span>
                    <span className="who done">{e.logged_by_name} at {localTime(e.logged_at)}</span>
                  </span>
                  <button className="link" onClick={async () => { await api(`/api/logs/${e.id}`, { method: 'DELETE' }); load() }}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="row">
        <button className="ghost" onClick={() => setAdding(adding === 'entry' ? '' : 'entry')}>+ Log something</button>
        <button className="ghost" onClick={() => setAdding(adding === 'schedule' ? '' : 'schedule')}>+ Add to schedule</button>
      </div>
      {adding === 'entry' && <EntryForm date={view.date} onDone={() => { setAdding(''); load() }} />}
      {adding === 'schedule' && <ScheduleForm onDone={() => { setAdding(''); load() }} />}

      {me.member.role === 'primary' && <Reports />}
    </div>
  )
}

function ItemActions({ schedule, log, date, onDone }: { schedule: Schedule; log: LogEntry | null; date: string; onDone: () => void }) {
  const [note, setNote] = useState(log?.note || '')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function setStatus(status: 'done' | 'skipped' | 'refused') {
    setBusy(true)
    try { await post('/api/logs', { schedule_id: schedule.id, status, note, date }); haptic('success'); onDone() } finally { setBusy(false) }
  }

  if (editing) return <ScheduleForm existing={schedule} onDone={onDone} />

  return (
    <div className="item-actions">
      <label className="field"><span>Note (optional)</span>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Took it later with pudding" />
      </label>
      <div className="row">
        <button className="primary small" disabled={busy} onClick={() => setStatus('done')}>Done</button>
        <button className="ghost small" disabled={busy} onClick={() => setStatus('skipped')}>Skipped</button>
        <button className="ghost small" disabled={busy} onClick={() => setStatus('refused')}>Refused</button>
        {log && <button className="ghost small" disabled={busy}
          onClick={async () => { await api(`/api/logs/${log.id}`, { method: 'DELETE' }); onDone() }}>Clear</button>}
      </div>
      {schedule.active ? (
        <div className="row">
          <button className="link" onClick={() => setEditing(true)}>Edit schedule item</button>
          <button className="link danger" onClick={async () => {
            if (!window.confirm(`Remove "${schedule.title}" from Ruth's daily schedule? Past ticks stay in reports.`)) return
            await api(`/api/schedules/${schedule.id}`, { method: 'DELETE' }); onDone()
          }}>Remove from schedule</button>
        </div>
      ) : null}
    </div>
  )
}

function ScheduleForm({ existing, onDone }: { existing?: Schedule; onDone: () => void }) {
  const [category, setCategory] = useState<Schedule['category']>(existing?.category || 'medicine')
  const [title, setTitle] = useState(existing?.title || '')
  const [details, setDetails] = useState(existing?.details || '')
  const [time, setTime] = useState(existing?.time || '09:00')
  const [days, setDays] = useState(existing?.days || 'daily')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true); setError('')
    try {
      const body = JSON.stringify({ category, title, details, time, days })
      if (existing) await api(`/api/schedules/${existing.id}`, { method: 'PATCH', body })
      else await api('/api/schedules', { method: 'POST', body })
      haptic('success'); onDone()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <section className="panel">
      <h3>{existing ? 'Edit schedule item' : 'Add to Ruth\'s daily schedule'}</h3>
      <div className="selects">
        <label className="field"><span>Type</span>
          <select value={category} onChange={e => setCategory(e.target.value as Schedule['category'])}>
            <option value="medicine">Medicine</option><option value="food">Food and drink</option>
            <option value="health">Health check</option><option value="other">Other</option>
          </select>
        </label>
        <label className="field"><span>Time</span><input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
        <label className="field"><span>Days</span>
          <select value={DAY_OPTIONS.some(d => d.value === days) ? days : 'daily'} onChange={e => setDays(e.target.value)}>
            {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </label>
      </div>
      <label className="field"><span>Name</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Blood pressure check" /></label>
      <label className="field"><span>Details</span><input value={details} onChange={e => setDetails(e.target.value)} placeholder="Dose, how, or where to write it" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button className="primary" disabled={busy || !title.trim()} onClick={save}>{existing ? 'Save' : 'Add'}</button>
        <button className="ghost" onClick={onDone}>Cancel</button>
      </div>
    </section>
  )
}

function EntryForm({ date, onDone }: { date: string; onDone: () => void }) {
  const [category, setCategory] = useState('health')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <section className="panel">
      <h3>Log something</h3>
      <div className="selects">
        <label className="field"><span>Type</span>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="health">Health check</option><option value="food">Food and drink</option>
            <option value="medicine">Medicine</option><option value="other">Other</option>
          </select>
        </label>
      </div>
      <label className="field"><span>What</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weight, Blood pressure, Snack" /></label>
      <label className="field"><span>Value or note</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. 162.4 lb, 128/82, ate half" /></label>
      <div className="row">
        <button className="primary" disabled={busy || !title.trim()} onClick={async () => {
          setBusy(true)
          try { await post('/api/logs', { category, title, note, date, status: 'done' }); haptic('success'); onDone() } finally { setBusy(false) }
        }}>Save entry</button>
        <button className="ghost" onClick={onDone}>Cancel</button>
      </div>
    </section>
  )
}

function Reports() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function download(format: 'pdf' | 'csv') {
    setBusy(true); setStatus('')
    try {
      const r = await post<{ url: string; path: string; file_name: string }>('/api/reports/link', { period, format })
      if (inTelegram && tg?.downloadFile && tg.isVersionAtLeast?.('8.0')) {
        tg.downloadFile({ url: r.url, file_name: r.file_name })
      } else if (inTelegram && tg?.openLink) {
        tg.openLink(r.url)
      } else {
        window.location.href = r.path
      }
      setStatus(`Downloading ${r.file_name}`)
    } catch (e) { setStatus((e as Error).message) } finally { setBusy(false) }
  }

  async function send() {
    setBusy(true); setStatus('')
    try {
      const r = await post<{ file_name: string }>('/api/reports/send', { period, format: 'pdf' })
      setStatus(`Sent ${r.file_name} to your Telegram chat with the bot.`)
      haptic('success')
    } catch (e) { setStatus((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <section className="panel reports">
      <h3>Reports</h3>
      <div className="chips" role="group" aria-label="Report period">
        <button className={period === 'week' ? 'chip on' : 'chip'} onClick={() => setPeriod('week')}>Last 7 days</button>
        <button className={period === 'month' ? 'chip on' : 'chip'} onClick={() => setPeriod('month')}>Last 30 days</button>
      </div>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => download('pdf')}>Download PDF</button>
        <button className="ghost" disabled={busy} onClick={() => download('csv')}>CSV</button>
        {inTelegram && <button className="ghost" disabled={busy} onClick={send}>Send to my chat</button>}
      </div>
      {status && <p className="muted small" role="status">{status}</p>}
    </section>
  )
}
