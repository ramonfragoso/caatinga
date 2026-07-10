"use client";
import { useEffect } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { Lights } from "./Lights";
import * as THREE from "three";
import { Terrain } from "./Terrain";
import { BushBillboard, DrySticks } from "./Bush";
import { Trees } from "./Trees";
import { Rocks } from "./Rocks";
import { MiniScenes } from "./MiniScenes";
import { SkeletonScene } from "./SkeletonScene";
import { VulturesScene } from "./VulturesScene";
import { AudioSystem } from "../audio/AudioSystem";

function SertaoModel() {
  const { scene, animations } = useGLTF("/sertao.glb");
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || obj.name.includes("vulture") || obj.name.includes('pole')) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
      // The authored single pole is scattered as instances by <BushBillboard>,
      // so hide the original here.
      if (obj.name.includes("pole")) obj.visible = false;
      // Likewise the authored vulture: it's only a source to clone from, and
      // every visible bird now belongs to <VulturesScene>.
      if (obj.name === "vulture_rig") obj.visible = false;
    });

    const idle = Object.values(actions).find((a) => a?.getClip().name.toLowerCase().includes("idle")) ?? Object.values(actions)[0];
    idle?.reset().play();
  }, [actions, scene]);

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
      <BushBillboard />
      <DrySticks />
      <Trees />
      <Rocks />
      <MiniScenes />
      <SkeletonScene />
      <VulturesScene />
      <AudioSystem />
    </>
  );
}
