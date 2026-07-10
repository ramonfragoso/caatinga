"use client";
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { getTerrainY } from "./Terrain";
import { findMesh, bakeNodeGeometry } from "../utils/scatter";
import { useDebugUI } from "../hooks/useDebugUI";
import { registerVulture } from "../audio/vultureRegistry";

const PERCHED_COUNT = 2;
const GROUND_COUNT = 3;

useGLTF.preload("/trees.glb");
useGLTF.preload("/sertao.glb");

/** Clone the authored `vulture_rig` n times, each running the idle clip. */
function cloneVultures(
  source: THREE.Object3D,
  clip: THREE.AnimationClip | undefined,
  count: number,
  phaseSeed: number,
) {
  const vultures: THREE.Object3D[] = [];
  const mixers: THREE.AnimationMixer[] = [];

  for (let i = 0; i < count; i++) {
    const clone = SkeletonUtils.clone(source);
    clone.visible = true; // the authored original is hidden in SertaoModel
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    const mixer = new THREE.AnimationMixer(clone);
    if (clip) {
      const action = mixer.clipAction(clip);
      // Desync so the birds don't bob in lockstep.
      action.time = ((i + phaseSeed) / count) * (clip.duration || 1);
      action.play();
    }

    vultures.push(clone);
    mixers.push(mixer);
  }
  return { vultures, mixers };
}

/**
 * The only vultures in the world: two perched in tree2's branches, and three
 * more standing on the ground at spots leading away from it.
 *
 * Perch offsets (v1-v2) are world units measured from the tree's base, so they
 * need re-dialing if `treeScale` changes. The ground birds (g1-g3) are absolute
 * world coords whose control-panel `y` is an offset above the terrain height.
 */
export function VulturesScene() {
  const { scene: trees } = useGLTF("/trees.glb");
  const { scene: sertao, animations } = useGLTF("/sertao.glb");
  const { vultureScene } = useDebugUI();

  const tree = useMemo(() => {
    const mesh = findMesh(trees, "tree2");
    if (!mesh) return null;
    const tree2 = new THREE.Mesh(bakeNodeGeometry(mesh), mesh.material);
    tree2.castShadow = true;
    tree2.receiveShadow = true;
    return tree2;
  }, [trees]);

  const { perched, ground, mixers } = useMemo(() => {
    const source = sertao.getObjectByName("vulture_rig");
    if (!source) return { perched: [], ground: [], mixers: [] };

    const idleClip =
      animations.find((a) => a.name.toLowerCase().includes("idle")) ??
      animations[0];

    const a = cloneVultures(source, idleClip, PERCHED_COUNT, 0);
    const b = cloneVultures(source, idleClip, GROUND_COUNT, 0.5);
    return {
      perched: a.vultures,
      ground: b.vultures,
      mixers: [...a.mixers, ...b.mixers],
    };
  }, [sertao, animations]);

  // Every bird is electable by the global scream scheduler.
  useEffect(() => {
    const unregister = [...perched, ...ground].map((v) => registerVulture(v));
    return () => unregister.forEach((fn) => fn());
  }, [perched, ground]);

  // Tree transform follows its live controls.
  useEffect(() => {
    if (!tree) return;
    tree.scale.setScalar(vultureScene.treeScale);
    tree.rotation.y = vultureScene.treeYaw;
  }, [tree, vultureScene.treeScale, vultureScene.treeYaw]);

  // Perch each vulture from its own position/rotation/scale controls.
  useEffect(() => {
    const perches = [
      { p: vultureScene.v1Position, r: vultureScene.v1Rotation, s: vultureScene.v1Scale },
      { p: vultureScene.v2Position, r: vultureScene.v2Rotation, s: vultureScene.v2Scale },
    ];
    perched.forEach((v, i) => {
      const { p, r, s } = perches[i];
      v.position.set(p[0], p[1], p[2]);
      v.rotation.set(r[0], r[1], r[2]);
      v.scale.setScalar(s);
    });
  }, [
    perched,
    vultureScene.v1Position, vultureScene.v1Rotation, vultureScene.v1Scale,
    vultureScene.v2Position, vultureScene.v2Rotation, vultureScene.v2Scale,
  ]);

  // Stand the ground birds on the terrain, `y` acting as a lift off the surface.
  useEffect(() => {
    const spots = [
      { p: vultureScene.g1Position, r: vultureScene.g1Rotation, s: vultureScene.g1Scale },
      { p: vultureScene.g2Position, r: vultureScene.g2Rotation, s: vultureScene.g2Scale },
      { p: vultureScene.g3Position, r: vultureScene.g3Rotation, s: vultureScene.g3Scale },
    ];
    ground.forEach((v, i) => {
      const { p, r, s } = spots[i];
      v.position.set(p[0], getTerrainY(p[0], p[2]) + p[1], p[2]);
      v.rotation.set(r[0], r[1], r[2]);
      v.scale.setScalar(s);
    });
  }, [
    ground,
    vultureScene.g1Position, vultureScene.g1Rotation, vultureScene.g1Scale,
    vultureScene.g2Position, vultureScene.g2Rotation, vultureScene.g2Scale,
    vultureScene.g3Position, vultureScene.g3Rotation, vultureScene.g3Scale,
  ]);

  useFrame((_, delta) => {
    for (const mixer of mixers) mixer.update(delta);
  });

  const [sx, , sz] = vultureScene.scenePosition;

  return (
    <>
      <group position={[sx, getTerrainY(sx, sz), sz]}>
        {tree && <primitive object={tree} />}
        {perched.map((v, i) => (
          <primitive key={`perched-${i}`} object={v} />
        ))}
      </group>
      {ground.map((v, i) => (
        <primitive key={`ground-${i}`} object={v} />
      ))}
    </>
  );
}
