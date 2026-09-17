/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

/** Administrative level of a {@link BdRegion}. */
export const BdArea = {
  /** Division (বিভাগ) — top level, 8 in total. */
  division: 'division',
  /** District / Zila (জেলা) — 64 in total. */
  district: 'district',
  /** Upazila / Thana (উপজেলা / থানা) — sub-district level. */
  upazila: 'upazila',
  /** Union / Ward (ইউনিয়ন / ওয়ার্ড) — the lowest tier, below upazila. */
  union: 'union',
} as const;

export type BdArea = (typeof BdArea)[keyof typeof BdArea];

/** All levels, shallowest first. */
export const BD_AREAS: readonly BdArea[] = ['division', 'district', 'upazila', 'union'];

/** Depth of a level: division = 0 … union = 3. */
export function bdAreaIndex(level: BdArea): number {
  return BD_AREAS.indexOf(level);
}

/** Axis-aligned bounding box in normalized country space. */
export interface BdRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BdPoint {
  x: number;
  y: number;
}

/** Polygons → rings → flat `[x1, y1, x2, y2, ...]`. */
export type BdPolygons = number[][][];

/**
 * One administrative region of Bangladesh (a division, district, upazila or
 * union) together with its boundary geometry.
 *
 * Coordinates are normalized to the country bounding box: `x` and `y` are in
 * `[0, 1]`, `y` grows southward (screen convention). Multiply `x` by
 * {@link BD_MAP_ASPECT_RATIO} to get uniform units.
 */
export class BdRegion {
  /**
   * Stable unique identifier: the lowercase English path from the division
   * down, dot-separated — `'dhaka'`, `'dhaka.gazipur'`,
   * `'dhaka.gazipur.sreepur'`, `'dhaka.gazipur.sreepur.barmi'`.
   */
  readonly id: string;
  /** English name, e.g. `'Dhaka'`. */
  readonly name: string;
  /** Bangla name, e.g. `'ঢাকা'`. May be empty when unknown. */
  readonly bnName: string;
  /** Administrative level of this region. */
  readonly level: BdArea;
  /** {@link id} of the parent region (`null` for divisions). */
  readonly parentId: string | null;
  /**
   * Boundary geometry: polygons → rings → flat `[x1, y1, x2, y2, ...]`
   * coordinate list. The first ring of each polygon is the outer boundary,
   * any following rings are holes.
   */
  readonly rawPolygons: BdPolygons;

  private _bounds?: BdRect;
  private _labelPoint?: BdPoint;

  constructor(init: {
    id: string;
    name: string;
    bnName: string;
    level: BdArea;
    parentId?: string | null;
    rawPolygons: BdPolygons;
  }) {
    this.id = init.id;
    this.name = init.name;
    this.bnName = init.bnName;
    this.level = init.level;
    this.parentId = init.parentId ?? null;
    this.rawPolygons = init.rawPolygons;
  }

  /** Bangla name when available, otherwise the English name. */
  get displayNameBn(): string {
    return this.bnName === '' ? this.name : this.bnName;
  }

  /** Bounding box of this region in normalized country space. */
  get bounds(): BdRect {
    if (this._bounds) return this._bounds;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const polygon of this.rawPolygons) {
      const outer = polygon[0];
      for (let i = 0; i < outer.length; i += 2) {
        const x = outer[i],
          y = outer[i + 1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    this._bounds = { left: minX, top: minY, right: maxX, bottom: maxY };
    return this._bounds;
  }

  /** A point inside the largest polygon, useful for placing labels. */
  get labelPoint(): BdPoint {
    if (this._labelPoint) return this._labelPoint;
    let largest: number[] | undefined;
    let largestArea = -1;
    for (const polygon of this.rawPolygons) {
      const area = ringArea(polygon[0]);
      if (area > largestArea) {
        largestArea = area;
        largest = polygon[0];
      }
    }
    const ring = largest!;
    const c = ringCentroid(ring);
    if (pointInRing(c.x, c.y, ring)) {
      this._labelPoint = c;
      return c;
    }
    // Centroid fell outside (concave shape) — use the midpoint of the
    // widest horizontal span at the centroid's height.
    const xs: number[] = [];
    for (let i = 0; i < ring.length; i += 2) {
      const x1 = ring[i],
        y1 = ring[i + 1];
      const j = (i + 2) % ring.length;
      const x2 = ring[j],
        y2 = ring[j + 1];
      if (y1 > c.y !== y2 > c.y) {
        xs.push(x1 + ((c.y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    this._labelPoint = xs.length >= 2 ? { x: (xs[0] + xs[1]) / 2, y: c.y } : c;
    return this._labelPoint;
  }

  /** Whether the normalized country-space point (`x`, `y`) lies inside this region. */
  containsPoint(x: number, y: number): boolean {
    for (const polygon of this.rawPolygons) {
      if (pointInRing(x, y, polygon[0])) {
        let inHole = false;
        for (let i = 1; i < polygon.length; i++) {
          if (pointInRing(x, y, polygon[i])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
    }
    return false;
  }

  /**
   * SVG path data (`d` attribute) for the boundary. Coordinates are scaled
   * by `scaleX` / `scaleY`; pass `BD_MAP_ASPECT_RATIO` as `scaleX` for
   * uniform units, or e.g. `width` / `height` of a target viewBox.
   * Use with `fill-rule="evenodd"` so holes render correctly.
   */
  svgPath(scaleX = 1, scaleY = 1, precision = 4): string {
    let d = '';
    const f = (v: number) => Number(v.toFixed(precision)).toString();
    for (const polygon of this.rawPolygons) {
      for (const ring of polygon) {
        d += `M${f(ring[0] * scaleX)} ${f(ring[1] * scaleY)}`;
        for (let i = 2; i < ring.length; i += 2) {
          d += `L${f(ring[i] * scaleX)} ${f(ring[i + 1] * scaleY)}`;
        }
        d += 'Z';
      }
    }
    return d;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      bnName: this.bnName,
      level: this.level,
      parentId: this.parentId,
    };
  }
}

/**
 * A union (ইউনিয়ন) — the lowest administrative tier, below upazila — as a
 * plain name record from the curated name list.
 */
export class BdUnion {
  /** English name, e.g. `'Subil'`. */
  readonly name: string;
  /** Bangla name, e.g. `'সুবিল'`. May be empty when unknown. */
  readonly bnName: string;
  /** {@link BdRegion.id} of the upazila this union belongs to. */
  readonly upazilaId: string;

  constructor(name: string, bnName: string, upazilaId: string) {
    this.name = name;
    this.bnName = bnName;
    this.upazilaId = upazilaId;
  }

  /** Bangla name when available, otherwise the English name. */
  get displayNameBn(): string {
    return this.bnName === '' ? this.name : this.bnName;
  }
}

// ------------------------------------------------------------ ring helpers

export function pointInRing(x: number, y: number, ring: number[]): boolean {
  let inside = false;
  const n = ring.length >> 1;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = ring[i * 2],
      yi = ring[i * 2 + 1];
    const xj = ring[j * 2],
      yj = ring[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

export function ringArea(ring: number[]): number {
  let area = 0;
  const n = ring.length >> 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += ring[i * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[i * 2 + 1];
  }
  return Math.abs(area) / 2;
}

export function ringCentroid(ring: number[]): BdPoint {
  let a = 0,
    cx = 0,
    cy = 0;
  const n = ring.length >> 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = ring[i * 2],
      y1 = ring[i * 2 + 1];
    const x2 = ring[j * 2],
      y2 = ring[j * 2 + 1];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-12) {
    let sx = 0,
      sy = 0;
    for (let i = 0; i < n; i++) {
      sx += ring[i * 2];
      sy += ring[i * 2 + 1];
    }
    return { x: sx / n, y: sy / n };
  }
  a *= 0.5;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}
