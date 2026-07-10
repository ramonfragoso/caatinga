"use client";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { folder, useControls } from "leva";
import * as THREE from "three";
import {
  getAudioContext,
  getListener,
  installGestureFallback,
  installVisibilitySuspend,
  useSceneAudioStarted,
} from "./context";
import { SOUNDS, resolveSrc } from "./sounds";
import { useAudioBuffers } from "./useAudioBuffer";
import { Footsteps } from "./Footsteps";
import { VultureCalls } from "./VultureCalls";

const WIND_FADE_IN = 2.5; // seconds; overlaps the entry sequence's noise fade-out

/** Ambient wind bed: non-positional, always on once the scene takes over. */
function Wind() {
  const started = useSceneAudioStarted();
  const buffers = useAudioBuffers([resolveSrc(SOUNDS.wind.src)]);
  const buffer = buffers?.[0] ?? null;

  const audioRef = useRef<THREE.Audio | null>(null);
  const fadingIn = useRef(false);

  const { windVolume } = useControls(
    "Sound",
    { Wind: folder({ windVolume: { value: SOUNDS.wind.volume, min: 0, max: 2, step: 0.01, label: "volume" } }, { collapsed: true }) },
    { collapsed: true },
  );

  useEffect(() => {
    if (!started || !buffer) return;

    const audio = new THREE.Audio(getListener());
    audio.setBuffer(buffer);
    audio.setLoop(true);
    audio.setVolume(0);
    audio.play();
    audioRef.current = audio;

    // Ramp the raw gain rather than stepping setVolume, so the wind rises under
    // the entry sequence's noise bed instead of punching in.
    const ctx = getAudioContext();
    const gain = audio.gain.gain;
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.linearRampToValueAtTime(windVolume, ctx.currentTime + WIND_FADE_IN);

    // Let the ramp own the gain until it lands; the volume effect below stands
    // aside for that window rather than cancelling the fade-in on mount.
    fadingIn.current = true;
    const t = window.setTimeout(() => { fadingIn.current = false; }, WIND_FADE_IN * 1000);

    return () => {
      window.clearTimeout(t);
      if (audio.isPlaying) audio.stop();
      audio.disconnect();
      audioRef.current = null;
    };
    // windVolume intentionally omitted: changing it shouldn't restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, buffer]);

  // Live-tune from the debug panel, once the fade-in has finished.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || fadingIn.current) return;
    audio.setVolume(windVolume);
  }, [windVolume]);

  return null;
}

/**
 * Root of the sound system. Parents the shared AudioListener to the camera
 * (which Player drives every frame, so panning tracks the view), owns master
 * volume/mute, and mounts every emitter.
 *
 * Debug controls live inside each emitter rather than in useDebugUI, because
 * the test-play buttons need to call into that emitter's live audio nodes.
 *
 * The cow breath isn't mounted here — it needs the cow placements, so
 * <SkeletonScene> renders it alongside the cows it belongs to.
 */
export function AudioSystem() {
  const camera = useThree((state) => state.camera);

  const { masterVolume, muted } = useControls(
    "Sound",
    {
      masterVolume: { value: 0.8, min: 0, max: 1, step: 0.01 },
      muted: false,
    },
    { collapsed: true },
  );

  useEffect(() => {
    const listener = getListener();
    camera.add(listener);
    return () => {
      camera.remove(listener);
    };
  }, [camera]);

  useEffect(() => installVisibilitySuspend(), []);
  useEffect(() => installGestureFallback(), []);

  useEffect(() => {
    getListener().setMasterVolume(muted ? 0 : masterVolume);
  }, [masterVolume, muted]);

  return (
    <>
      <Wind />
      <VultureCalls />
      <Footsteps />
    </>
  );
}
