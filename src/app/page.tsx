"use client";
import { Suspense } from "react";
import { Leva } from "leva";
import WebGPUCanvas from "./components/WebGPUCanvas";
import { PostProcessing } from "./components/PostProcessing";
import { Player } from "./components/Player";
import { Scene } from "./components/Scene";
import { Sky } from "./components/Sky";

export default function Home() {
  return (
    <div className="w-full h-screen">
      <div className="z-50 absolute overflow-auto top-1 right-1 rounded-md max-w-[370px]">
        <Leva fill />
      </div>

      <WebGPUCanvas
        dpr={[1.0, 2.0]}
        camera={{ position: [0, 2, 0], fov: 80, near: 0.1, far: 1500 }}
        shadows
      >
        <Suspense fallback={null}>
          <Scene />
          <Player />
          <PostProcessing />
          <Sky/>
        </Suspense>
      </WebGPUCanvas>
    </div>
  );
}
