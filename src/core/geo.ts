/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

import meta from '../data/meta.json';
import divisionsJson from '../data/divisions.json';
import districtsJson from '../data/districts.json';
import upazilasJson from '../data/upazilas.json';
import unionsJson from '../data/unions.json';
import unionNamesJson from '../data/union-names.json';
import { BD_AREAS, BdArea, BdRegion, BdUnion, type BdPolygons } from './region';

/** Width / height ratio of the projected country bounding box. */
export const BD_MAP_ASPECT_RATIO: number = meta.aspectRatio;

interface RawRegion {
  id: string;
  name: string;
  bn: string;
  level: number;
  parent: string | null;
  polygons: BdPolygons;
}

function hydrate(raw: RawRegion[]): BdRegion[] {
  return raw.map(
    (r) =>
      new BdRegion({
        id: r.id,
        name: r.name,
        bnName: r.bn,
        level: BD_AREAS[r.level],
        parentId: r.parent,
        rawPolygons: r.polygons,
      }),
  );
}

let _divisions: BdRegion[] | undefined;
let _districts: BdRegion[] | undefined;
let _upazilas: BdRegion[] | undefined;
let _unionRegions: BdRegion[] | undefined;
let _byId: Map<string, BdRegion> | undefined;
let _byParent: Map<string, BdRegion[]> | undefined;
let _unionsByUpazila: Map<string, BdUnion[]> | undefined;
let _allUnions: BdUnion[] | undefined;

function index() {
  if (_byId) return;
  const byId = new Map<string, BdRegion>();
  const byParent = new Map<string, BdRegion[]>();
  for (const list of [BdGeo.divisions, BdGeo.districts, BdGeo.upazilas, BdGeo.unionRegions]) {
    for (const r of list) {
      byId.set(r.id, r);
      if (r.parentId !== null) {
        let siblings = byParent.get(r.parentId);
        if (!siblings) byParent.set(r.parentId, (siblings = []));
        siblings.push(r);
      }
    }
  }
  _byId = byId;
  _byParent = byParent;
}

function indexUnions() {
  if (_unionsByUpazila) return;
  const byUpazila = new Map<string, BdUnion[]>();
  const all: BdUnion[] = [];
  for (const [upazilaId, entries] of Object.entries(unionNamesJson as Record<string, string[][]>)) {
    const list = entries.map(([name, bn]) => new BdUnion(name, bn, upazilaId));
    byUpazila.set(upazilaId, list);
    all.push(...list);
  }
  _unionsByUpazila = byUpazila;
  _allUnions = all;
}

function byName(list: BdRegion[], name: string): BdRegion | null {
  const trimmed = name.trim();
  const n = trimmed.toLowerCase();
  for (const r of list) {
    if (r.name.toLowerCase() === n || r.bnName === trimmed) return r;
  }
  return null;
}

/**
 * Lookup API over the administrative geography of Bangladesh.
 *
 * ```ts
 * const dhaka = BdGeo.divisionByName('Dhaka')!;
 * const districts = BdGeo.childrenOf(dhaka); // 13 districts
 * ```
 */
export const BdGeo = {
  /** The 8 divisions of Bangladesh. */
  get divisions(): BdRegion[] {
    return (_divisions ??= hydrate(divisionsJson as RawRegion[]));
  },

  /** All 64 districts. */
  get districts(): BdRegion[] {
    return (_districts ??= hydrate(districtsJson as RawRegion[]));
  },

  /** All upazilas / thanas. */
  get upazilas(): BdRegion[] {
    return (_upazilas ??= hydrate(upazilasJson as RawRegion[]));
  },

  /** All union / ward level regions, with boundary geometry. */
  get unionRegions(): BdRegion[] {
    return (_unionRegions ??= hydrate(unionsJson as RawRegion[]));
  },

  /** All unions (ইউনিয়ন) of Bangladesh from the curated name list — names only. */
  get unions(): BdUnion[] {
    indexUnions();
    return _allUnions!;
  },

  /** Every region of the given level. */
  regionsOf(level: BdArea): BdRegion[] {
    switch (level) {
      case BdArea.division:
        return BdGeo.divisions;
      case BdArea.district:
        return BdGeo.districts;
      case BdArea.upazila:
        return BdGeo.upazilas;
      case BdArea.union:
        return BdGeo.unionRegions;
    }
  },

  /**
   * Unions of the upazila with the given {@link BdRegion.id}.
   *
   * Backed by the curated name dataset; for upazilas it does not cover
   * (e.g. metro thanas, whose wards exist only as boundary geometry), the
   * list is derived from the union-level {@link BdGeo.unionRegions} instead,
   * so this never under-reports what the maps can actually draw.
   */
  unionsOf(upazilaId: string): BdUnion[] {
    indexUnions();
    const named = _unionsByUpazila!.get(upazilaId);
    if (named && named.length > 0) return named;
    index();
    const children = _byParent!.get(upazilaId);
    if (!children) return [];
    return children
      .filter((r) => r.level === BdArea.union)
      .map((r) => new BdUnion(r.name, r.bnName, upazilaId));
  },

  /** Region with the given id, or `null`. */
  byId(id: string): BdRegion | null {
    index();
    return _byId!.get(id) ?? null;
  },

  /**
   * Direct children of `region` (districts of a division, upazilas of a
   * district, unions of an upazila). Empty for unions.
   */
  childrenOf(region: BdRegion): BdRegion[] {
    index();
    return _byParent!.get(region.id) ?? [];
  },

  /** Parent of `region`, or `null` for divisions. */
  parentOf(region: BdRegion): BdRegion | null {
    return region.parentId === null ? null : BdGeo.byId(region.parentId);
  },

  /** Ancestors of `region`, division first. Empty for divisions. */
  ancestorsOf(region: BdRegion): BdRegion[] {
    const out: BdRegion[] = [];
    let p = BdGeo.parentOf(region);
    while (p) {
      out.unshift(p);
      p = BdGeo.parentOf(p);
    }
    return out;
  },

  /** Division matching `name` (English or Bangla, case-insensitive). */
  divisionByName(name: string): BdRegion | null {
    return byName(BdGeo.divisions, name);
  },

  /** District matching `name` (English or Bangla, case-insensitive). */
  districtByName(name: string): BdRegion | null {
    return byName(BdGeo.districts, name);
  },

  /**
   * Every upazila / thana matching `name` (English or Bangla,
   * case-insensitive). Several may share a name, e.g. `Sreepur` exists in
   * both Gazipur and Magura.
   */
  upazilasByName(name: string): BdRegion[] {
    const trimmed = name.trim();
    const n = trimmed.toLowerCase();
    return BdGeo.upazilas.filter((r) => r.name.toLowerCase() === n || r.bnName === trimmed);
  },

  /**
   * The deepest region containing the normalized country-space point,
   * down to `maxLevel`. Walks the hierarchy so union lookups stay fast.
   */
  regionAt(x: number, y: number, maxLevel: BdArea = BdArea.union): BdRegion | null {
    let candidates = BdGeo.divisions;
    let found: BdRegion | null = null;
    for (const level of BD_AREAS) {
      const hit = candidates.find((r) => r.containsPoint(x, y));
      if (!hit) break;
      found = hit;
      if (level === maxLevel) break;
      candidates = BdGeo.childrenOf(hit);
    }
    return found;
  },
};
