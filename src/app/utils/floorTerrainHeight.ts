/** Matches WebGPUFloor TSL: worldPos = (px, -py) + chunkCenter, then fbm(worldPos * k). */

function fract(x: number): number {
  return x - Math.floor(x);
}

function hash2(p0: number, p1: number): number {
  return fract(Math.sin(p0 * 127.1 + p1 * 311.7) * 44758.2378);
}

function hash2vec(p0: number, p1: number): [number, number] {
  const angle = hash2(p0, p1) * 6.2831853;
  return [Math.cos(angle), Math.sin(angle)];
}

function noise(px: number, py: number): number {
  const i0 = Math.floor(px);
  const i1 = Math.floor(py);
  const f0 = fract(px);
  const f1 = fract(py);

  const [ha0, ha1] = hash2vec(i0, i1);
  const [hb0, hb1] = hash2vec(i0 + 1, i1);
  const [hc0, hc1] = hash2vec(i0, i1 + 1);
  const [hd0, hd1] = hash2vec(i0 + 1, i1 + 1);

  const gridA = ha0 * f0 + ha1 * f1;
  const gridB = hb0 * (f0 - 1) + hb1 * f1;
  const gridC = hc0 * f0 + hc1 * (f1 - 1);
  const gridD = hd0 * (f0 - 1) + hd1 * (f1 - 1);

  const mixBottomEdge = gridA + (gridB - gridA) * fract(px);
  const mixTopEdge = gridC + (gridD - gridC) * fract(px);
  return mixBottomEdge + (mixTopEdge - mixBottomEdge) * fract(py);
}

function fbm(px: number, py: number): number {
  let frequency = 1;
  let amplitude = 0.5;
  let value = 0;
  for (let i = 0; i < 20; i++) {
    value += noise(px * frequency, py * frequency) * amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return value;
}

/** worldXZ must match shader vec2(px, -py) + chunkCenter (chunk center X and Z). */
export function floorTerrainHeightShaderWorld(worldXZx: number, worldXZz: number): number {
  const regional = fbm(worldXZx * 0.0002, worldXZz * 0.0002);
  const detail = fbm(worldXZx * 0.004, worldXZz * 0.004);
  return regional * detail * 500;
}
