import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BangladeshMap, BdArea, BdCountryMap, BdMap, BdMapData, BdRegion, renderSvg } from 'bd-map/react';

// A palette shared by the maps, like the Flutter example app's kMapPalette.
const palette = ['#3F51B5', '#009688', '#FF9800', '#E91E63', '#4CAF50', '#9C27B0', '#00BCD4', '#FFC107', '#F44336', '#2196F3', '#8BC34A', '#FF5722', '#673AB7'];

function App() {
  const [bn, setBn] = useState(false);
  const [level, setLevel] = useState<BdArea>('district');
  const [choropleth, setChoropleth] = useState(false);
  const [json, setJson] = useState<string | null>(null);
  const [last, setLast] = useState<BdRegion | null>(null);

  // The shipped sample file: every region of the country with a value.
  useEffect(() => {
    fetch('/bd_data_full_country.json')
      .then((r) => r.text())
      .then(setJson);
  }, []);
  const data = useMemo(() => (json ? BdMapData.fromJsonString(json) : null), [json]);
  const color = choropleth && data ? (r: BdRegion) => data.colorOf(r) : undefined;

  const svg = useMemo(() => renderSvg({ level: 'division', width: 320, data, choropleth, palette, labels: true }), [data, choropleth]);

  return (
    <>
      <header>
        <h1>bd-map</h1>
        <label>
          <input type="checkbox" checked={bn} onChange={(e) => setBn(e.target.checked)} /> Bangla names
        </label>
        <label>
          <input type="checkbox" checked={choropleth} onChange={(e) => setChoropleth(e.target.checked)} /> Choropleth
        </label>
        <label>
          Country map level
          <select value={level} onChange={(e) => setLevel(e.target.value as BdArea)}>
            <option value="division">Divisions</option>
            <option value="district">Districts</option>
            <option value="upazila">Upazilas</option>
            <option value="union">Unions</option>
          </select>
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 13 }}>{last ? `Last tap: ${last.name} (${last.id})` : 'Tap a region'}</span>
      </header>
      <main>
        <section>
          <h2>BdMap — drill down from division to union</h2>
          <BdMap palette={palette} useBanglaNames={bn} data={data} showDataList regionColorBuilder={color} onRegionTap={setLast} />
        </section>
        <section>
          <h2>BdCountryMap — the whole country at one level (drag, wheel, pinch)</h2>
          <BdCountryMap level={level} palette={palette} useBanglaNames={bn} data={data} showDataList regionColorBuilder={color} onRegionTap={setLast} />
        </section>
        <section>
          <h2>BangladeshMap — classic division map with your own colors</h2>
          <BangladeshMap
            useBanglaNames={bn}
            divisionColors={{ dhaka: '#E91E63', chattagram: '#3F51B5', sylhet: '#009688' }}
            onDivisionTap={setLast}
          />
        </section>
        <section>
          <h2>renderSvg — a static SVG string (works in Node)</h2>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          <pre>{svg.slice(0, 300)}…</pre>
        </section>
      </main>
    </>
  );
}

/** `?shot` renders just the drill-down map on a clean page, used for the README screenshot. */
function Shot() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
      <div style={{ width: 560 }}>
        <BdMap showBreadcrumb={false} labelFontSize={14} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{location.search.includes('shot') ? <Shot /> : <App />}</StrictMode>,
);
