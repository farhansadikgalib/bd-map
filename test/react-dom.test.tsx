// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BdCountryMap, BdGeo, BdMap, type BdRegion } from '../src/react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const click = (el: Element | null) => act(async () => el!.dispatchEvent(new MouseEvent('click', { bubbles: true })));

describe('BdMap in the DOM', () => {
  it('drills from divisions into districts and back via the breadcrumb', async () => {
    const taps: BdRegion[] = [];
    const levels: (BdRegion | null)[] = [];
    await act(async () =>
      root.render(<BdMap animationDuration={0} onRegionTap={(r) => taps.push(r)} onLevelChanged={(r) => levels.push(r)} />),
    );
    expect(host.querySelectorAll('path[data-id]')).toHaveLength(8);

    await click(host.querySelector('path[data-id="dhaka"]'));
    expect(taps.map((r) => r.id)).toEqual(['dhaka']);
    expect(levels.map((r) => r?.id)).toEqual(['dhaka']);
    const districts = [...host.querySelectorAll('path[data-id]')].map((p) => p.getAttribute('data-id'));
    expect(districts).toHaveLength(13);
    expect(districts.every((id) => id!.startsWith('dhaka.'))).toBe(true);
    expect(host.textContent).toContain('Dhaka');

    await click(host.querySelector('path[data-id="dhaka.gazipur"]'));
    expect(host.querySelectorAll('path[data-id]')).toHaveLength(BdGeo.childrenOf(BdGeo.byId('dhaka.gazipur')!).length);

    // Breadcrumb root goes back to the country.
    const rootCrumb = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Bangladesh')!;
    await click(rootCrumb);
    expect(host.querySelectorAll('path[data-id]')).toHaveLength(8);
    expect(levels[levels.length - 1]).toBeNull();
  });

  it('selects a leaf region at maxLevel and shows the info panel', async () => {
    await act(async () => root.render(<BdMap animationDuration={0} maxLevel="division" />));
    await click(host.querySelector('path[data-id="sylhet"]'));
    expect(host.querySelectorAll('path[data-id]')).toHaveLength(8);
    const panel = host.querySelector('.bd-map-info')!;
    expect(panel.textContent).toContain('Sylhet');
    expect(panel.textContent).toContain('4 districts');
  });
});

describe('BdCountryMap in the DOM', () => {
  it('selects a region on click and shows lineage', async () => {
    const taps: string[] = [];
    await act(async () => root.render(<BdCountryMap level="district" onRegionTap={(r) => taps.push(r.id)} />));
    const svg = host.querySelector('svg')!;
    const path = host.querySelector('path[data-id="dhaka.gazipur"]')!;
    await act(async () => {
      // jsdom has no PointerEvent; React only reads pointerId off the native event.
      const pointer = (type: string) => Object.assign(new MouseEvent(type, { bubbles: true, clientX: 10, clientY: 10 }), { pointerId: 1 });
      svg.dispatchEvent(pointer('pointerdown'));
      path.dispatchEvent(pointer('pointerup'));
    });
    expect(taps).toEqual(['dhaka.gazipur']);
    expect(host.querySelector('.bd-map-info')!.textContent).toContain('Dhaka Division');
  });
});
