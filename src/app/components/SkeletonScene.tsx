"use client";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainY } from "./Terrain";
import { Cows, type CowPlacement } from "./Cow";
import { CowBreath } from "../audio/CowBreath";
import { useDebugUI } from "../hooks/useDebugUI";

// Dialed in via the debug panel, then baked. Only the height correction below
// is still adjustable.
const SKELETON_X = 79;
const SKELETON_Z = 117;
const SKELETON_SCALE = 0.4;

useGLTF.preload("/skeleton.glb");

/**
 * A cattle skull on the ground with three living cows standing around it. The
 * cows are one InstancedMesh, so their placements are computed here and shared
 * with the breath emitters, which need somewhere to sit in world space.
 */
export function SkeletonScene() {
  const { scene } = useGLTF("/skeleton.glb");
  const { skeletonScene } = useDebugUI();

  // Normalize once: base on the ground, centered on XZ, so the debug transform
  // acts on a predictable pivot.
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    clone.position.x -= (box.min.x + box.max.x) / 2;
    clone.position.z -= (box.min.z + box.max.z) / 2;
    clone.position.y -= box.min.y;
    return clone;
  }, [scene]);

  const placements: CowPlacement[] = useMemo(
    () =>
      (
        [
          [skeletonScene.cow1Position, skeletonScene.cow1Rotation],
          [skeletonScene.cow2Position, skeletonScene.cow2Rotation],
          [skeletonScene.cow3Position, skeletonScene.cow3Rotation],
        ] as const
      ).map(([position, rotation]) => ({
        x: position[0],
        z: position[2],
        rotation: [rotation[0], rotation[1], rotation[2]] as [number, number, number],
      })),
    [
      skeletonScene.cow1Position, skeletonScene.cow1Rotation,
      skeletonScene.cow2Position, skeletonScene.cow2Rotation,
      skeletonScene.cow3Position, skeletonScene.cow3Rotation,
    ],
  );

  return (
    <>
      <group
        position={[
          SKELETON_X,
          getTerrainY(SKELETON_X, SKELETON_Z) + skeletonScene.skeletonY,
          SKELETON_Z,
        ]}
        scale={SKELETON_SCALE}
      >
        <primitive object={model} />
      </group>

      <Cows placements={placements} />
      <CowBreath placements={placements} />
    </>
  );
}
