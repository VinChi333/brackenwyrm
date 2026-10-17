// Zufall an einer Stelle, damit Simulationen mit festem Startwert wiederholbar sind.

let gen: () => number = Math.random;

/** Fester Startwert für Tests und Balancing (mulberry32). */
export function seedRng(seed: number): void {
  let a = seed >>> 0;
  gen = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function useMathRandom(): void {
  gen = Math.random;
}

/** Zahl in [0, 1). */
export function rand(): number {
  return gen();
}

/** Ganzzahl von a bis b (beide eingeschlossen). */
export function roll(a: number, b: number): number {
  return a + Math.floor(gen() * (b - a + 1));
}

/** Zahl von a bis b. */
export function between(a: number, b: number): number {
  return a + gen() * (b - a);
}

export function chance(p: number): boolean {
  return gen() < p;
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(gen() * list.length)];
}
