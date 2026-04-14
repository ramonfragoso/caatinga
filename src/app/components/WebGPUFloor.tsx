"use client";
import * as THREE from "three";
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { playerPosition } from "./Player";
import { Fn, fract, sin, dot, vec2, cos, floor, uniformArray, mix, Loop, float, positionLocal, vec3, uint, uniform, step } from 'three/tsl';

const CHUNK_SIZE = 3000;
const CHUNK_COUNT = 9; // 5x5

function worldToChunkIndex(axis: number) {
  return Math.floor(axis / 900);
}

function getChunkPositions(pos: THREE.Vector3) {
  const chunks: { chunkX: number; chunkZ: number }[] = [];
  const currentChunkX = worldToChunkIndex(pos.x);
  const currentChunkZ = worldToChunkIndex(pos.z);

  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -1; cz <= 1; cz++) {
      chunks.push({
        chunkX: (currentChunkX + cx) * CHUNK_SIZE + CHUNK_SIZE / 2,
        chunkZ: (currentChunkZ + cz) * CHUNK_SIZE + CHUNK_SIZE / 2
      })
    }
  }
  return chunks
}

const chunkUniforms = Array.from({ length: CHUNK_COUNT }, () =>
  uniform(new THREE.Vector2(0, 0), 'vec2')
)

const materials = Array.from({ length: CHUNK_COUNT }, () =>
  new MeshStandardNodeMaterial({
    color: '#1122ff',
    // wireframe: true 
  })
);

const hash = Fn(([p]: any, _builder: unknown) => {
  void _builder;
  return fract(sin(dot(p, vec2(127.1, 311.7))).mul(44758.2378));
});

const hash2 = Fn(([p]: any, _builder: unknown) => {
  void _builder;
  const angle = hash(p).mul(6.2831853);
  return vec2(cos(angle), sin(angle));
});

const noise = Fn(([p]: any, _builder: unknown) => {
  void _builder;
  const i = floor(p)
  const f = fract(p)

  const gridA = dot(hash2(i), f)
  const gridB = dot(hash2(i.add(vec2(1, 0))), f.sub(vec2(1, 0)))
  const gridC = dot(hash2(i.add(vec2(0, 1))), f.sub(vec2(0, 1)))
  const gridD = dot(hash2(i.add(vec2(1, 1))), f.sub(vec2(1, 1)))

  const mixBottomEdge = mix(gridA, gridB, fract(p.x))
  const mixTopEdge = mix(gridC, gridD, fract(p.x))
  return mix(mixBottomEdge, mixTopEdge, fract(p.y))
})

const fbm = Fn(([p]: any, _builder: unknown) => {
  void _builder;
  const frequency = float(1).toVar();
  const amplitude = float(0.5).toVar();
  const value = float(0).toVar();
  Loop(20, () => {
    value.assign(value.add(noise(p.mul(frequency)).mul(amplitude)))
    frequency.assign(frequency.mul(float(2)))
    amplitude.assign(amplitude.mul(float(0.5)))
  })
  return value
})

materials.forEach((material, i) => {
  const worldPos = vec2(positionLocal.x, positionLocal.y.negate()).add(chunkUniforms[i]);
  const regional = fbm(worldPos.mul(float(0.0008)));
  const detail = fbm(worldPos.mul(float(0.004)));
  const h = regional.mul(detail).mul(float(500.0));

  const desertColors = uniformArray([
    // new THREE.Color('#f7d16a'), // 7/7
    // new THREE.Color('#f6bc4e'), // 6/7
    new THREE.Color('#f5ae38'), // 5/7
    new THREE.Color('#f3a024'), // 4/7
    new THREE.Color('#ef8f2b'), // 3/7
    new THREE.Color('#ea7e2b'), // 2/7
    new THREE.Color('#e56d2a'), // 1/7
    new THREE.Color('#e05c2a'), // 0/7
  ], 'color');

  const c0 = desertColors.element(uint(0));
  const c1 = desertColors.element(uint(1));
  const c2 = desertColors.element(uint(2));
  const c3 = desertColors.element(uint(3));
  const c4 = desertColors.element(uint(4));
  const c5 = desertColors.element(uint(5));

  const t0 = float(-2);
  const t1 = float(-1);
  const t2 = float(0);
  const t3 = float(1);
  const t4 = float(2);

  const w0 = float(1).sub(step(t0, h));
  const w1 = step(t0, h).mul(float(1).sub(step(t1, h)));
  const w2 = step(t1, h).mul(float(1).sub(step(t2, h)));
  const w3 = step(t2, h).mul(float(1).sub(step(t3, h)));
  const w4 = step(t3, h).mul(float(1).sub(step(t4, h)));
  const w5 = step(t4, h);

  material.colorNode = c0
    .mul(w0)
    .add(c1.mul(w1))
    .add(c2.mul(w2))
    .add(c3.mul(w3))
    .add(c4.mul(w4))
    .add(c5.mul(w5))

  material.positionNode = vec3(positionLocal.x, positionLocal.y, h)
});

export function WebGPUFloor() {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array.from({ length: CHUNK_COUNT }, () => null));
  const lastChunk = useRef({ x: NaN, z: NaN });

  useFrame(() => {
    const currentChunkX = worldToChunkIndex(playerPosition.x);
    const currentChunkZ = worldToChunkIndex(playerPosition.z);

    if (currentChunkX === lastChunk.current.x && currentChunkZ === lastChunk.current.z) return;

    lastChunk.current = { x: currentChunkX, z: currentChunkZ };

    const chunkPositions = getChunkPositions(playerPosition);

    meshRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const pos = chunkPositions[i];
        mesh.position.x = pos.chunkX;
        mesh.position.y = 0;
        mesh.position.z = pos.chunkZ;
        chunkUniforms[i].value.set(pos.chunkX, pos.chunkZ);
      }
    });
  });

  return (
    <>
      {Array.from({ length: CHUNK_COUNT }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
        >
          <planeGeometry args={[CHUNK_SIZE, CHUNK_SIZE, 16, 16]} />
          <primitive object={materials[i]} attach="material" />
        </mesh>
      ))}
    </>
  )
}
