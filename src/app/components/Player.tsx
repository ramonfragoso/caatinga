"use client";
import { useFrame } from "@react-three/fiber";
import { Vector3, Matrix4, Mesh, Color, Quaternion, Euler } from "three";
import { usePlayerControls } from "../hooks/usePlayerControls";
import { useEffect, useRef } from "react";
import { WebGPUToonMaterial } from "./WebGPUToonMaterial";

const PATH_POINTS = [
  new Vector3(0, 20, 0),
  new Vector3(-2000, 30, 2000),
  new Vector3(1500, 25, -1500),
  new Vector3(-2000, 30, 3000),
];
const MOVE_SPEED = 200;

export const playerPosition = new Vector3(0, 0, 0);

export const x = new Vector3(1, 0, 0)
export const y = new Vector3(0, 1, 0)
export const z = new Vector3(0, 0, 1)

const delayedRotMatrix = new Matrix4()
const delayedQuaternion = new Quaternion()

const cameraYaw = { value: 0 };
const cameraPitch = { value: 0.3 };

export function Player() {
  const playerRef = useRef<Mesh>(null)
  const targetIndexRef = useRef(1);

  const { updatePlayerPosition } = usePlayerControls();

  // --- Pointer Lock + Mouse Look ---
  useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const onClick = () => canvas.requestPointerLock();
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const sensitivity = 0.002;
      cameraYaw.value -= e.movementX * sensitivity;
      cameraPitch.value -= e.movementY * sensitivity;
      cameraPitch.value = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cameraPitch.value));
    };

    canvas.addEventListener("click", onClick);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);


  useFrame(({ camera }, delta) => {
    if (playerRef.current) {
      // updatePlayerPosition(x, y, z, playerPosition, camera, delta);
      // const matrix = new Matrix4()
      //   .multiply(new Matrix4().makeTranslation(playerPosition.x, 0, playerPosition.z))
      // playerRef.current.matrixAutoUpdate = false
      // playerRef.current.matrix.copy(matrix)
      // playerRef.current.matrixWorldNeedsUpdate = true

      // const rotMatrix = new Matrix4().makeBasis(x, y, z)

      // const quaternionA = new Quaternion().copy(delayedQuaternion)
      // const quaternionB = new Quaternion()
      // quaternionB.setFromRotationMatrix(rotMatrix)

      // const interpolationFactor = 0.0175 * delta * 60
      // const interpolatedQuaternion = new Quaternion().copy(quaternionA)
      // interpolatedQuaternion.slerp(quaternionB, Math.min(interpolationFactor, 1))
      // delayedQuaternion.copy(interpolatedQuaternion)
      // delayedRotMatrix.identity()
      // delayedRotMatrix.makeRotationFromQuaternion(delayedQuaternion)
      // --- Path following ---
      const target = PATH_POINTS[targetIndexRef.current];
      const toTarget = new Vector3().subVectors(target, playerPosition);
      const distanceToTarget = toTarget.length();
      const stepSize = MOVE_SPEED * delta;

      if (distanceToTarget <= stepSize) {
        // Snap to target and advance to next point
        playerPosition.copy(target);
        targetIndexRef.current = (targetIndexRef.current + 1) % PATH_POINTS.length;
      } else {
        // Move toward target
        toTarget.normalize().multiplyScalar(stepSize);
        playerPosition.add(toTarget);
      }

      // --- Update facing direction (x/y/z basis) to match movement direction ---
      const direction = new Vector3().subVectors(target, playerPosition);
      if (direction.lengthSq() > 0.0001) {
        direction.normalize();
        z.copy(direction).negate();         // forward is -Z in Three.js
        x.crossVectors(y, z).normalize();   // right
        // y stays (0,1,0) — no tilting
      }

      // --- Player mesh matrix ---
      const matrix = new Matrix4().makeTranslation(
        playerPosition.x,
        playerPosition.y,
        playerPosition.z
      );
      playerRef.current.matrixAutoUpdate = false;
      playerRef.current.matrix.copy(matrix);
      playerRef.current.matrixWorldNeedsUpdate = true;

      // --- Smooth rotation of the mesh ---
      const rotMatrix = new Matrix4().makeBasis(x, y, z);
      const quaternionB = new Quaternion().setFromRotationMatrix(rotMatrix);
      const interpolationFactor = 0.0175 * delta * 60;
      delayedQuaternion.slerp(quaternionB, Math.min(interpolationFactor, 1));
      delayedRotMatrix.makeRotationFromQuaternion(delayedQuaternion);


      const distance = 0;
      const headHeight = 1.5;

      const yawQuat = new Quaternion().setFromEuler(
        new Euler(0, cameraYaw.value, 0, "YXZ")
      );
      const pitchQuat = new Quaternion().setFromEuler(
        new Euler(cameraPitch.value, 0, 0, "YXZ")
      );
      const cameraQuat = new Quaternion()
        .copy(yawQuat)
        .multiply(pitchQuat);

      const offset = new Vector3(0, 0, distance).applyQuaternion(cameraQuat);

      const cameraPos = new Vector3(
        playerPosition.x + offset.x,
        playerPosition.y + offset.y,
        playerPosition.z + offset.z
      );

      const cameraMatrix = new Matrix4()
        .makeRotationFromQuaternion(cameraQuat)
        .setPosition(cameraPos);


      if ("isPerspectiveCamera" in camera && camera.isPerspectiveCamera) {
        camera.fov = 40
        camera.updateProjectionMatrix()
      }
      camera.matrixAutoUpdate = false;
      camera.matrix.copy(cameraMatrix);
      camera.matrixWorldNeedsUpdate = true;
    }

  });

  return <mesh ref={playerRef} >
    <capsuleGeometry args={[0.3, 0.5, 4, 8, 1]} />
    <WebGPUToonMaterial color={'#ff0000'} preset={'sixTone'} />
  </mesh>;
}
