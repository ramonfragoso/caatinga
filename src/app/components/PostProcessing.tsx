"use client";
import * as THREE from "three/webgpu";
import {
  pass,
  mrt,
  output,
  normalView,
  uniform,
  vec2,
  uv,
  vec4,
  viewportSize,
  vec3,
  fract,
  mx_noise_float,
} from "three/tsl";
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";

export function PostProcessing() {
  const { gl, scene, camera } = useThree();
  const postProcessingRef = useRef<THREE.PostProcessing | null>(null);

  useEffect(() => {
    if (!gl || !scene || !camera) return;

    const scenePass = pass(scene, camera);

    scenePass.setMRT(
      mrt({
        output: output,
        normal: normalView,
      }),
    );

    const postProcessing = new THREE.PostProcessing(
      gl as unknown as THREE.Renderer,
    );

    const normalOutput = scenePass.getTextureNode("normal");
    const colorOutput = scenePass.getTextureNode("output");

    const texelSize = vec2(1.0).div(viewportSize.xy);

    const uvNode = uv();

    // sample the 4 neighbors
    const nCenter = normalOutput.sample(uvNode);
    const nUp = normalOutput.sample(uvNode.add(vec2(0, texelSize.y)));
    const nDown = normalOutput.sample(
      uvNode.add(vec2(0, texelSize.y.negate())),
    );
    const nRight = normalOutput.sample(uvNode.add(vec2(texelSize.x, 0)));
    const nLeft = normalOutput.sample(
      uvNode.add(vec2(texelSize.x.negate(), 0)),
    );

    // dot product between center and each neighbor
    const diffUp = nCenter.rgb.dot(nUp.rgb);
    const diffDown = nCenter.rgb.dot(nDown.rgb);
    const diffRight = nCenter.rgb.dot(nRight.rgb);
    const diffLeft = nCenter.rgb.dot(nLeft.rgb);

    const edgeStrength = diffUp
      .add(diffDown)
      .add(diffRight)
      .add(diffLeft)
      .div(4);

    const threshold = uniform(0.99);

    const isEdge = edgeStrength.lessThan(threshold);
    const finalColor = isEdge.select(vec4(0, 0, 0, 1), colorOutput);

    postProcessing.outputNode = finalColor;

    postProcessingRef.current = postProcessing;

    return () => {
      postProcessingRef.current = null;
    };
  }, [gl, scene, camera]);

  useFrame(() => {
    postProcessingRef.current?.render();
  }, 1);

  return null;
}
