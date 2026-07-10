"use client";
import type { Object3D } from "three";

/**
 * The nine vultures live in three unrelated components (scattered, perched, and
 * the one authored into sertao.glb). Rather than plumb refs upward, each one
 * registers itself here and the single scream scheduler reads the live list.
 */
const vultures = new Set<Object3D>();

export function registerVulture(obj: Object3D): () => void {
  vultures.add(obj);
  return () => {
    vultures.delete(obj);
  };
}

export function getVultures(): Object3D[] {
  return [...vultures];
}
