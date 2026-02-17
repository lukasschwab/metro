import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const VALID_CATEGORIES = [
  'battle', 'ruler', 'politician', 'military', 'writer', 'artist',
  'scientist', 'religion', 'institution', 'geographic', 'infrastructure',
  'trade', 'foreign', 'street',
];

const VALID_LINES = [1, 2, 3, '3bis', 4, 5, 6, 7, '7bis', 8, 9, 10, 11, 12, 13, 14];

const stationsPath = join(root, 'data', 'stations.json');
const stations = JSON.parse(readFileSync(stationsPath, 'utf-8'));

let errors = 0;
let warnings = 0;
const slugs = new Set();

for (const s of stations) {
  const id = s.slug || s.name || '(unknown)';

  // Required fields
  for (const field of ['slug', 'name', 'lines', 'opening', 'category', 'etymology', 'latitude', 'longitude']) {
    if (!s[field] && s[field] !== 0) {
      console.error(`ERROR [${id}]: missing field '${field}'`);
      errors++;
    }
  }

  // Slug uniqueness
  if (slugs.has(s.slug)) {
    console.error(`ERROR [${id}]: duplicate slug`);
    errors++;
  }
  slugs.add(s.slug);

  // Slug format
  if (s.slug && !/^[a-z0-9-]+$/.test(s.slug)) {
    console.error(`ERROR [${id}]: slug contains invalid characters (must be lowercase alphanumeric + hyphens)`);
    errors++;
  }

  // Category
  if (s.category && !VALID_CATEGORIES.includes(s.category)) {
    console.error(`ERROR [${id}]: invalid category '${s.category}'`);
    errors++;
  }

  // Lines
  if (s.lines) {
    for (const l of s.lines) {
      if (!VALID_LINES.includes(l)) {
        console.error(`ERROR [${id}]: invalid line '${l}'`);
        errors++;
      }
    }
  }

  // Opening date format
  if (s.opening && !/^\d{4}-\d{2}-\d{2}$/.test(s.opening)) {
    console.error(`ERROR [${id}]: invalid opening date format '${s.opening}' (expected YYYY-MM-DD)`);
    errors++;
  }

  // Coordinates sanity (Paris bounding box roughly)
  if (s.latitude && (s.latitude < 48.7 || s.latitude > 49.1)) {
    console.warn(`WARN  [${id}]: latitude ${s.latitude} seems outside Paris area`);
    warnings++;
  }
  if (s.longitude && (s.longitude < 2.1 || s.longitude > 2.6)) {
    console.warn(`WARN  [${id}]: longitude ${s.longitude} seems outside Paris area`);
    warnings++;
  }

  // Etymology length
  if (s.etymology && s.etymology.length < 20) {
    console.warn(`WARN  [${id}]: etymology seems too short (${s.etymology.length} chars)`);
    warnings++;
  }
}

console.log(`\nValidated ${stations.length} stations`);
console.log(`  ${errors} errors, ${warnings} warnings`);

if (stations.length < 300) {
  console.warn(`\nWARN: Only ${stations.length} stations found (expected ~302 unique)`);
}

// Check line coverage
const lineCounts = {};
for (const s of stations) {
  for (const l of s.lines) {
    lineCounts[l] = (lineCounts[l] || 0) + 1;
  }
}
console.log('\nStations per line (counting shared stations):');
for (const l of VALID_LINES) {
  console.log(`  Line ${l}: ${lineCounts[l] || 0}`);
}

process.exit(errors > 0 ? 1 : 0);
