"use client";
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import {
  Fn,
  float,
  floor,
  fract,
  instanceIndex,
  ivec2,
  mix,
  mod,
  textureLoad,
  uniform,
  vertexIndex,
} from "three/tsl";
import { getTerrainY } from "./Terrain";

// Vertex-animation-texture (VAT) settings. The skeletal `cow_idle` clip is
// sampled into NUM_FRAMES snapshots once at load; the GPU then interpolates
// between snapshots per frame. More frames = smoother but more bake time/VRAM.
const NUM_FRAMES = 24;
const VAT_WIDTH = 1024; // texels per row; vertices wrap onto multiple rows
const ANIM_SPEED = 0.25; // playback speed multiplier (clip loops over 1/SPEED s)

/**
 * Where a cow stands. The cows are one InstancedMesh, so there's no per-cow
 * Object3D for anything else (the breath emitters) to hang off — whoever places
 * them owns the placement list and shares it. `y` comes from the terrain;
 * `rotation` is a full euler so a cow can be tilted onto a slope.
 */
export interface CowPlacement {
  x: number;
  z: number;
  rotation: [number, number, number];
}

interface BakedPrimitive {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  /** Animated local-space positions, [vertex][frame] packed into a texture. */
  vat: THREE.DataTexture;
  rowsPerFrame: number;
  /** Transform of this primitive within the cow model. */
  localMatrix: THREE.Matrix4;
}

/**
 * Sample the skinned animation into a per-vertex/per-frame position texture.
 * Layout: x = vertexIndex % VAT_WIDTH, y = frame * rowsPerFrame + floor(vid / W).
 */
function bakePrimitive(
  mesh: THREE.SkinnedMesh,
  root: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  duration: number,
): BakedPrimitive {
  const vertexCount = mesh.geometry.attributes.position.count;
  const rowsPerFrame = Math.ceil(vertexCount / VAT_WIDTH);
  const height = rowsPerFrame * NUM_FRAMES;
  const data = new Float32Array(VAT_WIDTH * height * 4);
  const v = new THREE.Vector3();

  for (let f = 0; f < NUM_FRAMES; f++) {
    mixer.setTime((f / NUM_FRAMES) * duration);
    root.updateMatrixWorld(true);

    for (let vid = 0; vid < vertexCount; vid++) {
      mesh.getVertexPosition(vid, v); // animated position in local space
      const col = vid % VAT_WIDTH;
      const row = f * rowsPerFrame + Math.floor(vid / VAT_WIDTH);
      const idx = (row * VAT_WIDTH + col) * 4;
      data[idx] = v.x;
      data[idx + 1] = v.y;
      data[idx + 2] = v.z;
      data[idx + 3] = 1;
    }
  }

  const vat = new THREE.DataTexture(
    data,
    VAT_WIDTH,
    height,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  vat.minFilter = THREE.NearestFilter;
  vat.magFilter = THREE.NearestFilter;
  vat.generateMipmaps = false;
  vat.needsUpdate = true;

  return {
    geometry: mesh.geometry,
    material: mesh.material,
    vat,
    rowsPerFrame,
    localMatrix: mesh.matrixWorld.clone(),
  };
}

/** Node material that reconstructs the animated vertex from the VAT. */
function makeVatMaterial(
  source: THREE.Material,
  vat: THREE.DataTexture,
  rowsPerFrame: number,
  time: ReturnType<typeof uniform>,
): THREE.MeshStandardNodeMaterial {
  // Rebuild the GLB's PBR material as a node material so we can swap in our own
  // vertex position. (Normals stay static — fine for a subtle idle.) Copy the
  // maps/params explicitly; cross-type Material.copy() can silently drop them.
  const src = source as Partial<THREE.MeshStandardMaterial>;
  const material = new THREE.MeshStandardNodeMaterial();
  if (src.color) material.color.copy(src.color);
  if (src.map) material.map = src.map;
  if (src.normalMap) material.normalMap = src.normalMap;
  if (src.normalScale) material.normalScale.copy(src.normalScale);
  if (src.roughness !== undefined) material.roughness = src.roughness;
  if (src.roughnessMap) material.roughnessMap = src.roughnessMap;
  if (src.metalness !== undefined) material.metalness = src.metalness;
  if (src.metalnessMap) material.metalnessMap = src.metalnessMap;
  if (src.aoMap) material.aoMap = src.aoMap;
  if (src.aoMapIntensity !== undefined) material.aoMapIntensity = src.aoMapIntensity;
  if (src.emissive) material.emissive.copy(src.emissive);
  if (src.emissiveMap) material.emissiveMap = src.emissiveMap;
  if (src.emissiveIntensity !== undefined)
    material.emissiveIntensity = src.emissiveIntensity;
  if (src.alphaMap) material.alphaMap = src.alphaMap;
  if (src.transparent !== undefined) material.transparent = src.transparent;
  if (src.opacity !== undefined) material.opacity = src.opacity;
  if (src.alphaTest !== undefined) material.alphaTest = src.alphaTest;
  if (src.side !== undefined) material.side = src.side;
  if (src.vertexColors !== undefined) material.vertexColors = src.vertexColors;
  if (src.flatShading !== undefined) material.flatShading = src.flatShading;

  const W = float(VAT_WIDTH);
  const rpf = float(rowsPerFrame);
  const frames = float(NUM_FRAMES);

  material.positionNode = Fn(() => {
    const vid = float(vertexIndex);
    const col = mod(vid, W);
    const rowInFrame = floor(vid.div(W));

    // Per-cow phase so they don't animate in lockstep.
    const phase = fract(float(instanceIndex).mul(12.9898).sin().mul(43758.5453));
    const t = fract(time.mul(ANIM_SPEED).add(phase)).mul(frames);
    const f0 = floor(t);
    const f1 = mod(f0.add(1), frames);
    const blend = t.sub(f0);

    const row0 = f0.mul(rpf).add(rowInFrame);
    const row1 = f1.mul(rpf).add(rowInFrame);

    const p0 = textureLoad(vat, ivec2(col, row0)).xyz;
    const p1 = textureLoad(vat, ivec2(col, row1)).xyz;
    return mix(p0, p1, blend);
  })();

  return material;
}

useGLTF.preload("/cow.glb");

export function Cows({ placements }: { placements: CowPlacement[] }) {
  const { scene, animations } = useGLTF("/cow.glb");
  const time = useMemo(() => uniform(0), []);
  const count = placements.length;

  const { instancedMeshes, baked } = useMemo(() => {
    // Bake the idle clip into VATs, one per primitive.
    const idleClip =
      animations.find((a) => a.name.toLowerCase().includes("idle")) ??
      animations[0];
    const mixer = new THREE.AnimationMixer(scene);
    if (idleClip) mixer.clipAction(idleClip).play();
    const duration = idleClip?.duration ?? 1;

    const baked: BakedPrimitive[] = [];
    scene.traverse((obj) => {
      const sm = obj as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) baked.push(bakePrimitive(sm, scene, mixer, duration));
    });

    const instancedMeshes = baked.map((prim) => {
      const material = makeVatMaterial(
        prim.material as THREE.Material,
        prim.vat,
        prim.rowsPerFrame,
        time,
      );
      const inst = new THREE.InstancedMesh(prim.geometry, material, count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      // Instances span the terrain; the per-geometry bounding sphere would
      // wrongly cull the whole batch, so skip frustum culling.
      inst.frustumCulled = false;
      return inst;
    });

    return { instancedMeshes, baked };
    // The VAT bake is expensive, so it must not depend on `placements` — those
    // are pushed into the instance matrices separately below.
  }, [scene, animations, time, count]);

  // Re-place the cows whenever the debug controls move them.
  useEffect(() => {
    const world = new THREE.Matrix4();
    const cowMatrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);

    placements.forEach(({ x, z, rotation }, i) => {
      quat.setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2]));
      cowMatrix.compose(new THREE.Vector3(x, getTerrainY(x, z), z), quat, one);
      instancedMeshes.forEach((inst, p) => {
        world.multiplyMatrices(cowMatrix, baked[p].localMatrix);
        inst.setMatrixAt(i, world);
        inst.instanceMatrix.needsUpdate = true;
      });
    });
  }, [instancedMeshes, baked, placements]);

  useFrame((state) => {
    time.value = state.clock.elapsedTime;
  });

  return (
    <>
      {instancedMeshes.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </>
  );
}
