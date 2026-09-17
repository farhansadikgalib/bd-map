/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

export { BdArea, BD_AREAS, bdAreaIndex, BdRegion, BdUnion } from './core/region';
export type { BdRect, BdPoint, BdPolygons } from './core/region';
export { BdGeo, BD_MAP_ASPECT_RATIO } from './core/geo';
export { BdMapData, BD_DEFAULT_MIN_COLOR, BD_DEFAULT_MAX_COLOR } from './core/map-data';
export type { BdMapDataOptions, BdMapDataListOptions, AnyBdMapData } from './core/map-data';
export { parseColor, formatColor, lerpColor, lighten, withAlpha, hashString } from './core/color';
export type { Rgba } from './core/color';
export {
  BD_COLORFUL_PALETTE,
  BD_GREEN_PALETTE,
  BD_DRILLDOWN_PALETTE,
  BD_DIVISION_PALETTE,
  BD_DISTRICT_PALETTE,
  BD_UPAZILA_PALETTE,
  BD_UNION_PALETTE,
  bdPaletteFor,
  bdParentBorderFor,
  bdPaletteShade,
} from './core/palettes';
export { renderSvg, worldPath, worldBounds, viewportFor, countryViewport, viewBoxOf } from './core/svg';
export type { BdSvgOptions } from './core/svg';
