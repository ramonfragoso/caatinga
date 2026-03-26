"use client";
import { useFrame } from "@react-three/fiber";
import { Vector3, Matrix4, Mesh, Color, Quaternion } from "three";
import { usePlayerControls } from "../hooks/usePlayerControls";
import { useRef } from "react";

export const playerPosition = new Vector3(0, 0, 0);

export const x = new Vector3(1, 0, 0)
export const y = new Vector3(0, 1, 0)
export const z = new Vector3(0, 0, 1)

const delayedRotMatrix = new Matrix4()
const delayedQuaternion = new Quaternion()

export function Player() {
  const playerRef = useRef<Mesh>(null)
  const { updatePlayerPosition } = usePlayerControls();

  useFrame(({ camera }, delta) => {
    if (playerRef.current) {
      updatePlayerPosition(x, y, z, playerPosition, camera, delta);
      const matrix = new Matrix4()
        .multiply(new Matrix4().makeTranslation(playerPosition.x, 0, playerPosition.z))
      playerRef.current.matrixAutoUpdate = false
      playerRef.current.matrix.copy(matrix)
      playerRef.current.matrixWorldNeedsUpdate = true

      const rotMatrix = new Matrix4().makeBasis(x, y, z)

      const quaternionA = new Quaternion().copy(delayedQuaternion)
      const quaternionB = new Quaternion()
      quaternionB.setFromRotationMatrix(rotMatrix)

      const interpolationFactor = 0.0175 * delta * 60
      const interpolatedQuaternion = new Quaternion().copy(quaternionA)
      interpolatedQuaternion.slerp(quaternionB, Math.min(interpolationFactor, 1))
      delayedQuaternion.copy(interpolatedQuaternion)
      delayedRotMatrix.identity()
      delayedRotMatrix.makeRotationFromQuaternion(delayedQuaternion)

      const cameraMatrix = new Matrix4()
      .multiply(new Matrix4().makeTranslation(playerPosition.x, 0, playerPosition.z))
      .multiply(delayedRotMatrix)
      .multiply(new Matrix4().makeRotationX(-0.3))
      .multiply(new Matrix4().makeTranslation(0, 0, 10))

      camera.matrixAutoUpdate = false
      camera.matrix.copy(cameraMatrix)
      camera.matrixWorldNeedsUpdate = true
    }

  });

  return <mesh ref={playerRef} >
    <capsuleGeometry args={[0.3, 0.5, 4, 8, 1]} />
    <meshToonMaterial wireframe color={new Color("#ff0000")} />
  </mesh>;
}
