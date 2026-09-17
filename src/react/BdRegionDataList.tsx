/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

import type { CSSProperties } from 'react';
import { BdGeo } from '../core/geo';
import type { AnyBdMapData } from '../core/map-data';
import type { BdArea, BdRegion } from '../core/region';
import { rootStyle } from './shared';

export interface BdRegionDataListProps {
  /** Explicit regions to list. Takes precedence over `level` and `parent`. */
  regions?: BdRegion[];
  /** List every region of this level in the country. */
  level?: BdArea;
  /** List the direct children of this region. */
  parent?: BdRegion | null;
  /** Values (and colors) to show per region. */
  data?: AnyBdMapData | null;
  /** Show Bangla names first. */
  useBanglaNames?: boolean;
  /** Sort rows by numeric value, largest first. Ignored when `data` is not given. */
  sortByValue?: boolean;
  /** Called when a row is clicked. */
  onTap?: (region: BdRegion) => void;
  /**
   * Color of each row's dot and value bar. The map components pass their own
   * palette assignment so the list always matches the map. Falls back to the
   * data's choropleth color, then a neutral dot.
   */
  regionColor?: (region: BdRegion) => string | null | undefined;
  /** Compact rows. */
  dense?: boolean;
  /** Maximum height; the list scrolls beyond it. */
  maxHeight?: number | string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A ready-made scrollable list of regions with their attached data — the
 * list companion to the map components. Rows are colored with the same
 * choropleth fill the maps use, so list and map always match.
 */
export function BdRegionDataList({
  regions,
  level,
  parent,
  data,
  useBanglaNames = false,
  sortByValue = true,
  onTap,
  regionColor,
  dense = false,
  maxHeight,
  className,
  style,
}: BdRegionDataListProps) {
  let items: BdRegion[] = regions ?? (parent ? BdGeo.childrenOf(parent) : level ? BdGeo.regionsOf(level) : []);
  if (data && sortByValue) items = data.sort(items);

  // Scale value bars against the largest value among the listed rows.
  let localMax: number | null = null;
  if (data) {
    for (const r of items) {
      const v = data.valueOf(r);
      if (typeof v === 'number' && (localMax === null || v > localMax)) localMax = v;
    }
  }

  return (
    <ul
      className={['bd-map-list', className].filter(Boolean).join(' ')}
      style={{ ...rootStyle, listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', maxHeight, ...style }}
    >
      {items.map((r) => {
        const valueLabel = data?.labelOf(r) ?? null;
        const color = regionColor?.(r) ?? data?.colorOf(r) ?? 'var(--bd-border)';
        const v = data?.valueOf(r);
        const fraction =
          typeof v === 'number' && localMax !== null && localMax > 0 ? Math.max(0, Math.min(1, v / localMax)) : null;
        const otherName = useBanglaNames ? r.name : r.bnName;
        const row = (
          <>
            <span
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: color,
                border: '1px solid rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: dense ? 13 : 14 }}>{useBanglaNames ? r.displayNameBn : r.name}</span>
              {otherName !== '' && (
                <span style={{ display: 'block', fontSize: 12, color: 'var(--bd-fg-muted)' }}>{otherName}</span>
              )}
              {fraction !== null && (
                <span
                  style={{
                    display: 'block',
                    marginTop: 4,
                    height: 5,
                    borderRadius: 3,
                    background: 'var(--bd-border)',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{ display: 'block', height: '100%', width: `${Math.max(1, fraction * 100)}%`, background: color }}
                  />
                </span>
              )}
            </span>
            {valueLabel !== null && <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{valueLabel}</span>}
          </>
        );
        const rowStyle: CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: dense ? '6px 12px' : '10px 16px',
          background: 'none',
          border: 0,
          borderBottom: '1px solid var(--bd-border)',
          color: 'inherit',
          font: 'inherit',
          textAlign: 'left',
          cursor: onTap ? 'pointer' : 'default',
        };
        return (
          <li key={r.id} className="bd-map-list-row" data-id={r.id}>
            {onTap ? (
              <button type="button" style={rowStyle} onClick={() => onTap(r)}>
                {row}
              </button>
            ) : (
              <div style={rowStyle}>{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
