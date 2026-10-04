import { useEffect, useState } from 'react'
import Guides from './Guides'
import HealthRecords from './HealthRecords'
import { api, haptic, post, type Me } from '../api'

type ClaimLink = { id: string; name: string; role: string; connected: boolean; telegram_id: number | null; link: string }
type SendResult = { results: { name: string; status: string }[] }

const ROLE_LABELS: Record<string, string> = {
  primary: 'Primary caregiver', family: 'Family', aide: 'Aide', older_adult: 'Ruth herself',
}

export default function Circle({ me, onReset }: { me: Me; onReset: () => void }) {
  const isPrimary = me.member.role === 'primary'
  const [links, setLinks] = useState<ClaimLink[]>([])
  const [invite, setInvite] = useState('')
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [busy, setBusy] = useState('')

  useEffect(() => { if (isPrimary) api<ClaimLink[]>('/api/claim-links').then(setLinks) }, [isPrimary])

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); haptic('success') } catch { /* clipboard blocked */ }
  }

  return (
    <div>
      <section className="profile">
        <div className="avatar large" aria-hidden>RA</div>
        <div>
          <h2>{me.person.name}</h2>
          <p className="muted">{me.person.age} · {me.person.living}</p>
          <p>{me.person.conditions.join(' · ')}</p>
        </div>
      </section>

      <section>
        <h3>Contacts</h3>
        <ul className="plain">
          {me.person.contacts.map(c => <li key={c.label}><span>{c.label}</span> <a href={`tel:${c.value}`}>{c.value}</a></li>)}
        </ul>
      </section>

      <HealthRecords />

      <Guides />

      <section>
        <h3>Care circle</h3>
        <ul className="plain">
          {me.circle.map(m => (
            <li key={m.id}>
              <span><strong>{m.name}</strong> · {m.relation}</span>
              <span className={m.connected ? 'tag ok' : 'tag'}>{m.connected ? 'On Telegram' : 'Not connected'}</span>
            </li>
          ))}
        </ul>
      </section>

      {isPrimary && (
        <>
          <section>
            <h3>Connect people</h3>
            <p className="muted small">Send each person their link. Opening it in Telegram connects their account to their place in Ruth's circle.</p>
            <ul className="plain links">
              {links.map(l => (
                <li key={l.id}>
                  <span><strong>{l.name}</strong> · {ROLE_LABELS[l.role]}{l.connected ? ` · connected (${l.telegram_id})` : ''}</span>
                  <button className="ghost small" onClick={() => copy(l.link)}>Copy link</button>
                </li>
              ))}
            </ul>
            <div className="row">
              <button className="ghost" disabled={!!busy} onClick={async () => {
                setBusy('invite')
                const r = await post<{ link: string }>('/api/invites', { role: 'aide' })
                setInvite(r.link); copy(r.link); setBusy('')
              }}>New aide invite link</button>
            </div>
            {invite && <p className="small mono">{invite}</p>}
          </section>

          <section className="demo">
            <h3>Demo controls</h3>
            <div className="row">
              <button className="primary" disabled={!!busy} onClick={async () => {
                setBusy('send')
                try { setSendResult(await post<SendResult>('/api/demo/send-briefs')); haptic('success') } finally { setBusy('') }
              }}>{busy === 'send' ? 'Sending…' : 'Send briefs now'}</button>
              <button className="ghost" disabled={!!busy} onClick={async () => {
                if (!window.confirm('Reset Ruth\'s demo data? Connected Telegram accounts stay connected.')) return
                setBusy('reset')
                try { await post('/api/demo/reset'); onReset() } finally { setBusy('') }
              }}>Reset demo data</button>
            </div>
            {sendResult && (
              <ul className="plain small">
                {sendResult.results.map(r => <li key={r.name}><span>{r.name}</span><span>{r.status}</span></li>)}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
