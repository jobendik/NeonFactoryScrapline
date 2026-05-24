// Seeded linear-congruential PRNG. See blueprint.md §22.4.
// Used for the daily-seed leaderboard so all players get identical raid configs.

export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force unsigned 32-bit; treat 0 as a valid seed.
    this.state = seed >>> 0;
  }

  next(): number {
    // Numerical Recipes LCG constants - cheap, good enough for gameplay seeding.
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    const idx = Math.floor(this.next() * arr.length);
    // Index is in [0, arr.length) so this is always defined.
    return arr[idx] as T;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

// YYYYMMDD as integer, used as the daily leaderboard seed.
export function dailySeed(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
