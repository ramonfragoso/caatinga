import * as THREE from "three";
import { getTerrainY } from "../components/Terrain";

export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

/** First mesh under the node called `name`, or null. */
export function findMesh(root: THREE.Object3D, name: string): THREE.Mesh | null {
  const node = root.getObjectByName(name);
  if (!node) return null;
  let found: THREE.Mesh | null = null;
  node.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
  });
  return found;
}

/** Every mesh whose node name starts with `prefix` (e.g. "ground_rock"). */
export function findMeshesByPrefix(
  root: THREE.Object3D,
  prefix: string,
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name.startsWith(prefix)) out.push(o as THREE.Mesh);
  });
  return out;
}

/**
 * Geometry with the node's authored rotation+scale baked in, but its layout
 * translation dropped.
 *
 * The artist parks each prop at its own spot in the source file, so the node
 * translation is meaningless here. The *local origin* is the meaningful pivot:
 * it sits on the ground plane, and geometry below y=0 (rocks, miniscenes) is
 * meant to stay buried. So we keep the pivot and discard only the layout offset.
 */
export function bakeNodeGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const geo = mesh.geometry.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(0, 0, 0),
    mesh.quaternion,
    mesh.scale,
  );
  geo.applyMatrix4(m);
  geo.computeBoundingSphere();
  return geo;
}

export interface ScatterOptions {
  /** Distinct seed per prop family so families don't land on top of each other. */
  seed: number;
  /** Full world span; positions land in ±spread/2. */
  spread: number;
  baseScale: number;
  /** Fractional size variation, e.g. 0.3 => scale in [0.7, 1.3] * baseScale. */
  scaleJitter: number;
}

/**
 * One InstancedMesh per variant, instances round-robined across the variants and
 * dropped onto the terrain at a seeded random spot with random yaw and size.
 */
export function scatterInstanced(
  variants: THREE.Mesh[],
  count: number,
  { seed, spread, baseScale, scaleJitter }: ScatterOptions,
): THREE.InstancedMesh[] {
  if (variants.length === 0) return [];

  const perVariant = variants.map(() => 0);
  for (let i = 0; i < count; i++) perVariant[i % variants.length]++;

  const dummy = new THREE.Object3D();

  return variants.map((mesh, v) => {
    const n = perVariant[v];
    const inst = new THREE.InstancedMesh(
      bakeNodeGeometry(mesh),
      mesh.material,
      n,
    );
    inst.castShadow = true;
    inst.receiveShadow = true;
    // Instances span the terrain; the per-geometry bounding sphere would wrongly
    // cull the whole batch, so skip frustum culling (matches Cows/Bush).
    inst.frustumCulled = false;

    for (let i = 0; i < n; i++) {
      const s = seed + v * 977 + i * 4;
      const x = (seededRandom(s) - 0.5) * spread;
      const z = (seededRandom(s + 1) - 0.5) * spread;
      const yaw = seededRandom(s + 2) * Math.PI * 2;
      const jitter = 1 + (seededRandom(s + 3) - 0.5) * 2 * scaleJitter;

      dummy.position.set(x, getTerrainY(x, z), z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(baseScale * jitter);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    return inst;
  });
}

/**
 * A single prop placed at a chosen spot, keeping its authored pivot (so buried
 * geometry stays buried) and sitting at terrain height.
 */
export function placeSingle(
  mesh: THREE.Mesh,
  x: number,
  z: number,
  scale: number,
  yaw: number,
): THREE.Mesh {
  const single = new THREE.Mesh(bakeNodeGeometry(mesh), mesh.material);
  single.castShadow = true;
  single.receiveShadow = true;
  single.position.set(x, getTerrainY(x, z), z);
  single.rotation.y = yaw;
  single.scale.setScalar(scale);
  return single;
}
