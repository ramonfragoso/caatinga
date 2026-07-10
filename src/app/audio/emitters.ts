"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { getListener } from "./context";

export interface PositionalParams {
  volume: number;
  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  distanceModel?: DistanceModelType;
}

export function applyPositionalParams(
  audio: THREE.PositionalAudio,
  p: PositionalParams,
): void {
  audio.setVolume(p.volume);
  audio.setRefDistance(p.refDistance);
  audio.setMaxDistance(p.maxDistance);
  audio.setRolloffFactor(p.rolloffFactor);
  audio.setDistanceModel(p.distanceModel ?? "exponential");
}

/**
 * Attach a looping positional source to `target` for as long as it exists.
 * `offset` seeds the playhead so several emitters sharing one buffer (the cows)
 * don't breathe in unison, and `playbackRate` detunes each one slightly.
 */
export function usePositionalLoop(
  target: THREE.Object3D | null,
  buffer: AudioBuffer | null,
  enabled: boolean,
  params: PositionalParams,
  playbackRate = 1,
  offset = 0,
): void {
  const audioRef = useRef<THREE.PositionalAudio | null>(null);

  useEffect(() => {
    if (!target || !buffer || !enabled) return;

    const audio = new THREE.PositionalAudio(getListener());
    audio.setBuffer(buffer);
    audio.setLoop(true);
    audio.offset = offset;
    audio.play();
    target.add(audio);
    audioRef.current = audio;

    return () => {
      if (audio.isPlaying) audio.stop();
      audio.disconnect();
      target.remove(audio);
      audioRef.current = null;
    };
  }, [target, buffer, enabled, offset]);

  // Live-tune from the debug panel without rebuilding the source.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    applyPositionalParams(audio, params);
    audio.setPlaybackRate(playbackRate);
  });
}

/** Fire-and-forget one-shot on an existing positional source, with a pitch. */
export function playOneShot(
  audio: THREE.PositionalAudio,
  playbackRate: number,
): void {
  if (audio.isPlaying) audio.stop();
  audio.setPlaybackRate(playbackRate);
  audio.play();
}
