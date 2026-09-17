## 1.0.0

Initial release of the JavaScript port of the `bd_map` Flutter package, with the same geometry, names, ids and JSON data format.

- `bd-map` (core, framework-free): `BdGeo` with 8 divisions, 64 districts, 544 upazilas and 5,160 unions, English and Bangla names, hierarchy lookups and hit testing; `BdMapData` loading values from nested JSON, flat per-level sections, API-style lists or plain objects with an automatic choropleth scale; `renderSvg` for static server-side SVG maps.
- `bd-map/react`: `BangladeshMap` classic division map with per-division colors; `BdMap` drill-down map from division to union with animated zoom, breadcrumb navigation and an info panel; `BdCountryMap` showing the whole country at any level with pan, wheel and pinch zoom and click to select; `BdRegionDataList` ranked list colored to match the maps.
- Sample JSON data files under `bd-map/assets/`.
- ESM and CommonJS builds, TypeScript declarations, zero runtime dependencies, React as an optional peer dependency.
