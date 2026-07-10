"use client";
import { useFrame } from "@react-three/fiber";
import { Vector3, Mesh, Quaternion, Euler } from "three";
import { useEffect, useRef } from "react";
import { WebGPUToonMaterial } from "./WebGPUToonMaterial";
import { getTerrainY, TERRAIN_SIZE } from "./Terrain";
import { useDebugUI } from "../hooks/useDebugUI";

export const PLAYER_SPEED = 10;
const PLAYER_MOVE_SMOOTHING = 8;

// Keep the player away from the terrain edge, where the ground stops and the
// skybox meets nothing.
const BORDER_MARGIN = 30;
const WALK_LIMIT = TERRAIN_SIZE / 2 - BORDER_MARGIN;

// Start out on the eastern flats, looking back toward the world origin.
const START_X = 455;
const START_Z = 13;

// World position of the player. Exported for use by other components (clouds, etc).
export const playerPosition = new Vector3(START_X, 0, START_Z);

// First-person controls stay disabled until the entry sequence finishes.
// The parent flips `controls.enabled` in EntrySequence's onComplete callback.
export const controls = { enabled: false };

const keys: Record<string, boolean> = {};

// Face the world origin: the yaw whose forward vector (-sin y, 0, -cos y) points
// from the start position back to (0, 0).
const cameraYaw = { value: Math.atan2(START_X, START_Z) };
const cameraPitch = { value: 0.1 };

// Smoothed world velocity. Read by the footstep scheduler to set cadence.
export const playerVelocity = new Vector3();

const _yawQuat = new Quaternion();
const _pitchQuat = new Quaternion();
const _localCamQuat = new Quaternion();
const _localFwd = new Vector3();
const _localRight = new Vector3();
const _moveDir = new Vector3();
const _targetVel = new Vector3();

export function Player() {
  const playerRef = useRef<Mesh>(null);

  // Eye height above the ground. Adjustable so the camera can be nudged up/down
  // if it ends up clipping into the terrain or floating too high.
  const { player } = useDebugUI();
  const eyeHeight = player.eyeHeight;

  useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const onKeyDown = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    const onClick = () => canvas.requestPointerLock();
    const onMouseMove = (e: MouseEvent) => {
      if (!controls.enabled) return;
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

    // Only read movement input once the entry sequence hands over; the camera
    // itself is always driven into first-person below, so the very first frame
    // already shows the player's view (no static establishing shot).
    _moveDir.set(0, 0, 0);
    if (controls.enabled) {
      if (keys["KeyW"] || keys["KeyZ"] || keys["ArrowUp"])    _moveDir.add(_localFwd);
      if (keys["KeyS"] || keys["ArrowDown"])                  _moveDir.sub(_localFwd);
      if (keys["KeyD"] || keys["ArrowRight"])                 _moveDir.add(_localRight);
      if (keys["KeyA"] || keys["KeyQ"] || keys["ArrowLeft"])  _moveDir.sub(_localRight);
    }

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
    // Hard wall at the terrain edge. Clamping the position (rather than zeroing
    // the velocity) lets the player keep sliding along the border.
    playerPosition.x = Math.max(-WALK_LIMIT, Math.min(WALK_LIMIT, playerPosition.x));
    playerPosition.z = Math.max(-WALK_LIMIT, Math.min(WALK_LIMIT, playerPosition.z));
    // Follow the ground: sit the eye at terrain height + the adjustable offset.
    playerPosition.y = getTerrainY(playerPosition.x, playerPosition.z) + eyeHeight;

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

  // The camera rides inside the capsule in first-person, so keep the body mesh
  // hidden — it's only here to hold the player's transform.
  return (
    <mesh ref={playerRef} visible={false}>
      <capsuleGeometry args={[0.3, 0.5, 4, 8, 1]} />
      <WebGPUToonMaterial color={"#ff0000"} preset={"sixTone"} />
    </mesh>
  );
}
