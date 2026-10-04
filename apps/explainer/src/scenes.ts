// Fixed scene templates. Object ids must match TEMPLATES in services/api/app/main.py.
// Everything is built from simple shapes in code, so scenes load fast on older phones.
import * as THREE from 'three'

export type SceneObject = { id: string; label: string; group: THREE.Object3D; anchor: THREE.Vector3; button?: boolean }
export type BuiltScene = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  objects: Map<string, SceneObject>
  onFocus?: (id: string) => void
  caption?: () => { text: string; alert: boolean } | null
  tick?: (t: number) => void
  hitId?: (hit: THREE.Intersection) => string | undefined
}

const mat = (color: number, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness })

function box(w: number, h: number, d: number, color: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function room(scene: THREE.Scene, floorColor: number, wallColor: number) {
  scene.background = new THREE.Color(0xf4efe6)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mat(floorColor, 0.95))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), mat(wallColor, 1))
  wall.position.set(0, 3.5, -3)
  wall.receiveShadow = true
  scene.add(wall)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cbb5, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 1.8)
  sun.position.set(3, 7, 5)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  scene.add(sun)
}

function register(objects: Map<string, SceneObject>, id: string, label: string, group: THREE.Object3D, anchorY: number) {
  group.traverse(o => { o.userData.objectId = id })
  const anchor = new THREE.Vector3()
  new THREE.Box3().setFromObject(group).getCenter(anchor)
  anchor.y = anchorY
  objects.set(id, { id, label, group, anchor })
}

function textTexture(lines: { text: string; color: string; size: number }[], bg = '#1d2b22') {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 256, 128)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => {
    ctx.fillStyle = l.color
    ctx.font = `bold ${l.size}px -apple-system, Helvetica, sans-serif`
    ctx.fillText(l.text, 128, lines.length === 1 ? 64 : 40 + i * 50)
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function weighIn(): BuiltScene {
  const scene = new THREE.Scene()
  room(scene, 0xdfe7ea, 0xeef3f5)
  const objects = new Map<string, SceneObject>()

  // Bathroom scale with a number display.
  const scale = new THREE.Group()
  const base = box(1.6, 0.18, 1.6, 0xfafafa)
  base.position.y = 0.09
  scale.add(base)
  const pad = box(1.3, 0.02, 0.9, 0xd9dee2)
  pad.position.set(0, 0.19, 0.2)
  scale.add(pad)
  scale.position.set(-0.5, 0, 1.3)
  scene.add(scale)
  register(objects, 'scale', 'Scale', scale, 0.15)

  const displayMat = new THREE.MeshBasicMaterial({ map: textTexture([{ text: '160 lb', color: '#8cf5b0', size: 54 }]) })
  const display = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.35), [mat(0x333333), mat(0x333333), displayMat, mat(0x333333), mat(0x333333), mat(0x333333)])
  display.position.set(-0.5, 0.21, 0.85)
  scene.add(display)
  register(objects, 'display', 'Number', display, 0.45)

  // Fridge with the weight sheet.
  const fridge = new THREE.Group()
  const body = box(1.5, 3.4, 1.2, 0xe9ecef)
  body.position.y = 1.7
  fridge.add(body)
  const handle = box(0.06, 0.8, 0.08, 0x9aa3ab)
  handle.position.set(0.6, 2.2, 0.62)
  fridge.add(handle)
  fridge.position.set(1.4, 0, -2.2)
  scene.add(fridge)
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8),
    new THREE.MeshBasicMaterial({ map: textTexture([{ text: 'Weight', color: '#333', size: 34 }, { text: 'Fri 160', color: '#555', size: 30 }], '#fffdf3') }))
  sheet.position.set(1.2, 2.1, -1.59)
  scene.add(sheet)
  register(objects, 'sheet', 'Weight sheet', sheet, 2.6)

  // Side table with a phone.
  const table = box(1.3, 1.1, 0.9, 0xb98b5e)
  table.position.set(-1.6, 0.55, -1.7)
  scene.add(table)
  const phone = new THREE.Group()
  const handset = box(0.36, 0.06, 0.7, 0x22262b)
  phone.add(handset)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), new THREE.MeshBasicMaterial({ color: 0x5aa7ff }))
  screen.rotation.x = -Math.PI / 2
  screen.position.y = 0.035
  phone.add(screen)
  phone.position.set(-1.6, 1.14, -1.6)
  phone.rotation.y = 0.3
  scene.add(phone)
  register(objects, 'phone', 'Phone', phone, 1.5)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(0, 4.4, 7.6)
  camera.lookAt(0, 1.0, -0.3)

  let rising = -1
  let shown = 160
  return {
    scene, camera, objects,
    caption() {
      if (rising < 0) return null
      return shown > 163 ? { text: `${shown} lb · up 4 since yesterday`, alert: true } : { text: `${shown} lb`, alert: false }
    },
    onFocus(id) { if (id === 'display' && rising < 0) rising = 0 },
    tick(dt) {
      if (rising < 0 || rising > 1) return
      rising = Math.min(1.01, rising + dt / 2.5)
      const value = Math.round(160 + 4 * Math.min(1, rising))
      shown = value
      const lines = [{ text: `${value} lb`, color: value > 163 ? '#ffb3a7' : '#8cf5b0', size: 50 }]
      if (value > 163) lines.push({ text: '+4 since yesterday', color: '#ffb3a7', size: 22 })
      displayMat.map?.dispose()
      displayMat.map = textTexture(lines)
      displayMat.needsUpdate = true
    },
  }
}

export function standSafely(): BuiltScene {
  const scene = new THREE.Scene()
  room(scene, 0xd9c7ae, 0xf1e9dc)
  const objects = new Map<string, SceneObject>()

  // Armchair.
  const chair = new THREE.Group()
  const seat = box(1.8, 0.5, 1.6, 0x6f8fb3)
  seat.position.y = 0.75
  chair.add(seat)
  const back = box(1.8, 1.6, 0.35, 0x6f8fb3)
  back.position.set(0, 1.5, -0.65)
  chair.add(back)
  for (const x of [-0.95, 0.95]) {
    const arm = box(0.3, 0.6, 1.6, 0x5c7a9c)
    arm.position.set(x, 1.15, 0)
    chair.add(arm)
  }
  for (const [x, z] of [[-0.75, -0.65], [0.75, -0.65], [-0.75, 0.65], [0.75, 0.65]]) {
    const leg = box(0.15, 0.5, 0.15, 0x3d3229)
    leg.position.set(x, 0.25, z)
    chair.add(leg)
  }
  chair.position.set(0, 0, -1.2)
  scene.add(chair)
  register(objects, 'chair', 'Chair', chair, 2.4)

  // Walker in front of the chair, with two brake levers.
  const walker = new THREE.Group()
  const frameMat = mat(0xa9b4bf, 0.35)
  const tube = (len: number) => new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 12), frameMat)
  for (const x of [-0.75, 0.75]) {
    for (const z of [-0.35, 0.35]) {
      const leg = tube(1.9)
      leg.position.set(x, 0.95, z)
      walker.add(leg)
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 20), mat(0x2b2b2b))
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.16, z)
      walker.add(wheel)
    }
    const side = tube(0.8)
    side.rotation.x = Math.PI / 2
    side.position.set(x, 1.9, 0)
    walker.add(side)
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 16), mat(0x2f3a45))
    grip.rotation.x = Math.PI / 2
    grip.position.set(x, 1.93, 0.15)
    walker.add(grip)
  }
  const cross = tube(1.5)
  cross.rotation.z = Math.PI / 2
  cross.position.set(0, 1.2, -0.35)
  walker.add(cross)
  walker.position.set(0, 0, 1.0)
  scene.add(walker)
  register(objects, 'walker', 'Walker', walker, 2.4)

  const brakes = new THREE.Group()
  for (const x of [-0.75, 0.75]) {
    const lever = box(0.16, 0.12, 0.45, 0xd64545)
    lever.position.set(x, 1.8, 1.3)
    lever.rotation.x = -0.35
    brakes.add(lever)
  }
  scene.add(brakes)
  register(objects, 'brakes', 'Brakes', brakes, 2.2)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(3.2, 4.2, 6.4)
  camera.lookAt(0, 1.1, 0)

  let locked = -1
  return {
    scene, camera, objects,
    onFocus(id) { if (id === 'chair' && locked < 0) locked = 0 },
    tick(dt) {
      // Once Ruth reaches the "stand up" step, the levers show as pressed down (locked).
      if (locked < 0 || locked > 1) return
      locked = Math.min(1.01, locked + dt / 0.8)
      brakes.children.forEach(l => { l.rotation.x = -0.35 + 0.35 * Math.min(1, locked) })
    },
  }
}



// ---------- kit: guides planned by Gemma from a fixed set of object kinds ----------

export type KitSpec = {
  objects: { id: string; kind: string; label: string }[]
  phone_buttons: { id: string; label: string; color: string }[]
}

const BUTTON_FILL: Record<string, string> = { green: '#1f9d55', red: '#d64545', blue: '#2f6fde', grey: '#4b5563' }
const TABLETOP = new Set(['cup', 'kettle', 'pill_box', 'keys', 'glasses', 'tv_remote', 'plate', 'clock', 'lamp', 'phone'])

function cyl(r: number, h: number, color: number, segments = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), mat(color))
  m.castShadow = true
  return m
}

function kind(kindName: string): THREE.Group {
  const g = new THREE.Group()
  const add = (m: THREE.Object3D, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); g.add(m); return m }
  switch (kindName) {
    case 'chair':
      add(box(1.2, 0.3, 1.1, 0x6f8fb3), 0, 0.75); add(box(1.2, 1.2, 0.25, 0x6f8fb3), 0, 1.4, -0.45)
      for (const [x, z] of [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45], [0.5, 0.45]]) add(box(0.12, 0.6, 0.12, 0x3d3229), x, 0.3, z)
      break
    case 'table':
      add(box(2.4, 0.12, 1.4, 0xb98b5e), 0, 1.0)
      for (const [x, z] of [[-1.05, -0.6], [1.05, -0.6], [-1.05, 0.6], [1.05, 0.6]]) add(box(0.12, 1.0, 0.12, 0x8a6544), x, 0.5, z)
      break
    case 'bed':
      add(box(2.2, 0.5, 3.0, 0xe9e4da), 0, 0.45); add(box(2.2, 0.3, 0.5, 0xffffff), 0, 0.85, -1.1); add(box(2.3, 1.0, 0.15, 0x8a6544), 0, 0.7, -1.55)
      break
    case 'cup':
      add(cyl(0.22, 0.4, 0xf4f1ea), 0, 0.2); add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 8, 16), mat(0xf4f1ea)), 0.28, 0.22)
      break
    case 'kettle':
      add(cyl(0.35, 0.6, 0xc9d1d9), 0, 0.3); add(cyl(0.12, 0.08, 0x2b2b2b), 0, 0.64); add(box(0.1, 0.4, 0.1, 0x2b2b2b), 0.4, 0.4)
      break
    case 'pill_box': {
      const colors = [0xef4444, 0xf59e0b, 0xeab308, 0x22c55e, 0x3b82f6, 0x8b5cf6, 0xec4899]
      add(box(1.6, 0.18, 0.4, 0xf8fafc), 0, 0.09)
      colors.forEach((c, i) => add(box(0.2, 0.05, 0.36, c), -0.66 + i * 0.22, 0.2))
      break
    }
    case 'door':
      add(box(1.2, 2.6, 0.12, 0x9a7b5a), 0, 1.3); add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), mat(0xd4af37)), 0.45, 1.3, 0.1)
      break
    case 'keys':
      add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 20), mat(0xd4af37)), 0, 0.03).rotateX(Math.PI / 2)
      add(box(0.06, 0.03, 0.35, 0xc0c0c0), 0.05, 0.03, 0.25); add(box(0.06, 0.03, 0.3, 0xd4af37), -0.08, 0.03, 0.22)
      break
    case 'glasses':
      for (const x of [-0.17, 0.17]) { const lens = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 24), mat(0x111111)); lens.position.set(x, 0.14, 0); g.add(lens) }
      add(box(0.12, 0.02, 0.02, 0x111111), 0, 0.14)
      break
    case 'scale':
      add(box(1.2, 0.15, 1.2, 0xfafafa), 0, 0.08); add(box(0.5, 0.03, 0.25, 0x333333), 0, 0.17, -0.3)
      break
    case 'walker':
      for (const x of [-0.6, 0.6]) for (const z of [-0.3, 0.3]) add(cyl(0.04, 1.6, 0xa9b4bf, 10), x, 0.8, z)
      add(box(1.25, 0.06, 0.06, 0xa9b4bf), 0, 1.0, -0.3)
      for (const x of [-0.6, 0.6]) add(box(0.1, 0.08, 0.7, 0x2f3a45), x, 1.62)
      break
    case 'tv_remote':
      add(box(0.25, 0.08, 0.8, 0x1f2937), 0, 0.04); add(box(0.08, 0.02, 0.08, 0xd64545), 0, 0.09, -0.28)
      break
    case 'clock':
      add(cyl(0.45, 0.1, 0xf8fafc, 32), 0, 0.5).rotateX(Math.PI / 2)
      add(box(0.04, 0.3, 0.02, 0x111111), 0, 0.62, 0.06); add(box(0.22, 0.04, 0.02, 0x111111), 0.1, 0.5, 0.06)
      break
    case 'lamp':
      add(cyl(0.25, 0.08, 0x374151), 0, 0.04); add(cyl(0.04, 0.9, 0x374151, 10), 0, 0.5)
      add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 24, 1, true), mat(0xfde68a)), 0, 1.05)
      break
    case 'plate':
      add(cyl(0.45, 0.05, 0xffffff, 32), 0, 0.03)
      break
    case 'phone':
    default:
      add(box(0.36, 0.06, 0.7, 0x22262b), 0, 0.03)
      break
  }
  return g
}

function screenTexture(buttons: KitSpec['phone_buttons'], focus: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, 512, 1024)
  ctx.fillStyle = '#e2e8f0'
  ctx.font = 'bold 44px -apple-system, Helvetica, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 256, 90)
  const rects: { id: string; y0: number; y1: number }[] = []
  const n = Math.max(1, buttons.length)
  const top = 150, gap = 30, height = Math.min(170, (1024 - top - 60 - gap * (n - 1)) / n)
  buttons.forEach((b, i) => {
    const y = top + i * (height + gap)
    ctx.fillStyle = BUTTON_FILL[b.color] || BUTTON_FILL.grey
    ctx.beginPath()
    ctx.roundRect(40, y, 432, height, 36)
    ctx.fill()
    if (b.id === focus) {
      ctx.lineWidth = 14
      ctx.strokeStyle = '#ffb020'
      ctx.stroke()
    }
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.min(64, height * 0.42)}px -apple-system, Helvetica, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(b.label, 256, y + height / 2)
    rects.push({ id: b.id, y0: y / 1024, y1: (y + height) / 1024 })
  })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, rects }
}

export function kit(spec: KitSpec): BuiltScene {
  const scene = new THREE.Scene()
  room(scene, 0xe7e1d6, 0xf3eee6)
  const objects = new Map<string, SceneObject>()
  const phoneObj = spec.objects.find(o => o.kind === 'phone')
  const hero = Boolean(phoneObj && spec.phone_buttons.length)
  const others = spec.objects.filter(o => !(hero && o.kind === 'phone'))
  const needsTable = others.some(o => TABLETOP.has(o.kind)) && !others.some(o => o.kind === 'table')
  let tableTop = 0
  if (needsTable || hero) {
    const t = kind('table')
    t.position.set(0, 0, hero ? -1.2 : 0)
    scene.add(t)
    tableTop = 1.06
  }

  // Lay the objects out in a row, small things on the table and furniture on the floor.
  const spacing = hero ? 1.0 : 1.6
  others.forEach((o, i) => {
    const g = kind(o.kind)
    const onTable = TABLETOP.has(o.kind) && (needsTable || hero)
    const x = (i - (others.length - 1) / 2) * spacing
    g.position.set(x, onTable ? tableTop : 0, hero ? -1.2 : onTable ? 0 : 0.6)
    if (o.kind === 'table') tableTop = 1.06
    scene.add(g)
    const top = new THREE.Box3().setFromObject(g).max.y
    register(objects, o.id, o.label, g, top + 0.25)
  })

  let redraw: ((focus: string) => void) | undefined
  let screen: THREE.Mesh | undefined
  let rects: { id: string; y0: number; y1: number }[] = []
  if (hero && phoneObj) {
    // A large phone standing up, facing the reader, so its buttons can be read and tapped.
    const phone = new THREE.Group()
    const body = box(1.3, 2.5, 0.12, 0x111827)
    phone.add(body)
    const drawn = screenTexture(spec.phone_buttons, '')
    rects = drawn.rects
    const screenMat = new THREE.MeshBasicMaterial({ map: drawn.texture })
    screen = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.3), screenMat)
    screen.position.z = 0.065
    phone.add(screen)
    phone.position.set(0, 1.9, 0.6)
    phone.rotation.x = -0.12
    scene.add(phone)
    register(objects, phoneObj.id, phoneObj.label, phone, 3.25)
    phone.updateMatrixWorld(true)
    for (const r of rects) {
      // Each button is its own focus target; its anchor is the button's middle, on the screen.
      const local = new THREE.Vector3(0.5, 1.15 - ((r.y0 + r.y1) / 2) * 2.3, 0.07)
      const marker = new THREE.Object3D()
      marker.position.copy(local)
      phone.add(marker)
      marker.updateMatrixWorld(true)
      const anchor = new THREE.Vector3()
      marker.getWorldPosition(anchor)
      const label = spec.phone_buttons.find(b => b.id === r.id)?.label || r.id
      objects.set(r.id, { id: r.id, label, group: marker, anchor, button: true })
    }
    redraw = (focus: string) => {
      const next = screenTexture(spec.phone_buttons, focus)
      screenMat.map?.dispose()
      screenMat.map = next.texture
      screenMat.needsUpdate = true
    }
  }

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  if (hero) {
    camera.position.set(0, 2.2, 3.9)
    camera.lookAt(0, 1.85, 0)
  } else {
    const width = Math.max(3, others.length * spacing)
    camera.position.set(0, 3.6 + width * 0.25, 5.5 + width * 0.6)
    camera.lookAt(0, 0.9, 0)
  }

  return {
    scene, camera, objects,
    onFocus(id) { redraw?.(id) },
    hitId(hit) {
      if (screen && hit.object === screen && hit.uv) {
        const y = 1 - hit.uv.y
        return rects.find(r => y >= r.y0 && y <= r.y1)?.id ?? phoneObj?.id
      }
      return hit.object.userData.objectId
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TEMPLATES: Record<string, (spec: any) => BuiltScene> = { weigh_in: weighIn, stand_safely: standSafely, kit }
