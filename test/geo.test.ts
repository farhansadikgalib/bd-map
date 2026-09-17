import { describe, expect, it } from 'vitest';
import { BD_MAP_ASPECT_RATIO, BdArea, BdGeo, renderSvg } from '../src';

describe('BdGeo', () => {
  it('ships the full hierarchy', () => {
    expect(BdGeo.divisions).toHaveLength(8);
    expect(BdGeo.districts).toHaveLength(64);
    expect(BdGeo.upazilas).toHaveLength(544);
    expect(BdGeo.unionRegions).toHaveLength(5160);
    expect(BD_MAP_ASPECT_RATIO).toBeCloseTo(0.71319, 5);
  });

  it('looks up by name, id, parent and children', () => {
    const dhaka = BdGeo.divisionByName('Dhaka')!;
    expect(dhaka.id).toBe('dhaka');
    expect(BdGeo.divisionByName('ঢাকা')).toBe(dhaka);
    expect(BdGeo.childrenOf(dhaka)).toHaveLength(13);

    const gazipur = BdGeo.districtByName('Gazipur')!;
    expect(gazipur.id).toBe('dhaka.gazipur');
    expect(gazipur.parentId).toBe('dhaka');
    expect(BdGeo.parentOf(gazipur)).toBe(dhaka);

    const sreepur = BdGeo.byId('dhaka.gazipur.sreepur')!;
    expect(sreepur.level).toBe(BdArea.upazila);
    expect(BdGeo.ancestorsOf(sreepur).map((r) => r.id)).toEqual(['dhaka', 'dhaka.gazipur']);
    expect(BdGeo.upazilasByName('Sreepur').length).toBeGreaterThan(1);
    expect(BdGeo.unionsOf(sreepur.id).length).toBeGreaterThan(0);
  });

  it('every upazila reports unions and has union-level geometry', () => {
    for (const u of BdGeo.upazilas) {
      expect(BdGeo.unionsOf(u.id).length, u.id).toBeGreaterThan(0);
      expect(BdGeo.childrenOf(u).length, u.id).toBeGreaterThan(0);
    }
  });

  it('metro thanas fall back to ward geometry names', () => {
    const adabor = BdGeo.byId('dhaka.dhaka.adabor')!;
    const wards = BdGeo.unionsOf(adabor.id);
    expect(wards.length).toBe(BdGeo.childrenOf(adabor).length);
    for (const w of wards) expect(w.name).not.toBe('');
  });

  it('geometry helpers: bounds, label point, hit testing', () => {
    const dhaka = BdGeo.divisionByName('Dhaka')!;
    const b = dhaka.bounds;
    expect(b.left).toBeLessThan(b.right);
    expect(b.top).toBeLessThan(b.bottom);
    const p = dhaka.labelPoint;
    expect(dhaka.containsPoint(p.x, p.y)).toBe(true);
    expect(BdGeo.regionAt(p.x, p.y, BdArea.division)).toBe(dhaka);
    expect(BdGeo.regionAt(p.x, p.y)?.level).toBe(BdArea.union);
    expect(BdGeo.regionAt(-1, -1)).toBeNull();
    expect(dhaka.svgPath()).toMatch(/^M[\d.]+ [\d.]+L/);
  });
});

describe('renderSvg', () => {
  it('renders every level as valid-looking SVG', () => {
    for (const level of ['division', 'district', 'upazila'] as const) {
      const svg = renderSvg({ level, width: 400 });
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg.match(/<path /g)!.length).toBeGreaterThanOrEqual(BdGeo.regionsOf(level).length);
    }
  });

  it('frames a parent region and honours custom colors', () => {
    const svg = renderSvg({ level: 'upazila', parent: 'dhaka.gazipur', regionColor: () => '#123456' });
    const paths = svg.match(/data-id="dhaka\.gazipur\.[^"]+"/g)!;
    expect(paths.length).toBe(BdGeo.childrenOf(BdGeo.byId('dhaka.gazipur')!).length);
    expect(svg).toContain('fill="#123456"');
    expect(() => renderSvg({ level: 'division', parent: 'dhaka' })).toThrow(RangeError);
  });
});
