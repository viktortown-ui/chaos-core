export interface Rng {
  next: () => number;
  nextNormal: () => number;
  fork: (salt: number) => Rng;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), t | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const source = mulberry32(seed || 1);
  let spare: number | null = null;

  const next = () => source();

  const nextNormal = () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }

    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();

    const mag = Math.sqrt(-2 * Math.log(u));
    const angle = 2 * Math.PI * v;
    spare = mag * Math.sin(angle);
    return mag * Math.cos(angle);
  };

  return {
    next,
    nextNormal,
    fork: (salt: number) => createRng((seed * 1664525 + 1013904223 + salt) >>> 0)
  };
}
