"use client";

import { Canvas, extend, type ThreeToJSXElements } from "@react-three/fiber";
import React, { type ComponentProps, type FC, type PropsWithChildren } from "react";
import WebGPU from "three/examples/jsm/capabilities/WebGPU.js";
import { type WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js";
import * as THREE from "three/webgpu";

declare module "@react-three/fiber" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any);

type CanvasProps = Omit<ComponentProps<typeof Canvas>, "gl">;

type Props = PropsWithChildren<
  CanvasProps & {
    isMobile?: boolean;
  }
>;

const WebGPUCanvas: FC<Props> = ({ children, ...canvasProps }) => {
  return (
    <Canvas
      {...canvasProps}
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer({
          ...(props as WebGPURendererParameters),
          forceWebGL: !WebGPU.isAvailable(),
        });
        await renderer.init();
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        // Hard 1-tap shadows: cheapest sampling; the crosshatch post-process hides
        // the aliased edges, so soft PCF isn't worth the cost here.
        renderer.shadowMap.type = THREE.BasicShadowMap;
        return renderer;
      }}
    >
      {children}
    </Canvas>
  );
};

export default WebGPUCanvas;
