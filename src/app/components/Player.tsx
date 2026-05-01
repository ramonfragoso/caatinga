"use client";
import { useFrame } from "@react-three/fiber";
import { Vector2, Vector3, Matrix4, Mesh, Quaternion, Euler } from "three";
import { useEffect, useRef } from "react";
import { WebGPUToonMaterial } from "./WebGPUToonMaterial";

const PATH_NUM_POINTS = 50;
const PATH_DIAMETER = 20000;
const PATH_CIRCLE_RADIUS = PATH_DIAMETER / 2;
const PATH_CENTER_X = PATH_CIRCLE_RADIUS;
const PATH_CENTER_Z = 0;
const PLAYER_HEIGHT = 21;

const PATH_POINTS = Array.from({ length: PATH_NUM_POINTS }, (_, i) => {
  const t = Math.PI + (i / PATH_NUM_POINTS) * Math.PI * 2;
  const px = PATH_CENTER_X + PATH_CIRCLE_RADIUS * Math.cos(t);
  const pz = PATH_CENTER_Z + PATH_CIRCLE_RADIUS * Math.sin(t);
  return new Vector3(px, PLAYER_HEIGHT, pz);
});

// Train translation speed along the path.
const TRAIN_SPEED = 200;
// Maximum walking speed of the player (relative to the train, in train-local space).
const PLAYER_MAX_SPEED = 30;
// Higher = snappier acceleration/deceleration. Lower = floatier/smoother.
const PLAYER_MOVE_SMOOTHING = 6;
// Smooth rotation rate applied when the train turns and yanks the player around.
const TRAIN_FACING_SMOOTHING = 4;

// World position of the train origin (its origin is at the player's foot height).
export const trainPosition = new Vector3(0, PLAYER_HEIGHT - 5, 0);

// World position of the player. Used by camera, clouds, etc.
export const playerPosition = new Vector3(0, PLAYER_HEIGHT, 0);

// Train facing basis (world space). x=right, y=up, z=back (-z=forward).
export const x = new Vector3(1, 0, 0);
export const y = new Vector3(0, 1, 0);
export const z = new Vector3(0, 0, 1);

// Smoothed world-space rotation of the train (kept in sync between train mesh,
// player mesh, and cage clamping frame).
export const trainQuaternion = new Quaternion();

// Cage polygon (train-local XZ) used to constrain player motion.
// Train.tsx populates this when the GLB scene is built.
export const trainCage: { polygon: Vector2[] } = {
  polygon: [],
};

// Active keys — populated by the event listeners below.
const keys: Record<string, boolean> = {};

const cameraYaw = { value: 0 };
const cameraPitch = { value: 0.3 };

// Player offset in train-local space (relative to train's rotated frame).
const playerLocalOffset = new Vector3();
const playerVelocity = new Vector3();

// Scratch values reused every frame.
const _trainToTarget = new Vector3();
const _localFwd = new Vector3();
const _localRight = new Vector3();
const _moveDir = new Vector3();
const _targetVel = new Vector3();
const _yawQuat = new Quaternion();
const _pitchQuat = new Quaternion();
const _localCamQuat = new Quaternion();
const _trainTargetQuat = new Quaternion();
const _trainBasisMatrix = new Matrix4();
const _worldOffset = new Vector3();
const _worldCamQuat = new Quaternion();
const _cameraMatrix = new Matrix4();
const _meshMatrix = new Matrix4();
const _yAxis = new Vector3(0, 1, 0);
const _trainOffsetQuat = new Quaternion().setFromAxisAngle(_yAxis, Math.PI / 2);
const _localOffsetXZ = new Vector2();

// ── Polygon utilities ────────────────────────────────────────────────────────
function pointInPolygon2D(p: Vector2, poly: Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i];
    const pj = poly[j];
    const intersect =
      (pi.y > p.y) !== (pj.y > p.y) &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

const _segDir = new Vector2();
const _segToP = new Vector2();
const _segClosest = new Vector2();

/** Mutates `out` to be the closest point on segment a→b to p. */
function closestPointOnSegment(p: Vector2, a: Vector2, b: Vector2, out: Vector2) {
  _segDir.subVectors(b, a);
  const lenSq = _segDir.lengthSq();
  if (lenSq <= 1e-12) {
    out.copy(a);
    return;
  }
  _segToP.subVectors(p, a);
  const t = Math.max(0, Math.min(1, _segToP.dot(_segDir) / lenSq));
  out.copy(a).addScaledVector(_segDir, t);
}

/** Clamp p to be inside polygon (mutates p). */
function clampToPolygon(p: Vector2, poly: Vector2[]) {
  if (poly.length < 3) return;
  if (pointInPolygon2D(p, poly)) return;

  let bestDistSq = Infinity;
  let bestX = p.x;
  let bestY = p.y;

  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    closestPointOnSegment(p, poly[j], poly[i], _segClosest);
    const dx = _segClosest.x - p.x;
    const dy = _segClosest.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestDistSq) {
      bestDistSq = d;
      bestX = _segClosest.x;
      bestY = _segClosest.y;
    }
  }
  p.set(bestX, bestY);
}

export function Player() {
  const playerRef = useRef<Mesh>(null);
  const targetIndexRef = useRef(1);

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
      cameraPitch.value = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cameraPitch.value));
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

    // ── 1. Advance the train along its circular path ──────────────────────────
    const target = PATH_POINTS[targetIndexRef.current];
    _trainToTarget.subVectors(target, trainPosition);
    const distToTarget = _trainToTarget.length();
    const trainStep = TRAIN_SPEED * delta;

    if (distToTarget <= trainStep) {
      trainPosition.copy(target);
      targetIndexRef.current = (targetIndexRef.current + 1) % PATH_POINTS.length;
    } else {
      _trainToTarget.normalize().multiplyScalar(trainStep);
      trainPosition.add(_trainToTarget);
    }

    // ── 2. Update train facing basis to point at next target ──────────────────
    const nextTarget = PATH_POINTS[targetIndexRef.current];
    const trainDir = _trainToTarget.subVectors(nextTarget, trainPosition);
    if (trainDir.lengthSq() > 0.0001) {
      trainDir.normalize();
      z.copy(trainDir).negate(); // -Z = forward in Three.js
      x.crossVectors(y, z).normalize();
    }

    // Target train rotation (basis * 90°-Y offset, matching Train.tsx).
    _trainBasisMatrix.makeBasis(x, y, z);
    _trainTargetQuat
      .setFromRotationMatrix(_trainBasisMatrix)
      .multiply(_trainOffsetQuat);

    // Smooth the train's rotation so direction changes at corners are eased
    // (the player's world position is derived from this so smoothness here
    // gives smoothness everywhere — camera, mesh, and cage frame all rotate
    // together).
    const trainRotT = 1 - Math.exp(-TRAIN_FACING_SMOOTHING * delta);
    trainQuaternion.slerp(_trainTargetQuat, trainRotT);

    // ── 3. Read WASD / arrow keys → desired velocity in TRAIN-LOCAL space ─────
    // Camera yaw is interpreted in the train's local frame, so when the train
    // rotates the player rotates with it automatically.
    _yawQuat.setFromEuler(new Euler(0, cameraYaw.value, 0, "YXZ"));

    _localFwd.set(0, 0, -1).applyQuaternion(_yawQuat);
    _localFwd.y = 0;
    _localFwd.normalize();

    _localRight.set(1, 0, 0).applyQuaternion(_yawQuat);
    _localRight.y = 0;
    _localRight.normalize();

    _moveDir.set(0, 0, 0);
    const fwd =
      keys["KeyW"] || keys["KeyZ"] || keys["ArrowUp"];
    const back =
      keys["KeyS"] || keys["ArrowDown"];
    const left =
      keys["KeyA"] || keys["KeyQ"] || keys["ArrowLeft"];
    const right =
      keys["KeyD"] || keys["ArrowRight"];

    if (fwd)   _moveDir.add(_localFwd);
    if (back)  _moveDir.sub(_localFwd);
    if (right) _moveDir.add(_localRight);
    if (left)  _moveDir.sub(_localRight);

    if (_moveDir.lengthSq() > 0) {
      _moveDir.normalize();
      _targetVel.copy(_moveDir).multiplyScalar(PLAYER_MAX_SPEED);
    } else {
      _targetVel.set(0, 0, 0);
    }

    // Frame-rate independent exponential smoothing of velocity.
    const moveT = 1 - Math.exp(-PLAYER_MOVE_SMOOTHING * delta);
    playerVelocity.lerp(_targetVel, moveT);

    // Integrate position (only XZ — Y stays pinned at the train origin).
    playerLocalOffset.x += playerVelocity.x * delta;
    playerLocalOffset.z += playerVelocity.z * delta;
    playerLocalOffset.y = 0;

    // ── 4. Constrain to the cage polygon (train-local XZ) ─────────────────────
    if (trainCage.polygon.length >= 3) {
      _localOffsetXZ.set(playerLocalOffset.x, playerLocalOffset.z);
      clampToPolygon(_localOffsetXZ, trainCage.polygon);
      // Kill velocity component that pushed us into the wall, otherwise
      // the player keeps "leaning" into the cage and feels sticky.
      if (
        _localOffsetXZ.x !== playerLocalOffset.x ||
        _localOffsetXZ.y !== playerLocalOffset.z
      ) {
        playerVelocity.x = 0;
        playerVelocity.z = 0;
      }
      playerLocalOffset.x = _localOffsetXZ.x;
      playerLocalOffset.z = _localOffsetXZ.y;
    }

    // ── 5. Compose world-space player transform ───────────────────────────────
    _worldOffset.copy(playerLocalOffset).applyQuaternion(trainQuaternion);
    playerPosition.copy(trainPosition).add(_worldOffset);
    playerPosition.y = trainPosition.y;

    // Player mesh inherits the train's smoothed rotation so it visually turns
    // with the cage (no more "sliding inside the train" at corners).
    _meshMatrix.makeRotationFromQuaternion(trainQuaternion);
    _meshMatrix.setPosition(playerPosition);
    playerRef.current.matrixAutoUpdate = false;
    playerRef.current.matrix.copy(_meshMatrix);
    playerRef.current.matrixWorldNeedsUpdate = true;

    // ── 6. Camera = trainQuat ⨯ yaw ⨯ pitch, positioned at the player ─────────
    _pitchQuat.setFromEuler(new Euler(cameraPitch.value, 0, 0, "YXZ"));
    _localCamQuat.copy(_yawQuat).multiply(_pitchQuat);
    _worldCamQuat.copy(trainQuaternion).multiply(_localCamQuat);

    _cameraMatrix
      .makeRotationFromQuaternion(_worldCamQuat)
      .setPosition(playerPosition);

    if ("isPerspectiveCamera" in camera && camera.isPerspectiveCamera) {
      camera.fov = 80;
      camera.updateProjectionMatrix();
    }
    camera.matrixAutoUpdate = false;
    camera.matrix.copy(_cameraMatrix);
    camera.matrixWorldNeedsUpdate = true;
  });

  return (
    <mesh ref={playerRef}>
      <capsuleGeometry args={[0.3, 0.5, 4, 8, 1]} />
      <WebGPUToonMaterial color={"#ff0000"} preset={"sixTone"} />
    </mesh>
  );
}
