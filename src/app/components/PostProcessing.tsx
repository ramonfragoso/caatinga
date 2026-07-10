"use client";
import * as THREE from "three/webgpu";
import {
  pass,
  mrt,
  output,
  normalView,
  depth,
  uniform,
  vec2,
  vec3,
  vec4,
  uv,
  texture,
  viewportSize,
  fract,
} from "three/tsl";
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import { useTexture } from "@react-three/drei";
import { useDebugUI } from "../hooks/useDebugUI";

interface PostProcessingProps {
  any?: any;
}

export function PostProcessing({}: PostProcessingProps) {
  const { gl, scene, camera } = useThree();
  const { hatching } = useDebugUI();
  const hatchTextures = useTexture(
    Array.from({ length: 6 }, (_, i) => `/textures/hatch_${i}.jpg`),
  );
  const postProcessingRef = useRef<THREE.PostProcessing | null>(null);
  const hatchThresholdsRef = useRef<Record<string, ReturnType<typeof uniform>> | null>(
    null,
  );

  useEffect(() => {
    if (!gl || !scene || !camera) return;

    // configure textures for tiling
    hatchTextures.forEach((t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
    });

    const scenePass = pass(scene, camera);

    scenePass.setMRT(
      mrt({
        output: output,
        normal: normalView,
        depth: depth,
      }),
    );

    const postProcessing = new THREE.PostProcessing(
      gl as unknown as THREE.Renderer,
    );

    const normalOutput = scenePass.getTextureNode("normal");
    const colorOutput = scenePass.getTextureNode("output");
    const depthOutput = scenePass.getTextureNode("depth");

    // ─── outline pass ─────────────────────────────────────────────

    const texelSize = vec2(0.6).div(viewportSize.xy);
    const uvNode = uv();

    const nCenter = normalOutput.sample(uvNode);
    const nUp = normalOutput.sample(uvNode.add(vec2(0, texelSize.y)));
    const nDown = normalOutput.sample(
      uvNode.add(vec2(0, texelSize.y.negate())),
    );
    const nRight = normalOutput.sample(uvNode.add(vec2(texelSize.x, 0)));
    const nLeft = normalOutput.sample(
      uvNode.add(vec2(texelSize.x.negate(), 0)),
    );

    const diffUp = nCenter.rgb.dot(nUp.rgb);
    const diffDown = nCenter.rgb.dot(nDown.rgb);
    const diffRight = nCenter.rgb.dot(nRight.rgb);
    const diffLeft = nCenter.rgb.dot(nLeft.rgb);

    const edgeStrength = diffUp
      .add(diffDown)
      .add(diffRight)
      .add(diffLeft)
      .div(4);
    const outlineThreshold = uniform(0.99);

    const dCenter = depthOutput.sample(uvNode);
    const dUp = depthOutput.sample(uvNode.add(vec2(0, texelSize.y)));
    const dDown = depthOutput.sample(uvNode.add(vec2(0, texelSize.y.negate())));
    const dRight = depthOutput.sample(uvNode.add(vec2(texelSize.x, 0)));
    const dLeft = depthOutput.sample(uvNode.add(vec2(texelSize.x.negate(), 0)));

    const depthDiff = dCenter
      .sub(dUp)
      .abs()
      .add(dCenter.sub(dDown).abs())
      .add(dCenter.sub(dRight).abs())
      .add(dCenter.sub(dLeft).abs());

    const depthThreshold = uniform(0.002); // tune this — depth is nonlinear, very sensitive near camera
    const isSilhouette = depthDiff.greaterThan(depthThreshold);

    // ─── crosshatch pass ──────────────────────────────────────────

    // Use NdotL from the view-space normal rather than the rendered color so
    // shadow maps don't drive hatch density (shadows are still visible in the
    // output color, but hatching reflects geometry shading only).
    const brightness = colorOutput.rgb.dot(vec3(0.299, 0.587, 0.114));

    // how many times the hatch texture tiles across the screen
    const tiling = uniform(9.0);
    const tiledUV = fract(uvNode.mul(tiling));
    // sample all 6 textures at tiled UV
    const h0 = texture(hatchTextures[0], tiledUV).r;
    const h1 = texture(hatchTextures[1], tiledUV).r;
    const h2 = texture(hatchTextures[2], tiledUV).r;
    const h3 = texture(hatchTextures[3], tiledUV).r;
    const h4 = texture(hatchTextures[4], tiledUV).r;
    const h5 = texture(hatchTextures[5], tiledUV).r;
    const h6 = 0.0;

    // pick texture based on brightness — darkest areas get densest hatch
    const hatchThreshold0 = uniform(hatching.threshold0);
    const hatchThreshold1 = uniform(hatching.threshold1);
    const hatchThreshold2 = uniform(hatching.threshold2);
    const hatchThreshold3 = uniform(hatching.threshold3);
    const hatchThreshold4 = uniform(hatching.threshold4);
    const hatchThreshold5 = uniform(hatching.threshold5);
    const hatchThreshold6 = uniform(hatching.threshold6);
    hatchThresholdsRef.current = {
      threshold0: hatchThreshold0,
      threshold1: hatchThreshold1,
      threshold2: hatchThreshold2,
      threshold3: hatchThreshold3,
      threshold4: hatchThreshold4,
      threshold5: hatchThreshold5,
      threshold6: hatchThreshold6,
    };

    const hatchValue = brightness.greaterThan(hatchThreshold0).select(
      1.0, // very bright → no hatch
      brightness.greaterThan(hatchThreshold1).select(
        h0, // light shadow → sparse hatch
        brightness.greaterThan(hatchThreshold2).select(
          h1,
          brightness.greaterThan(hatchThreshold3).select(
            h2,
            brightness.greaterThan(hatchThreshold4).select(
              h3,
              brightness.greaterThan(hatchThreshold5).select(
                h4,
                brightness.greaterThan(hatchThreshold6).select(h5, h6), // very dark → dense hatch
              ),
            ),
          ),
        ),
      ),
    );

    const depthValue = depthOutput.sample(uvNode);

    const isFarEdge = depthValue.greaterThan(0.999);
    const isBackground = depthOutput.lessThan(1.0).not();
    const afterHatch = vec4(
      colorOutput.rgb.mul(isBackground.select(vec3(1.0), vec3(hatchValue))),
      colorOutput.a,
    );
    const isEdge = edgeStrength
      .lessThan(outlineThreshold)
      .and(isBackground.not())
      .and(isFarEdge.not())
      .and(isSilhouette); // ← add this

    // ─── compose: outline on top of hatched color ─────────────────

    const finalColor = isEdge.select(vec4(0, 0, 0, 1), afterHatch);

    postProcessing.outputNode = finalColor;
    postProcessingRef.current = postProcessing;

    return () => {
      postProcessingRef.current = null;
    };
  }, [gl, scene, camera, hatchTextures]);

  // Sync threshold uniforms on change without rebuilding the node graph.
  useEffect(() => {
    const thresholds = hatchThresholdsRef.current;
    if (!thresholds) return;
    thresholds.threshold0.value = hatching.threshold0;
    thresholds.threshold1.value = hatching.threshold1;
    thresholds.threshold2.value = hatching.threshold2;
    thresholds.threshold3.value = hatching.threshold3;
    thresholds.threshold4.value = hatching.threshold4;
    thresholds.threshold5.value = hatching.threshold5;
    thresholds.threshold6.value = hatching.threshold6;
  }, [hatching]);

  useFrame(({ camera }) => {
    // Transform world-space "toward light" dir ([0,1,0] for light at [0,5,0]→origin)
    // into view space so the dot product matches the captured normalView.
    postProcessingRef.current?.render();
  }, 1);

  return null;
}
