import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BdGeo, BdMapData } from '../src';

const asset = (name: string) => readFileSync(new URL(`../assets/${name}`, import.meta.url), 'utf8');

describe('BdMapData', () => {
  it('values, labels, and formatting', () => {
    const data = new BdMapData<number>({ dhaka: 44.2, sylhet: 11.0 }, { title: 'Population', format: (v) => `${v}M` });
    const dhaka = BdGeo.divisionByName('Dhaka')!;
    const khulna = BdGeo.divisionByName('Khulna')!;
    expect(data.valueOf(dhaka)).toBe(44.2);
    expect(data.get('sylhet')).toBe(11.0);
    expect(data.has(khulna)).toBe(false);
    expect(data.labelOf(dhaka)).toBe('44.2M');
    expect(data.labelOf(khulna)).toBeNull();
    expect(data.minValue).toBe(11.0);
    expect(data.maxValue).toBe(44.2);
    expect(data.size).toBe(2);
  });

  it('numeric values get an automatic choropleth scale', () => {
    const data = new BdMapData<number>({ dhaka: 0, sylhet: 10 });
    expect(data.colorOf(BdGeo.divisionByName('Dhaka')!)).toBe(data.minColor.toLowerCase());
    expect(data.colorOf(BdGeo.divisionByName('Sylhet')!)).toBe(data.maxColor.toLowerCase());
    expect(data.colorOf(BdGeo.divisionByName('Khulna')!)).toBeNull();
  });

  it('colorBuilder overrides the automatic scale', () => {
    const data = new BdMapData<number>({ dhaka: 5 }, { colorBuilder: () => 'red' });
    expect(data.colorOf(BdGeo.divisionByName('Dhaka')!)).toBe('red');
  });

  it('non-numeric values have labels but no color', () => {
    const data = new BdMapData<string>({ dhaka: 'HQ' });
    const dhaka = BdGeo.divisionByName('Dhaka')!;
    expect(data.labelOf(dhaka)).toBe('HQ');
    expect(data.colorOf(dhaka)).toBeNull();
  });

  it('accepts a Map and sorts by value', () => {
    const data = new BdMapData(new Map([['sylhet', 99], ['dhaka', 1]]));
    const sorted = data.sort(BdGeo.divisions);
    expect(sorted[0].id).toBe('sylhet');
    expect(sorted[1].id).toBe('dhaka');
    expect(sorted).toHaveLength(8);
  });
});

describe('BdMapData.fromJson', () => {
  it('parses all level sections keyed by names', () => {
    const data = BdMapData.fromJson({
      title: 'Population',
      unit: 'M',
      divisions: { Dhaka: 44.2, 'চট্টগ্রাম': 33.2 },
      districts: { Gazipur: 3.4, "Cox's Bazar": 2.9 },
      upazilas: { 'Gazipur/Sreepur': 0.4 },
      unions: { 'Gazipur/Sreepur/Barmi': 0.05 },
    });
    expect(data.title).toBe('Population');
    expect(data.get('dhaka')).toBe(44.2);
    expect(data.get('chattagram')).toBe(33.2);
    expect(data.get('dhaka.gazipur')).toBe(3.4);
    expect(data.get('chattagram.coxsbazar')).toBe(2.9);
    expect(data.get('dhaka.gazipur.sreepur')).toBe(0.4);
    expect([...data.values.keys()].some((k) => k.endsWith('.barmi'))).toBe(true);
    expect(data.labelOf(BdGeo.divisionByName('Dhaka')!)).toBe('44.2M');
  });

  it('ambiguous plain names apply to every match', () => {
    const data = BdMapData.fromJson({ upazilas: { Sreepur: 7 } });
    expect(data.size).toBeGreaterThan(1);
    const qualified = BdMapData.fromJson({ upazilas: { 'Gazipur/Sreepur': 7 } });
    expect(qualified.size).toBe(1);
    expect(qualified.get('dhaka.gazipur.sreepur')).toBe(7);
  });

  it('thanas alias, raw values section, and string parsing', () => {
    const data = BdMapData.fromJson({ thanas: { Sreepur: 1 }, values: { dhaka: '44.2', 'not.a.region': 5 } });
    expect(data.get('dhaka.gazipur.sreepur')).toBe(1);
    expect(data.get('dhaka')).toBe(44.2);
    expect(data.get('not.a.region')).toBeNull();
  });

  it('nested tree: division -> district -> thana -> union', () => {
    const data = BdMapData.fromJson({
      title: 'Population',
      unit: 'M',
      data: {
        Dhaka: {
          value: 44.2,
          Gazipur: { value: 3.4, Sreepur: { value: 0.4, Barmi: 0.05 }, Kapasia: 1.3 },
          Tangail: 4.0,
        },
        Sylhet: { value: 11.0 },
      },
    });
    expect(data.get('dhaka')).toBe(44.2);
    expect(data.get('dhaka.gazipur')).toBe(3.4);
    expect(data.get('dhaka.gazipur.sreepur')).toBe(0.4);
    expect(data.get('dhaka.gazipur.kapasia')).toBe(1.3);
    expect(data.get('dhaka.tangail')).toBe(4.0);
    expect(data.get('sylhet')).toBe(11.0);
    expect([...data.values.keys()].some((k) => k.endsWith('.barmi'))).toBe(true);
    expect([...data.values.keys()].some((k) => k.includes('magura'))).toBe(false);
  });

  it('nested tree with level-wrapper keys', () => {
    const data = BdMapData.fromJson({
      data: { Dhaka: { value: 1, districts: { Gazipur: { thanas: { Sreepur: { unions: { Barmi: 3 }, value: 2 } } } } } },
    });
    expect(data.get('dhaka')).toBe(1);
    expect(data.get('dhaka.gazipur.sreepur')).toBe(2);
    expect([...data.values.keys()].some((k) => k.endsWith('.barmi'))).toBe(true);
  });

  it('same-name child resolves within its parent (Barishal/Barishal)', () => {
    const data = BdMapData.fromJson({ data: { Barishal: { value: 9.1, Barishal: 1.2 } } });
    expect(data.get('barishal')).toBe(9.1);
    expect(data.get('barishal.barishal')).toBe(1.2);
  });

  it('shipped full-country JSON covers every region at every level', () => {
    const data = BdMapData.fromJsonString(asset('bd_data_full_country.json'));
    expect(data.title).toBe('Population');
    for (const list of [BdGeo.divisions, BdGeo.districts, BdGeo.upazilas, BdGeo.unionRegions]) {
      expect(list.filter((r) => data.has(r)).length).toBe(list.length);
    }
  });

  it('per-level JSON files each cover their whole level', () => {
    expect(BdGeo.divisions.filter((r) => BdMapData.fromJsonString(asset('bd_data_divisions.json')).has(r))).toHaveLength(8);
    expect(BdGeo.districts.filter((r) => BdMapData.fromJsonString(asset('bd_data_districts.json')).has(r))).toHaveLength(64);
    const thanas = BdMapData.fromJsonString(asset('bd_data_thanas.json'));
    expect(BdGeo.upazilas.filter((r) => thanas.has(r))).toHaveLength(BdGeo.upazilas.length);
    const unions = BdMapData.fromJsonString(asset('bd_data_unions.json'));
    expect(BdGeo.unionRegions.filter((r) => unions.has(r))).toHaveLength(BdGeo.unionRegions.length);
  });

  it('fromList: API-style list of objects', () => {
    const data = BdMapData.fromList(
      [
        { district: 'Gazipur', value: 3.4 },
        { district: 'Cumilla', population: 5.6 },
        { division: 'Dhaka', thana: 'Savar', count: 1.4 },
        { division: 'Dhaka', value: 44.2 },
        { name: 'Sylhet', value: 11.0 },
        { district: 'Nowhere', value: 1 },
        { district: 'Gazipur' },
      ],
      { title: 'Population', unit: 'M' },
    );
    expect(data.get('dhaka.gazipur')).toBe(3.4);
    expect(data.get('chattagram.cumilla')).toBe(5.6);
    expect(data.get('dhaka.dhaka.savar')).toBe(1.4);
    expect(data.get('dhaka')).toBe(44.2);
    expect(data.get('sylhet')).toBe(11.0);
    expect(data.labelOf(BdGeo.divisionByName('Dhaka')!)).toBe('44.2M');
  });

  it('fromList: explicit regionKey/valueKey and numeric fallback', () => {
    const data = BdMapData.fromList([{ zone: 'Rajshahi', sales: 12 }], { regionKey: 'zone', valueKey: 'sales' });
    expect(data.get('rajshahi')).toBe(12);
    const auto = BdMapData.fromList([{ name: 'Khulna', anything_numeric: 7 }]);
    expect(auto.get('khulna')).toBe(7);
  });

  it('fromJsonString accepts a top-level array and data:[...] wrapper', () => {
    expect(BdMapData.fromJsonString('[{"division": "Dhaka", "value": 44.2}]').get('dhaka')).toBe(44.2);
    const wrapped = BdMapData.fromJsonString('{"title": "Population", "unit": "M", "data": [{"district": "Gazipur", "value": 3.4}]}');
    expect(wrapped.get('dhaka.gazipur')).toBe(3.4);
    expect(wrapped.title).toBe('Population');
    expect(wrapped.labelOf(BdGeo.districtByName('Gazipur')!)).toBe('3.4M');
  });

  it('hex colors', () => {
    const data = BdMapData.fromJsonString('{"divisions": {"Dhaka": 1}, "minColor": "#FFFFFF", "maxColor": "#000000"}');
    expect(data.get('dhaka')).toBe(1);
    expect(data.minColor).toBe('#FFFFFF');
    expect(data.maxColor).toBe('#000000');
  });
});
