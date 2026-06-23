import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide } from 'three'
import { uniform, vec3, sin, float, Fn, vec2, dot, floor, fract, mix, uv, positionLocal, cos } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { Mesh } from 'three'

const time = uniform(0)

const PA = vec3(0.7, 0.7, 0.7)
const PB = vec3(0.3, 0.3, 0.3)
const PC = vec3(1.0, 1.0, 1.0)
const PD = vec3(1.0, 3.0, 2.0)

const hash3 = Fn(([p]: [ReturnType<typeof vec3>]) => {
  const pp = p.mul(vec3(123.34, 345.45, 234.56)).fract().toVar()
  pp.addAssign(dot(pp, pp.add(34.345)))
  return pp.x.mul(pp.y).mul(pp.z).fract()
})

const vnoise3 = Fn(([p]: [ReturnType<typeof vec3>]) => {
  const i = floor(p)
  const f = fract(p)
  const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)))

  // 8 corners of the unit cube
  const c000 = hash3(i.add(vec3(0, 0, 0)))
  const c100 = hash3(i.add(vec3(1, 0, 0)))
  const c010 = hash3(i.add(vec3(0, 1, 0)))
  const c110 = hash3(i.add(vec3(1, 1, 0)))
  const c001 = hash3(i.add(vec3(0, 0, 1)))
  const c101 = hash3(i.add(vec3(1, 0, 1)))
  const c011 = hash3(i.add(vec3(0, 1, 1)))
  const c111 = hash3(i.add(vec3(1, 1, 1)))

  // interpolate along x first (4 lerps)
  const x00 = mix(c000, c100, u.x)
  const x10 = mix(c010, c110, u.x)
  const x01 = mix(c001, c101, u.x)
  const x11 = mix(c011, c111, u.x)

  // then along y (2 lerps)
  const y0 = mix(x00, x10, u.y)
  const y1 = mix(x01, x11, u.y)

  // then along z (1 lerp)
  return mix(y0, y1, u.z)
})

const fbm3 = Fn(([pIn]: [ReturnType<typeof vec3>]) => {
  const p = pIn.toVar()
  const s = float(0).toVar()
  const a = float(0.5).toVar()

  // 4 octaves
  for (let i = 0; i < 4; i++) {
    s.addAssign(a.mul(vnoise3(p)))
    p.mulAssign(2.0)
    a.mulAssign(0.5)
  }

  return s
})

const pal = Fn(([t]: [ReturnType<typeof float>]) => {
  return PA.add(PB.mul(cos(float(6.28318).mul(PC.mul(t).add(PD)))))
})

const liquid3 = Fn(([p]: [ReturnType<typeof vec3>]) => {
  const t = time.mul(5)

  // Layer 1 — first-order warp
  const q = vec3(
    fbm3(p.mul(2.2).add(t.mul(0.05))),
    fbm3(p.mul(2.2).add(float(5.2)).sub(t.mul(0.04))),
    fbm3(p.mul(2.2).add(float(1.3)).add(t.mul(0.03))),
  )

  // Layer 2 — second-order warp, using q as offset
  const r = vec3(
    fbm3(p.mul(2.2).add(q.mul(1.9)).add(t.mul(0.06)).add(float(1.7))),
    fbm3(p.mul(2.2).add(q.mul(1.9)).sub(t.mul(0.05)).add(float(9.2))),
    fbm3(p.mul(2.2).add(q.mul(1.9)).add(t.mul(0.04)).add(float(2.8))),
  )

  // Final noise sample at double-warped coordinate
  const v = fbm3(p.mul(2.2).add(r.mul(2.0)))

  // Color driver — mix final value with warp magnitude
  const ir = v.add(r.length().mul(0.5))

  const col = pal(ir)
  return col.mul(float(0.9).add(v.mul(0.4)))
})

const dir = positionLocal.normalize()
const n = liquid3(dir.mul(4))

const colorNode = vec3(n, n, n)

const material = new MeshBasicNodeMaterial({
  side: BackSide,
  depthWrite: false,
  depthTest: false,
  colorNode,
})

export function Sky() {
  const meshRef = useRef<Mesh>(null!)

  useFrame(({ camera, clock }) => {
    meshRef.current.position.copy(camera.position)
    time.value = clock.getElapsedTime()
  })

  return (
    <mesh ref={meshRef} renderOrder={-1} material={material}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  )
}