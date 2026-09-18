#!/usr/bin/env node
// Generates screenshots/banner.svg — a compact, dark, code-style banner
// that draws the real division geometry from the built package.
// Run `npm run build` first, then `node scripts/make-banner.mjs`.
import { writeFileSync } from 'node:fs';
import { BD_COLORFUL_PALETTE, BD_MAP_ASPECT_RATIO, BdGeo } from '../dist/index.js';

const W = 1200, H = 300;
const MAP_H = 250, MAP_W = MAP_H * BD_MAP_ASPECT_RATIO;
const MAP_X = W - MAP_W - 70, MAP_Y = (H - MAP_H) / 2;

const map = BdGeo.divisions
  .map((d, i) => `<path d="${d.svgPath(MAP_W, MAP_H, 1)}" fill="${BD_COLORFUL_PALETTE[i % BD_COLORFUL_PALETTE.length]}"/>`)
  .join('\n    ');

const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const sans = "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif";

const chip = (x, y, label, color) => {
  const w = label.length * 8.2 + 22;
  return `<g transform="translate(${x} ${y})"><rect width="${w}" height="26" rx="13" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-opacity="0.5"/><text x="${w / 2}" y="17.5" text-anchor="middle" font-family="${sans}" font-size="13" font-weight="600" fill="${color}">${label}</text></g>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="bd-map: interactive drill-down Bangladesh maps for React, Node and Flutter">
  <defs>
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="16"/></clipPath>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#ffffff" stroke-opacity="0.04"/>
    </pattern>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="#0d1117"/>
    <rect width="${W}" height="${H}" fill="url(#grid)"/>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="#30363d"/>

  <!-- window dots -->
  <circle cx="34" cy="30" r="6" fill="#ff5f57"/>
  <circle cx="54" cy="30" r="6" fill="#febc2e"/>
  <circle cx="74" cy="30" r="6" fill="#28c840"/>

  <!-- title -->
  <text x="60" y="108" font-family="${mono}" font-size="54" font-weight="700" fill="#e6edf3" letter-spacing="-1">bd-map</text>
  <text x="60" y="146" font-family="${sans}" font-size="20" fill="#8b949e">Interactive drill-down maps of Bangladesh · division → district → upazila → union</text>

  <!-- install commands -->
  <g transform="translate(60 172)">
    <rect width="620" height="72" rx="10" fill="#161b22" stroke="#30363d"/>
    <text x="18" y="30" font-family="${mono}" font-size="16" fill="#8b949e">$ <tspan fill="#79c0ff">npm</tspan> <tspan fill="#e6edf3">i @farhansadikgalib/bd-map</tspan></text>
    <text x="18" y="56" font-family="${mono}" font-size="16" fill="#8b949e">$ <tspan fill="#79c0ff">flutter</tspan> <tspan fill="#e6edf3">pub add bd_map</tspan></text>
  </g>

  <!-- chips -->
  ${chip(60, 258, 'React', '#61dafb')}
  ${chip(144, 258, 'Node', '#8cc84b')}
  ${chip(222, 258, 'Flutter', '#54c5f8')}
  ${chip(316, 258, 'TypeScript', '#3178c6')}
  ${chip(432, 258, 'Bangla + English', '#f778ba')}
  ${chip(586, 258, 'Zero deps', '#d2a8ff')}

  <!-- real division geometry from the package -->
  <g transform="translate(${MAP_X} ${MAP_Y})" stroke="#0d1117" stroke-width="1.4" stroke-linejoin="round">
    ${map}
  </g>
</svg>
`;
writeFileSync(new URL('../screenshots/banner.svg', import.meta.url), svg);
console.log('screenshots/banner.svg written');
