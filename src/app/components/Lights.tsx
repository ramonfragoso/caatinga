"use client";
import { useRef } from "react";
import { useHelper } from "@react-three/drei";
import * as THREE from "three";
import { useDebugUI } from "../hooks/useDebugUI";

export function Lights() {
  const { lighting } = useDebugUI();
  const {
    ambientIntensity,
    directionalIntensity,
    directionalPosition,
    directionalColor,
    pointIntensity,
    pointPosition,
    pointColor,
    showHelpers,
  } = lighting;

  const directionalLightRef = useRef<THREE.DirectionalLight>(null!);
  const pointLightRef = useRef<THREE.PointLight>(null!);

  // Add helpers for directional and point lights
  useHelper(showHelpers ? directionalLightRef : null, THREE.DirectionalLightHelper, 1, directionalColor);
  useHelper(showHelpers ? pointLightRef : null, THREE.PointLightHelper, 0.5, pointColor);

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      
      <directionalLight 
        ref={directionalLightRef}
        position={directionalPosition as [number, number, number]} 
        intensity={directionalIntensity}
        color={directionalColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      
      <pointLight 
        ref={pointLightRef}
        position={pointPosition as [number, number, number]} 
        intensity={pointIntensity}
        color={pointColor}
      />
    </>
  );
}
