"use client";
import { useEffect, useState } from "react";
import { getAudioContext } from "./context";

// Decode each URL once, no matter how many emitters ask for it: nine vultures
// share one scream buffer.
const cache = new Map<string, Promise<AudioBuffer>>();

export function loadBuffer(url: string): Promise<AudioBuffer> {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => getAudioContext().decodeAudioData(data));
    cache.set(url, pending);
  }
  return pending;
}

/** Load one or more buffers; returns null until every one has decoded. */
export function useAudioBuffers(urls: string[]): AudioBuffer[] | null {
  const [buffers, setBuffers] = useState<AudioBuffer[] | null>(null);
  const key = urls.join("|");

  useEffect(() => {
    let cancelled = false;
    Promise.all(key.split("|").map(loadBuffer))
      .then((result) => {
        if (!cancelled) setBuffers(result);
      })
      .catch(() => {
        // A missing/undecodable file shouldn't take the scene down; the rest of
        // the soundscape still plays.
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return buffers;
}
