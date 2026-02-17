import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const stationsPath = join(root, 'data', 'stations.json');
const dadesPath = join(root, 'data', 'dades-paris.json');
const outputPath = join(root, 'public', 'stations.json');

// Read source station data
const stations = JSON.parse(readFileSync(stationsPath, 'utf-8'));

// Read dades.js coordinate/layout data if available
let dadesMap = {};
if (existsSync(dadesPath)) {
  const dades = JSON.parse(readFileSync(dadesPath, 'utf-8'));
  for (const d of dades) {
    // Index by slug (underscore format from dades.js)
    dadesMap[d.slug] = d;
  }
  console.log(`Loaded ${dades.length} dades.js entries for coordinate matching`);
}

// Normalize a station name to an underscore slug for dades.js matching
function toUnderscoreSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[\s\-–—]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

let coordUpdates = 0;
let layoutUpdates = 0;

// Enrich with computed fields and dades.js coordinates
const enriched = stations.map(s => {
  const result = {
    ...s,
    openingYear: s.opening ? parseInt(s.opening.slice(0, 4), 10) : null,
    linesSorted: [...s.lines].sort((a, b) => {
      const toNum = v => typeof v === 'string' ? parseFloat(v) + 0.5 : v;
      return toNum(a) - toNum(b);
    }),
  };

  // Try to match with dades.js data
  const layoutSlug = s.layout_image;
  const nameSlug = toUnderscoreSlug(s.name);
  const dades = dadesMap[layoutSlug] || dadesMap[nameSlug];

  if (dades) {
    // Override coordinates with dades.js data (more reliable), but skip
    // stations whose layout_image points to a different station's diagram
    const SKIP_COORDS = ['cluny-la-sorbonne', 'la-chapelle'];
    if (dades.lat && dades.lng && !SKIP_COORDS.includes(s.slug)) {
      result.latitude = dades.lat;
      result.longitude = dades.lng;
      coordUpdates++;
    }
    // Set layout_image from dades if not already set
    if (!result.layout_image) {
      result.layout_image = dades.slug;
      layoutUpdates++;
    }
  }

  return result;
});

// Ensure output directory exists
mkdirSync(dirname(outputPath), { recursive: true });

writeFileSync(outputPath, JSON.stringify(enriched, null, 0));

console.log(`Built ${enriched.length} stations → ${outputPath}`);
console.log(`  Coordinates updated from dades.js: ${coordUpdates}`);
console.log(`  Layout images filled from dades.js: ${layoutUpdates}`);

// Quick stats
const categories = {};
const lines = new Set();
let missingCoords = 0;
for (const s of enriched) {
  (s.categories || []).forEach(c => categories[c] = (categories[c] || 0) + 1);
  s.lines.forEach(l => lines.add(l));
  if (!s.latitude || !s.longitude) missingCoords++;
}
console.log(`Lines: ${[...lines].sort().join(', ')}`);
console.log(`Missing coordinates: ${missingCoords}`);
console.log('Categories:');
Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
