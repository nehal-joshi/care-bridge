// Fixed scene templates. Object ids must match TEMPLATES in services/api/app/main.py.
// Everything is built from simple shapes in code, so scenes load fast on older phones.
import * as THREE from 'three'

export type SceneObject = { id: string; label: string; group: THREE.Object3D; anchor: THREE.Vector3 }
export type BuiltScene = {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  objects: Map<string, SceneObject>
  onFocus?: (id: string) => void
  caption?: () => { text: string; alert: boolean } | null
  tick?: (t: number) => void
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

export const TEMPLATES: Record<string, () => BuiltScene> = { weigh_in: weighIn, stand_safely: standSafely }
