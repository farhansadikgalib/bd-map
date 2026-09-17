/*
  Copyright 2026 Farhan Sadik Galib. All rights reserved.
  Use of this source code is governed by a MIT license that can be
  found in the LICENSE file.
  source: https://github.com/farhansadikgalib/bd-map
  website: https://farhansadikgalib.com
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BdGeo } from '../core/geo';
import type { AnyBdMapData } from '../core/map-data';
import { BdArea, BdRegion, type BdRect } from '../core/region';

/** Default theme. Override any token by setting the CSS variable on an ancestor. */
export const bdVars: CSSProperties = {
  ['--bd-fg' as string]: '#1f2933',
  ['--bd-fg-muted' as string]: '#5f6b7a',
  ['--bd-bg' as string]: '#ffffff',
  ['--bd-panel' as string]: '#f5f7f9',
  ['--bd-border' as string]: '#dde3ea',
  ['--bd-primary' as string]: '#1565c0',
  ['--bd-chip' as string]: '#e3ecf5',
  ['--bd-chip-fg' as string]: '#243b53',
  ['--bd-radius' as string]: '10px',
  ['--bd-font' as string]: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

export const rootStyle: CSSProperties = {
  ...bdVars,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  fontFamily: 'var(--bd-font)',
  color: 'var(--bd-fg)',
};

export function levelName(level: BdArea, bn: boolean): string {
  switch (level) {
    case BdArea.division:
      return bn ? 'বিভাগ' : 'Division';
    case BdArea.district:
      return bn ? 'জেলা' : 'District';
    case BdArea.upazila:
      return bn ? 'উপজেলা / থানা' : 'Upazila / Thana';
    case BdArea.union:
      return bn ? 'ইউনিয়ন / ওয়ার্ড' : 'Union / Ward';
  }
}

export const nameOf = (r: BdRegion | null | undefined, bn: boolean) => (r ? (bn ? r.displayNameBn : r.name) : '');

/** Measures an element's content box, updating on resize. */
export function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Animates a world-space rect toward `target` with an ease-in-out curve. */
export function useAnimatedRect(target: BdRect, duration: number, curve: (t: number) => number = easeInOutCubic): BdRect {
  const [current, setCurrent] = useState(target);
  const fromRef = useRef(target);
  const currentRef = useRef(target);
  currentRef.current = current;
  const prevTarget = useRef(target);

  useEffect(() => {
    if (sameRect(prevTarget.current, target) && sameRect(currentRef.current, target)) return;
    prevTarget.current = target;
    if (duration <= 0 || typeof requestAnimationFrame === 'undefined') {
      setCurrent(target);
      return;
    }
    const from = { ...currentRef.current };
    fromRef.current = from;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = curve(t);
      setCurrent({
        left: from.left + (target.left - from.left) * k,
        top: from.top + (target.top - from.top) * k,
        right: from.right + (target.right - from.right) * k,
        bottom: from.bottom + (target.bottom - from.bottom) * k,
      });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, curve]);

  return current;
}

function sameRect(a: BdRect, b: BdRect) {
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

export interface InfoPanelProps {
  region: BdRegion;
  useBanglaNames: boolean;
  data?: AnyBdMapData | null;
  /** Extra content rendered under the built-in details. */
  children?: ReactNode;
  /** Show lineage ("Gazipur District, Dhaka Division"). */
  lineage?: boolean;
}

/** The built-in details card for a selected region. */
export function BdInfoPanel({ region, useBanglaNames: bn, data, children, lineage = false }: InfoPanelProps) {
  const parent = BdGeo.parentOf(region);
  const grandParent = parent ? BdGeo.parentOf(parent) : null;
  const children_ = BdGeo.childrenOf(region);
  const unions = region.level === BdArea.upazila ? children_ : [];
  const label = data?.labelOf(region) ?? null;

  let lineageText: string | null = null;
  if (lineage) {
    if (region.level === BdArea.district) {
      lineageText = bn ? `${nameOf(parent, bn)} বিভাগ` : `${nameOf(parent, bn)} Division`;
    } else if (region.level === BdArea.upazila && parent) {
      lineageText = bn
        ? `${nameOf(parent, bn)} জেলা, ${nameOf(grandParent, bn)} বিভাগ`
        : `${nameOf(parent, bn)} District, ${nameOf(grandParent, bn)} Division`;
    } else if (region.level === BdArea.union && parent) {
      lineageText = bn
        ? `${nameOf(parent, bn)} উপজেলা/থানা, ${nameOf(grandParent, bn)} জেলা`
        : `${nameOf(parent, bn)} Upazila/Thana, ${nameOf(grandParent, bn)} District`;
    }
  }

  let childSummary: string | null = null;
  if (region.level === BdArea.division) {
    const upazilaCount = children_.reduce((sum, d) => sum + BdGeo.childrenOf(d).length, 0);
    childSummary = bn
      ? `${children_.length}টি জেলা, ${upazilaCount}টি উপজেলা/থানা`
      : `${children_.length} districts, ${upazilaCount} upazilas / thanas`;
  } else if (region.level === BdArea.district) {
    childSummary = bn ? `${children_.length}টি উপজেলা/থানা` : `${children_.length} upazilas / thanas`;
  }

  return (
    <div
      className="bd-map-info"
      style={{
        margin: 8,
        padding: 12,
        background: 'var(--bd-panel)',
        border: '1px solid var(--bd-border)',
        borderRadius: 'var(--bd-radius)',
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>{bn ? region.displayNameBn : region.name}</div>
        <span
          style={{
            background: 'var(--bd-chip)',
            color: 'var(--bd-chip-fg)',
            borderRadius: 999,
            padding: '2px 10px',
            fontSize: 12,
            whiteSpace: 'nowrap',
          }}
        >
          {levelName(region.level, bn)}
        </span>
      </div>
      {region.bnName !== '' && !bn && <div>{region.bnName}</div>}
      {label !== null && (
        <div style={{ marginTop: 6, fontWeight: 600 }}>
          <span aria-hidden style={{ color: 'var(--bd-primary)', marginRight: 6 }}>
            ▮
          </span>
          {data?.title ? `${data.title}: ${label}` : label}
        </div>
      )}
      {lineageText && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--bd-fg-muted)' }}>{lineageText}</div>}
      {childSummary && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--bd-fg-muted)' }}>{childSummary}</div>}
      {unions.length > 0 ? (
        <>
          <div style={{ marginTop: 10, fontWeight: 600, fontSize: 13 }}>
            {bn ? `ইউনিয়নসমূহ (${unions.length}টি)` : `Unions (${unions.length})`}
          </div>
          <div style={{ marginTop: 6, maxHeight: 150, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unions.map((u) => (
              <span
                key={u.id}
                style={{
                  background: 'var(--bd-chip)',
                  color: 'var(--bd-chip-fg)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 12,
                }}
              >
                {bn ? u.displayNameBn : u.name}
              </span>
            ))}
          </div>
        </>
      ) : (
        region.level === BdArea.upazila && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--bd-fg-muted)' }}>
            {bn ? 'কোনো ইউনিয়ন তথ্য নেই (সিটি থানা)' : 'No union data (city thana)'}
          </div>
        )
      )}
      {children && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}
