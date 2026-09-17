/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type WheelEvent } from 'react';
import { lighten } from '../core/color';
import { BD_MAP_ASPECT_RATIO, BdGeo } from '../core/geo';
import type { AnyBdMapData } from '../core/map-data';
import { bdPaletteFor, bdPaletteShade, bdParentBorderFor } from '../core/palettes';
import { BdArea, BdRegion, bdAreaIndex } from '../core/region';
import { countryViewport, viewBoxOf, worldBounds, worldPath } from '../core/svg';
import { BdRegionDataList } from './BdRegionDataList';
import { BdInfoPanel, nameOf, rootStyle, useElementSize } from './shared';

export interface BdCountryMapProps {
  /** Which administrative level fills the map. Default `'district'`. */
  level?: BdArea;
  /** Use Bangla names for labels and the info panel. */
  useBanglaNames?: boolean;
  /** Called when a region is clicked. */
  onRegionTap?: (region: BdRegion) => void;
  /** Whether the built-in info panel is shown for the selected region. Default `true`. */
  showInfoPanel?: boolean;
  /** Renders your own content inside the info panel. */
  infoBuilder?: (region: BdRegion) => ReactNode;
  /** Whether name labels are drawn. Default `true`. */
  showLabels?: boolean;
  /** Maximum wheel / pinch zoom factor. Default `16`. */
  maxZoom?: number;
  /** Overrides the fill color per region. Return `null` for the default palette. */
  regionColorBuilder?: (region: BdRegion) => string | null | undefined;
  /** Your data. The info panel shows the selected value; `showDataList` adds a ranked list. */
  data?: AnyBdMapData | null;
  /** Ranked, clickable list of every region at this level below the map. Needs `data`. */
  showDataList?: boolean;
  /** Fill shades. Each level has its own default palette. */
  palette?: readonly string[];
  nationalBorderColor?: string;
  nationalBorderWidth?: number;
  /** Dashed borders one level above `level`. Defaults to an amber / orange per level. */
  parentBorderColor?: string;
  parentBorderWidth?: number;
  regionBorderColor?: string;
  regionBorderWidth?: number;
  backgroundColor?: string;
  /** Font size in px of the primary (bold) labels. */
  primaryLabelSize?: number;
  /** Font size in px of the small per-upazila labels on the upazila / union maps. */
  secondaryLabelSize?: number;
  labelColor?: string;
  /** Extra CSS for the primary (bold) labels. */
  primaryLabelStyle?: CSSProperties;
  /** Extra CSS for the small per-upazila labels. */
  secondaryLabelStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
}

interface Transform {
  k: number;
  x: number;
  y: number;
}

/**
 * A full-country administrative map of Bangladesh at a chosen level, in the
 * style of a printed wall map: every region drawn at once in varied shades,
 * with a thick national border, dashed parent-level borders and printed-map
 * labels. Pan by dragging, zoom with the wheel or a pinch, click to select.
 */
export function BdCountryMap({
  level = BdArea.district,
  useBanglaNames: bn = false,
  onRegionTap,
  showInfoPanel = true,
  infoBuilder,
  showLabels = true,
  maxZoom = 16,
  regionColorBuilder,
  data,
  showDataList = false,
  palette,
  nationalBorderColor = '#616161',
  nationalBorderWidth = 2.5,
  parentBorderColor,
  parentBorderWidth = 1.1,
  regionBorderColor = 'rgba(55, 71, 79, 0.53)',
  regionBorderWidth = 0.4,
  backgroundColor,
  primaryLabelSize,
  secondaryLabelSize = 3.2,
  labelColor = 'rgba(38, 50, 56, 0.9)',
  primaryLabelStyle,
  secondaryLabelStyle,
  className,
  style,
}: BdCountryMapProps) {
  const [selected, setSelected] = useState<BdRegion | null>(null);
  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const [hostRef, size] = useElementSize<HTMLDivElement>();

  useEffect(() => {
    setSelected(null);
    setTransform({ k: 1, x: 0, y: 0 });
  }, [level]);

  const regions = useMemo(() => BdGeo.regionsOf(level), [level]);
  const shades = palette ?? bdPaletteFor(level);
  const parentBorders = useMemo(() => {
    const i = bdAreaIndex(level) - 1;
    return i < 0 ? [] : BdGeo.regionsOf((['division', 'district', 'upazila'] as const)[i]);
  }, [level]);

  const view = countryViewport();
  const viewW = view.right - view.left;
  const viewH = view.bottom - view.top;
  const baseScale = size.width > 0 ? Math.min(size.width / viewW, size.height / viewH) : 1;
  const scale = baseScale * transform.k;

  const select = useCallback(
    (r: BdRegion) => {
      onRegionTap?.(r);
      setSelected((s) => (s === r ? null : r));
    },
    [onRegionTap],
  );

  const tooltip = (r: BdRegion) => {
    const label = data?.labelOf(r);
    return label ? `${nameOf(r, bn)} · ${label}` : nameOf(r, bn);
  };
  const paletteColorOf = (r: BdRegion) => regionColorBuilder?.(r) ?? bdPaletteShade(r, regions.indexOf(r), regions, shades);
  const fillFor = (r: BdRegion, i: number) => {
    const shade = regionColorBuilder?.(r) ?? bdPaletteShade(r, i, regions, shades);
    return r === selected ? lighten(shade, 0.45) : shade;
  };

  // ---- pan / zoom (pointer + wheel). Screen px -> world units via baseScale.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: Transform; origin: { x: number; y: number }; dist: number; moved: boolean } | null>(null);

  const clampTransform = (t: Transform): Transform => ({ ...t, k: Math.max(1, Math.min(maxZoom, t.k)) });

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const origin =
      pts.length >= 2
        ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
        : { x: e.clientX, y: e.clientY };
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { start: transform, origin, dist, moved: gesture.current?.moved ?? false };
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    const rect = e.currentTarget.getBoundingClientRect();
    if (pts.length >= 2) {
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = g.dist > 0 ? dist / g.dist : 1;
      const k = Math.max(1, Math.min(maxZoom, g.start.k * ratio));
      // Keep the world point under the pinch center fixed.
      const ox = (g.origin.x - rect.left) / baseScale;
      const oy = (g.origin.y - rect.top) / baseScale;
      const wx = (ox - g.start.x) / g.start.k;
      const wy = (oy - g.start.y) / g.start.k;
      const nx = (cx - rect.left) / baseScale - wx * k;
      const ny = (cy - rect.top) / baseScale - wy * k;
      g.moved = true;
      setTransform({ k, x: nx, y: ny });
    } else {
      const dx = (pts[0].x - g.origin.x) / baseScale;
      const dy = (pts[0].y - g.origin.y) / baseScale;
      if (Math.abs(dx * baseScale) + Math.abs(dy * baseScale) > 4) g.moved = true;
      if (g.moved) setTransform({ k: g.start.k, x: g.start.x + dx, y: g.start.y + dy });
    }
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      const moved = gesture.current?.moved ?? false;
      gesture.current = null;
      if (!moved) {
        const id = (e.target as Element).closest?.('[data-id]')?.getAttribute('data-id');
        const r = id ? BdGeo.byId(id) : null;
        if (r) select(r);
      }
    } else {
      // A finger lifted mid-pinch: restart the gesture from the remaining pointer.
      const [p] = pointers.current.values();
      gesture.current = { start: transform, origin: { x: p.x, y: p.y }, dist: 0, moved: true };
    }
  };

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    if (e.deltaY === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / baseScale;
    const py = (e.clientY - rect.top) / baseScale;
    setTransform((t) => {
      const k = Math.max(1, Math.min(maxZoom, t.k * Math.exp(-e.deltaY * 0.0015)));
      const wx = (px - t.x) / t.k;
      const wy = (py - t.y) / t.k;
      return clampTransform({ k, x: px - wx * k, y: py - wy * k });
    });
  };

  // Non-passive wheel listener so preventDefault stops page scroll.
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const block = (ev: globalThis.WheelEvent) => ev.preventDefault();
    el.addEventListener('wheel', block, { passive: false });
    return () => el.removeEventListener('wheel', block);
  }, []);

  // ---- labels
  const labelSpec = useMemo(() => {
    const primary = primaryLabelSize ?? (level === 'division' ? 13 : level === 'district' ? 7.5 : 6.5);
    switch (level) {
      case 'division':
        return { primary: BdGeo.divisions, primarySize: primary, secondary: [] as BdRegion[], upper: true };
      case 'district':
        return { primary: BdGeo.districts, primarySize: primary, secondary: [], upper: true };
      default:
        return { primary: BdGeo.districts, primarySize: primary, secondary: BdGeo.upazilas, upper: true };
    }
  }, [level, primaryLabelSize]);

  const renderLabels = (list: BdRegion[], px: number, upper: boolean, maxWidthFactor: number, bold: boolean) => {
    const fontWorld = px / baseScale; // constant px at zoom 1, scales with zoom like a printed map
    return (
      <g fontSize={fontWorld} fontWeight={bold ? 700 : 400} fill={labelColor} textAnchor="middle" dominantBaseline="middle" pointerEvents="none" letterSpacing={bold ? fontWorld * 0.04 : 0} style={bold ? primaryLabelStyle : secondaryLabelStyle}>
        {list.map((r) => {
          let text = nameOf(r, bn);
          if (upper && !bn) text = text.toUpperCase();
          const b = worldBounds(r);
          if (text.length * fontWorld * 0.62 > (b.right - b.left) * maxWidthFactor) return null;
          const p = r.labelPoint;
          return (
            <text key={r.id} x={p.x * BD_MAP_ASPECT_RATIO} y={p.y}>
              {text}
            </text>
          );
        })}
      </g>
    );
  };

  const tx = transform.x;
  const ty = transform.y;

  return (
    <div className={['bd-country-map', className].filter(Boolean).join(' ')} style={{ ...rootStyle, ...style }}>
      <div
        ref={hostRef}
        className="bd-map-canvas"
        style={{ position: 'relative', width: '100%', aspectRatio: String(BD_MAP_ASPECT_RATIO), background: backgroundColor, overflow: 'hidden', touchAction: 'none' }}
      >
        <svg
          ref={svgRef}
          viewBox={viewBoxOf(view)}
          width="100%"
          height="100%"
          style={{ display: 'block', position: 'absolute', inset: 0, userSelect: 'none', cursor: transform.k > 1 ? 'grab' : 'default' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          role="img"
          aria-label={bn ? 'বাংলাদেশের মানচিত্র' : 'Map of Bangladesh'}
        >
          <g transform={`translate(${view.left} ${view.top}) translate(${tx} ${ty}) scale(${transform.k}) translate(${-view.left} ${-view.top})`}>
            <g fillRule="evenodd" stroke={regionBorderColor} strokeWidth={regionBorderWidth} strokeLinejoin="round">
              {regions.map((r, i) => (
                <path key={r.id} d={worldPath(r)} fill={fillFor(r, i)} data-id={r.id} vectorEffect="non-scaling-stroke">
                  <title>{tooltip(r)}</title>
                </path>
              ))}
            </g>
            {parentBorders.length > 0 && (
              <g fill="none" stroke={parentBorderColor ?? bdParentBorderFor(level)} strokeWidth={parentBorderWidth} strokeLinejoin="round" strokeDasharray="0.008 0.004" pointerEvents="none">
                {parentBorders.map((p) => (
                  <path key={p.id} d={worldPath(p)} vectorEffect="non-scaling-stroke" />
                ))}
              </g>
            )}
            <g fill="none" stroke={nationalBorderColor} strokeWidth={nationalBorderWidth} strokeLinejoin="round" pointerEvents="none">
              {BdGeo.divisions.map((d) => (
                <path key={d.id} d={worldPath(d)} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            {selected && <path d={worldPath(selected)} fill="none" stroke="#D32F2F" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            {showLabels && size.width > 0 && (
              <>
                {labelSpec.secondary.length > 0 && renderLabels(labelSpec.secondary, secondaryLabelSize, false, 1.4, false)}
                {renderLabels(labelSpec.primary, labelSpec.primarySize, labelSpec.upper, 2.0, true)}
              </>
            )}
          </g>
        </svg>
        {transform.k > 1 && (
          <button
            type="button"
            onClick={() => setTransform({ k: 1, x: 0, y: 0 })}
            style={{ position: 'absolute', right: 8, top: 8, background: 'var(--bd-bg)', border: '1px solid var(--bd-border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--bd-fg)' }}
          >
            {bn ? 'রিসেট' : 'Reset'}
          </button>
        )}
      </div>
      {selected && showInfoPanel && (
        <BdInfoPanel region={selected} useBanglaNames={bn} data={data} lineage>
          {infoBuilder?.(selected)}
        </BdInfoPanel>
      )}
      {data && showDataList && (
        <BdRegionDataList level={level} data={data} useBanglaNames={bn} onTap={select} regionColor={paletteColorOf} dense maxHeight={240} />
      )}
    </div>
  );
}
