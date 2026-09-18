#!/usr/bin/env node
// Generates screenshots/social.svg (1200x630, LinkedIn/OG size).
// Render to PNG with: npm run social
import { writeFileSync } from 'node:fs';
import { BD_COLORFUL_PALETTE, BD_MAP_ASPECT_RATIO, BdGeo } from '../dist/index.js';

const W = 1200, H = 630;
const MAP_H = 540, MAP_W = MAP_H * BD_MAP_ASPECT_RATIO;
const MAP_X = W - MAP_W - 60, MAP_Y = (H - MAP_H) / 2;
const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const sans = "-apple-system, 'Segoe UI', Inter, Roboto, sans-serif";

const map = BdGeo.divisions
  .map((d, i) => {
    const p = d.labelPoint;
    return `<path d="${d.svgPath(MAP_W, MAP_H, 1)}" fill="${BD_COLORFUL_PALETTE[i]}"/>
    <text x="${(p.x * MAP_W).toFixed(1)}" y="${(p.y * MAP_H).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="${sans}" font-size="15" font-weight="700" fill="#fff" stroke="none" style="paint-order:stroke" >${d.name}</text>`;
  })
  .join('\n    ');

const chip = (x, y, label, color) => {
  const w = label.length * 9.4 + 26;
  return `<g transform="translate(${x} ${y})"><rect width="${w}" height="30" rx="15" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-opacity="0.5"/><text x="${w / 2}" y="20" text-anchor="middle" font-family="${sans}" font-size="15" font-weight="600" fill="${color}">${label}</text></g>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#ffffff" stroke-opacity="0.045"/>
    </pattern>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#3F51B5" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#3F51B5" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0d1117"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <circle cx="${MAP_X + MAP_W / 2}" cy="${H / 2}" r="330" fill="url(#glow)"/>

  <circle cx="60" cy="56" r="7" fill="#ff5f57"/>
  <circle cx="84" cy="56" r="7" fill="#febc2e"/>
  <circle cx="108" cy="56" r="7" fill="#28c840"/>

  <text x="60" y="190" font-family="${mono}" font-size="84" font-weight="700" fill="#e6edf3" letter-spacing="-2">bd-map</text>
  <text x="60" y="240" font-family="${sans}" font-size="26" fill="#c9d1d9">Interactive drill-down maps of Bangladesh</text>
  <text x="60" y="276" font-family="${sans}" font-size="21" fill="#8b949e">division → district → upazila → union · Bangla + English names</text>

  <g transform="translate(60 316)">
    <rect width="600" height="96" rx="12" fill="#161b22" stroke="#30363d"/>
    <text x="22" y="40" font-family="${mono}" font-size="20" fill="#8b949e">$ <tspan fill="#79c0ff">npm</tspan> <tspan fill="#e6edf3">i @farhansadikgalib/bd-map</tspan></text>
    <text x="22" y="74" font-family="${mono}" font-size="20" fill="#8b949e">$ <tspan fill="#79c0ff">flutter</tspan> <tspan fill="#e6edf3">pub add bd_map</tspan></text>
  </g>

  ${chip(60, 440, 'React', '#61dafb')}
  ${chip(151, 440, 'Node', '#8cc84b')}
  ${chip(237, 440, 'Flutter', '#54c5f8')}
  ${chip(339, 440, 'TypeScript', '#3178c6')}
  ${chip(466, 440, 'Zero deps', '#d2a8ff')}
  ${chip(577, 440, 'MIT', '#ffa657')}

  <text x="60" y="560" font-family="${mono}" font-size="17" fill="#8b949e">github.com/farhansadikgalib/bd-map</text>
  <text x="60" y="588" font-family="${mono}" font-size="17" fill="#8b949e">pub.dev/packages/bd_map</text>

  <g transform="translate(${MAP_X} ${MAP_Y})" stroke="#0d1117" stroke-width="2" stroke-linejoin="round">
    ${map}
  </g>
</svg>
`;
writeFileSync(new URL('../screenshots/social.svg', import.meta.url), svg);
console.log('screenshots/social.svg written');
