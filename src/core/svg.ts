/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

import { lighten } from './color';
import { BD_MAP_ASPECT_RATIO, BdGeo } from './geo';
import type { AnyBdMapData } from './map-data';
import { bdPaletteFor, bdPaletteShade, bdParentBorderFor } from './palettes';
import { BdArea, BdRegion, bdAreaIndex, type BdRect } from './region';

/** World space: x in `[0, aspect]`, y in `[0, 1]` (uniform units). */
export function worldBounds(region: BdRegion): BdRect {
  const b = region.bounds;
  return {
    left: b.left * BD_MAP_ASPECT_RATIO,
    top: b.top,
    right: b.right * BD_MAP_ASPECT_RATIO,
    bottom: b.bottom,
  };
}

/** The whole country in world space, with a small margin. */
export function countryViewport(margin = 0.01): BdRect {
  return { left: -margin, top: -margin, right: BD_MAP_ASPECT_RATIO + margin, bottom: 1 + margin };
}

/** A viewport framing `region` (or the country when `null`) in world space. */
export function viewportFor(region: BdRegion | null, padding = 0.04): BdRect {
  if (!region) return countryViewport();
  const b = worldBounds(region);
  const longest = Math.max(b.right - b.left, b.bottom - b.top);
  const inflate = longest * padding;
  return { left: b.left - inflate, top: b.top - inflate, right: b.right + inflate, bottom: b.bottom + inflate };
}

/** SVG `viewBox` attribute value for a world-space rect. */
export function viewBoxOf(r: BdRect, precision = 5): string {
  const f = (v: number) => Number(v.toFixed(precision));
  return `${f(r.left)} ${f(r.top)} ${f(r.right - r.left)} ${f(r.bottom - r.top)}`;
}

/** `d` attribute of `region` in world space (uniform units). */
export function worldPath(region: BdRegion): string {
  let cached = pathCache.get(region.id);
  if (!cached) {
    cached = region.svgPath(BD_MAP_ASPECT_RATIO, 1, 5);
    pathCache.set(region.id, cached);
  }
  return cached;
}
const pathCache = new Map<string, string>();

export interface BdSvgOptions {
  /** Which administrative level fills the map. Default `'district'`. */
  level?: BdArea;
  /** Only draw the descendants of this region (by id) at `level`, framed to it. */
  parent?: string | BdRegion | null;
  /** Output width in px. Height follows the country's aspect ratio. Default `600`. */
  width?: number;
  /** Values per region. Colors the map as a choropleth unless `choropleth` is `false`. */
  data?: AnyBdMapData | null;
  /** Use the data's color scale for fills. Default `true` when `data` is given. */
  choropleth?: boolean;
  /** Overrides the fill color per region. Return `null` for the default. */
  regionColor?: ((region: BdRegion) => string | null | undefined) | null;
  /** Fill shades cycled through the regions when no data color applies. */
  palette?: readonly string[];
  /** Draw region name labels. Default `true` for divisions and districts. */
  labels?: boolean;
  /** Use Bangla names for labels. */
  useBanglaNames?: boolean;
  /** Label font family. */
  fontFamily?: string;
  nationalBorderColor?: string;
  nationalBorderWidth?: number;
  parentBorderColor?: string;
  parentBorderWidth?: number;
  regionBorderColor?: string;
  regionBorderWidth?: number;
  backgroundColor?: string | null;
  /** Highlight this region (by id) with a lighter fill and a red outline. */
  selected?: string | BdRegion | null;
  /** Add `data-id` attributes and `<title>` tooltips to region paths. Default `true`. */
  interactive?: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Renders a static SVG string of Bangladesh at one administrative level —
 * usable on the server, in Node scripts, emails, or anywhere React is not.
 *
 * ```ts
 * import { writeFileSync } from 'node:fs';
 * import { BdMapData, renderSvg } from 'bd-map';
 *
 * const data = BdMapData.fromJsonString(json);
 * writeFileSync('map.svg', renderSvg({ level: 'district', data }));
 * ```
 */
export function renderSvg(options: BdSvgOptions = {}): string {
  const level = options.level ?? BdArea.district;
  const parent = typeof options.parent === 'string' ? BdGeo.byId(options.parent) : (options.parent ?? null);
  const width = options.width ?? 600;
  const palette = options.palette ?? bdPaletteFor(level);
  const data = options.data ?? null;
  const choropleth = options.choropleth ?? data !== null;
  const selectedId = typeof options.selected === 'string' ? options.selected : (options.selected?.id ?? null);
  const interactive = options.interactive ?? true;
  const bn = options.useBanglaNames ?? false;
  const fontFamily = options.fontFamily ?? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

  // Regions to fill: the whole level, or the parent's descendants at that level.
  let regions = BdGeo.regionsOf(level);
  if (parent) {
    if (bdAreaIndex(parent.level) >= bdAreaIndex(level)) {
      throw new RangeError(`parent '${parent.id}' is not above level '${level}'`);
    }
    regions = regions.filter((r) => r.id === parent.id || r.id.startsWith(parent.id + '.'));
  }
  const parentLevelIndex = bdAreaIndex(level) - 1;
  const parentBorders =
    parentLevelIndex < 0
      ? []
      : BdGeo.regionsOf(['division', 'district', 'upazila', 'union'][parentLevelIndex] as BdArea).filter(
          (r) => !parent || r.id === parent.id || r.id.startsWith(parent.id + '.'),
        );
  const nationalBorders = parent ? [] : BdGeo.divisions;

  const view = viewportFor(parent);
  const viewW = view.right - view.left;
  const viewH = view.bottom - view.top;
  const height = Math.round((width * viewH) / viewW);
  const scale = width / viewW; // px per world unit

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBoxOf(view)}" font-family="${esc(fontFamily)}">`,
  );
  if (options.backgroundColor) {
    parts.push(`<rect x="${view.left}" y="${view.top}" width="${viewW}" height="${viewH}" fill="${esc(options.backgroundColor)}"/>`);
  }

  const regionStroke = options.regionBorderColor ?? 'rgba(55, 71, 79, 0.53)';
  const regionStrokeW = (options.regionBorderWidth ?? 0.4) / scale;
  parts.push(`<g fill-rule="evenodd" stroke="${esc(regionStroke)}" stroke-width="${regionStrokeW}" stroke-linejoin="round">`);
  regions.forEach((r, i) => {
    let fill = options.regionColor?.(r) ?? null;
    if (!fill && choropleth && data) fill = data.colorOf(r);
    if (!fill) fill = bdPaletteShade(r, i, regions, palette);
    if (r.id === selectedId) fill = lighten(fill, 0.45);
    const attrs = interactive ? ` data-id="${esc(r.id)}" data-level="${r.level}"` : '';
    const title = interactive
      ? `<title>${esc(bn ? r.displayNameBn : r.name)}${data?.labelOf(r) ? ` · ${esc(data.labelOf(r)!)}` : ''}</title>`
      : '';
    parts.push(`<path d="${worldPath(r)}" fill="${esc(fill)}"${attrs}>${title}</path>`);
  });
  parts.push('</g>');

  if (parentBorders.length > 0) {
    const color = options.parentBorderColor ?? bdParentBorderFor(level);
    const w = (options.parentBorderWidth ?? 1.1) / scale;
    parts.push(
      `<g fill="none" stroke="${esc(color)}" stroke-width="${w}" stroke-linejoin="round" stroke-dasharray="0.008 0.004">`,
    );
    for (const p of parentBorders) parts.push(`<path d="${worldPath(p)}"/>`);
    parts.push('</g>');
  }

  if (nationalBorders.length > 0) {
    const w = (options.nationalBorderWidth ?? 2.5) / scale;
    parts.push(`<g fill="none" stroke="${esc(options.nationalBorderColor ?? '#616161')}" stroke-width="${w}" stroke-linejoin="round">`);
    for (const d of nationalBorders) parts.push(`<path d="${worldPath(d)}"/>`);
    parts.push('</g>');
  }

  if (selectedId) {
    const sel = regions.find((r) => r.id === selectedId);
    if (sel) parts.push(`<path d="${worldPath(sel)}" fill="none" stroke="#D32F2F" stroke-width="${2 / scale}" stroke-linejoin="round"/>`);
  }

  const labels = options.labels ?? (level === 'division' || level === 'district');
  if (labels) {
    const labelRegions = level === 'union' || level === 'upazila' ? (parent ? regions : BdGeo.districts) : regions;
    const px = level === 'division' ? 13 : level === 'district' ? 7.5 : 5;
    const fontSize = (px / scale) * (600 / width) * (width / 600); // px in world units
    parts.push(
      `<g font-size="${fontSize}" font-weight="700" fill="rgba(38, 50, 56, 0.9)" text-anchor="middle" dominant-baseline="middle" pointer-events="none">`,
    );
    for (const r of labelRegions) {
      const text = bn ? r.displayNameBn : level === 'upazila' && !parent ? r.name : r.name.toUpperCase();
      const b = worldBounds(r);
      const approxWidth = text.length * fontSize * 0.62;
      if (approxWidth > (b.right - b.left) * 2) continue;
      const p = r.labelPoint;
      parts.push(`<text x="${(p.x * BD_MAP_ASPECT_RATIO).toFixed(5)}" y="${p.y.toFixed(5)}">${esc(text)}</text>`);
    }
    parts.push('</g>');
  }

  parts.push('</svg>');
  return parts.join('');
}
