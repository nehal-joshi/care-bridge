// API client. Inside Telegram it signs every request with initData; in a browser it uses a dev-only user switch.

type TelegramWebApp = {
  initData: string
  initDataUnsafe?: { start_param?: string }
  ready: () => void
  expand: () => void
  colorScheme?: 'light' | 'dark'
  HapticFeedback?: { notificationOccurred: (t: 'success' | 'warning' | 'error') => void; impactOccurred: (s: 'light' | 'medium') => void }
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
  downloadFile?: (params: { url: string; file_name: string }, callback?: (accepted: boolean) => void) => void
  isVersionAtLeast?: (version: string) => boolean
}

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
}

export const tg: TelegramWebApp | undefined = window.Telegram?.WebApp
export const inTelegram = Boolean(tg?.initData)

const DEV_USER_KEY = 'carebridge.devUser'
export function getDevUser(): string {
  try { return localStorage.getItem(DEV_USER_KEY) || 'priya' } catch { return 'priya' }
}
export function setDevUser(id: string) {
  try { localStorage.setItem(DEV_USER_KEY, id) } catch { /* private mode */ }
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('ngrok-skip-browser-warning', '1')
  if (inTelegram) headers.set('X-Telegram-Init-Data', tg!.initData)
  else headers.set('X-Dev-User', getDevUser())
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...options, headers })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    let code: string | undefined
    try {
      const body = await response.json()
      const detail = body.detail
      if (typeof detail === 'string') message = detail
      else if (detail?.message) { message = detail.message; code = detail.code }
    } catch { /* not JSON */ }
    throw new ApiError(response.status, message, code)
  }
  return response.json() as Promise<T>
}

export const post = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export function haptic(kind: 'success' | 'warning' | 'error' | 'light') {
  const h = tg?.HapticFeedback
  if (!h) return
  if (kind === 'light') h.impactOccurred('light')
  else h.notificationOccurred(kind)
}

// ---- types shared with the API ----

export type Tier = 'warning' | 'routine' | 'nice'

export type Fact = {
  id: string
  text: string
  question: string
  answer: string
  category: string
  tier: Tier
  audience: 'everyone' | 'caregivers'
  status: 'approved' | 'draft'
  source: string
  version: number
  updated_at: string
  explainer_template: string | null
  replaces_fact_id: string | null
  replaces_text?: string | null
  shifted: boolean
  created_by: string
  approved_by: string | null
}

export type CardState = {
  retrievability: number
  status: 'green' | 'amber' | 'red'
  due: string
  is_due: boolean
  last_review: string | null
}

export type Me = {
  member: { id: string; name: string; role: 'primary' | 'family' | 'aide' | 'older_adult' }
  person: { name: string; age: number; conditions: string[]; living: string; contacts: { label: string; value: string }[] }
  circle: { id: string; name: string; role: string; relation: string; connected: boolean }[]
  drafts: number
  bot_username: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  warning_signs: 'Warning signs',
  medications: 'Medicines',
  allergies: 'Allergies',
  mobility: 'Mobility',
  routines: 'Routines',
  diet: 'Food and drink',
  behaviour: 'Behaviour and comfort',
  contacts: 'Contacts',
  appointments: 'Appointments',
}

export const TIER_LABELS: Record<Tier, string> = { warning: 'Warning sign', routine: 'Routine', nice: 'Nice to know' }

export function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const minutes = Math.round(abs / 60000)
  const hours = Math.round(abs / 3600000)
  const days = Math.round(abs / 86400000)
  const text = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min` : hours < 24 ? `${hours} h` : `${days} day${days === 1 ? '' : 's'}`
  if (text === 'just now') return text
  return diff > 0 ? `in ${text}` : `${text} ago`
}

export type Schedule = {
  id: string
  category: 'medicine' | 'food' | 'health' | 'other'
  title: string
  details: string
  time: string
  days: string
  active: number
}

export type LogEntry = {
  id: number
  date: string
  schedule_id: string | null
  category: string
  title: string
  status: 'done' | 'skipped' | 'refused'
  note: string | null
  logged_by: string
  logged_by_name: string
  logged_at: string
}

export type DayView = {
  date: string
  is_today: boolean
  items: { schedule: Schedule; log: LogEntry | null }[]
  extra: LogEntry[]
  summary: { done: number; total: number; open: number }
  categories: Record<string, string>
}

export function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
