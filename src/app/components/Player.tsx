"use client";
import { useFrame } from "@react-three/fiber";
import { Vector3, Mesh, Quaternion, Euler } from "three";
import { useEffect, useRef } from "react";
import { WebGPUToonMaterial } from "./WebGPUToonMaterial";

const PLAYER_SPEED = 30;
const PLAYER_MOVE_SMOOTHING = 8;

// World position of the player. Exported for use by other components (clouds, etc).
export const playerPosition = new Vector3(0, 2, 0);

const keys: Record<string, boolean> = {};

const cameraYaw = { value: 0 };
const cameraPitch = { value: 0.1 };

const playerVelocity = new Vector3();

const _yawQuat = new Quaternion();
const _pitchQuat = new Quaternion();
const _localCamQuat = new Quaternion();
const _localFwd = new Vector3();
const _localRight = new Vector3();
const _moveDir = new Vector3();
const _targetVel = new Vector3();

export function Player() {
  const playerRef = useRef<Mesh>(null);

  useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const onKeyDown = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    const onClick = () => canvas.requestPointerLock();
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const sensitivity = 0.002;
      cameraYaw.value -= e.movementX * sensitivity;
      cameraPitch.value -= e.movementY * sensitivity;
      cameraPitch.value = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, cameraPitch.value));
    };

    canvas.addEventListener("click", onClick);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame(({ camera }, delta) => {
    if (!playerRef.current) return;

    _yawQuat.setFromEuler(new Euler(0, cameraYaw.value, 0, "YXZ"));

    _localFwd.set(0, 0, -1).applyQuaternion(_yawQuat);
    _localFwd.y = 0;
    _localFwd.normalize();

    _localRight.set(1, 0, 0).applyQuaternion(_yawQuat);
    _localRight.y = 0;
    _localRight.normalize();

    _moveDir.set(0, 0, 0);
    if (keys["KeyW"] || keys["KeyZ"] || keys["ArrowUp"])    _moveDir.add(_localFwd);
    if (keys["KeyS"] || keys["ArrowDown"])                  _moveDir.sub(_localFwd);
    if (keys["KeyD"] || keys["ArrowRight"])                 _moveDir.add(_localRight);
    if (keys["KeyA"] || keys["KeyQ"] || keys["ArrowLeft"])  _moveDir.sub(_localRight);

    if (_moveDir.lengthSq() > 0) {
      _moveDir.normalize();
      _targetVel.copy(_moveDir).multiplyScalar(PLAYER_SPEED);
    } else {
      _targetVel.set(0, 0, 0);
    }

    const moveT = 1 - Math.exp(-PLAYER_MOVE_SMOOTHING * delta);
    playerVelocity.lerp(_targetVel, moveT);

    playerPosition.x += playerVelocity.x * delta;
    playerPosition.z += playerVelocity.z * delta;

    playerRef.current.position.copy(playerPosition);

    _pitchQuat.setFromEuler(new Euler(cameraPitch.value, 0, 0, "YXZ"));
    _localCamQuat.copy(_yawQuat).multiply(_pitchQuat);

    if ("isPerspectiveCamera" in camera && camera.isPerspectiveCamera) {
      camera.fov = 80;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(playerPosition);
    camera.quaternion.copy(_localCamQuat);
    camera.matrixAutoUpdate = true;
  });

  return (
    <mesh ref={playerRef}>
      <capsuleGeometry args={[0.3, 0.5, 4, 8, 1]} />
      <WebGPUToonMaterial color={"#ff0000"} preset={"sixTone"} />
    </mesh>
  );
}
