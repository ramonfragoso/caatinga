"use client";
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { getTerrainY } from "./Terrain";
import { useDebugUI } from "../hooks/useDebugUI";

const VULTURE_COUNT = 5;
const SPAWN_RANGE = 120; // matches the cows' spread
const VULTURE_SCALE = 0.5; // same half-size as the authored vulture

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 43758.5453123;
  return x - Math.floor(x);
}

useGLTF.preload("/sertao.glb");

/**
 * Scatter extra vultures across the terrain. Each is a full skinned clone of the
 * authored `vulture_rig` (so it keeps the idle animation), placed like the cows:
 * a seeded random spot at terrain height + the shared vulture Y offset.
 */
export function Vultures() {
  const { scene, animations } = useGLTF("/sertao.glb");
  const { vulture } = useDebugUI();
  const vultureYOffset = vulture.vultureYOffset;

  const { clones, mixers } = useMemo(() => {
    const source = scene.getObjectByName("vulture_rig");
    const clones: THREE.Object3D[] = [];
    const mixers: THREE.AnimationMixer[] = [];
    if (!source) return { clones, mixers };

    const idleClip =
      animations.find((a) => a.name.toLowerCase().includes("idle")) ??
      animations[0];

    for (let i = 0; i < VULTURE_COUNT; i++) {
      const clone = SkeletonUtils.clone(source);
      const x = (seededRandom(i * 4 + 100) - 0.5) * SPAWN_RANGE;
      const z = (seededRandom(i * 4 + 101) - 0.5) * SPAWN_RANGE;
      const yaw = seededRandom(i * 4 + 102) * Math.PI * 2;

      clone.position.set(x, getTerrainY(x, z), z); // Y offset applied reactively below
      clone.rotation.set(0, yaw, 0);
      clone.scale.setScalar(VULTURE_SCALE);
      clone.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });

      const mixer = new THREE.AnimationMixer(clone);
      if (idleClip) {
        const action = mixer.clipAction(idleClip);
        // Desync each vulture so they don't animate in lockstep.
        action.time = seededRandom(i * 4 + 103) * (idleClip.duration || 1);
        action.play();
      }

      clones.push(clone);
      mixers.push(mixer);
    }

    return { clones, mixers };
  }, [scene, animations]);

  // Follow terrain height + the live shared offset (same control as the original).
  useEffect(() => {
    for (const clone of clones) {
      clone.position.y = getTerrainY(clone.position.x, clone.position.z) + vultureYOffset;
    }
  }, [clones, vultureYOffset]);

  useFrame((_, delta) => {
    for (const mixer of mixers) mixer.update(delta);
  });

  return (
    <>
      {clones.map((clone, i) => (
        <primitive key={i} object={clone} />
      ))}
    </>
  );
}
