#!/usr/bin/env node
// Converts the Dart geo data of the Flutter package (../lib/src/geo) into
// compact JSON under src/data. Run from bd_map/: `npm run data`.
//
// The Dart files are the single source of truth for geometry and names;
// this script keeps the npm package byte-for-byte in sync with them.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dartDir = join(here, '..', '..', 'lib', 'src', 'geo');
const outDir = join(here, '..', 'src', 'data');
mkdirSync(outDir, { recursive: true });

const LEVELS = { division: 0, district: 1, upazila: 2, union: 3 };

/** Dart single-quoted string literal -> JS string. Only `\'` escapes occur. */
const unquote = (s) => s.replace(/\\'/g, "'");

function parseRegions(source) {
  const regions = [];
  const re = /BdRegion\(\s*id:\s*'((?:[^'\\]|\\.)*)',\s*name:\s*'((?:[^'\\]|\\.)*)',\s*bnName:\s*'((?:[^'\\]|\\.)*)',\s*level:\s*BdArea\.(\w+),\s*(?:parentId:\s*'((?:[^'\\]|\\.)*)',\s*)?rawPolygons:\s*(\[[\s\S]*?\])\s*\)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const [, id, name, bnName, level, parentId, polys] = m;
    if (!(level in LEVELS)) throw new Error(`Unknown level ${level} for ${id}`);
    const rawPolygons = JSON.parse(polys.replace(/\s+/g, ''));
    regions.push({
      id: unquote(id),
      name: unquote(name),
      bn: unquote(bnName),
      level: LEVELS[level],
      parent: parentId === undefined ? null : unquote(parentId),
      polygons: rawPolygons,
    });
  }
  return regions;
}

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Marker not found: ${startMarker}`);
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  return source.slice(start, end < 0 ? source.length : end);
}

// ---- divisions / districts / upazilas
const geo = readFileSync(join(dartDir, 'bd_geo_data.dart'), 'utf8');
const aspect = Number(/kBdMapAspectRatio = ([\d.]+);/.exec(geo)[1]);
const divisions = parseRegions(sliceBetween(geo, 'kBdDivisions', 'kBdDistricts'));
const districts = parseRegions(sliceBetween(geo, 'kBdDistricts', 'kBdUpazilas'));
const upazilas = parseRegions(sliceBetween(geo, 'kBdUpazilas', null));

// ---- union geometry
const unionGeo = readFileSync(join(dartDir, 'bd_union_geo_data.dart'), 'utf8');
const unions = parseRegions(unionGeo);

// ---- union names per upazila
const unionNamesSrc = readFileSync(join(dartDir, 'bd_union_data.dart'), 'utf8');
const body = sliceBetween(unionNamesSrc, '<String, List<List<String>>>{', null);
const unionNames = {};
const entryRe = /'((?:[^'\\]|\\.)*)':\s*\[((?:\s*\[\s*'(?:[^'\\]|\\.)*',\s*'(?:[^'\\]|\\.)*'\s*\],?)*)\s*\]/g;
let m;
while ((m = entryRe.exec(body)) !== null) {
  const pairs = [];
  const pairRe = /\[\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\s*\]/g;
  let p;
  while ((p = pairRe.exec(m[2])) !== null) pairs.push([unquote(p[1]), unquote(p[2])]);
  unionNames[unquote(m[1])] = pairs;
}

const write = (name, value) => {
  const json = JSON.stringify(value);
  writeFileSync(join(outDir, name), json);
  console.log(`${name.padEnd(20)} ${(json.length / 1024).toFixed(0).padStart(6)} KB`);
};

write('meta.json', { aspectRatio: aspect });
write('divisions.json', divisions);
write('districts.json', districts);
write('upazilas.json', upazilas);
write('unions.json', unions);
write('union-names.json', unionNames);

console.log(
  `\n${divisions.length} divisions, ${districts.length} districts, ` +
    `${upazilas.length} upazilas, ${unions.length} union regions, ` +
    `${Object.keys(unionNames).length} upazilas with union names`,
);
