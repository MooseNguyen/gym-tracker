// Slowly turning dumbbell behind the Home / Login header.
// Battery matters more than smoothness here (this is the page opened most),
// so the scene renders at ~30 fps, at most 1.5x pixel ratio, and stops
// completely when the page is hidden or the canvas is scrolled away.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const FRAME_MS = 1000 / 30

export function createHeroScene(container: HTMLElement): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.domElement.setAttribute('aria-hidden', 'true') // decorative; the page heading says it all
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envRT.texture

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  camera.position.set(0, 0.4, 6)
  camera.lookAt(0, 0, 0)

  // Rim light in the brand lime, on top of the neutral environment.
  const rim = new THREE.DirectionalLight(0xb5d93a, 3)
  rim.position.set(-3, 2, -2)
  scene.add(rim)

  // Dumbbell from primitives: no model file to download, ~1 kB of code.
  const steel = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 1, roughness: 0.25 })
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x232720,
    metalness: 0.6,
    roughness: 0.45,
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xb5d93a,
    metalness: 0.3,
    roughness: 0.35,
    emissive: 0x3f5208,
    emissiveIntensity: 0.4,
  })
  const handleGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.4, 24)
  const bigPlateGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 48)
  const smallPlateGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.12, 40)
  const collarGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 24)

  const dumbbell = new THREE.Group()
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.y = y
    dumbbell.add(m)
  }
  add(handleGeo, steel, 0)
  for (const side of [-1, 1]) {
    add(bigPlateGeo, plateMat, side * 0.62)
    add(smallPlateGeo, accentMat, side * 0.78)
    add(collarGeo, steel, side * 0.9)
  }
  dumbbell.rotation.z = Math.PI / 2 // lie horizontally
  const pivot = new THREE.Group()
  pivot.add(dumbbell)
  pivot.rotation.x = 0.35
  scene.add(pivot)

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container
    if (w === 0 || h === 0) return
    const aspect = w / h
    camera.aspect = aspect
    // Short, wide banner (Home): push the dumbbell right so it does not sit on
    // the headline. Tall hero (Login): centre it above the text.
    const wide = aspect > 1.6
    pivot.position.x = wide ? 1.35 * Math.min(aspect / 2.2, 1.4) : 0
    camera.position.z = wide ? 7.2 : 7.5
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    if (reducedMotion) renderer.render(scene, camera)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  const timer = new THREE.Timer()
  timer.connect(document)
  let elapsed = 0
  let last = 0

  const tick = (timestamp: number) => {
    if (timestamp - last < FRAME_MS) return
    last = timestamp
    timer.update(timestamp)
    elapsed += Math.min(timer.getDelta(), 0.1)
    pivot.rotation.y = elapsed * 0.45
    pivot.position.y = Math.sin(elapsed * 1.2) * 0.08
    renderer.render(scene, camera)
  }

  // Run only while visible on screen *and* the page is in the foreground.
  let onScreen = true
  const update = () => {
    const run = !reducedMotion && onScreen && document.visibilityState === 'visible'
    renderer.setAnimationLoop(run ? tick : null)
  }
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting
    update()
  })
  io.observe(container)
  document.addEventListener('visibilitychange', update)
  if (reducedMotion) renderer.render(scene, camera) // one still frame
  update()

  return () => {
    renderer.setAnimationLoop(null)
    document.removeEventListener('visibilitychange', update)
    io.disconnect()
    ro.disconnect()
    timer.dispose()
    for (const g of [handleGeo, bigPlateGeo, smallPlateGeo, collarGeo]) g.dispose()
    for (const m of [steel, plateMat, accentMat]) m.dispose()
    envRT.dispose()
    pmrem.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }
}
