"use client";
import { useEffect } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { Lights } from "./Lights";
import { useDebugUI } from "../hooks/useDebugUI";
import * as THREE from "three";
import { Terrain } from "./Terrain";
import { Cows } from "./Cow";
import { BushBillboard, DrySticks } from "./Bush";
import { Vultures } from "./Vultures";

function SertaoModel() {
  const { scene, animations } = useGLTF("/sertao.glb");
  const { actions } = useAnimations(animations, scene);

  // Adjustable vertical offset so the vulture can be raised/lowered on its pole.
  const { vulture } = useDebugUI();
  const vultureYOffset = vulture.vultureYOffset;

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || obj.name.includes("vulture") || obj.name.includes('pole')) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
      // The authored single pole is scattered as instances by <BushBillboard>,
      // so hide the original here.
      if (obj.name.includes("pole")) obj.visible = false;
      // Render the vulture at half size.
      if (obj.name === "vulture_rig") obj.scale.setScalar(0.5);
    });

    const idle = Object.values(actions).find((a) => a?.getClip().name.toLowerCase().includes("idle")) ?? Object.values(actions)[0];
    idle?.reset().play();
  }, [actions, scene]);

  // Apply the vulture height offset separately so it reacts to the live control.
  useEffect(() => {
    const vulture = scene.getObjectByName("vulture_rig");
    if (vulture) vulture.position.y = vultureYOffset;
  }, [scene, vultureYOffset]);

  return <primitive object={scene} />;
}

useGLTF.preload("/sertao.glb");

export function Scene() {
  return (
    <>
      {/* <SceneFog /> */}
      <Lights />
      <SertaoModel />
      <Terrain/>
      <Cows />
      <Vultures />
      <BushBillboard />
      <DrySticks />
    </>
  );
}
