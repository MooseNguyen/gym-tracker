// Particle burst shown for ~1.4 s when a set beats last time.
// Loaded with import() the first time it is needed, so three.js is not in the
// main bundle. One renderer is created per burst and fully released afterwards:
// iOS Safari only allows a handful of live WebGL contexts.
import * as THREE from 'three'

const COUNT = 260
const DURATION = 1.4 // seconds
const GRAVITY = 900 // px / s²
const COLORS = [0xb5d93a, 0xd6eb9a, 0x2dd4bf, 0xffffff]

export interface Origin {
  x: number
  y: number
}

let running: { restart: (o: Origin) => void } | null = null

/** Plays the burst from `origin` (viewport px). Resolves when it is gone. */
export function playBurst(origin: Origin): Promise<void> {
  // Ticking two sets quickly restarts the same burst instead of opening a second context.
  if (running) {
    running.restart(origin)
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const w = window.innerWidth
    const h = window.innerHeight

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    const canvas = renderer.domElement
    canvas.className = 'pr-burst-canvas'
    // Decorative only: the PrBanner text carries the meaning.
    canvas.setAttribute('aria-hidden', 'true')
    document.body.appendChild(canvas)

    // Orthographic camera in CSS pixels: particle positions are plain screen coordinates.
    const camera = new THREE.OrthographicCamera(0, w, 0, -h, -1, 1)
    const scene = new THREE.Scene()

    const positions = new Float32Array(COUNT * 3)
    const velocities = new Float32Array(COUNT * 2)
    const colors = new Float32Array(COUNT * 3)
    const color = new THREE.Color()

    const reset = (o: Origin) => {
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = o.x
        positions[i * 3 + 1] = -o.y
        positions[i * 3 + 2] = 0
        const angle = Math.random() * Math.PI * 2
        const speed = 250 + Math.random() * 650
        velocities[i * 2] = Math.cos(angle) * speed
        // Bias upwards so the burst rises before gravity pulls it down.
        velocities[i * 2 + 1] = Math.sin(angle) * speed + 350
        color.setHex(COLORS[i % COLORS.length])
        colors.set([color.r, color.g, color.b], i * 3)
      }
    }
    reset(origin)

    const geometry = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(positions, 3)
    geometry.setAttribute('position', posAttr)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const texture = makeDotTexture()
    const material = new THREE.PointsMaterial({
      size: 10,
      sizeAttenuation: false, // size in px, independent of the ortho camera
      map: texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    scene.add(new THREE.Points(geometry, material))

    const timer = new THREE.Timer()
    timer.connect(document)
    let elapsed = 0
    let startedAt = performance.now()

    const tick = (timestamp: number) => {
      timer.update(timestamp)
      // Clamp: after a stall (tab switch) particles should not teleport.
      const dt = Math.min(timer.getDelta(), 1 / 20)
      elapsed += dt
      for (let i = 0; i < COUNT; i++) {
        velocities[i * 2 + 1] -= GRAVITY * dt
        positions[i * 3] += velocities[i * 2] * dt
        positions[i * 3 + 1] += velocities[i * 2 + 1] * dt
      }
      posAttr.needsUpdate = true
      // The clamp slows simulated time below 20 fps, so fade and teardown
      // also follow the wall clock: a slow device must not keep a
      // full-screen WebGL canvas alive longer than DURATION.
      const wall = (performance.now() - startedAt) / 1000
      const progress = Math.max(elapsed, wall) / DURATION
      material.opacity = Math.max(0, 1 - progress ** 2)
      renderer.render(scene, camera)
      if (progress >= 1) teardown()
    }

    const teardown = () => {
      renderer.setAnimationLoop(null)
      timer.dispose()
      geometry.dispose()
      material.dispose()
      texture.dispose()
      renderer.dispose()
      // Give the context back now instead of waiting for GC.
      renderer.forceContextLoss()
      canvas.remove()
      running = null
      resolve()
    }

    running = {
      restart: (o) => {
        reset(o)
        posAttr.needsUpdate = true
        elapsed = 0
        startedAt = performance.now()
      },
    }
    renderer.setAnimationLoop(tick)
  })
}

/** Soft round dot, drawn once on a 2D canvas instead of shipping an image. */
function makeDotTexture(): THREE.CanvasTexture {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
