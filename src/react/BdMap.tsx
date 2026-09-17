/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { lighten, withAlpha } from '../core/color';
import { BD_MAP_ASPECT_RATIO, BdGeo } from '../core/geo';
import type { AnyBdMapData } from '../core/map-data';
import { BD_COLORFUL_PALETTE } from '../core/palettes';
import { BdArea, BdRegion, bdAreaIndex } from '../core/region';
import { viewBoxOf, viewportFor, worldBounds, worldPath } from '../core/svg';
import { BdRegionDataList } from './BdRegionDataList';
import { BdInfoPanel, nameOf, rootStyle, useAnimatedRect, useElementSize } from './shared';

export interface BdMapProps {
  /** Deepest level the map drills into. Default `'union'`. */
  maxLevel?: BdArea;
  /** Whether region name labels are drawn. Default `true`. */
  showLabels?: boolean;
  /** Use Bangla names for labels, breadcrumb and info panel. */
  useBanglaNames?: boolean;
  /** Whether the breadcrumb bar is shown above the map. Default `true`. */
  showBreadcrumb?: boolean;
  /** Whether the built-in info panel is shown for the selected region. Default `true`. */
  showInfoPanel?: boolean;
  /**
   * Fill colors cycled through the visible regions. Defaults to
   * `BD_COLORFUL_PALETTE`; pass `BD_GREEN_PALETTE` for the green look.
   */
  palette?: readonly string[];
  /** Overrides the fill color per region. Return `null` to fall back to the palette. */
  regionColorBuilder?: (region: BdRegion) => string | null | undefined;
  /**
   * Your data, keyed by region id, for any mix of levels. The map keeps its
   * normal colors; the info panel shows the selected region's value and
   * `showDataList` adds a ranked list of the visible regions. For a
   * choropleth pass `regionColorBuilder={(r) => data.colorOf(r)}`.
   */
  data?: AnyBdMapData | null;
  /** Ranked, clickable list of the visible regions below the map. Needs `data`. */
  showDataList?: boolean;
  borderColor?: string;
  /** Border width in px (constant at every zoom). */
  borderWidth?: number;
  /** Fill of the selected region. Defaults to a lightened version of its own color. */
  highlightColor?: string;
  /** Font size of region labels in px. Default `11`. */
  labelFontSize?: number;
  labelColor?: string;
  /** Extra CSS for the region labels (font family, weight, ...). */
  labelStyle?: CSSProperties;
  /** Renders your own content inside the info panel for the selected region. */
  infoBuilder?: (region: BdRegion) => ReactNode;
  /** Called whenever any region is clicked (before drilling in). */
  onRegionTap?: (region: BdRegion) => void;
  /** Called when the view drills in or out. `null` means country level. */
  onLevelChanged?: (region: BdRegion | null) => void;
  /** Zoom animation duration in ms. Default `450`. */
  animationDuration?: number;
  /** Easing of the zoom animation, `t` in `[0, 1]`. Default ease-in-out cubic. */
  animationCurve?: (t: number) => number;
  backgroundColor?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * An interactive, drillable map of Bangladesh. Starts at the country level
 * showing the 8 divisions; clicking a division zooms into its districts,
 * then upazilas, then unions. A breadcrumb navigates back up and an info
 * panel shows details (and any data you attach) for the selected region.
 */
export function BdMap({
  maxLevel = BdArea.union,
  showLabels = true,
  useBanglaNames: bn = false,
  showBreadcrumb = true,
  showInfoPanel = true,
  palette = BD_COLORFUL_PALETTE,
  regionColorBuilder,
  data,
  showDataList = false,
  borderColor = '#ffffff',
  borderWidth = 1,
  highlightColor,
  labelFontSize = 11,
  labelColor = '#ffffff',
  labelStyle,
  infoBuilder,
  onRegionTap,
  onLevelChanged,
  animationDuration = 450,
  animationCurve,
  backgroundColor,
  className,
  style,
}: BdMapProps) {
  const [stack, setStack] = useState<BdRegion[]>([]);
  const [selected, setSelected] = useState<BdRegion | null>(null);
  const [hovered, setHovered] = useState<BdRegion | null>(null);

  const current = stack.length === 0 ? null : stack[stack.length - 1];
  const visible = useMemo(() => (current ? BdGeo.childrenOf(current) : BdGeo.divisions), [current]);

  const target = useMemo(() => viewportFor(selected ?? current), [selected, current]);
  const view = useAnimatedRect(target, animationDuration, animationCurve);
  const [hostRef, size] = useElementSize<HTMLDivElement>();
  const scale = size.width > 0 ? Math.min(size.width / (view.right - view.left), size.height / (view.bottom - view.top)) : 1;

  const canDrillInto = (r: BdRegion) => bdAreaIndex(r.level) < bdAreaIndex(maxLevel) && BdGeo.childrenOf(r).length > 0;

  const drillInto = useCallback(
    (r: BdRegion) => {
      setStack((s) => [...s, r]);
      setSelected(null);
      setHovered(null);
      onLevelChanged?.(r);
    },
    [onLevelChanged],
  );

  const popTo = useCallback(
    (depth: number) => {
      setStack((s) => {
        if (depth >= s.length) return s;
        const next = s.slice(0, depth);
        onLevelChanged?.(next.length === 0 ? null : next[next.length - 1]);
        return next;
      });
      setSelected(null);
      setHovered(null);
    },
    [onLevelChanged],
  );

  const handleTap = useCallback(
    (r: BdRegion) => {
      onRegionTap?.(r);
      if (canDrillInto(r)) drillInto(r);
      else setSelected((s) => (s === r ? null : r));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onRegionTap, drillInto, maxLevel],
  );

  const tooltip = (r: BdRegion) => {
    const label = data?.labelOf(r);
    return label ? `${nameOf(r, bn)} · ${label}` : nameOf(r, bn);
  };
  const paletteColorOf = (r: BdRegion) => palette[Math.max(0, visible.indexOf(r)) % palette.length];
  const fillFor = (r: BdRegion, i: number) => {
    const base = regionColorBuilder?.(r) ?? palette[i % palette.length];
    if (r === selected) return highlightColor ?? lighten(base, 0.35);
    if (r === hovered) return lighten(base, 0.18);
    if (selected) return withAlpha(base, 0.35);
    return base;
  };

  const crumbStyle = (active: boolean): CSSProperties => ({
    background: 'none',
    border: 0,
    padding: '6px 4px',
    font: 'inherit',
    fontSize: 14,
    fontWeight: active ? 400 : 600,
    color: active ? 'var(--bd-primary)' : 'var(--bd-fg)',
    cursor: active ? 'pointer' : 'default',
    whiteSpace: 'nowrap',
  });
  const chevron = <span style={{ color: 'var(--bd-fg-muted)', padding: '0 2px' }}>›</span>;

  const crumbs: ReactNode[] = [
    <button key="root" type="button" style={crumbStyle(stack.length > 0)} onClick={() => popTo(0)} disabled={stack.length === 0}>
      {bn ? 'বাংলাদেশ' : 'Bangladesh'}
    </button>,
  ];
  stack.forEach((r, i) => {
    const isLast = i === stack.length - 1;
    const active = !isLast || selected !== null;
    crumbs.push(
      <span key={`c${r.id}`}>{chevron}</span>,
      <button
        key={r.id}
        type="button"
        style={crumbStyle(active)}
        disabled={!active}
        onClick={() => (isLast ? setSelected(null) : popTo(i + 1))}
      >
        {nameOf(r, bn)}
      </button>,
    );
  });
  if (selected) {
    crumbs.push(
      <span key="csel">{chevron}</span>,
      <span key="sel" style={crumbStyle(false)}>
        {nameOf(selected, bn)}
      </span>,
    );
  }

  const fontWorld = labelFontSize / scale;

  return (
    <div className={['bd-map', className].filter(Boolean).join(' ')} style={{ ...rootStyle, ...style }}>
      {showBreadcrumb && (
        <div className="bd-map-breadcrumb" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', gap: 4 }}>
          {(stack.length > 0 || selected) && (
            <button
              type="button"
              aria-label="Back"
              title="Back"
              onClick={() => (selected ? setSelected(null) : popTo(stack.length - 1))}
              style={{
                background: 'none',
                border: 0,
                fontSize: 18,
                lineHeight: 1,
                padding: '4px 6px',
                cursor: 'pointer',
                color: 'var(--bd-fg)',
              }}
            >
              ←
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', minWidth: 0 }}>{crumbs}</div>
        </div>
      )}
      <div
        ref={hostRef}
        className="bd-map-canvas"
        style={{ position: 'relative', width: '100%', aspectRatio: String(BD_MAP_ASPECT_RATIO), background: backgroundColor, overflow: 'hidden' }}
      >
        <svg
          viewBox={viewBoxOf(view)}
          width="100%"
          height="100%"
          style={{ display: 'block', position: 'absolute', inset: 0, userSelect: 'none' }}
          onMouseLeave={() => setHovered(null)}
          role="img"
          aria-label={bn ? 'বাংলাদেশের মানচিত্র' : 'Map of Bangladesh'}
        >
          <g fillRule="evenodd" stroke={borderColor} strokeWidth={borderWidth} strokeLinejoin="round">
            {visible.map((r, i) => (
              <path
                key={r.id}
                d={worldPath(r)}
                fill={fillFor(r, i)}
                vectorEffect="non-scaling-stroke"
                data-id={r.id}
                style={{ cursor: 'pointer', transition: 'fill 120ms' }}
                onMouseEnter={() => setHovered(r)}
                onClick={() => handleTap(r)}
              >
                <title>{tooltip(r)}</title>
              </path>
            ))}
          </g>
          {showLabels && size.width > 0 && (
            <g
              fontSize={fontWorld}
              fill={labelColor}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
              fontWeight={600}
              style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.25)', strokeWidth: fontWorld * 0.12, ...labelStyle }}
            >
              {visible.map((r) => {
                const text = nameOf(r, bn);
                const b = worldBounds(r);
                if (text.length * fontWorld * 0.6 > (b.right - b.left) * 1.05) return null;
                const p = r.labelPoint;
                return (
                  <text key={r.id} x={p.x * BD_MAP_ASPECT_RATIO} y={p.y}>
                    {text}
                  </text>
                );
              })}
            </g>
          )}
        </svg>
      </div>
      {selected && (infoBuilder || showInfoPanel) && (
        <BdInfoPanel region={selected} useBanglaNames={bn} data={data}>
          {infoBuilder?.(selected)}
        </BdInfoPanel>
      )}
      {data && showDataList && (
        <BdRegionDataList regions={visible} data={data} useBanglaNames={bn} onTap={handleTap} regionColor={paletteColorOf} dense maxHeight={240} />
      )}
    </div>
  );
}
