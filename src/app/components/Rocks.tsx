"use client";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import {
  findMesh,
  findMeshesByPrefix,
  placeSingle,
  scatterInstanced,
} from "../utils/scatter";
import { useDebugUI } from "../hooks/useDebugUI";

const ROCK_SPREAD = 600;
const ROCK_JITTER = 0.4;

useGLTF.preload("/rocks.glb");

/**
 * `ground_rock*` scattered as small debris across the terrain, plus the
 * standalone `rock_scene` set piece placed off to one side of the origin.
 */
export function Rocks() {
  const { scene } = useGLTF("/rocks.glb");
  const { props } = useDebugUI();
  const { groundRockScale, groundRockCount, rockSceneScale, rockScenePosition } = props;

  const groundRocks = useMemo(() => {
    const variants = findMeshesByPrefix(scene, "ground_rock");
    return scatterInstanced(variants, groundRockCount, {
      seed: 4200,
      spread: ROCK_SPREAD,
      baseScale: groundRockScale,
      scaleJitter: ROCK_JITTER,
    });
  }, [scene, groundRockScale, groundRockCount]);

  const rockScene = useMemo(() => {
    const mesh = findMesh(scene, "rock_scene");
    if (!mesh) return null;
    const [x, , z] = rockScenePosition;
    return placeSingle(mesh, x, z, rockSceneScale, 0.6);
  }, [scene, rockSceneScale, rockScenePosition]);

  return (
    <>
      {groundRocks.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
      {rockScene && <primitive object={rockScene} />}
    </>
  );
}
