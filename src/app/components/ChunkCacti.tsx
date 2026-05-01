"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { playerPosition } from "./Player";
import {
  FLOOR_CHUNK_COUNT,
  FLOOR_CHUNK_SIZE,
  FLOOR_PLANE_SEGMENTS,
  floorWorldToChunkIndex,
  getFloorChunkPositions,
} from "./WebGPUFloor";
import { floorTerrainHeightShaderWorld } from "../utils/floorTerrainHeight";

const CACTUS_NAMES = ["cactus1", "cactus2", "cactus3", "cactus4", "rock1", "rock2", "rock3",] as const;
const CACTI_PER_CHUNK = 30;
const CACTUS_UNIFORM_SCALE = 5;

function fract(x: number): number {
  return x - Math.floor(x);
}

function rand01(seed: number): number {
  return fract(Math.sin(seed) * 43758.5453123);
}

type CactusPlacement = {
  key: string;
  variant: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  matrix: THREE.Matrix4;
};

const floorRot = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(-Math.PI / 2, 0, 0, "XYZ")
);
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3(
  CACTUS_UNIFORM_SCALE,
  CACTUS_UNIFORM_SCALE,
  CACTUS_UNIFORM_SCALE
);
const tmpQuat = new THREE.Quaternion();
const tmpMat = new THREE.Matrix4();

function buildCactusPlacements(
  chunkPositions: { chunkX: number; chunkZ: number }[],
  currentChunkX: number,
  currentChunkZ: number
): CactusPlacement[] {
  const out: CactusPlacement[] = [];
  const half = FLOOR_CHUNK_SIZE / 2;
  const segs = FLOOR_PLANE_SEGMENTS;

  for (let i = 0; i < FLOOR_CHUNK_COUNT; i++) {
    const { chunkX, chunkZ } = chunkPositions[i];
    const cx = Math.floor(i / 3) - 1;
    const cz = (i % 3) - 1;
    const tileKey = `${currentChunkX + cx},${currentChunkZ + cz}`;

    for (let p = 0; p < CACTI_PER_CHUNK; p++) {
      const seed =
        (currentChunkX + cx) * 5023 +
        (currentChunkZ + cz) * 877 +
        p * 131;
      const r0 = rand01(seed);
      const r1 = rand01(seed + 1);
      const r2 = rand01(seed + 2);
      const r3 = rand01(seed + 3);

      const gx = Math.min(segs, Math.floor(r0 * (segs + 1)));
      const gz = Math.min(segs, Math.floor(r1 * (segs + 1)));
      const px = -half + (gx / segs) * FLOOR_CHUNK_SIZE;
      const py = -half + (gz / segs) * FLOOR_CHUNK_SIZE;

      const worldSampleX = chunkX + px;
      const worldSampleZ = chunkZ - py;
      const h = floorTerrainHeightShaderWorld(worldSampleX, worldSampleZ);

      tmpPos.set(px, py, h);
      tmpPos.applyQuaternion(floorRot);
      tmpPos.add(new THREE.Vector3(chunkX, 0, chunkZ));

      const rotY = r2 * Math.PI * 2;
      tmpQuat.setFromEuler(new THREE.Euler(0, rotY, 0, "YXZ"));
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);

      const variant = Math.min(6, Math.floor(r3 * 7)) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

      out.push({
        key: `${tileKey}-${p}`,
        variant,
        matrix: tmpMat.clone(),
      });
    }
  }
  return out;
}

const OneCactus = memo(function OneCactus({
  rootScene,
  variant,
  matrix,
}: {
  rootScene: THREE.Object3D;
  variant: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  matrix: THREE.Matrix4;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const obj = useMemo(() => {
    const src = rootScene.getObjectByName(CACTUS_NAMES[variant]);
    const clone = src ? src.clone(true) : new THREE.Group();
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return clone;
  }, [rootScene, variant]);

  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.matrix.copy(matrix);
    g.matrixWorldNeedsUpdate = true;
  }, [matrix]);

  return (
    <group ref={groupRef} matrixAutoUpdate={false} frustumCulled={false}>
      <primitive object={obj} />
    </group>
  );
});

export function ChunkCacti() {
  const { scene } = useGLTF("/cactus.glb");
  const lastChunk = useRef({ x: NaN, z: NaN });
  const [placements, setPlacements] = useState<CactusPlacement[]>(() =>
    buildCactusPlacements(
      getFloorChunkPositions(playerPosition),
      floorWorldToChunkIndex(playerPosition.x),
      floorWorldToChunkIndex(playerPosition.z)
    )
  );

  useFrame(() => {
    const cx = floorWorldToChunkIndex(playerPosition.x);
    const cz = floorWorldToChunkIndex(playerPosition.z);
    if (cx === lastChunk.current.x && cz === lastChunk.current.z) return;

    lastChunk.current = { x: cx, z: cz };
    const chunkPos = getFloorChunkPositions(playerPosition);
    setPlacements(buildCactusPlacements(chunkPos, cx, cz));
  });

  return (
    <>
      {placements.map((pl) => (
        <OneCactus
          key={pl.key}
          rootScene={scene}
          variant={pl.variant}
          matrix={pl.matrix}
        />
      ))}
    </>
  );
}

useGLTF.preload("/cactus.glb");
