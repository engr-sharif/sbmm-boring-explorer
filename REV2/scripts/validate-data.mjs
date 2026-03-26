import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'data', 'borings.geojson');
const json = JSON.parse(fs.readFileSync(file, 'utf8'));

const errors = [];
const ids = new Set();

json.features.forEach((f, idx) => {
  const p = f.properties || {};
  const id = p.id;
  if (!id) errors.push(`feature[${idx}] missing id`);
  if (id) {
    const key = `${p.campaign}:${id}`;
    if (ids.has(key)) errors.push(`duplicate key ${key}`);
    ids.add(key);
  }

  if (!['previous', '2025'].includes(p.campaign)) {
    errors.push(`${id}: invalid campaign ${p.campaign}`);
  }

  if (!f.geometry || f.geometry.type !== 'Point') {
    errors.push(`${id}: missing/invalid point geometry`);
  } else {
    const [lng, lat] = f.geometry.coordinates;
    if (typeof lng !== 'number' || Number.isNaN(lng) || lng < -180 || lng > 180) {
      errors.push(`${id}: invalid lng ${lng}`);
    }
    if (typeof lat !== 'number' || Number.isNaN(lat) || lat < -90 || lat > 90) {
      errors.push(`${id}: invalid lat ${lat}`);
    }
  }

  if (p.year !== null && typeof p.year !== 'string') {
    errors.push(`${id}: year must be string/null`);
  }

  if (p.depth_ft !== null && typeof p.depth_ft !== 'number') {
    errors.push(`${id}: depth_ft must be number/null`);
  }
});

if (errors.length) {
  console.error('Data validation failed:');
  errors.slice(0, 50).forEach((e) => console.error(` - ${e}`));
  if (errors.length > 50) console.error(`...and ${errors.length - 50} more`);
  process.exit(1);
}

console.log(`Data validation passed for ${json.features.length} boring features.`);
