"use client";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { fog, color, densityFogFactor, float, uniform, uv, texture, vec3, clamp, dot, normalWorld, mix, vec4 } from "three/tsl";
import { useGLTF } from "@react-three/drei";
import { Lights } from "./Lights";
import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";

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

function createHatchMaterial() {
  // load the 6 textures — hatch_0 = brightest, hatch_5 = darkest
  const loader = new THREE.TextureLoader();
  const hatches = Array.from({ length: 6 }, (_, i) => {
    const t = loader.load(`/textures/hatch_${i}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });

  // how many times the hatch tiles across the mesh UVs
  const repeatScale = uniform(float(4));
  const tiledUV = uv().mul(repeatScale);

  // sample all 6 textures at the same tiled UV
  const h = hatches.map((tex) => texture(tex, tiledUV));

  // light direction — matches your directional light at [0, 5, 0]
  // pointing downward toward origin, normalized
  const lightDir = vec3(0, 1, 0); // upward = toward the light

  // dot product between surface normal and light direction
  // gives 0.0 (facing away) to 1.0 (fully lit)
  const brightness = clamp(dot(normalWorld, lightDir), float(0), float(1));

  // 6 textures = 6 equal steps of 1/6 each
  // blend between adjacent layers based on exact brightness position
  // this is the smooth mix the original code does
  const step = float(1 / 6);

  const blended = brightness.lessThan(step).select(
    mix(h[5], h[4], brightness.mul(6)),

    brightness.lessThan(step.mul(2)).select(
      mix(h[4], h[3], brightness.sub(step).mul(6)),

      brightness.lessThan(step.mul(3)).select(
        mix(h[3], h[2], brightness.sub(step.mul(2)).mul(6)),

        brightness.lessThan(step.mul(4)).select(
          mix(h[2], h[1], brightness.sub(step.mul(3)).mul(6)),

          brightness.lessThan(step.mul(5)).select(
            mix(h[1], h[0], brightness.sub(step.mul(4)).mul(6)),

            mix(h[0], vec4(1), brightness.sub(step.mul(5)).mul(6)),
          ),
        ),
      ),
    ),
  );

  const material = new MeshStandardNodeMaterial();
  material.colorNode = blended;
  return material;
}

function SertaoModel() {
  const { scene } = useGLTF("/sertao.glb");

  useEffect(() => {
    const mat = createHatchMaterial();
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = mat;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}

useGLTF.preload("/sertao.glb");

export function Scene() {
  return (
    <>
      {/* <SceneFog /> */}
      <Lights />
      <SertaoModel />
    </>
  );
}
