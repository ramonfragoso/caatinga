import { useCallback, useEffect, useRef } from "react";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";

const KEYS = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

type MovementState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

export function usePlayerControls() {
  const movement = useRef<MovementState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = KEYS[e.code as keyof typeof KEYS];
      if (key) movement.current[key as keyof MovementState] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = KEYS[e.code as keyof typeof KEYS];
      if (key) movement.current[key as keyof MovementState] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  let speed = 0;
  let steeringVelocity = 0;

  const updatePlayerPosition = useCallback(
    (
      x: Vector3,
      y: Vector3,
      z: Vector3,
      playerPosition: Vector3,
      camera: PerspectiveCamera | OrthographicCamera,
      delta: number,
    ) => {
      const { forward,  left, right } = movement.current;

      const deltaTime = delta * 60;

      steeringVelocity *= Math.pow(0.93, deltaTime);

      if (forward) {
        speed += 0.005 * deltaTime;
      } else {
        speed *= Math.pow(0.95, deltaTime);
      }
      if (left) {
        steeringVelocity = 0.01;
      }

      if (right) {
        steeringVelocity = -0.01;
      }

      x.applyAxisAngle(y, steeringVelocity * deltaTime)
      z.applyAxisAngle(y, steeringVelocity * deltaTime)


      x.normalize();
      y.normalize();
      z.normalize();

      playerPosition.add(z.clone().multiplyScalar(-speed * deltaTime))
    },
    [movement],
  );

  return { movement, updatePlayerPosition };
}
