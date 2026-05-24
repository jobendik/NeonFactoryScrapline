import { Balance } from '../config/Balance';

// SpatialGrid — bucket-by-cell index for cheap nearest-N / within-radius
// queries. Rebuilt once per frame in RaidScene.update() and read by:
//   - WeaponSystem.findNearestInRange (enemies, replaces O(n) scan)
//   - RaidScene pickup magnet loop (pickups, replaces O(n) scan)
//
// Per blueprint §24.2 / M21 spec. Cell size from Balance.performance —
// 120px gives 14×10 = 140 buckets max over the 1600×1120 world; with at
// most ~32 enemies / ~220 pickups, average bucket occupancy is small.

export interface GridItem {
  x: number;
  y: number;
  active: boolean;
}

export class SpatialGrid<T extends GridItem> {
  private cellSize: number;
  private buckets: Map<number, T[]> = new Map();
  // Encoded keys are recycled per call; clearing the Map between frames
  // would churn allocations, so we drop bucket arrays in-place.

  constructor(cellSize: number = Balance.performance.spatialGridCellPx) {
    this.cellSize = cellSize;
  }

  rebuild(items: Iterable<T>): void {
    // Clear existing buckets (re-use map + arrays where possible).
    for (const b of this.buckets.values()) b.length = 0;
    for (const it of items) {
      if (!it.active) continue;
      const key = this.keyOf(it.x, it.y);
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = [];
        this.buckets.set(key, bucket);
      }
      bucket.push(it);
    }
  }

  // Iterates all items whose CELLS lie within `radius` of (x, y). Caller
  // filters by exact distance. The bias is to over-collect slightly so no
  // valid item is missed (cells at the edge of the radius are kept).
  queryNearby(x: number, y: number, radius: number, out: T[] = []): T[] {
    out.length = 0;
    const cs = this.cellSize;
    const minCx = Math.floor((x - radius) / cs);
    const maxCx = Math.floor((x + radius) / cs);
    const minCy = Math.floor((y - radius) / cs);
    const maxCy = Math.floor((y + radius) / cs);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = (cx & 0xffff) * 0x10000 + (cy & 0xffff);
        const bucket = this.buckets.get(key);
        if (!bucket) continue;
        for (const it of bucket) {
          if (!it.active) continue;
          out.push(it);
        }
      }
    }
    return out;
  }

  // Cell key — interleaves x/y to fit in a single 32-bit number for fast
  // Map keying. Coordinates are masked to 16 bits each; the world bounds
  // (±800 / ±560) fit comfortably with cell size ≥ 32.
  private keyOf(x: number, y: number): number {
    const cs = this.cellSize;
    const cx = Math.floor(x / cs);
    const cy = Math.floor(y / cs);
    return (cx & 0xffff) * 0x10000 + (cy & 0xffff);
  }
}
