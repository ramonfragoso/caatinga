"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { button, folder, useControls } from "leva";
import { controls, playerVelocity, PLAYER_SPEED } from "../components/Player";
import { getAudioContext, getListener, useSceneAudioStarted } from "./context";
import { FOOTSTEP_SRCS, FOOTSTEPS, randomInRange } from "./sounds";
import { useAudioBuffers } from "./useAudioBuffer";

/**
 * Footsteps are non-positional: the source sits exactly at the listener, where
 * a PannerNode's direction is undefined and the image collapses to the centre.
 * Instead each step is panned slightly left or right, alternating, to stand in
 * for the two feet.
 *
 * Cadence is a random gap in [interval min, interval max] seconds, stretched by
 * how far below full speed the player is moving — so the rhythm is directly
 * dialable, but still slackens when you're decelerating.
 */
export function Footsteps() {
  const started = useSceneAudioStarted();
  const buffers = useAudioBuffers(FOOTSTEP_SRCS);
  const countdown = useRef(0);
  const leftFoot = useRef(true);

  const params = useControls(
    "Sound",
    {
      Footsteps: folder(
        {
          footstepVolume: { value: FOOTSTEPS.volume, min: 0, max: 2, step: 0.01, label: "volume" },
          footstepIntervalMin: { value: 0.45, min: 0.1, max: 3, step: 0.01, label: "interval min (s)" },
          footstepIntervalMax: { value: 0.5, min: 0.1, max: 4, step: 0.01, label: "interval max (s)" },
          footstepPitchMin: { value: FOOTSTEPS.pitch[0], min: 0.5, max: 1.5, step: 0.01, label: "pitch min" },
          footstepPitchMax: { value: FOOTSTEPS.pitch[1], min: 0.5, max: 2, step: 0.01, label: "pitch max" },
          footstepPan: { value: 0.35, min: 0, max: 1, step: 0.01, label: "pan width" },
          footstepMinSpeed: { value: 0.6, min: 0, max: 5, step: 0.1, label: "min speed" },
          "step now": button(() => stepRef.current?.()),
        },
        { collapsed: true },
      ),
    },
    { collapsed: true },
  );

  const stepRef = useRef<(() => void) | null>(null);

  const step = () => {
    if (!buffers) return;
    const ctx = getAudioContext();

    const source = ctx.createBufferSource();
    source.buffer = buffers[Math.floor(Math.random() * buffers.length)];

    const lo = Math.min(params.footstepPitchMin, params.footstepPitchMax);
    const hi = Math.max(params.footstepPitchMin, params.footstepPitchMax);
    source.playbackRate.value = randomInRange([lo, hi]);

    const panner = ctx.createStereoPanner();
    // Alternate feet, with a little jitter so it never sounds metronomic.
    const side = leftFoot.current ? -1 : 1;
    leftFoot.current = !leftFoot.current;
    panner.pan.value = side * params.footstepPan * randomInRange([0.7, 1]);

    const gain = ctx.createGain();
    gain.gain.value = params.footstepVolume * randomInRange([0.85, 1]);

    // Into the listener's master gain, so the global volume/mute applies.
    source.connect(panner).connect(gain).connect(getListener().getInput());
    source.start();
    source.onended = () => {
      source.disconnect();
      panner.disconnect();
      gain.disconnect();
    };
  };
  stepRef.current = step;

  useFrame((_, delta) => {
    if (!started || !buffers || !controls.enabled) return;

    const speed = Math.hypot(playerVelocity.x, playerVelocity.z);
    if (speed < params.footstepMinSpeed) {
      countdown.current = 0; // step immediately when the player sets off again
      return;
    }

    // Drain the countdown at the *current* speed, so walking at half speed
    // stretches the gap twice as long. Scaling the interval up-front instead
    // would sample the speed at the moment of the previous step — which, right
    // after setting off, is barely above `minSpeed` and schedules the next step
    // many seconds away.
    countdown.current -= delta * (speed / PLAYER_SPEED);
    if (countdown.current > 0) return;

    const lo = Math.min(params.footstepIntervalMin, params.footstepIntervalMax);
    const hi = Math.max(params.footstepIntervalMin, params.footstepIntervalMax);
    countdown.current = randomInRange([lo, hi]);
    step();
  });

  return null;
}
