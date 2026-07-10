"use client";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  findMesh,
  findMeshesByPrefix,
  placeSingle,
  scatterInstanced,
} from "../utils/scatter";
import { useDebugUI } from "../hooks/useDebugUI";

const MINISCENE_SPREAD = 600;
const MINISCENE_JITTER = 0.4;

const CACTUS_SPREAD = 600;
const CACTUS_JITTER = 0.35;

// Rendered on its own as a landmark, so it must not join the scatter pool.
const HERO_MINISCENE = "miniscene.004";

useGLTF.preload("/miniscenes.glb");

/**
 * The miniscenes GLB holds three prop families: the `miniscene*` set pieces
 * (one of which, miniscene.004, is a unique landmark) and standalone `cactus*`
 * meshes that get scattered smaller than everything else.
 */
export function MiniScenes() {
  const { scene } = useGLTF("/miniscenes.glb");
  const { props } = useDebugUI();
  const {
    miniSceneScale,
    miniSceneCount,
    miniScene004Scale,
    miniScene004Position,
    cactusScale,
    cactusCount,
  } = props;

  const miniScenes = useMemo(() => {
    const variants = findMeshesByPrefix(scene, "miniscene").filter(
      (m: THREE.Mesh) => m.name !== HERO_MINISCENE,
    );
    return scatterInstanced(variants, miniSceneCount, {
      seed: 1500,
      spread: MINISCENE_SPREAD,
      baseScale: miniSceneScale,
      scaleJitter: MINISCENE_JITTER,
    });
  }, [scene, miniSceneScale, miniSceneCount]);

  const hero = useMemo(() => {
    const mesh = findMesh(scene, HERO_MINISCENE);
    if (!mesh) return null;
    const [x, , z] = miniScene004Position;
    return placeSingle(mesh, x, z, miniScene004Scale, -0.8);
  }, [scene, miniScene004Scale, miniScene004Position]);

  const cacti = useMemo(() => {
    const variants = findMeshesByPrefix(scene, "cactus");
    return scatterInstanced(variants, cactusCount, {
      seed: 2600,
      spread: CACTUS_SPREAD,
      baseScale: cactusScale,
      scaleJitter: CACTUS_JITTER,
    });
  }, [scene, cactusScale, cactusCount]);

  return (
    <>
      {miniScenes.map((mesh, i) => (
        <primitive key={`ms-${i}`} object={mesh} />
      ))}
      {hero && <primitive object={hero} />}
      {cacti.map((mesh, i) => (
        <primitive key={`cactus-${i}`} object={mesh} />
      ))}
    </>
  );
}
