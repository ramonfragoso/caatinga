"use client";
import { useSyncExternalStore } from "react";
import * as THREE from "three";

/**
 * One AudioContext for the whole app, owned by three's AudioContext helper so
 * that any AudioListener we later construct inside the canvas lands on the same
 * context as the entry-sequence ambience. Created lazily on first call; it will
 * be in the `suspended` state until a user gesture resumes it.
 */
export function getAudioContext(): AudioContext {
  return THREE.AudioContext.getContext() as AudioContext;
}

/**
 * The single AudioListener, created lazily so it never runs during SSR (its
 * constructor touches AudioContext). Emitters grab it from inside effects;
 * <AudioSystem> is what parents it to the camera.
 */
let listener: THREE.AudioListener | null = null;

export function getListener(): THREE.AudioListener {
  if (!listener) listener = new THREE.AudioListener();
  return listener;
}

// --- Scene-audio gate -------------------------------------------------------
// Flipped once the entry sequence hands over. Components subscribe so their
// sources start (and the wind fades in) at exactly that moment.

let started = false;
let deferred = false;
const subscribers = new Set<() => void>();

/**
 * Called by <EntrySequence> to claim ownership of the start moment: it will
 * call startSceneAudio() itself when the player clicks Begin, so the first-
 * gesture fallback below must stay out of the way. When the entry sequence is
 * disabled (dev), nothing claims it and the fallback takes over.
 */
export function deferSceneAudio(): void {
  deferred = true;
}

/**
 * Web Audio needs a user gesture. If no entry sequence is going to provide one,
 * unlock on the first click or keypress instead.
 */
export function installGestureFallback(): () => void {
  const onGesture = () => {
    if (!deferred) startSceneAudio();
  };
  window.addEventListener("pointerdown", onGesture);
  window.addEventListener("keydown", onGesture);
  return () => {
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("keydown", onGesture);
  };
}

export function startSceneAudio(): void {
  if (started) return;
  started = true;
  void getAudioContext().resume();
  for (const fn of subscribers) fn();
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function useSceneAudioStarted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => started,
    () => false, // server snapshot
  );
}

/**
 * Suspend while the tab is hidden. Browsers throttle timers in background tabs,
 * so a still-running context would drift out of sync with our schedulers.
 * Pointer-lock loss deliberately does *not* pause: the scene is still on screen.
 */
export function installVisibilitySuspend(): () => void {
  const onChange = () => {
    const ctx = getAudioContext();
    if (document.hidden) void ctx.suspend();
    else if (started) void ctx.resume();
  };
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
