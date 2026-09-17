<p align="center">
  <img src="https://raw.githubusercontent.com/farhansadikgalib/bd-map/main/screenshots/banner.svg" alt="bd-map — interactive, drill-down Bangladesh maps" width="100%">
</p>

[![npm](https://img.shields.io/npm/v/bd-map.svg)](https://www.npmjs.com/package/bd-map)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/farhansadikgalib/bd-map/blob/main/LICENSE)
[![pub package](https://img.shields.io/pub/v/bd_map.svg?label=flutter)](https://pub.dev/packages/bd_map)

Interactive Bangladesh maps for **React**, and a geography + data API for **Node**. One component gives you a clickable map that drills from division down to union, with your own data from JSON or an API coloring every region. The same core renders static SVG on the server. **Zero dependencies**, TypeScript types included.

This is the JavaScript port of the [`bd_map` Flutter package](https://pub.dev/packages/bd_map); both share the same geometry, names, ids and JSON data format.

<p align="center">
  <img src="https://raw.githubusercontent.com/farhansadikgalib/bd-map/main/screenshots/example.png" alt="BdMap: the 8 divisions of Bangladesh, ready to drill down" width="520">
</p>

## Installation

```sh
npm install bd-map
```

```ts
import { BdGeo, BdMapData, renderSvg } from 'bd-map';       // Node / any framework
import { BdMap, BdCountryMap } from 'bd-map/react';         // React components
```

React 17 or newer is an optional peer dependency, needed only for `bd-map/react`. ESM and CommonJS builds are both included.

## Usage

### 1. Show a map

Every map works with no data at all. Pick the one you need:

```tsx
<BdMap />                          // click to drill in, all four levels
<BdCountryMap level="district" />  // whole country at one level; drag, wheel and pinch to zoom
<BangladeshMap />                  // classic division map
```

Switch labels, breadcrumb and panel text to Bangla with `useBanglaNames`. The drill-down map is colorful out of the box; pass your own `palette` (any list of CSS colors) to every map, exactly like the Flutter package:

```tsx
const palette = ['#3F51B5', '#009688', '#FF9800', '#E91E63', '#4CAF50', '#9C27B0'];

<BdMap palette={palette} />
<BdCountryMap level="upazila" palette={palette} />
<BangladeshMap divisionColors={{ dhaka: '#E91E63', sylhet: '#009688' }} />
```

`BD_COLORFUL_PALETTE` (the default), `BD_GREEN_PALETTE` and the per-level `BD_DIVISION_PALETTE`, `BD_DISTRICT_PALETTE`, `BD_UPAZILA_PALETTE` and `BD_UNION_PALETTE` are exported if you want to reuse them.

| Feature | Export | What you get |
| --- | --- | --- |
| Drill-down map | `BdMap` | Click a division to see its districts, then upazilas, then unions. Breadcrumb, back button, animated zoom. |
| Wall maps | `BdCountryMap` | The whole country at one level: 8 divisions, 64 districts, 544 upazilas or 5,160 unions. Pan, zoom, click to select. |
| Your data | `BdMapData` | Load values from a JSON file, an API response or a plain object. Shows in the info panel, a ranked list and, optionally, as choropleth colors. |
| Geography API | `BdGeo` | Every region with English and Bangla names, parent and children lookups, hit testing and boundary geometry. |
| Server SVG | `renderSvg` | A static SVG string of any level, with or without data. Works in Node, emails, PDFs, Next.js server components. |
| Ranked list | `BdRegionDataList` | The list companion of the maps, colored to match. |
| Classic map | `BangladeshMap` | The original division map with per-division colors, tooltips and click callbacks. |

### 2. Handle clicks

Every callback and builder gives you a `BdRegion`:

```tsx
<BdMap
  onRegionTap={(region) => console.log(region.name)}
  infoBuilder={(region) => <p>{region.name} · {region.bnName}</p>}
/>
```

| Field | Example | Meaning |
| --- | --- | --- |
| `name` | `'Sreepur'` | English name |
| `bnName` | `'শ্রীপুর'` | Bangla name |
| `level` | `'upazila'` | `'division'`, `'district'`, `'upazila'` or `'union'` |
| `id` | `'dhaka.gazipur.sreepur'` | Stable key: lowercase path from the division down |
| `parentId` | `'dhaka.gazipur'` | Id of the region one level up |

You never type ids by hand. Read them from a clicked region, look them up with `BdGeo`, or key your data by plain names in JSON as shown next.

### 3. Add your data

Write a JSON file nested the way the country is organized. Keys are region names in English or Bangla, each region has a `value`, and children sit inside their parent. A child that is a plain number is just its value:

```json
{
  "title": "Population",
  "unit": "M",
  "data": {
    "Dhaka": {
      "value": 44.2,
      "Gazipur": { "value": 3.4, "Sreepur": 0.4, "Kapasia": 1.3 },
      "Tangail": 4.0
    },
    "Sylhet": 11.0
  }
}
```

Load it and pass it to any map. The same call also accepts an API response body, where a JSON array of objects is read as a list:

```tsx
const body = await (await fetch('/population.json')).text();   // or any API
const population = BdMapData.fromJsonString(body);

<BdMap
  data={population}        // value shown in the info panel
  showDataList             // ranked, clickable list under the map
/>
```

API-style list items name their region with a level field and carry any numeric value field:

```json
[
  { "district": "Gazipur", "value": 3.4 },
  { "division": "Dhaka", "thana": "Savar", "population": 1.4 }
]
```

The maps keep their normal colors. For a choropleth, add one line:

```tsx
regionColorBuilder={(r) => population.colorOf(r)}
```

Building the dataset in code works too, keyed by region id:

```ts
const population = new BdMapData<number>(
  { dhaka: 44.2, 'dhaka.gazipur': 3.4, 'dhaka.gazipur.sreepur': 0.4 },
  { title: 'Population', format: (v) => `${v}M` },
);
```

**Ready-made JSON files.** The package ships sample files with every region name already spelled correctly and in the right place. Copy one, replace the sample values with yours:

| File | Contains |
| --- | --- |
| `bd-map/assets/bd_data_full_country.json` | All 5,700+ regions in one tree. Start here. |
| `bd-map/assets/bd_data_divisions.json` | 8 divisions |
| `bd-map/assets/bd_data_districts.json` | 64 districts |
| `bd-map/assets/bd_data_thanas.json` | 544 thanas and upazilas |
| `bd-map/assets/bd_data_unions.json` | 5,160 unions and wards |

They resolve through the package's `exports`, so `import data from 'bd-map/assets/bd_data_districts.json'` works with bundlers, and Node can `readFileSync(require.resolve('bd-map/assets/bd_data_districts.json'))`.

<details>
<summary>More data formats</summary>

Names are resolved among the parent's children only, so repeated names such as `Sadar` are never ambiguous. Children may also be wrapped in explicit `"districts"`, `"thanas"` or `"unions"` keys. A region carrying only children and no `"value"` is fine.

Flat per-level sections are accepted as well, with optional `Parent/Child` keys to disambiguate:

```json
{ "districts": { "Gazipur": 3.4 }, "upazilas": { "Gazipur/Sreepur": 0.4 } }
```

For API lists, the region comes from `division`, `district`, `thana` or `upazila`, and `union`, where the deepest field is the target and shallower ones qualify it, or from a generic `name`, `region` or `id`. The value comes from `value`, `count`, `total`, `amount`, `population` or `percentage`, otherwise the first numeric field. Name your own fields with `regionKey` and `valueKey` on `BdMapData.fromList`.

`BdMapData.fromAny(parsedJson)` takes an already-parsed object or array, which is handy with `fetch(...).then((r) => r.json())`.

</details>

### 4. Show data as a list

`BdRegionDataList` renders a level or one region's children with the same colors and values as the maps:

```tsx
<BdRegionDataList
  level="district"                                // all 64 districts, or
  // parent={BdGeo.divisionByName('Dhaka')}       // its 13 districts
  data={population}
  onTap={(region) => console.log(region.name)}
/>
```

### 5. Look up geography

Everything here is synchronous and works in Node without React:

```ts
const dhaka = BdGeo.divisionByName('Dhaka')!;      // or 'ঢাকা'
const districts = BdGeo.childrenOf(dhaka);          // 13 districts
const gazipur = BdGeo.districtByName('Gazipur')!;   // gazipur.id === 'dhaka.gazipur'
const upazilas = BdGeo.childrenOf(gazipur);         // its upazilas
const unions = BdGeo.unionsOf(upazilas[0].id);      // its unions
const region = BdGeo.byId('dhaka.gazipur.sreepur');
const chain = BdGeo.ancestorsOf(region!);           // [Dhaka, Gazipur]
const hit = BdGeo.regionAt(0.5, 0.5);               // deepest region at a normalized point
```

`BdGeo.divisions`, `.districts`, `.upazilas` and `.unionRegions` list whole levels; `BdGeo.regionsOf('district')` does the same by name.

### 6. Render SVG on the server

```ts
import { writeFileSync } from 'node:fs';
import { BdMapData, renderSvg } from 'bd-map';

const data = BdMapData.fromList(apiRows, { title: 'Sales', unit: ' BDT' });
writeFileSync('sales.svg', renderSvg({ level: 'district', data, width: 800 }));

// One district's upazilas only, framed to the district:
renderSvg({ level: 'upazila', parent: 'dhaka.gazipur', labels: true });
```

The output is a self-contained `<svg>` with a `data-id` on every region path and a `<title>` tooltip, so it can be styled or made interactive later.

### `BdMap` props

| Prop | Description |
| --- | --- |
| `maxLevel` | Deepest level the user can drill to. |
| `useBanglaNames` | Labels, breadcrumb and panel text in Bangla. |
| `data`, `showDataList` | Your `BdMapData` and the ranked list under the map. |
| `regionColorBuilder` | Per-region fill color, for choropleth maps. |
| `infoBuilder` | Your content for the selected region in the info panel. |
| `onRegionTap`, `onLevelChanged` | Callbacks for clicks and drilling in or out. |
| `showLabels`, `showBreadcrumb`, `showInfoPanel` | Toggle the built-in parts. |
| `palette`, `borderColor`, `borderWidth`, `highlightColor`, `backgroundColor` | Styling. |
| `labelFontSize`, `labelColor`, `labelStyle` | Region label text. |
| `animationDuration`, `animationCurve` | Zoom animation in ms and its easing function. |

### `BdCountryMap` props

| Prop | Description |
| --- | --- |
| `level` | `'division'`, `'district'`, `'upazila'` or `'union'`. |
| `useBanglaNames`, `showLabels`, `maxZoom` | Display options. |
| `data`, `showDataList`, `regionColorBuilder`, `infoBuilder`, `onRegionTap` | Same as `BdMap`. |
| `palette`, `nationalBorderColor/Width`, `parentBorderColor/Width`, `regionBorderColor/Width`, `backgroundColor` | Styling. Each level has its own default palette. |
| `primaryLabelSize`, `secondaryLabelSize`, `primaryLabelStyle`, `secondaryLabelStyle`, `labelColor` | Label text. |

`BdUpazilaMap` is `BdCountryMap` fixed to the upazila level.

### `BangladeshMap` props

| Prop | Description |
| --- | --- |
| `divisionColors` | Fill per division, keyed by id or English name. |
| `palette`, `color` | Fills for divisions without an explicit color. |
| `strokeColor`, `strokeWidth`, `showLabels`, `labelColor`, `labelFontSize`, `labelStyle`, `hoverEffect` | Styling. |
| `onDivisionTap`, `onDivisionHover`, `useBanglaNames` | Interaction and language. |

### Theming

The components use inline styles driven by CSS variables, so they work with no stylesheet and adapt to yours. Override any of these on an ancestor:

```css
.my-dashboard {
  --bd-fg: #e6edf3;
  --bd-fg-muted: #9aa7b4;
  --bd-panel: #161b22;
  --bd-border: #30363d;
  --bd-primary: #58a6ff;
  --bd-chip: #21262d;
  --bd-chip-fg: #c9d1d9;
  --bd-radius: 8px;
  --bd-font: inherit;
}
```

Every root element also carries a class (`bd-map`, `bd-country-map`, `bd-map-list`, `bd-map-info`, `bd-map-breadcrumb`) for further styling.

## Example app

```sh
git clone https://github.com/farhansadikgalib/bd-map
cd bd-map
npm install
npm run example
```

## Bundle size

The geometry for all 5,776 regions is compiled into the package (about 2.4 MB unminified, roughly 600 KB gzipped) so nothing is fetched at runtime. Both entry points share one chunk, so importing `bd-map` and `bd-map/react` together costs nothing extra.

## Data sources

- Geometry: [geoBoundaries](https://www.geoboundaries.org) gbOpen BGD ADM1–ADM4, simplified. CC BY 4.0.
- Bangla names: [nuhil/bangladesh-geocode](https://github.com/nuhil/bangladesh-geocode).

## License

MIT © [Farhan Sadik Galib](https://farhansadikgalib.com)
