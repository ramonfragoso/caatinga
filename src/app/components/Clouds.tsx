"use client";
import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from "three/webgpu";
import { playerPosition } from "./Player";

const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const BOX_MAT = new MeshBasicNodeMaterial({ color: "white" });

type BoxConfig = {
  lx: number;
  ly: number;
  lz: number;
  sx: number;
  sy: number;
  sz: number;
};

type CloudConfig = {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  boxes: BoxConfig[];
  height: number;
};

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _rot = new THREE.Quaternion();
const _scale = new THREE.Vector3();

function buildBoxConfigs(size: [number, number, number], count: number): BoxConfig[] {
  const out: BoxConfig[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      lx: Math.random() * size[0],
      ly: Math.random() * size[1],
      lz: Math.random() * size[2],
      sx: 0.6 + Math.random() * (2.2 - 0.6),
      sy: 0.6 + Math.random() * (1.8 - 0.6),
      sz: 0.6 + Math.random() * (2.2 - 0.6),
    });
  }
  return out;
}

function buildCloudConfigs(
  count: number,
  spread: number,
  height: number,
): CloudConfig[] {
  const out: CloudConfig[] = [];
  for (let i = 0; i < count; i++) {
    const px = (Math.random() - 0.5) * spread;
    const pz = (Math.random() - 0.5) * spread;

    const dx = 1.0 + (0.3 * 0.2 - 0.1);
    const dz = 0.3 * 0.12 - 0.06;
    const dir = new THREE.Vector3(dx, 0, dz).normalize();

    const w = 12 + Math.random() * (22 - 12);
    const h = 2 + Math.random() * (4 - 2);
    const d = 8 + Math.random() * (14 - 8);
    const boxCount = Math.floor(18 + Math.random() * (35 - 18));

    out.push({
      position: new THREE.Vector3(px, 0, pz),
      direction: dir,
      boxes: buildBoxConfigs([w, h, d], boxCount),
      height,
    });
  }
  return out;
}

function CloudMesh({ boxes }: { boxes: BoxConfig[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      _pos.set(b.lx, b.ly, b.lz);
      _scale.set(b.sx, b.sy, b.sz);
      _mat.compose(_pos, _rot, _scale);
      mesh.setMatrixAt(i, _mat);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [boxes]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[BOX_GEO, BOX_MAT, boxes.length]}
      scale={2.0}
    />
  );
}

type CloudsProps = {
  count?: number;
  spread?: number;
  height?: number;
  speed?: number;
};

export function Clouds({
  count = 40,
  spread = 2000,
  height = 30,
  speed = 8,
}: CloudsProps) {
  const rootRef = useRef<THREE.Group>(null);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);

  const cloudConfigsRef = useRef<CloudConfig[] | null>(null);
  if (!cloudConfigsRef.current) {
    cloudConfigsRef.current = buildCloudConfigs(count, spread, height);
  }
  const configs = cloudConfigsRef.current;

  const halfSpread = spread / 2;

  useFrame((_, delta) => {
    if (rootRef.current) {
      rootRef.current.position.x = playerPosition.x;
      rootRef.current.position.z = playerPosition.z;
    }

    for (let i = 0; i < configs.length; i++) {
      const ref = groupRefs.current[i];
      if (!ref) continue;

      const cfg = configs[i];
      cfg.position.addScaledVector(cfg.direction, speed * delta);

      if (cfg.position.x > halfSpread) cfg.position.x -= spread;
      else if (cfg.position.x < -halfSpread) cfg.position.x += spread;

      if (cfg.position.z > halfSpread) cfg.position.z -= spread;
      else if (cfg.position.z < -halfSpread) cfg.position.z += spread;

      ref.position.x = cfg.position.x;
      ref.position.z = cfg.position.z;
    }
  });

  return (
    <group ref={rootRef}>
      {configs.map((cfg, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el; }}
          position={[cfg.position.x, cfg.height, cfg.position.z]}
        >
          <CloudMesh boxes={cfg.boxes} />
        </group>
      ))}
    </group>
  );
}
