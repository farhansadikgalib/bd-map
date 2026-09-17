/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

/** `[r, g, b, a]` with channels in `0–255` and alpha in `0–1`. */
export type Rgba = [number, number, number, number];

/**
 * Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`.
 * Returns `null` for anything else (named colors, hsl, ...).
 */
export function parseColor(input: string): Rgba | null {
  const s = input.trim();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    const v = Number.parseInt(hex, 16);
    if (Number.isNaN(v)) return null;
    if (hex.length === 6) return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1];
    return [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, (v & 255) / 255];
  }
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  return null;
}

/** Formats as `#rrggbb`, or `rgba(...)` when alpha is below 1. */
export function formatColor([r, g, b, a]: Rgba): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  if (a >= 1) return `#${h(r)}${h(g)}${h(b)}`;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`;
}

/** Linear interpolation between two CSS colors; `t` in `[0, 1]`. */
export function lerpColor(from: string, to: string, t: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return t < 0.5 ? from : to;
  const k = Math.max(0, Math.min(1, t));
  return formatColor([
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
    a[3] + (b[3] - a[3]) * k,
  ]);
}

/** Mixes a color toward white; `amount` in `[0, 1]`. */
export function lighten(color: string, amount: number): string {
  return lerpColor(color, '#ffffff', amount);
}

/** Returns the color with its alpha multiplied by `alpha`. */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  if (!c) return color;
  return formatColor([c[0], c[1], c[2], c[3] * alpha]);
}

/**
 * Deterministic 32-bit string hash (FNV-1a), used to spread palette shades
 * over regions like a printed mosaic map.
 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
