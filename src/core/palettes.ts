/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

import { hashString } from './color';
import type { BdArea, BdRegion } from './region';

/**
 * Default fills of the drill-down map: bright material hues (indigo, teal,
 * orange, pink, green, ...) cycled through the visible regions.
 */
export const BD_COLORFUL_PALETTE: readonly string[] = [
  '#3F51B5', '#009688', '#FF9800', '#E91E63', '#4CAF50', '#9C27B0', '#00BCD4',
  '#FFC107', '#F44336', '#2196F3', '#8BC34A', '#FF5722', '#673AB7',
];

/** The green-toned drill-down palette of the Flutter package. */
export const BD_GREEN_PALETTE: readonly string[] = [
  '#00796B', '#43A047', '#7CB342', '#26A69A', '#2E7D32', '#66BB6A', '#00897B',
  '#558B2F', '#388E3C', '#4DB6AC', '#81C784', '#33691E', '#00695C',
];

/** @deprecated Use {@link BD_GREEN_PALETTE}; the drill-down default is now {@link BD_COLORFUL_PALETTE}. */
export const BD_DRILLDOWN_PALETTE = BD_GREEN_PALETTE;

/** Division map: soft categorical hues (ColorBrewer Set2 style). */
export const BD_DIVISION_PALETTE: readonly string[] = [
  '#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854', '#FFD92F', '#80B1D3', '#E5C494',
];

/** District map: emerald-and-teal mosaic. */
export const BD_DISTRICT_PALETTE: readonly string[] = [
  '#26A69A', '#9CCC65', '#80CBC4', '#66BB6A', '#00897B', '#A5D6A7',
  '#4DB6AC', '#7CB342', '#B2DFDB', '#43A047', '#81C784', '#00796B',
];

/** Thana/upazila map: the classic printed-map green mosaic. */
export const BD_UPAZILA_PALETTE: readonly string[] = [
  '#66BB6A', '#9CCC65', '#43A047', '#A5D6A7', '#7CB342', '#81C784', '#558B2F',
  '#C5E1A5', '#388E3C', '#8BC34A', '#2E7D32', '#AED581', '#689F38', '#DCEDC8',
];

/** Union map: pale sage-and-water pastels. */
export const BD_UNION_PALETTE: readonly string[] = [
  '#C8E6C9', '#B2DFDB', '#DCEDC8', '#B2EBF2', '#E6EE9C', '#A5D6A7', '#80CBC4', '#C5E1A5', '#E0F2F1', '#AED581',
];

/** The default country-map palette for a level. */
export function bdPaletteFor(level: BdArea): readonly string[] {
  switch (level) {
    case 'division':
      return BD_DIVISION_PALETTE;
    case 'district':
      return BD_DISTRICT_PALETTE;
    case 'upazila':
      return BD_UPAZILA_PALETTE;
    case 'union':
      return BD_UNION_PALETTE;
  }
}

/** Default dashed parent-border color of the country map for a level. */
export function bdParentBorderFor(level: BdArea): string {
  return level === 'union' ? '#EF6C00' : '#F9A825';
}

/**
 * The palette shade for a region among `regions`. When every region fits in
 * the palette the shade is assigned by index so all are distinct; otherwise
 * the id is hashed so neighbors tend to differ, like a printed mosaic map.
 */
export function bdPaletteShade(region: BdRegion, index: number, regions: readonly BdRegion[], palette: readonly string[]): string {
  if (regions.length <= palette.length) return palette[(index < 0 ? 0 : index) % palette.length];
  return palette[hashString(region.id) % palette.length];
}
