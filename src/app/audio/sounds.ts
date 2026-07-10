"use client";

/**
 * Central sound registry. Everything about how a sound behaves lives here so a
 * new emitter is a matter of adding an entry, not wiring nodes.
 *
 * Format choice: Ogg Vorbis is gapless, so seamless loops (wind, cow breath)
 * and tightly-timed one-shots (the scream) use it where supported. MP3 carries
 * encoder-delay padding, which shows up as a click at the loop point and a few
 * ms of dead air in front of a one-shot — it's the Safari fallback only.
 * The footsteps stay uncompressed: they're tiny and must fire without latency.
 */

export interface SoundDef {
  /** Sources in preference order; the first playable one is used. */
  src: { ogg?: string; mp3?: string; wav?: string };
  volume: number;
  loop: boolean;
  /** Positional falloff. Omit for non-positional (listener-attached) sounds. */
  positional?: {
    refDistance: number;
    maxDistance: number;
    rolloffFactor: number;
    distanceModel: DistanceModelType;
  };
  /** Random playbackRate range applied per playback. 1 = original pitch. */
  pitch?: [min: number, max: number];
  /** Random seconds between repeats, for scheduled one-shots. */
  interval?: [min: number, max: number];
}

export const SOUNDS = {
  wind: {
    src: { ogg: "/sounds/wind.ogg", mp3: "/sounds/wind.mp3" },
    volume: 0.17,
    loop: true,
  },

  cowBreath: {
    src: { ogg: "/sounds/cow_breath.ogg", mp3: "/sounds/cow_breath.mp3" },
    // Above 1 the source is amplified past its recorded level; the breath is a
    // quiet recording under a tight falloff, so it needs the boost.
    volume: 3,
    loop: true,
    // Tight: audible only up close, so a cow is something you discover by
    // walking into it rather than a landmark you can hear across the terrain.
    positional: {
      refDistance: 2.2,
      maxDistance: 15,
      rolloffFactor: 1.6,
      distanceModel: "exponential",
    },
    pitch: [0.94, 1.06],
  },

  vultureScream: {
    src: { ogg: "/sounds/vulture_scream.ogg", mp3: "/sounds/vulture_scream.mp3" },
    volume: 1,
    loop: false,
    positional: {
      refDistance: 8,
      maxDistance: 90,
      rolloffFactor: 1.1,
      distanceModel: "exponential",
    },
    pitch: [0.85, 1.15],
    interval: [2, 3.75],
  },
} satisfies Record<string, SoundDef>;

/** The three interchangeable footstep clips, picked from at random per step. */
export const FOOTSTEP_SRCS = [
  "/sounds/footsteps1.mono.wav",
  "/sounds/footsteps2.mono.wav",
  "/sounds/footsteps3.mono.wav",
];

export const FOOTSTEPS = {
  src: { wav: FOOTSTEP_SRCS[0] }, // unused; the sources are the array above
  volume: 0.12,
  loop: false,
  pitch: [0.88, 1.12],
} satisfies SoundDef;

let canOgg: boolean | null = null;

/** Resolve a SoundDef's sources to the one URL this browser can decode. */
export function resolveSrc(src: SoundDef["src"]): string {
  if (canOgg === null) {
    canOgg =
      typeof document !== "undefined" &&
      document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"') !== "";
  }
  if (canOgg && src.ogg) return src.ogg;
  return src.mp3 ?? src.wav ?? src.ogg!;
}

export function randomInRange([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}
