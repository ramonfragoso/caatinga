"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { button, folder, useControls } from "leva";
import * as THREE from "three";
import { playerPosition } from "../components/Player";
import { getListener, useSceneAudioStarted } from "./context";
import { applyPositionalParams, playOneShot } from "./emitters";
import { SOUNDS, randomInRange, resolveSrc } from "./sounds";
import { useAudioBuffers } from "./useAudioBuffer";
import { getVultures } from "./vultureRegistry";

const DEF = SOUNDS.vultureScream;
const _worldPos = new THREE.Vector3();

/**
 * One scheduler for every vulture in the world. A per-bird timer would mean
 * nine independent 8-15s rolls — a scream every ~1.3s on average, constantly
 * overlapping — so instead a single timer fires and elects one bird to call.
 */
export function VultureCalls() {
  const started = useSceneAudioStarted();
  const buffers = useAudioBuffers([resolveSrc(DEF.src)]);
  const buffer = buffers?.[0] ?? null;

  /** Lazily-built PositionalAudio per vulture, reusing the one shared buffer. */
  const sources = useMemo(() => new Map<THREE.Object3D, THREE.PositionalAudio>(), []);
  const countdown = useRef(randomInRange(DEF.interval));

  const params = useControls(
    "Sound",
    {
      Vultures: folder(
        {
          vultureVolume: { value: DEF.volume, min: 0, max: 2, step: 0.01, label: "volume" },
          vultureRefDistance: { value: DEF.positional.refDistance, min: 0.5, max: 40, step: 0.5, label: "refDistance" },
          vultureMaxDistance: { value: DEF.positional.maxDistance, min: 5, max: 300, step: 1, label: "maxDistance" },
          vultureRolloff: { value: DEF.positional.rolloffFactor, min: 0, max: 4, step: 0.05, label: "rolloff" },
          vulturePitchMin: { value: DEF.pitch[0], min: 0.5, max: 1.5, step: 0.01, label: "pitch min" },
          vulturePitchMax: { value: DEF.pitch[1], min: 0.5, max: 2, step: 0.01, label: "pitch max" },
          vultureIntervalMin: { value: DEF.interval[0], min: 0.5, max: 30, step: 0.5, label: "interval min" },
          vultureIntervalMax: { value: DEF.interval[1], min: 0.5, max: 60, step: 0.5, label: "interval max" },
          // When on, a slot is spent on a bird you can actually hear (falling
          // back to any bird if none are in range). Off = true uniform pick,
          // which leaves long silences out in empty terrain.
          vulturePreferAudible: { value: true, label: "prefer audible" },
          "scream now": button(() => screamRef.current?.()),
        },
        { collapsed: true },
      ),
    },
    { collapsed: true },
  );

  // The Leva button closes over the first render, so route it through a ref.
  const screamRef = useRef<(() => void) | null>(null);

  const getAudio = (vulture: THREE.Object3D) => {
    let audio = sources.get(vulture);
    if (!audio) {
      audio = new THREE.PositionalAudio(getListener());
      audio.setBuffer(buffer!);
      audio.setLoop(false);
      vulture.add(audio);
      sources.set(vulture, audio);
    }
    applyPositionalParams(audio, {
      volume: params.vultureVolume,
      refDistance: params.vultureRefDistance,
      maxDistance: params.vultureMaxDistance,
      rolloffFactor: params.vultureRolloff,
      distanceModel: DEF.positional.distanceModel,
    });
    return audio;
  };

  const scream = () => {
    if (!buffer) return;
    const vultures = getVultures();
    if (vultures.length === 0) return;

    let candidates = vultures;
    if (params.vulturePreferAudible) {
      const audible = vultures.filter(
        (v) =>
          v.getWorldPosition(_worldPos).distanceTo(playerPosition) <=
          params.vultureMaxDistance,
      );
      if (audible.length > 0) candidates = audible;
    }

    const vulture = candidates[Math.floor(Math.random() * candidates.length)];
    const lo = Math.min(params.vulturePitchMin, params.vulturePitchMax);
    const hi = Math.max(params.vulturePitchMin, params.vulturePitchMax);
    playOneShot(getAudio(vulture), randomInRange([lo, hi]));
  };
  screamRef.current = scream;

  useFrame((_, delta) => {
    if (!started || !buffer) return;
    countdown.current -= delta;
    if (countdown.current > 0) return;

    const lo = Math.min(params.vultureIntervalMin, params.vultureIntervalMax);
    const hi = Math.max(params.vultureIntervalMin, params.vultureIntervalMax);
    countdown.current = randomInRange([lo, hi]);
    scream();
  });

  useEffect(() => {
    return () => {
      for (const [vulture, audio] of sources) {
        if (audio.isPlaying) audio.stop();
        audio.disconnect();
        vulture.remove(audio);
      }
      sources.clear();
    };
  }, [sources]);

  return null;
}
