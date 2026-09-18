#!/usr/bin/env node
// Generates screenshots/social.svg (1200x630): a clean, minimal cover.
// Render to PNG with `npm run social`.
import { writeFileSync } from 'node:fs';
import { BD_COLORFUL_PALETTE, BD_MAP_ASPECT_RATIO, BdGeo } from '../dist/index.js';

const W = 1200, H = 630;
const MAP_H = 560, MAP_W = MAP_H * BD_MAP_ASPECT_RATIO;
const MAP_X = W - MAP_W - 90, MAP_Y = (H - MAP_H) / 2;
// All three text lines share one center: the middle of the tagline.
const CX = 330;
const sans = "-apple-system, 'Segoe UI', Inter, Roboto, Helvetica, sans-serif";

const map = BdGeo.divisions
  .map((d, i) => {
    const p = d.labelPoint;
    return `<path d="${d.svgPath(MAP_W, MAP_H, 1)}" fill="${BD_COLORFUL_PALETTE[i]}"/>
    <text x="${(p.x * MAP_W).toFixed(1)}" y="${(p.y * MAP_H).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="${sans}" font-size="15" font-weight="600" fill="#fff" stroke="none">${d.name}</text>`;
  })
  .join('\n    ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${CX}" y="238" text-anchor="middle" font-family="${sans}" font-size="72" font-weight="700" fill="#111827" letter-spacing="-2">bd-map</text>
  <text x="${CX}" y="292" text-anchor="middle" font-family="${sans}" font-size="22" fill="#9ca3af">Flutter · React · Node</text>
  <text x="${CX}" y="336" text-anchor="middle" font-family="${sans}" font-size="21" fill="#6b7280">Division → District → Upazila → Union</text>
  <text x="${CX}" y="396" text-anchor="middle" font-family="${sans}" font-size="26" fill="#4b5563">Interactive drill-down maps of Bangladesh</text>
  <g transform="translate(${MAP_X} ${MAP_Y})" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">
    ${map}
  </g>
</svg>
`;
writeFileSync(new URL('../screenshots/social.svg', import.meta.url), svg);
console.log('screenshots/social.svg written');
