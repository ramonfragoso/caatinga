"use client";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { findMesh, scatterInstanced } from "../utils/scatter";
import { useDebugUI } from "../hooks/useDebugUI";

const TREE1_SPREAD = 600; // ±300, roughly the visible terrain
const TREE1_JITTER = 0.35;

useGLTF.preload("/trees.glb");

/** tree1, scattered across the terrain at varying size. (tree2 lives in VultureScene.) */
export function Trees() {
  const { scene } = useGLTF("/trees.glb");
  const { props } = useDebugUI();
  const { tree1Scale, tree1Count } = props;

  const instances = useMemo(() => {
    const mesh = findMesh(scene, "tree1");
    if (!mesh) return [];
    return scatterInstanced([mesh], tree1Count, {
      seed: 7000,
      spread: TREE1_SPREAD,
      baseScale: tree1Scale,
      scaleJitter: TREE1_JITTER,
    });
  }, [scene, tree1Scale, tree1Count]);

  return (
    <>
      {instances.map((mesh, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </>
  );
}
