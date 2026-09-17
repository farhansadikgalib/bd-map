import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BdCountryMap, BdGeo, BdMap, BdMapData, BdRegionDataList } from '../src/react';

describe('React components render on the server', () => {
  it('BdMap renders the 8 divisions with a breadcrumb', () => {
    const html = renderToStaticMarkup(<BdMap />);
    expect(html.match(/data-id="/g)).toHaveLength(8);
    expect(html).toContain('Bangladesh');
    expect(renderToStaticMarkup(<BdMap useBanglaNames />)).toContain('বাংলাদেশ');
  });

  it('BdCountryMap renders every region of the level', () => {
    const html = renderToStaticMarkup(<BdCountryMap level="district" />);
    expect(html.match(/data-id="/g)).toHaveLength(64);
    expect(html).toContain('stroke-dasharray');
  });

  it('BdRegionDataList sorts by value and shows labels', () => {
    const data = new BdMapData({ sylhet: 99, dhaka: 1 }, { format: (v) => `${v}M` });
    const html = renderToStaticMarkup(<BdRegionDataList level="division" data={data} onTap={() => {}} />);
    expect(html.indexOf('Sylhet')).toBeLessThan(html.indexOf('Dhaka'));
    expect(html).toContain('99M');
    expect(html.match(/<li /g)).toHaveLength(8);
  });

  it('data list of a parent lists its children', () => {
    const dhaka = BdGeo.divisionByName('Dhaka')!;
    const html = renderToStaticMarkup(<BdRegionDataList parent={dhaka} />);
    expect(html.match(/<li /g)).toHaveLength(13);
  });
});

describe('BangladeshMap', () => {
  it('renders 8 divisions with custom colors', async () => {
    const { BangladeshMap } = await import('../src/react');
    const html = renderToStaticMarkup(<BangladeshMap divisionColors={{ Dhaka: '#123456', sylhet: '#abcdef' }} />);
    expect(html.match(/data-id="/g)).toHaveLength(8);
    expect(html).toContain('fill="#123456"');
    expect(html).toContain('fill="#abcdef"');
  });
});
