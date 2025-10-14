"use client";
import { useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface GLBModelProps {
  url: string;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  autoRotate?: boolean;
  rotationSpeed?: number;
}

export function GLBModel({ 
  url, 
  position = [0, 0, 0], 
  scale = [1, 1, 1], 
  rotation = [0, 0, 0],
  autoRotate = false,
  rotationSpeed = 0.01
}: GLBModelProps) {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);

  // Auto-rotate animation
  useFrame(() => {
    if (modelRef.current && autoRotate) {
      modelRef.current.rotation.y += rotationSpeed;
    }
  });

  // Clone the scene to avoid issues with multiple instances
  const clonedScene = scene.clone();

  return (
    <group 
      ref={modelRef}
      position={position}
      scale={scale}
      rotation={rotation}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

// Preload the model for better performance
useGLTF.preload("/cozy_room.glb");
