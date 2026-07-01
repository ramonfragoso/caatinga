"use client";
import { useMemo } from "react";
import { useTexture, useGLTF } from "@react-three/drei";
import * as THREE from "three/webgpu";
import { texture as textureNode } from "three/tsl";
import { getTerrainY } from "./Terrain";

const SPAWN_RANGE = 300;
const COUNT_PER_TYPE = 70;
const STICK_COUNT = 20;
const ALPHA_TEST = 0.5;

// The `pole` object lives in the sertao model; we scatter it across the terrain
// (reusing the bush placement loop) instead of showing the single authored one.
const POLE_COUNT = 25;

// One bush = NUM_PLANES quads merged into a single "star", rotated evenly so the
// crossed cards read as a small volume from any angle.
const NUM_PLANES = 5;

// bush1 = big, bush2 = small, bush3 = medium. Values are world-space heights;
// each quad's width is derived from the texture aspect so nothing is stretched.
const BUSH_TEXTURES = [
  "/textures/bush1.png",
  "/textures/bush2.png",
  "/textures/bush3.png",
];
const BUSH_HEIGHTS = [3, 1.25, 2];

const STICK_TEXTURE = "/textures/dry_sticks.png";
const STICK_SIZE = 2;
const STICK_LIFT = 0.06; // sit just above the ground so it reads as slightly 3d

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

/** Merged 5-quad star geometry, bottom-pivoted (base at y=0) so it sits on the ground. */
function makeStarGeometry(width: number, height: number): THREE.BufferGeometry {
  const hw = width / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Local quad corners (x, y) in the plane before rotation around Y.
  const corners: [number, number][] = [
    [-hw, 0],
    [hw, 0],
    [hw, height],
    [-hw, height],
  ];
  const cornerUVs: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];

  for (let p = 0; p < NUM_PLANES; p++) {
    // NUM_PLANES quads spread over 180deg; DoubleSide covers the full circle.
    const a = (p * Math.PI) / NUM_PLANES;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const base = p * 4;

    for (let k = 0; k < 4; k++) {
      const [lx, ly] = corners[k];
      positions.push(lx * c, ly, -lx * s);
      uvs.push(cornerUVs[k][0], cornerUVs[k][1]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

/** Single horizontal quad (normal +Y), centered, for a ground decal. */
function makeGroundQuad(size: number): THREE.BufferGeometry {
  const h = size / 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h],
      3,
    ),
  );
  geo.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeBoundingSphere();
  return geo;
}

function makeFoliageMaterial(texture: THREE.Texture): THREE.MeshBasicNodeMaterial {
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicNodeMaterial();
  material.map = texture;
  material.alphaTest = ALPHA_TEST; // hard cutout: order-independent
  material.transparent = false;
  material.side = THREE.DoubleSide;
  // The WebGPU shadow pass ignores `.map` alpha (it only reads `.alphaMap` /
  // `castShadowNode`), so feed the texture in explicitly. Combined with the
  // copied `alphaTest`, this cuts the transparent parts out of the shadow too.
  material.castShadowNode = textureNode(texture);
  return material;
}

/**
 * Pull the `pole` mesh out of the sertao model and normalize its geometry so
 * the base sits at y=0 and it's centered on XZ — ready to be scattered as
 * ground-anchored instances just like a bush.
 */
function makePoleInstancedMesh(sertao: THREE.Object3D): THREE.InstancedMesh | null {
  let poleObj: THREE.Mesh | undefined;
  sertao.traverse((o) => {
    if (o.name.includes("pole") && (o as THREE.Mesh).isMesh) poleObj = o as THREE.Mesh;
  });
  if (!poleObj) return null;

  poleObj.updateWorldMatrix(true, false);
  const geo = poleObj.geometry.clone();
  geo.applyMatrix4(poleObj.matrixWorld); // bake in the authored scale/orientation
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  geo.translate(-cx, -bb.min.y, -cz); // base at y=0, centered on XZ
  geo.computeBoundingSphere();

  const inst = new THREE.InstancedMesh(geo, poleObj.material, POLE_COUNT);
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.frustumCulled = false;
  return inst;
}

useTexture.preload(BUSH_TEXTURES);
useTexture.preload(STICK_TEXTURE);
useGLTF.preload("/sertao.glb");

export function BushBillboard() {
  const textures = useTexture(BUSH_TEXTURES);
  const { scene: sertao } = useGLTF("/sertao.glb");

  const { bushes, pole } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const pole = makePoleInstancedMesh(sertao);

    const bushes = BUSH_TEXTURES.map((_, t) => {
      const tex = textures[t];
      const img = tex.image as { width: number; height: number };
      const height = BUSH_HEIGHTS[t];
      const width = height * (img.width / img.height);

      const geometry = makeStarGeometry(width, height);
      const material = makeFoliageMaterial(tex);
      const inst = new THREE.InstancedMesh(geometry, material, COUNT_PER_TYPE);
      inst.castShadow = true;
      inst.receiveShadow = false;
      // Instances span the terrain; the per-geometry bounding sphere would
      // wrongly cull the whole batch, so skip frustum culling (matches Cows).
      inst.frustumCulled = false;

      for (let i = 0; i < COUNT_PER_TYPE; i++) {
        const seed = t * 1000 + i * 4;
        const x = (seededRandom(seed) - 0.5) * SPAWN_RANGE;
        const z = (seededRandom(seed + 1) - 0.5) * SPAWN_RANGE;
        const yaw = seededRandom(seed + 2) * Math.PI * 2;
        const scale = 0.8 + seededRandom(seed + 3) * 0.4;
        const y = getTerrainY(x, z);

        dummy.position.set(x, y, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);

        // Scatter the pole in the same loop (avoids a second pass), but with its
        // own seed so it doesn't land on top of the bushes.
        if (pole && t === 0 && i < POLE_COUNT) {
          const pseed = 9000 + i * 4;
          const px = (seededRandom(pseed) - 0.5) * SPAWN_RANGE;
          const pz = (seededRandom(pseed + 1) - 0.5) * SPAWN_RANGE;
          const pyaw = seededRandom(pseed + 2) * Math.PI * 2;
          dummy.position.set(px, getTerrainY(px, pz), pz);
          dummy.rotation.set(0, pyaw, 0);
          dummy.scale.setScalar(1); // pole geometry is already world-scaled
          dummy.updateMatrix();
          pole.setMatrixAt(i, dummy.matrix);
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      return inst;
    });

    if (pole) pole.instanceMatrix.needsUpdate = true;
    return { bushes, pole };
  }, [textures, sertao]);

  return (
    <>
      {bushes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
      {pole && <primitive object={pole} />}
    </>
  );
}

export function DrySticks() {
  const texture = useTexture(STICK_TEXTURE);

  const mesh = useMemo(() => {
    const geometry = makeGroundQuad(STICK_SIZE);
    const material = makeFoliageMaterial(texture);
    const inst = new THREE.InstancedMesh(geometry, material, STICK_COUNT);
    inst.castShadow = true;
    inst.receiveShadow = false;
    inst.frustumCulled = false;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < STICK_COUNT; i++) {
      const seed = 5000 + i * 5;
      const x = (seededRandom(seed) - 0.5) * SPAWN_RANGE;
      const z = (seededRandom(seed + 1) - 0.5) * SPAWN_RANGE;
      const yaw = seededRandom(seed + 2) * Math.PI * 2;
      const scale = 0.8 + seededRandom(seed + 3) * 0.4;

      // Always lie flat (facing world up); just random yaw + a small lift off the ground.
      dummy.position.set(x, getTerrainY(x, z) + STICK_LIFT, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    return inst;
  }, [texture]);

  return <primitive object={mesh} />;
}
