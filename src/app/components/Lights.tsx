"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useHelper } from "@react-three/drei";
import * as THREE from "three";
import { useDebugUI } from "../hooks/useDebugUI";

/** Matches pixelart `OrbitingSphere` defaults: radius 8, speed 0.35, clockwise. */
function OrbitingDirectionalLight({
  radius,
  angularSpeed,
  clockwise,
  intensity,
  color,
  showHelpers,
}: {
  radius: number;
  angularSpeed: number;
  clockwise: boolean;
  intensity: number;
  color: string;
  showHelpers: boolean;
}) {
  const ref = useRef<THREE.DirectionalLight>(null!);
  const sign = clockwise ? 1 : -1;

  useHelper(showHelpers ? ref : null, THREE.DirectionalLightHelper, 1, color);

  useFrame((state) => {
    const light = ref.current;
    if (!light) return;
    const t = state.clock.elapsedTime;
    const angle = sign * angularSpeed * t;
    light.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();
  });

  return (
    <directionalLight
      ref={ref}
      intensity={intensity}
      color={color}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-near={0.5}
      shadow-camera-far={80}
      shadow-camera-left={-22}
      shadow-camera-right={22}
      shadow-camera-top={22}
      shadow-camera-bottom={-22}
    />
  );
}

function SpotShadowCameraHelper({
  lightRef,
  visible,
}: {
  lightRef: RefObject<THREE.SpotLight | null>;
  visible: boolean;
}) {
  const helperRef = useRef<THREE.CameraHelper | null>(null);
  const scene = useThree((s) => s.scene);

  useLayoutEffect(() => {
    if (!visible) return;
    const light = lightRef.current;
    if (!light) return;
    const helper = new THREE.CameraHelper(light.shadow.camera);
    scene.add(helper);
    helperRef.current = helper;
    return () => {
      scene.remove(helper);
      helper.dispose?.();
      helperRef.current = null;
    };
  }, [scene, visible, lightRef]);

  useFrame(() => {
    helperRef.current?.update();
  });

  return null;
}

type SpotlightParams = ReturnType<typeof useDebugUI>["spotlight"];

/** three.js webgl_lights_spotlight-style orbiting spotlight. */
function OrbitingSpotLight({
  showHelpers,
  spotlight,
}: {
  showHelpers: boolean;
  spotlight: SpotlightParams;
}) {
  const {
    enabled,
    intensity,
    color,
    distance,
    angle,
    penumbra,
    decay,
    orbitRadius,
    height,
    orbitSpeed,
    orbitEnabled,
    targetY,
    shadowFocus,
    shadowBias,
    shadowIntensity,
  } = spotlight;

  const spotRef = useRef<THREE.SpotLight>(null!);

  // useHelper(showHelpers && enabled ? spotRef : null, THREE.SpotLightHelper);

  useFrame((state) => {
    const light = spotRef.current;
    if (!light) return;
    if (orbitEnabled) {
      const t = state.clock.elapsedTime * orbitSpeed;
      light.position.set(
        Math.cos(t) * orbitRadius,
        height,
        Math.sin(t) * orbitRadius,
      );
    } else {
      light.position.set(2.5, height, 2.5);
    }
    light.target.position.set(0, targetY, 0);
    light.target.updateMatrixWorld();
  });

  if (!enabled) return null;

  return (
    <>
      <spotLight
        ref={spotRef}
        color={color}
        intensity={intensity}
        distance={distance}
        angle={angle}
        penumbra={penumbra}
        decay={decay}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={10}
        shadow-focus={shadowFocus}
        shadow-bias={shadowBias}
        shadow-intensity={shadowIntensity}
      >
        <object3D position={[0, targetY, 0]} attach="target" />
      </spotLight>
      {/* <SpotShadowCameraHelper lightRef={spotRef} visible={showHelpers} /> */}
    </>
  );
}

export function Lights() {
  const { lighting, spotlight } = useDebugUI();
  const {
    ambientIntensity,
    directionalIntensity,
    directionalColor,
    pointIntensity,
    pointPosition,
    pointColor,
    showHelpers,
  } = lighting;

  const pointLightRef = useRef<THREE.PointLight>(null!);
  const dirLightRef = useRef<THREE.DirectionalLight>(null!);

  useHelper(showHelpers ? pointLightRef : null, THREE.PointLightHelper, 0.5, pointColor);
  useHelper(showHelpers ? dirLightRef : null, THREE.DirectionalLightHelper, 1, directionalColor);

  return (
    <>
      <ambientLight intensity={ambientIntensity} />

      <directionalLight
        ref={dirLightRef}
        position={[0,5,0]}
        intensity={directionalIntensity}
        color={directionalColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
      />

      {/* <OrbitingDirectionalLight
        radius={12}
        angularSpeed={0.8}
        clockwise
        intensity={directionalIntensity}
        color={directionalColor}
        showHelpers={showHelpers}
      /> */}

      {/* <OrbitingSpotLight showHelpers={showHelpers} spotlight={spotlight} /> */}

      <pointLight
        ref={pointLightRef}
        position={pointPosition as [number, number, number]}
        intensity={pointIntensity}
        color={pointColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
      />
    </>
  );
}
