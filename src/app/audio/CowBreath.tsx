"use client";
import { useState } from "react";
import { folder, useControls } from "leva";
import * as THREE from "three";
import type { CowPlacement } from "../components/Cow";
import { getTerrainY } from "../components/Terrain";
import { useSceneAudioStarted } from "./context";
import { usePositionalLoop, type PositionalParams } from "./emitters";
import { SOUNDS, resolveSrc } from "./sounds";
import { useAudioBuffers } from "./useAudioBuffer";

const DEF = SOUNDS.cowBreath;

function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 17.3 + salt) * 43758.5453123;
  return x - Math.floor(x);
}

function CowEmitter({
  index,
  placement,
  buffer,
  enabled,
  params,
  height,
  pitchSpread,
}: {
  index: number;
  placement: CowPlacement;
  buffer: AudioBuffer | null;
  enabled: boolean;
  params: PositionalParams;
  height: number;
  pitchSpread: number;
}) {
  const [target, setTarget] = useState<THREE.Group | null>(null);

  // Same buffer on every cow, so offset the playhead and detune each one —
  // otherwise three cows in earshot breathe in lockstep and phase against
  // each other.
  const offset = buffer ? seeded(index, 1) * buffer.duration : 0;
  const rate = 1 + (seeded(index, 2) - 0.5) * 2 * pitchSpread;

  usePositionalLoop(target, buffer, enabled, params, rate, offset);

  const { x, z } = placement;
  return <group ref={setTarget} position={[x, getTerrainY(x, z) + height, z]} />;
}

/** A looping breath on every cow, audible only from close up. */
export function CowBreath({ placements }: { placements: CowPlacement[] }) {
  const started = useSceneAudioStarted();
  const buffers = useAudioBuffers([resolveSrc(DEF.src)]);
  const buffer = buffers?.[0] ?? null;

  const p = useControls(
    "Sound",
    {
      Cows: folder(
        {
          cowVolume: { value: DEF.volume, min: 0, max: 20, step: 0.05, label: "volume" },
          cowRefDistance: { value: DEF.positional.refDistance, min: 0.5, max: 20, step: 0.1, label: "refDistance" },
          cowMaxDistance: { value: DEF.positional.maxDistance, min: 1, max: 100, step: 1, label: "maxDistance" },
          cowRolloff: { value: DEF.positional.rolloffFactor, min: 0, max: 4, step: 0.05, label: "rolloff" },
          cowPitchSpread: { value: 0.06, min: 0, max: 0.3, step: 0.01, label: "pitch spread" },
          cowHeight: { value: 1.2, min: 0, max: 4, step: 0.1, label: "emitter height" },
        },
        { collapsed: true },
      ),
    },
    { collapsed: true },
  );

  const params: PositionalParams = {
    volume: p.cowVolume,
    refDistance: p.cowRefDistance,
    maxDistance: p.cowMaxDistance,
    rolloffFactor: p.cowRolloff,
    distanceModel: DEF.positional.distanceModel,
  };

  return (
    <>
      {placements.map((placement, i) => (
        <CowEmitter
          key={i}
          index={i}
          placement={placement}
          buffer={buffer}
          enabled={started}
          params={params}
          height={p.cowHeight}
          pitchSpread={p.cowPitchSpread}
        />
      ))}
    </>
  );
}
