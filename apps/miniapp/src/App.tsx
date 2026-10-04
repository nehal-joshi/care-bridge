import { useCallback, useEffect, useState } from 'react'
import { ApiError, api, getDevUser, inTelegram, setDevUser, type Me } from './api'
import Brief from './views/Brief'
import Changes from './views/Changes'
import Circle from './views/Circle'
import Coverage from './views/Coverage'
import Handbook from './views/Handbook'
import Today from './views/Today'

type Tab = 'today' | 'brief' | 'handbook' | 'coverage' | 'changes' | 'circle'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '☑' },
  { id: 'brief', label: 'Brief', icon: '◷' },
  { id: 'handbook', label: 'Handbook', icon: '▤' },
  { id: 'coverage', label: 'Coverage', icon: '◉' },
  { id: 'changes', label: 'Changes', icon: '↻' },
  { id: 'circle', label: 'Ruth', icon: '♡' },
]

const DEV_USERS = [
  { id: 'priya', label: 'Priya' },
  { id: 'marcus', label: 'Marcus' },
  { id: 'dev', label: 'Dev' },
]

function initialTab(): Tab {
  const fromUrl = new URLSearchParams(window.location.search).get('tab') as Tab | null
  if (fromUrl && TABS.some(t => t.id === fromUrl)) return fromUrl
  return 'today'
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [devUser, setDevUserState] = useState(getDevUser())
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const data = await api<Me>('/api/me')
      setMe(data)
      setError(null)
      return data
    } catch (e) {
      setError(e as ApiError)
      return null
    }
  }, [])

  useEffect(() => {
    load().then(() => setTab(initialTab()))
  }, [load, devUser])

  const refresh = () => { setRefreshKey(k => k + 1); load() }

  if (error) {
    return (
      <div className="screen center">
        <div className="empty">
          <h1>Care-Bridge</h1>
          <p>{error.code === 'not_in_circle' ? error.message : error.message || 'Something went wrong.'}</p>
          {!inTelegram && <p className="muted">Open this from the Care-Bridge bot in Telegram.</p>}
        </div>
      </div>
    )
  }
  if (!me) return <div className="screen center"><div className="spinner" aria-label="Loading" /></div>

  if (me.member.role === 'older_adult') {
    return (
      <div className="screen center">
        <div className="empty large">
          <h1>Hello, Ruth</h1>
          <p>You can talk to me in the Telegram chat any time.</p>
        </div>
      </div>
    )
  }

  const isPrimary = me.member.role === 'primary'

  return (
    <div className="app">
      <header className="topbar">
        <div className="person">
          <div className="avatar" aria-hidden>RA</div>
          <div>
            <div className="person-name">{me.person.name}, {me.person.age}</div>
            <div className="person-sub">{me.person.conditions.join(' · ')}</div>
          </div>
        </div>
        <div className="viewer">
          {inTelegram ? (
            <span className="pill">{me.member.name}</span>
          ) : (
            <select
              aria-label="View as (development only)"
              value={devUser}
              onChange={e => { setDevUser(e.target.value); setDevUserState(e.target.value) }}
            >
              {DEV_USERS.map(u => <option key={u.id} value={u.id}>View as {u.label}</option>)}
            </select>
          )}
        </div>
      </header>

      <main className="content" key={`${tab}-${devUser}-${refreshKey}`}>
        {tab === 'today' && <Today me={me} />}
        {tab === 'brief' && <Brief me={me} />}
        {tab === 'handbook' && <Handbook me={me} onChanged={refresh} />}
        {tab === 'coverage' && <Coverage />}
        {tab === 'changes' && <Changes />}
        {tab === 'circle' && <Circle me={me} onReset={refresh} />}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'handbook' && isPrimary && me.drafts > 0 && <span className="badge">{me.drafts}</span>}
          </button>
        ))}
      </nav>
    </div>
  )
}
