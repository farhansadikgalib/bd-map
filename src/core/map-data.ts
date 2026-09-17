/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

import { lerpColor } from './color';
import { BdGeo } from './geo';
import { BdRegion } from './region';

export const BD_DEFAULT_MIN_COLOR = '#C8E6C9';
export const BD_DEFAULT_MAX_COLOR = '#1B5E20';

/** A {@link BdMapData} of any value type — what the map components accept. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBdMapData = BdMapData<any>;

export interface BdMapDataOptions<T> {
  /** What this dataset measures, e.g. `'Population'`. */
  title?: string | null;
  /** Formats a value for display. Defaults to `String(value)`. */
  format?: ((value: T) => string) | null;
  /**
   * Overrides the choropleth color per value. Return `null` to fall back to
   * the automatic numeric scale (or no color for non-numeric values).
   */
  colorBuilder?: ((value: T) => string | null | undefined) | null;
  /** Fill for the smallest numeric value on the automatic scale. */
  minColor?: string;
  /** Fill for the largest numeric value on the automatic scale. */
  maxColor?: string;
}

export interface BdMapDataListOptions {
  /** Name of the field holding the region name / id. */
  regionKey?: string;
  /** Name of the field holding the value. */
  valueKey?: string;
  title?: string | null;
  unit?: string | null;
  minColor?: string;
  maxColor?: string;
}

type Json = unknown;

const LEVEL_FIELDS: Record<string, number> = {
  division: 0,
  district: 1,
  upazila: 2,
  thana: 2,
  union: 3,
};
const VALUE_FIELDS = ['value', 'count', 'total', 'amount', 'population', 'percentage'];
const WRAPPER_KEYS = new Set(['districts', 'upazilas', 'thanas', 'unions', 'children']);
const GENERIC_KEYS = new Set(['id', 'region', 'name']);

function isRecord(v: unknown): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Numbers pass through; numeric strings become numbers; other strings stay. */
function coerce(raw: unknown): number | string | null {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
    return raw;
  }
  return null;
}

function trimNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const s = v.toFixed(2);
  return s.endsWith('0') ? s.slice(0, -1) : s;
}

function unitFormatter(unit: string | null | undefined): ((v: unknown) => string) {
  if (unit === null || unit === undefined) {
    return (v) => (typeof v === 'number' ? trimNum(v) : String(v));
  }
  return (v) => (typeof v === 'number' ? `${trimNum(v)}${unit}` : `${String(v)}${unit}`);
}

function hexOrDefault(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const hex = raw.replace(/^#/, '');
  return /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex) ? `#${hex}` : fallback;
}

function matches(r: BdRegion, key: string): boolean {
  const k = key.trim();
  const lower = k.toLowerCase();
  return (
    r.name.toLowerCase() === lower ||
    r.bnName === k ||
    r.id === lower ||
    r.id.slice(r.id.lastIndexOf('.') + 1) === lower
  );
}

/**
 * Resolves a key directly against `candidates` — used in the nested tree,
 * where children are already scoped to their parent and a literal `/` may
 * be part of the name (e.g. the union `Nuralla Pur U/C`).
 */
function resolveIn(key: string, candidates: BdRegion[]): BdRegion[] {
  return candidates.filter((r) => matches(r, key));
}

/**
 * Resolves a JSON key (name, id, or `Parent/Child` path) to the regions of
 * `level` it refers to. The whole key is tried as a name first, so names
 * containing a literal `/` still work.
 */
function resolveKey(key: string, level: BdRegion[]): BdRegion[] {
  const direct = resolveIn(key, level);
  if (direct.length > 0) return direct;
  const segments = key
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (segments.length === 0) return [];
  const target = segments[segments.length - 1];
  const ancestors = segments.slice(0, -1);
  const out: BdRegion[] = [];
  for (const region of level) {
    if (!matches(region, target)) continue;
    // Every path ancestor must appear (in order, deepest last) in the
    // region's ancestor chain.
    let r = BdGeo.parentOf(region);
    let ok = true;
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const wanted = ancestors[i];
      while (r && !matches(r, wanted)) r = BdGeo.parentOf(r);
      if (!r) {
        ok = false;
        break;
      }
      r = BdGeo.parentOf(r);
    }
    if (ok) out.push(region);
  }
  return out;
}

/**
 * User data attached to the Bangladesh maps, keyed by {@link BdRegion.id}.
 *
 * Works at every administrative level — the same object can carry values for
 * divisions, districts, upazilas/thanas, and unions at once, because all
 * region ids share one namespace (`'dhaka'`, `'dhaka.gazipur'`,
 * `'dhaka.gazipur.sreepur'`, ...).
 *
 * Numeric values get an automatic choropleth scale: {@link colorOf}
 * interpolates between {@link minColor} and {@link maxColor} according to
 * where the value sits between the smallest and largest values.
 *
 * ```ts
 * const population = new BdMapData<number>(
 *   { dhaka: 44.2, chattagram: 33.2, rajshahi: 20.4 },
 *   { title: 'Population', format: (v) => `${v}M` },
 * );
 * ```
 */
export class BdMapData<T = number> {
  /** Region values keyed by {@link BdRegion.id}. */
  readonly values: Map<string, T>;
  readonly title: string | null;
  readonly format: ((value: T) => string) | null;
  readonly colorBuilder: ((value: T) => string | null | undefined) | null;
  readonly minColor: string;
  readonly maxColor: string;

  private _min?: number;
  private _max?: number;
  private _scanned = false;

  constructor(values: Record<string, T> | Map<string, T> | Iterable<[string, T]>, options: BdMapDataOptions<T> = {}) {
    this.values =
      values instanceof Map
        ? new Map(values)
        : Symbol.iterator in Object(values) && typeof values !== 'string'
          ? new Map(values as Iterable<[string, T]>)
          : new Map(Object.entries(values as Record<string, T>));
    this.title = options.title ?? null;
    this.format = options.format ?? null;
    this.colorBuilder = options.colorBuilder ?? null;
    this.minColor = options.minColor ?? BD_DEFAULT_MIN_COLOR;
    this.maxColor = options.maxColor ?? BD_DEFAULT_MAX_COLOR;
  }

  /**
   * Builds a dataset from a user-friendly JSON object — the easiest way to
   * feed data into the maps. Region keys are plain **names** (English,
   * case-insensitive, or Bangla) or region ids.
   *
   * Primary shape — a tree nested the way the country is organized, under
   * `"data"`. Each region holds its own `"value"` and its children (directly
   * by name, or wrapped in `"districts"` / `"thanas"` / `"unions"`); a child
   * that is a plain number is just its value:
   *
   * ```json
   * {
   *   "title": "Population", "unit": "M",
   *   "data": { "Dhaka": { "value": 44.2, "Gazipur": { "value": 3.4, "Sreepur": 0.4 } } }
   * }
   * ```
   *
   * Flat per-level sections are also accepted (`"divisions"`, `"districts"`,
   * `"upazilas"` / `"thanas"`, `"unions"`), where a key may be a
   * `Parent/Child` path to disambiguate repeated names. `"values"` may hold
   * raw region-id keys. `"minColor"` / `"maxColor"` accept hex strings.
   */
  static fromJson<T = number>(json: Record<string, Json>): BdMapData<T> {
    const values = new Map<string, T>();
    const accept = (v: number | string | null): v is T & (number | string) => v !== null;

    const section = (name: string, level: BdRegion[]) => {
      const map = json[name];
      if (!isRecord(map)) return;
      for (const [k, raw] of Object.entries(map)) {
        const value = coerce(raw);
        if (!accept(value)) continue;
        for (const region of resolveKey(k, level)) values.set(region.id, value);
      }
    };
    section('divisions', BdGeo.divisions);
    section('districts', BdGeo.districts);
    section('upazilas', BdGeo.upazilas);
    section('thanas', BdGeo.upazilas);
    section('unions', BdGeo.unionRegions);

    const walkTree = (region: BdRegion, node: Json) => {
      if (!isRecord(node)) {
        const value = coerce(node);
        if (accept(value)) values.set(region.id, value);
        return;
      }
      const children = BdGeo.childrenOf(region);
      for (const [key, childNode] of Object.entries(node)) {
        if (key === 'value') {
          const value = coerce(childNode);
          if (accept(value)) values.set(region.id, value);
          continue;
        }
        if (WRAPPER_KEYS.has(key) && isRecord(childNode)) {
          for (const [k, v] of Object.entries(childNode)) {
            for (const child of resolveIn(k, children)) walkTree(child, v);
          }
          continue;
        }
        for (const child of resolveIn(key, children)) walkTree(child, childNode);
      }
    };
    const tree = json.data;
    if (isRecord(tree)) {
      for (const [k, v] of Object.entries(tree)) {
        for (const division of resolveIn(k, BdGeo.divisions)) walkTree(division, v);
      }
    }

    const raw = json.values;
    if (isRecord(raw)) {
      for (const [k, v] of Object.entries(raw)) {
        const value = coerce(v);
        if (accept(value) && BdGeo.byId(k)) values.set(k, value);
      }
    }

    const unit = typeof json.unit === 'string' ? json.unit : null;
    return new BdMapData<T>(values, {
      title: typeof json.title === 'string' ? json.title : null,
      format: unitFormatter(unit) as (v: T) => string,
      minColor: hexOrDefault(json.minColor, BD_DEFAULT_MIN_COLOR),
      maxColor: hexOrDefault(json.maxColor, BD_DEFAULT_MAX_COLOR),
    });
  }

  /**
   * Builds a dataset from a JSON **list** — the shape most APIs return:
   *
   * ```ts
   * BdMapData.fromList([
   *   { district: 'Gazipur', value: 3.4 },
   *   { division: 'Dhaka', thana: 'Savar', population: 1.4 },
   * ], { title: 'Population' });
   * ```
   *
   * Each item names its region with a level field — `division`, `district`,
   * `thana` / `upazila`, or `union` — where the deepest field present is the
   * target and shallower ones qualify it. Items may instead use a generic
   * `name`, `region` or `id` field. The value comes from `valueKey`, else
   * the first of `value` / `count` / `total` / `amount` / `population` /
   * `percentage`, else the first numeric field left over.
   */
  static fromList<T = number>(items: Json[], options: BdMapDataListOptions = {}): BdMapData<T> {
    const values = new Map<string, T>();
    const levels = [BdGeo.divisions, BdGeo.districts, BdGeo.upazilas, BdGeo.unionRegions];
    const regionKey = options.regionKey?.toLowerCase();
    const valueKey = options.valueKey?.toLowerCase();

    for (const raw of items) {
      if (!isRecord(raw)) continue;
      const item: Record<string, Json> = {};
      for (const [k, v] of Object.entries(raw)) item[k.toLowerCase()] = v;

      let regions: BdRegion[] = [];
      if (regionKey !== undefined) {
        const key = item[regionKey];
        if (key !== undefined && key !== null) {
          for (const level of levels) {
            regions = resolveKey(String(key), level);
            if (regions.length > 0) break;
          }
        }
      } else {
        let deepest = -1;
        for (const f of Object.keys(LEVEL_FIELDS)) {
          if (item[f] !== undefined && item[f] !== null && LEVEL_FIELDS[f] > deepest) {
            deepest = LEVEL_FIELDS[f];
          }
        }
        if (deepest >= 0) {
          const path: string[] = [];
          for (const f of ['division', 'district', 'upazila', 'thana', 'union']) {
            if (item[f] !== undefined && item[f] !== null && LEVEL_FIELDS[f] <= deepest) {
              path.push(String(item[f]));
            }
          }
          regions = resolveKey(path.join('/'), levels[deepest]);
        } else {
          const key = item.id ?? item.region ?? item.name;
          if (key !== undefined && key !== null) {
            for (const level of levels) {
              regions = resolveKey(String(key), level);
              if (regions.length > 0) break;
            }
          }
        }
      }
      if (regions.length === 0) continue;

      let rawValue: Json;
      if (valueKey !== undefined) {
        rawValue = item[valueKey];
      } else {
        for (const f of VALUE_FIELDS) {
          if (item[f] !== undefined && item[f] !== null) {
            rawValue = item[f];
            break;
          }
        }
        if (rawValue === undefined) {
          rawValue = Object.entries(item).find(
            ([k, v]) => !(k in LEVEL_FIELDS) && !GENERIC_KEYS.has(k) && typeof coerce(v) === 'number',
          )?.[1];
        }
      }
      const value = coerce(rawValue);
      if (value === null) continue;
      for (const region of regions) values.set(region.id, value as unknown as T);
    }

    return new BdMapData<T>(values, {
      title: options.title ?? null,
      format: unitFormatter(options.unit) as (v: T) => string,
      minColor: options.minColor ?? BD_DEFAULT_MIN_COLOR,
      maxColor: options.maxColor ?? BD_DEFAULT_MAX_COLOR,
    });
  }

  /**
   * {@link fromJson} / {@link fromList} for a raw JSON string — pair it with
   * a file or an HTTP response body. A top-level object uses the file
   * format; a top-level **array** (or an object whose `"data"` is an array)
   * is treated as an API-style list.
   */
  static fromJsonString<T = number>(jsonString: string): BdMapData<T> {
    return BdMapData.fromAny<T>(JSON.parse(jsonString));
  }

  /** {@link fromJsonString} for an already-parsed value (object or array). */
  static fromAny<T = number>(decoded: Json): BdMapData<T> {
    if (Array.isArray(decoded)) return BdMapData.fromList<T>(decoded);
    if (!isRecord(decoded)) throw new TypeError('BdMapData: expected a JSON object or array');
    if (Array.isArray(decoded.data)) {
      return BdMapData.fromList<T>(decoded.data, {
        title: typeof decoded.title === 'string' ? decoded.title : null,
        unit: typeof decoded.unit === 'string' ? decoded.unit : null,
        minColor: hexOrDefault(decoded.minColor, BD_DEFAULT_MIN_COLOR),
        maxColor: hexOrDefault(decoded.maxColor, BD_DEFAULT_MAX_COLOR),
      });
    }
    return BdMapData.fromJson<T>(decoded);
  }

  private scan() {
    if (this._scanned) return;
    this._scanned = true;
    for (const v of this.values.values()) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        this._min = this._min === undefined || v < this._min ? v : this._min;
        this._max = this._max === undefined || v > this._max ? v : this._max;
      }
    }
  }

  /** Smallest numeric value, or `null` if none are numeric. */
  get minValue(): number | null {
    this.scan();
    return this._min ?? null;
  }

  /** Largest numeric value, or `null` if none are numeric. */
  get maxValue(): number | null {
    this.scan();
    return this._max ?? null;
  }

  /** Number of regions with a value. */
  get size(): number {
    return this.values.size;
  }

  /** The value for `region`, or `null` when none was provided. */
  valueOf(region: BdRegion): T | null {
    return this.values.get(region.id) ?? null;
  }

  /** The value for the region with `id`, or `null`. */
  get(id: string): T | null {
    return this.values.get(id) ?? null;
  }

  /** Whether a value exists for `region`. */
  has(region: BdRegion): boolean {
    return this.values.has(region.id);
  }

  /** The display string for `region`'s value, or `null` when it has none. */
  labelOf(region: BdRegion): string | null {
    const v = this.values.get(region.id);
    if (v === undefined || v === null) return null;
    return this.format ? this.format(v) : String(v);
  }

  /**
   * The choropleth fill for `region`, or `null` when it has no value (or a
   * non-numeric value and no `colorBuilder`).
   */
  colorOf(region: BdRegion): string | null {
    const v = this.values.get(region.id);
    if (v === undefined || v === null) return null;
    const custom = this.colorBuilder?.(v);
    if (custom) return custom;
    if (typeof v !== 'number') return null;
    this.scan();
    if (this._min === undefined || this._max === undefined) return null;
    const t = this._max === this._min ? 1 : Math.max(0, Math.min(1, (v - this._min) / (this._max - this._min)));
    return lerpColor(this.minColor, this.maxColor, t);
  }

  /**
   * Regions sorted by value, largest first. Regions without a value keep
   * their original order at the end.
   */
  sort(regions: BdRegion[]): BdRegion[] {
    const withValue: BdRegion[] = [];
    const withoutValue: BdRegion[] = [];
    for (const r of regions) (this.has(r) ? withValue : withoutValue).push(r);
    withValue.sort((a, b) => {
      const va = this.valueOf(a),
        vb = this.valueOf(b);
      if (typeof va === 'number' && typeof vb === 'number') return vb - va;
      return 0;
    });
    return [...withValue, ...withoutValue];
  }
}
