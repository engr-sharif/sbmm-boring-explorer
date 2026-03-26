import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rev2Root = path.resolve(process.cwd());
const repoRoot = path.resolve(rev2Root, '..');
const sourceDataPath = path.join(repoRoot, 'data.js');
const sourceBoundariesPath = path.join(repoRoot, 'boundaries.js');
const outDir = path.join(rev2Root, 'data');

const parseJsConstants = (filePath, names) => {
  const code = fs.readFileSync(filePath, 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${code};this.__out={${names.join(',')}};`, context);
  return context.__out;
};

const { BORINGS_DATA, BORINGS_2025 } = parseJsConstants(sourceDataPath, ['BORINGS_DATA', 'BORINGS_2025']);
const { KMZ_BOUNDARIES } = parseJsConstants(sourceBoundariesPath, ['KMZ_BOUNDARIES']);

const toNum = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\u00a0/g, ' ').trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const normalizeBoring = (record, campaign) => {
  const lat = toNum(record.lat);
  const lng = toNum(record.lng);

  const normYear = record.year === null || record.year === undefined || record.year === '' ? null : String(record.year);

  return {
    type: 'Feature',
    geometry: lat !== null && lng !== null ? { type: 'Point', coordinates: [lng, lat] } : null,
    properties: {
      id: record.id ?? null,
      campaign,
      subproject: record.subproject ?? 'Unknown',
      type: record.type ?? 'Unknown',
      is_mw: Boolean(record.is_mw),
      year: normYear,
      company: record.company ?? null,
      firm: record.firm ?? null,
      elevation_ft: toNum(record.elevation),
      elevation_estimated: Boolean(record.elevation_estimated),
      depth_ft: toNum(record.depth),
      gw_depth_ft: toNum(record.gw_depth),
      screen_interval_ft: record.screen ?? null,
      casing_in: toNum(record.casing),
      installation_date: record.date ?? null,
      condition: record.condition ?? null,
      notes: record.notes ?? null,
      source_polygon_label: record.polygon ?? null,
      source_doc: campaign === '2025' ? 'SBMM Geotechnical Report in progress' : 'Summary of Existing Explorations / EA Engineering / Historical Boring Info / SBMM.kmz',
      source_page: null,
      confidence_score: campaign === '2025' ? 0.95 : 0.9,
      last_verified_at: new Date().toISOString().slice(0, 10)
    }
  };
};

const boringFeatures = [
  ...BORINGS_DATA.map((r) => normalizeBoring(r, 'previous')),
  ...BORINGS_2025.map((r) => normalizeBoring(r, '2025'))
];

const boundaryFeatures = Object.entries(KMZ_BOUNDARIES).map(([name, ring]) => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[...ring.map(([lat, lng]) => [lng, lat])]]
  },
  properties: {
    name,
    source: 'SBMM.kmz',
    last_verified_at: new Date().toISOString().slice(0, 10)
  }
}));

const boringGeoJson = {
  type: 'FeatureCollection',
  metadata: {
    generated_at: new Date().toISOString(),
    campaigns: {
      previous: BORINGS_DATA.length,
      y2025: BORINGS_2025.length
    }
  },
  features: boringFeatures
};

const boundaryGeoJson = {
  type: 'FeatureCollection',
  metadata: { generated_at: new Date().toISOString() },
  features: boundaryFeatures
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'borings.geojson'), JSON.stringify(boringGeoJson, null, 2));
fs.writeFileSync(path.join(outDir, 'boundaries.geojson'), JSON.stringify(boundaryGeoJson, null, 2));

console.log(`Generated REV2/data/borings.geojson (${boringFeatures.length} features)`);
console.log(`Generated REV2/data/boundaries.geojson (${boundaryFeatures.length} features)`);
