"use client";

import { useGLTF, useHelper } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { DirectionalLightHelper, Vector2 } from "three";
import { trainCage, trainPosition, trainQuaternion } from "./Player";
import { CameraStableMeshToonNodeMaterial } from "../utils/CameraStableMeshToonNodeMaterial";
import { getToonGradientTexture } from "../utils/toonGradientTextures";

type TrainLightsConfig = {
  showHelpers: boolean;
  light1Color: string;
  light1Intensity: number;
  light1Distance: number;
  light1Position: [number, number, number];
  light2Color: string;
  light2Intensity: number;
  light2Distance: number;
  light2Position: [number, number, number];
  light3Color: string;
  light3Intensity: number;
  light3Distance: number;
  light3Position: [number, number, number];
  light4Color: string;
  light4Intensity: number;
  light4Distance: number;
  light4Position: [number, number, number];
};

type EmissiveConfig = {
  color: string;
  intensity: number;
};

type TrainSunConfig = {
  enabled: boolean;
  showHelpers: boolean;
  color: string;
  intensity: number;
  position: [number, number, number];
  rotation: [number, number, number];
  helperSize: number;
};

const EMISSIVE_MATERIAL_NAME = "emissive";
const CAGE_MESH_NAME = "cage";

function buildWebGPUMaterial(
  src: THREE.Material,
  toonGradient: THREE.DataTexture,
): THREE.Material {
  const srcStd = src as THREE.MeshStandardMaterial;

  // Materials authored as "emissive" in the GLB are turned into self-lit
  // node materials whose emissive properties are driven from the debug UI.
  if (src.name === EMISSIVE_MATERIAL_NAME) {
    const mat = new THREE.MeshStandardNodeMaterial();
    mat.name = src.name;
    mat.color.set("#000000");
    mat.roughness = 1;
    mat.metalness = 0;
    mat.emissive = new THREE.Color("#ffaa33");
    mat.emissiveIntensity = 1;
    mat.toneMapped = false;
    mat.side = src.side;
    return mat;
  }

  if (srcStd.map) {
    // Baked-texture mesh — keep the diffuse map, use a WebGPU node material.
    // Force channel 0 (UVMap) so the correct UV set is always used.
    srcStd.map.channel = 0;
    const mat = new THREE.MeshStandardNodeMaterial();
    mat.name = src.name;
    mat.map = srcStd.map;
    mat.color.copy(srcStd.color);
    mat.roughness = 1;
    mat.metalness = 0;
    mat.side = src.side;
    return mat;
  }

  // Solid-color mesh — toon shading via CameraStableMeshToonNodeMaterial.
  const mat = new CameraStableMeshToonNodeMaterial({
    gradientMap: toonGradient,
  });
  mat.name = src.name;
  mat.color.copy(srcStd.color);
  mat.side = src.side;
  return mat;
}

// 2D convex hull (Andrew's monotone chain). Returns a CCW polygon.
function convexHull2D(points: Vector2[]): Vector2[] {
  const pts = points
    .map((p) => p.clone())
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (pts.length < 3) return pts;

  const cross = (o: Vector2, a: Vector2, b: Vector2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Vector2[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Vector2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

type BuiltTrain = {
  scene: THREE.Object3D;
  emissiveMaterials: THREE.MeshStandardNodeMaterial[];
  cagePolygon: Vector2[];
};

function buildTrainScene(
  gltfScene: THREE.Object3D,
  toonGradient: THREE.DataTexture,
): BuiltTrain {
  const matCache = new Map<string, THREE.Material>();
  const emissiveMaterials: THREE.MeshStandardNodeMaterial[] = [];
  const clone = gltfScene.clone(true);

  let cageMesh: THREE.Mesh | null = null;

  clone.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;

    if (node.name === CAGE_MESH_NAME) {
      cageMesh = node;
      node.visible = false;
      // Don't pay the shader cost on a hidden mesh.
      node.castShadow = false;
      node.receiveShadow = false;
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;

    const replaceMaterial = (src: THREE.Material): THREE.Material => {
      const cached = matCache.get(src.uuid);
      if (cached) return cached;
      const built = buildWebGPUMaterial(src, toonGradient);
      matCache.set(src.uuid, built);
      if (built.name === EMISSIVE_MATERIAL_NAME) {
        emissiveMaterials.push(built as THREE.MeshStandardNodeMaterial);
      }
      return built;
    };

    if (Array.isArray(node.material)) {
      node.material = node.material.map(replaceMaterial);
    } else {
      node.material = replaceMaterial(node.material);
    }
  });

  // Extract cage polygon in train-local XZ space.
  const cagePolygon: Vector2[] = [];
  if (cageMesh) {
    // `clone` is the train's local root. Compute cage transform relative to it.
    clone.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(clone.matrixWorld).invert();
    const localToTrain = new THREE.Matrix4().multiplyMatrices(
      inv,
      (cageMesh as THREE.Mesh).matrixWorld,
    );

    const positions = (cageMesh as THREE.Mesh).geometry.attributes.position;
    const tmp = new THREE.Vector3();
    const points: Vector2[] = [];
    for (let i = 0; i < positions.count; i++) {
      tmp.fromBufferAttribute(positions, i).applyMatrix4(localToTrain);
      points.push(new Vector2(tmp.x, tmp.z));
    }
    cagePolygon.push(...convexHull2D(points));
  }

  return { scene: clone, emissiveMaterials, cagePolygon };
}

const _finalMatrix = new THREE.Matrix4();

// Reusable temporaries for TrainSun target computation.
const _sunLocalPos = new THREE.Vector3();
const _sunDir = new THREE.Vector3();
const _euler = new THREE.Euler();
const _rotMat = new THREE.Matrix4();

/**
 * Directional sun-style light that lives inside the train group, so it
 * automatically follows the train as it moves and turns.
 *
 * Both the light position and its target are expressed in the train's local
 * frame, meaning the entire sun orientation rotates with the train — the sun
 * always shines from the same side of the train regardless of which way the
 * train faces.
 *
 * The `rotation` from the debug UI tilts the light direction in local space
 * around the base direction (from the configured position toward the local
 * origin), giving the same artistic control as before.
 */
function TrainSun({ sun }: { sun: TrainSunConfig }) {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const targetRef = useRef<THREE.Object3D>(null!);

  useHelper(
    sun.showHelpers ? lightRef : null,
    DirectionalLightHelper,
    sun.helperSize,
    sun.color,
  );

  // Wire the light's target to our explicit target object once on mount.
  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);

  useFrame(() => {
    const target = targetRef.current;
    if (!target) return;

    // Light position in local train space (from the debug UI).
    _sunLocalPos.set(sun.position[0], sun.position[1], sun.position[2]);

    // Base direction in local space: from the light toward the train's local origin.
    _sunDir.copy(_sunLocalPos).negate().normalize();

    // Apply the rotation offsets from the debug UI as an additional tilt in local space.
    _euler.set(sun.rotation[0], sun.rotation[1], sun.rotation[2], "XYZ");
    _rotMat.makeRotationFromEuler(_euler);
    _sunDir.applyMatrix4(_rotMat);

    // Place the target one unit along the final direction from the light in local space.
    target.position.copy(_sunLocalPos).addScaledVector(_sunDir, 1);
    target.updateMatrixWorld();
  });

  return (
    <>
      <directionalLight
        ref={lightRef}
        color={sun.color}
        intensity={sun.intensity}
        position={sun.position}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <object3D ref={targetRef} />
    </>
  );
}

export function Train({
  yOffset,
  trainLights,
  emissive,
  sun,
}: {
  yOffset: number;
  trainLights?: TrainLightsConfig;
  emissive?: EmissiveConfig;
  sun?: TrainSunConfig;
}) {
  const { scene } = useGLTF("/train.glb");
  const groupRef = useRef<THREE.Group>(null);
  const light1Ref = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);
  const light3Ref = useRef<THREE.PointLight>(null);
  const light4Ref = useRef<THREE.PointLight>(null);

  const toonGradient = useMemo(() => getToonGradientTexture("fiveTone"), []);

  const built = useMemo(
    () => buildTrainScene(scene, toonGradient),
    [scene, toonGradient],
  );

  // Publish the cage polygon to the shared module so Player.tsx can constrain
  // movement to the cage area.
  useEffect(() => {
    trainCage.polygon = built.cagePolygon;
    return () => {
      trainCage.polygon = [];
    };
  }, [built]);

  // Drive emissive material props from the debug UI.
  useEffect(() => {
    if (!emissive) return;
    for (const mat of built.emissiveMaterials) {
      mat.emissive.set(emissive.color);
      mat.emissiveIntensity = emissive.intensity;
    }
  }, [built, emissive?.color, emissive?.intensity, emissive]);

  // Snap the train's transform to the shared (already-smoothed) train rotation
  // and position from Player.tsx, so cage / camera / player all stay in sync.
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    _finalMatrix.makeRotationFromQuaternion(trainQuaternion);
    _finalMatrix.setPosition(
      trainPosition.x,
      trainPosition.y + yOffset,
      trainPosition.z,
    );

    g.matrixAutoUpdate = false;
    g.matrix.copy(_finalMatrix);
    g.matrixWorldNeedsUpdate = true;
  });

  const l = trainLights;

  return (
    <group ref={groupRef}>
      <primitive object={built.scene} />

      {sun?.enabled && <TrainSun sun={sun} />}

    </group>
  );
}

useGLTF.preload("/train.glb");
