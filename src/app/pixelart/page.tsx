"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useEffect, useRef } from "react";
import { Leva } from "leva";
import { fog, rangeFogFactor, color, densityFogFactor, float } from "three/tsl";
import { Lights } from "../components/Lights";
import { useDebugUI } from "../hooks/useDebugUI";
import WebGPUCanvas from "../components/WebGPUCanvas";
import {
  WebGPUToonMaterial,
  type ToonGradientPresetName,
} from "../components/WebGPUToonMaterial";
import { PostProcessing } from "../components/PostProcessing";
import { WebGPUFloor } from "../components/WebGPUFloor";
import { Player } from "../components/Player";

function OrbitingSphere({
  radius,
  angularSpeed,
  clockwise,
  geometryArgs,
  color,
  toonPreset,
}: {
  radius: number;
  angularSpeed: number;
  clockwise: boolean;
  geometryArgs: [number, number, number];
  color: string;
  toonPreset: ToonGradientPresetName;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const sign = clockwise ? 1 : -1;

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const angle = sign * angularSpeed * t;
    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.z = Math.sin(angle) * radius;
    mesh.position.y = 0;
  });

  return (
    <mesh
      ref={ref}
      castShadow
      // receiveShadow
      frustumCulled={false}>
      <sphereGeometry args={geometryArgs} />
      <WebGPUToonMaterial color={color} preset={toonPreset} />
    </mesh>
  );
}

function SceneFog() {
  const { scene } = useThree();

  useEffect(() => {
    const sceneFog = fog(color('#FFD300'), densityFogFactor(float(0.001)));
    scene.fogNode = sceneFog;
    return () => {
      scene.fogNode = null;
    };
  }, [scene]);

  return null;
}

function Scene() {
  return (
    <group scale={.3}>
      <SceneFog />
      <Lights />
      {/* <TestFloor /> */}
      {/* <Player /> */}
      <mesh
        position={[-3, 0, -7]}
        rotation={[0, 2, 0]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[3, 5, 6]} />
        <WebGPUToonMaterial color="#6F3CF0" preset="threeTone" />
      </mesh>
      <OrbitingSphere
        radius={8}
        angularSpeed={0.1}
        clockwise
        geometryArgs={[3, 32, 32]}
        color="#3CF0B5"
        toonPreset="sixTone"
      />
      {/* <mesh
        position={[0, -2.6, 0]}
        rotation={[0, 0, 0]}
        // castShadow
        receiveShadow
      >
        <boxGeometry args={[100, 1, 100, 30]} />
        <WebGPUToonMaterial color="#F0603C" preset="threeTone" />
      </mesh> */}
      <mesh
        position={[4, 1, 5]}
        castShadow
      // receiveShadow
      >
        <cylinderGeometry args={[1, 0.5, 5, 8]} />
        <WebGPUToonMaterial color="#F0E23C" preset="sixTone" />
      </mesh>
      <mesh
        position={[-2, 0, 2]}
        castShadow
      // receiveShadow
      >
        <torusKnotGeometry args={[1, 0.5, 30, 30]} />
        <WebGPUToonMaterial color="#A34831" preset="fiveTone" />
      </mesh>
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        makeDefault
      />
      <WebGPUFloor />
    </group>
  );
}

export default function Home() {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  useDebugUI();

  return (
    <div className="w-full h-screen">
      <div className="z-50 absolute  overflow-auto top-1 right-1 rounded-md max-w-[370px] ">
        <Leva fill />
      </div>

      <WebGPUCanvas
        dpr={[1.0, 2.0]}
        camera={{ position: [20,20,20], fov: 45, near: 0.1, far: 1500 }}
        shadows
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, 0);
          cameraRef.current = camera as THREE.PerspectiveCamera;
        }}
      >
        <Suspense fallback={null}>
          <Environment
            files="/textures/skybox.hdr"
            background
          />

          <PostProcessing normalEdgeStrength={3} radius={1} depthEdgeStrength={3} strength={0.3} threshold={0.8} />
          <Scene />
          <Player />
        </Suspense>
      </WebGPUCanvas>
    </div>
  );
}