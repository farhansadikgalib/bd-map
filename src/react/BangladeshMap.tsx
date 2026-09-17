/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

import { useState, type CSSProperties } from 'react';
import { lighten } from '../core/color';
import { BD_MAP_ASPECT_RATIO, BdGeo } from '../core/geo';
import { BD_COLORFUL_PALETTE } from '../core/palettes';
import type { BdRegion } from '../core/region';
import { countryViewport, viewBoxOf, worldPath } from '../core/svg';
import { BdCountryMap, type BdCountryMapProps } from './BdCountryMap';
import { nameOf, rootStyle, useElementSize } from './shared';

export interface BangladeshMapProps {
  /**
   * Fill per division, keyed by division id (`'dhaka'`, `'chattagram'`,
   * `'rajshahi'`, `'khulna'`, `'barishal'`, `'sylhet'`, `'rangpur'`,
   * `'mymensingh'`) or English name. Missing divisions use `palette`.
   */
  divisionColors?: Record<string, string>;
  /** Fills cycled through divisions without an explicit color. */
  palette?: readonly string[];
  /** Fill for every division; overrides `palette` but not `divisionColors`. */
  color?: string;
  strokeColor?: string;
  /** Stroke width in px. */
  strokeWidth?: number;
  showLabels?: boolean;
  useBanglaNames?: boolean;
  labelColor?: string;
  labelFontSize?: number;
  labelStyle?: CSSProperties;
  /** Lighten the hovered division. Default `true`. */
  hoverEffect?: boolean;
  /** Called when a division is clicked. */
  onDivisionTap?: (division: BdRegion) => void;
  onDivisionHover?: (division: BdRegion | null) => void;
  backgroundColor?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The classic division map: the 8 divisions with per-division colors,
 * hover tooltips and click callbacks. The React counterpart of the Flutter
 * `Bangladesh` / `BangladeshMap` widgets.
 */
export function BangladeshMap({
  divisionColors = {},
  palette = BD_COLORFUL_PALETTE,
  color,
  strokeColor = '#ffffff',
  strokeWidth = 1.65,
  showLabels = true,
  useBanglaNames: bn = false,
  labelColor = '#ffffff',
  labelFontSize = 12,
  labelStyle,
  hoverEffect = true,
  onDivisionTap,
  onDivisionHover,
  backgroundColor,
  className,
  style,
}: BangladeshMapProps) {
  const [hovered, setHovered] = useState<BdRegion | null>(null);
  const view = countryViewport();
  const byName: Record<string, string> = {};
  for (const [k, v] of Object.entries(divisionColors)) byName[k.trim().toLowerCase()] = v;

  const fillFor = (d: BdRegion, i: number) => {
    const base = byName[d.id] ?? byName[d.name.toLowerCase()] ?? color ?? palette[i % palette.length];
    return hoverEffect && d === hovered ? lighten(base, 0.2) : base;
  };
  const hover = (d: BdRegion | null) => {
    setHovered(d);
    onDivisionHover?.(d);
  };
  const [hostRef, size] = useElementSize<HTMLDivElement>();
  const scale = size.width > 0 ? size.width / (view.right - view.left) : 600 / (view.right - view.left);
  const fontWorld = labelFontSize / scale;

  return (
    <div ref={hostRef} className={['bd-bangladesh-map', className].filter(Boolean).join(' ')} style={{ ...rootStyle, ...style }}>
      <svg
        viewBox={viewBoxOf(view)}
        width="100%"
        style={{ display: 'block', aspectRatio: String(BD_MAP_ASPECT_RATIO), background: backgroundColor, userSelect: 'none' }}
        onMouseLeave={() => hover(null)}
        role="img"
        aria-label={bn ? 'বাংলাদেশের মানচিত্র' : 'Map of Bangladesh'}
      >
        <g fillRule="evenodd" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round">
          {BdGeo.divisions.map((d, i) => (
            <path
              key={d.id}
              d={worldPath(d)}
              fill={fillFor(d, i)}
              data-id={d.id}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: onDivisionTap ? 'pointer' : 'default', transition: 'fill 120ms' }}
              onMouseEnter={() => hover(d)}
              onClick={() => onDivisionTap?.(d)}
            >
              <title>{nameOf(d, bn)}</title>
            </path>
          ))}
        </g>
        {showLabels && (
          <g fontSize={fontWorld} fontWeight={600} fill={labelColor} textAnchor="middle" dominantBaseline="middle" pointerEvents="none" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.25)', strokeWidth: fontWorld * 0.12, ...labelStyle }}>
            {BdGeo.divisions.map((d) => (
              <text key={d.id} x={d.labelPoint.x * BD_MAP_ASPECT_RATIO} y={d.labelPoint.y}>
                {nameOf(d, bn)}
              </text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

/** {@link BdCountryMap} fixed to the upazila / thana level. */
export function BdUpazilaMap(props: Omit<BdCountryMapProps, 'level'>) {
  return <BdCountryMap {...props} level="upazila" />;
}
