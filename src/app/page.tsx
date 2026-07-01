"use client";
import { Suspense } from "react";
import { Leva } from "leva";
import { useProgress } from "@react-three/drei";
import WebGPUCanvas from "./components/WebGPUCanvas";
import { PostProcessing } from "./components/PostProcessing";
import { Player, controls } from "./components/Player";
import { Scene } from "./components/Scene";
import { Sky } from "./components/Sky";
import { EntrySequence } from "./components/EntrySequence";

export default function Home() {
  // Real GLB/texture load progress via THREE's DefaultLoadingManager (0–100).
  const { progress } = useProgress();

  return (
    <div className="w-full h-screen">
      <div className="z-50 absolute overflow-auto top-1 right-1 rounded-md max-w-[370px]">
        <Leva fill  hidden/>
      </div>

      <WebGPUCanvas
        dpr={[1.0, 2.0]}
        camera={{ position: [1, 0, 1], fov: 80, near: 0.1, far: 1500 }}
        shadows
      >
        <Suspense fallback={null}>
          <Scene />
          <Player />
          <PostProcessing />
          <Sky />
        </Suspense>
      </WebGPUCanvas>

      <EntrySequence
        progress={100 / 100}
        onComplete={() => {
          controls.enabled = true;
        }}
      />
    </div>
  );
}
