"use client";
import { useMemo } from "react";
import * as THREE from "three";

export const DISPLACEMENT_SCALE = 10;
export const TERRAIN_Y_OFFSET = -5;

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hash3(x: number, y: number, z: number): number {
  const base = x * 123.34 + y * 345.45 + z * 234.56;
  let px = base % 1;
  let py = (base + 0.1) % 1;
  let pz = (base + 0.2) % 1;
  const d = px * (px + 34.345) + py * (py + 34.345) + pz * (pz + 34.345);
  px += d; py += d; pz += d;
  return ((px * py * pz) % 1 + 1) % 1;
}

function vnoise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const c000 = hash3(ix,   iy,   iz  );
  const c100 = hash3(ix+1, iy,   iz  );
  const c010 = hash3(ix,   iy+1, iz  );
  const c110 = hash3(ix+1, iy+1, iz  );
  const c001 = hash3(ix,   iy,   iz+1);
  const c101 = hash3(ix+1, iy,   iz+1);
  const c011 = hash3(ix,   iy+1, iz+1);
  const c111 = hash3(ix+1, iy+1, iz+1);

  return mix(
    mix(mix(c000, c100, ux), mix(c010, c110, ux), uy),
    mix(mix(c001, c101, ux), mix(c011, c111, ux), uy),
    uz
  );
}

export function fbm3(x: number, y: number, z: number, octaves = 10): number {
  let s = 0, a = 0.5;
  for (let i = 0; i < octaves; i++) {
    s += a * vnoise3(x, y, z);
    x *= 2; y *= 2; z *= 2;
    a *= 0.5;
  }
  return s;
}

// Terrain plane resolution — MUST match the geometry built below so placement
// samples the exact same coarse surface that gets rendered.
export const TERRAIN_SIZE = 1000;
export const TERRAIN_SEGMENTS = 64;
const TERRAIN_STEP = TERRAIN_SIZE / TERRAIN_SEGMENTS;
const TERRAIN_HALF = TERRAIN_SIZE / 2;

/** Displaced height of a single terrain grid vertex at plane coords (gx, gz). */
function vertexHeight(gx: number, gz: number): number {
  return fbm3(gx * 15, -2, gz * 3) * DISPLACEMENT_SCALE;
}

/**
 * World-space ground height at (x, z). The terrain mesh is a coarse 64x64 grid
 * (~78u between vertices) with flat triangles in between, while the noise itself
 * is high-frequency — so sampling the continuous noise makes objects float above
 * or sink below the rendered surface. Instead we interpolate across the SAME two
 * triangles the mesh draws for this cell.
 */
export function getTerrainY(x: number, z: number): number {
  const gx = (x + TERRAIN_HALF) / TERRAIN_STEP;
  const gz = (z + TERRAIN_HALF) / TERRAIN_STEP;
  const i = Math.max(0, Math.min(TERRAIN_SEGMENTS - 1, Math.floor(gx)));
  const j = Math.max(0, Math.min(TERRAIN_SEGMENTS - 1, Math.floor(gz)));
  const fx = gx - i;
  const fz = gz - j;

  const x0 = i * TERRAIN_STEP - TERRAIN_HALF;
  const x1 = (i + 1) * TERRAIN_STEP - TERRAIN_HALF;
  const z0 = j * TERRAIN_STEP - TERRAIN_HALF;
  const z1 = (j + 1) * TERRAIN_STEP - TERRAIN_HALF;

  const ha = vertexHeight(x0, z0); // (i,   j)
  const hb = vertexHeight(x0, z1); // (i,   j+1)
  const hc = vertexHeight(x1, z1); // (i+1, j+1)
  const hd = vertexHeight(x1, z0); // (i+1, j)

  // PlaneGeometry splits each quad along the b–d diagonal (fx + fz = 1).
  const h =
    fx + fz <= 1
      ? ha + (hd - ha) * fx + (hb - ha) * fz
      : hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);

  return h + TERRAIN_Y_OFFSET;
}

export function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, fbm3(x * 15, -2, z * 3) * DISPLACEMENT_SCALE);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    return geo;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, TERRAIN_Y_OFFSET, 0]} castShadow receiveShadow >
      <meshStandardNodeMaterial color="white" />
    </mesh>
  );
}
