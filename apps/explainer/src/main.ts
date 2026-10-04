// Ruth's explainer player. It only shows text from the validated spec; it never runs generated code.
import * as THREE from 'three'
import { TEMPLATES, type BuiltScene } from './scenes'
import './style.css'

type Step = { text: string; focus: string; action: 'tap' | 'watch' }
type Spec = { id: string; template: string; title: string; steps: Step[]; fact_id: string }

type TelegramWebApp = {
  initData: string
  ready: () => void
  expand: () => void
  close: () => void
  HapticFeedback?: { notificationOccurred: (t: 'success') => void; impactOccurred: (s: 'light') => void }
}
const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
tg?.ready()
tg?.expand()

const $ = (id: string) => document.getElementById(id)!
const titleEl = $('title')
const countEl = $('count')
const stepEl = $('step')
const hintEl = $('hint')
const nextBtn = $('next') as HTMLButtonElement
const labelsEl = $('labels')
const canvas = $('scene') as HTMLCanvasElement
const captionEl = $('caption')

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('ngrok-skip-browser-warning', '1')
  if (tg?.initData) headers.set('X-Telegram-Init-Data', tg.initData)
  else headers.set('X-Dev-User', new URLSearchParams(location.search).get('as') || 'ruth')
  const r = await fetch(path, { ...init, headers })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

function finish(spec: Spec) {
  labelsEl.innerHTML = ''
  titleEl.textContent = spec.title
  countEl.textContent = ''
  stepEl.textContent = 'You did it.'
  hintEl.textContent = 'You can come back to this guide any time from the chat.'
  const preview = new URLSearchParams(location.search).get('preview') === '1'
  nextBtn.textContent = preview ? 'Back to Care-Bridge' : 'Back to chat'
  nextBtn.onclick = () => {
    if (preview) location.href = `/?tab=circle${location.hash}`
    else if (tg) tg.close()
    else history.back()
  }
  tg?.HapticFeedback?.notificationOccurred('success')
  api(`/api/explainers/${spec.id}/done`, { method: 'POST' }).catch(() => {})
}

function runCards(spec: Spec) {
  // Fallback without WebGL: the same steps as large text cards.
  document.body.classList.add('cards')
  let i = 0
  const show = () => {
    if (i >= spec.steps.length) return finish(spec)
    countEl.textContent = `Step ${i + 1} of ${spec.steps.length}`
    stepEl.textContent = spec.steps[i].text
    hintEl.textContent = ''
    nextBtn.textContent = i === spec.steps.length - 1 ? 'Done' : 'Next'
  }
  nextBtn.onclick = () => { i += 1; show() }
  show()
}

function runScene(spec: Spec, built: BuiltScene) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const { scene, camera, objects } = built

  const resize = () => {
    const rect = canvas.parentElement!.getBoundingClientRect()
    renderer.setSize(rect.width, rect.height, false)
    camera.aspect = rect.width / rect.height
    camera.fov = camera.aspect < 0.8 ? 58 : 42
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', resize)
  resize()

  // Remember each mesh's original colour so the focus glow can be added and removed.
  const glowTargets = new Map<string, THREE.MeshStandardMaterial[]>()
  for (const [id, obj] of objects) {
    const mats: THREE.MeshStandardMaterial[] = []
    obj.group.traverse(o => {
      const m = (o as THREE.Mesh).material
      for (const each of Array.isArray(m) ? m : m ? [m] : []) {
        if (each instanceof THREE.MeshStandardMaterial) {
          const clone = each.clone()
          ;(o as THREE.Mesh).material = Array.isArray(m) ? m.map(x => (x === each ? clone : x)) : clone
          mats.push(clone)
        }
      }
    })
    glowTargets.set(id, mats)
  }

  let index = 0
  let focus = ''
  let nudge = 0
  const label = document.createElement('div')
  label.className = 'label'
  labelsEl.appendChild(label)

  const show = () => {
    if (index >= spec.steps.length) {
      focus = ''
      label.style.display = 'none'
      return finish(spec)
    }
    const step = spec.steps[index]
    focus = step.focus
    built.onFocus?.(focus)
    countEl.textContent = `Step ${index + 1} of ${spec.steps.length}`
    stepEl.textContent = step.text
    const name = objects.get(focus)?.label.toLowerCase() || 'glowing object'
    hintEl.textContent = step.action === 'tap' ? `Tap the glowing ${name}, or press Next.` : 'Watch the glowing part, then press Next.'
    nextBtn.textContent = index === spec.steps.length - 1 ? 'Done' : 'Next'
    label.textContent = objects.get(focus)?.label || ''
    label.style.display = 'block'
  }
  const advance = () => { tg?.HapticFeedback?.impactOccurred('light'); index += 1; show() }
  nextBtn.onclick = advance

  const raycaster = new THREE.Raycaster()
  canvas.addEventListener('pointerdown', ev => {
    const step = spec.steps[index]
    if (!step) return
    const rect = canvas.getBoundingClientRect()
    const pointer = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(scene.children, true).find(h => h.object.userData.objectId)
    const id = hit?.object.userData.objectId
    if (id === step.focus) advance()
    else nudge = 1 // A wrong tap is never "wrong": the right object just glows brighter for a moment.
  })

  const clock = new THREE.Clock()
  const projected = new THREE.Vector3()
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta()
    const t = clock.elapsedTime
    nudge = Math.max(0, nudge - dt)
    built.tick?.(dt)
    const pulse = 0.35 + 0.25 * Math.sin(t * 2.2) + nudge * 0.5 // slow pulse, about one cycle every 3 seconds
    for (const [id, mats] of glowTargets) {
      for (const m of mats) {
        m.emissive.set(id === focus ? 0xffb020 : 0x000000)
        m.emissiveIntensity = id === focus ? pulse : 0
      }
    }
    const caption = built.caption?.()
    captionEl.style.display = caption && focus ? 'block' : 'none'
    if (caption) { captionEl.textContent = caption.text; captionEl.classList.toggle('alert', caption.alert) }
    const obj = objects.get(focus)
    if (obj) {
      projected.copy(obj.anchor).project(camera)
      const rect = canvas.getBoundingClientRect()
      label.style.left = `${((projected.x + 1) / 2) * rect.width}px`
      label.style.top = `${((1 - projected.y) / 2) * rect.height}px`
    }
    renderer.render(scene, camera)
  })
  show()
}

async function start() {
  const id = new URLSearchParams(location.search).get('id')
  if (!id) { titleEl.textContent = 'This guide link is missing its id.'; return }
  let spec: Spec
  try {
    spec = await api<Spec>(`/api/explainers/${encodeURIComponent(id)}`)
  } catch {
    titleEl.textContent = 'This guide could not be opened.'
    stepEl.textContent = 'Please go back to the chat and ask again.'
    nextBtn.style.display = 'none'
    return
  }
  titleEl.textContent = spec.title
  const build = TEMPLATES[spec.template]
  if (!build || !webglAvailable()) return runCards(spec)
  try {
    runScene(spec, build())
  } catch {
    runCards(spec)
  }
}

start()
