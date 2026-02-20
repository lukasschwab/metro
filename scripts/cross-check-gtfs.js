/**
 * Cross-check local metro line/station data against the official
 * IDFM (Île-de-France Mobilités) GTFS feed.
 *
 * Downloads the GTFS ZIP, extracts metro routes, and compares:
 *   1. Which stations belong to which lines
 *   2. Station ordering along each line
 *
 * Usage: node scripts/cross-check-gtfs.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const tmpDir = join(root, '.gtfs-tmp');

const GTFS_URL = 'https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip';

// ─── Load local data ────────────────────────────────────────────────

const stations = JSON.parse(readFileSync(join(root, 'data/stations.json'), 'utf-8'));
const bySlug = new Map(stations.map(s => [s.slug, s]));

const appJs = readFileSync(join(root, 'app.js'), 'utf-8');
const match = appJs.match(/const LINE_STATION_ORDER\s*=\s*(\{[\s\S]*?\n\};)/);
if (!match) throw new Error('Could not find LINE_STATION_ORDER in app.js');
const LINE_STATION_ORDER = eval('(' + match[1].replace(/;$/, '') + ')');

// ─── Slug helpers ───────────────────────────────────────────────────

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[\s\-–—]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── CSV helpers ────────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    return obj;
  });
}

/** Stream a large CSV, calling `fn(record)` for each row. */
async function streamCSV(filePath, fn) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });
  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) { headers = parseCSVLine(line); continue; }
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    fn(obj);
  }
}

// ─── Download & extract GTFS ────────────────────────────────────────

async function downloadGTFS() {
  if (existsSync(join(tmpDir, 'routes.txt'))) {
    console.log('Using cached GTFS data in .gtfs-tmp/');
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  const zipPath = join(tmpDir, 'gtfs.zip');

  console.log('Downloading IDFM GTFS feed...');
  const res = await fetch(GTFS_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(zipPath, buf);
  console.log(`Downloaded ${(buf.length / 1e6).toFixed(1)} MB`);

  console.log('Extracting relevant files...');
  execSync(
    `unzip -o -j "${zipPath}" routes.txt trips.txt stop_times.txt stops.txt -d "${tmpDir}"`,
    { stdio: 'pipe' }
  );
  console.log('Extraction complete.');
}

// ─── GTFS line name → our line key mapping ──────────────────────────

const GTFS_LINE_MAP = {
  '1': 1, '2': 2, '3': 3, '3B': '3bis', '3b': '3bis',
  '4': 4, '5': 5, '6': 6, '7': 7, '7B': '7bis', '7b': '7bis',
  '8': 8, '9': 9, '10': 10, '11': 11, '12': 12, '13': 13, '14': 14,
};

// ─── Main ───────────────────────────────────────────────────────────

await downloadGTFS();

console.log('\nParsing GTFS data...');

// 1) Parse small files fully in memory
const routes = parseCSV(readFileSync(join(tmpDir, 'routes.txt'), 'utf-8'));
const stops = parseCSV(readFileSync(join(tmpDir, 'stops.txt'), 'utf-8'));
const stopById = new Map(stops.map(s => [s.stop_id, s]));

// 2) Find metro route IDs
const metroRoutes = routes.filter(r => r.route_type === '1');
const metroRouteIds = new Set(metroRoutes.map(r => r.route_id));
const routeByRouteId = new Map(metroRoutes.map(r => [r.route_id, r]));
console.log(`Found ${metroRoutes.length} metro routes in GTFS`);

// 3) Stream trips.txt — keep only metro trips, index by route
console.log('Streaming trips.txt...');
const metroTrips = new Map(); // trip_id → { route_id, direction_id }
const tripsByRoute = new Map(); // route_id → [trip_id, ...]
await streamCSV(join(tmpDir, 'trips.txt'), (row) => {
  if (!metroRouteIds.has(row.route_id)) return;
  metroTrips.set(row.trip_id, { route_id: row.route_id, direction_id: row.direction_id || '0' });
  if (!tripsByRoute.has(row.route_id)) tripsByRoute.set(row.route_id, []);
  tripsByRoute.get(row.route_id).push(row.trip_id);
});
console.log(`  Kept ${metroTrips.size} metro trips`);

// 4) Stream stop_times.txt — keep only metro trip stop times
console.log('Streaming stop_times.txt (this may take a moment)...');
const stopTimesByTrip = new Map(); // trip_id → [{stop_id, stop_sequence}, ...]
await streamCSV(join(tmpDir, 'stop_times.txt'), (row) => {
  if (!metroTrips.has(row.trip_id)) return;
  if (!stopTimesByTrip.has(row.trip_id)) stopTimesByTrip.set(row.trip_id, []);
  stopTimesByTrip.get(row.trip_id).push({
    stop_id: row.stop_id,
    stop_sequence: Number(row.stop_sequence),
  });
});
console.log(`  Indexed stop times for ${stopTimesByTrip.size} trips`);

// 5) For each metro route, pick the longest trip per direction
const gtfsLines = new Map();

for (const route of metroRoutes) {
  const shortName = route.route_short_name.trim();
  const lineKey = GTFS_LINE_MAP[shortName];
  if (lineKey === undefined) {
    console.log(`  Skipping unknown metro route: "${shortName}" (${route.route_id})`);
    continue;
  }

  const routeTripIds = tripsByRoute.get(route.route_id) || [];
  if (routeTripIds.length === 0) continue;

  // Best (longest) trip per direction
  const bestByDir = new Map();
  for (const tripId of routeTripIds) {
    const trip = metroTrips.get(tripId);
    const count = (stopTimesByTrip.get(tripId) || []).length;
    const cur = bestByDir.get(trip.direction_id);
    if (!cur || count > cur.count) {
      bestByDir.set(trip.direction_id, { tripId, count });
    }
  }

  const directionStops = [];
  for (const [, { tripId }] of bestByDir) {
    const times = (stopTimesByTrip.get(tripId) || [])
      .sort((a, b) => a.stop_sequence - b.stop_sequence);

    const stationList = [];
    for (const st of times) {
      let stop = stopById.get(st.stop_id);
      if (stop && stop.parent_station) {
        const parent = stopById.get(stop.parent_station);
        if (parent) stop = parent;
      }
      if (stop) {
        const slug = toSlug(stop.stop_name);
        if (stationList.length === 0 || stationList[stationList.length - 1].slug !== slug) {
          stationList.push({ slug, name: stop.stop_name });
        }
      }
    }
    directionStops.push(stationList);
  }

  const allSlugs = new Set();
  let canonical = [];
  for (const ds of directionStops) {
    for (const s of ds) allSlugs.add(s.slug);
    if (ds.length > canonical.length) canonical = ds;
  }

  gtfsLines.set(String(lineKey), { shortName, canonical, allSlugs });
}

console.log(`Mapped ${gtfsLines.size} metro lines from GTFS\n`);

// ─── Cross-check ────────────────────────────────────────────────────

let totalIssues = 0;

for (const lineKey of Object.keys(LINE_STATION_ORDER)) {
  const gtfs = gtfsLines.get(lineKey);
  if (!gtfs) {
    console.log(`⚠  Line ${lineKey}: not found in GTFS data`);
    totalIssues++;
    continue;
  }

  const localSlugs = [...new Set(LINE_STATION_ORDER[lineKey].flat())];
  const gtfsSlugs = gtfs.allSlugs;

  const onlyLocal = localSlugs.filter(s => !gtfsSlugs.has(s));
  const onlyGTFS = [...gtfsSlugs].filter(s => !localSlugs.includes(s));

  if (onlyLocal.length === 0 && onlyGTFS.length === 0) {
    console.log(`✓  Line ${lineKey}: all ${localSlugs.length} stations match`);
  } else {
    if (onlyLocal.length > 0) {
      console.log(`✗  Line ${lineKey}: ${onlyLocal.length} station(s) in our data but NOT in GTFS:`);
      for (const s of onlyLocal) {
        const station = bySlug.get(s);
        console.log(`     - ${s} (${station?.name || '?'})`);
      }
      totalIssues += onlyLocal.length;
    }
    if (onlyGTFS.length > 0) {
      console.log(`✗  Line ${lineKey}: ${onlyGTFS.length} station(s) in GTFS but NOT in our data:`);
      for (const s of onlyGTFS) {
        const gtfsName = gtfs.canonical.find(st => st.slug === s)?.name || '?';
        console.log(`     + ${s} (${gtfsName})`);
      }
      totalIssues += onlyGTFS.length;
    }
  }

  // Station order check
  const localPrimary = LINE_STATION_ORDER[lineKey][0];
  const gtfsCanonical = gtfs.canonical.map(s => s.slug);
  const shared = localPrimary.filter(s => gtfsCanonical.includes(s));
  const gtfsShared = gtfsCanonical.filter(s => localPrimary.includes(s));
  const gtfsSharedRev = [...gtfsShared].reverse();
  const orderMatch = arraysEqual(shared, gtfsShared) || arraysEqual(shared, gtfsSharedRev);

  if (!orderMatch && shared.length > 2) {
    console.log(`   ↕ Line ${lineKey}: station order differs from GTFS`);
    const fwd = findFirstDivergence(shared, gtfsShared);
    const rev = findFirstDivergence(shared, gtfsSharedRev);
    const best = fwd.index >= rev.index ? fwd : rev;
    if (best.index < shared.length) {
      console.log(`     First mismatch at position ${best.index}: ours="${best.ours}" vs GTFS="${best.theirs}"`);
    }
    totalIssues++;
  }
}

// Check stations.json line claims against GTFS
console.log('\n─── stations.json line claims vs GTFS ───');
for (const station of stations) {
  for (const line of station.lines) {
    const lineKey = String(line);
    const gtfs = gtfsLines.get(lineKey);
    if (!gtfs) continue;
    const slug = station.slug;
    const inGTFS = gtfs.allSlugs.has(slug);
    const inLocal = LINE_STATION_ORDER[lineKey]?.flat().includes(slug);
    if (inGTFS && !inLocal) {
      console.log(`✗  "${station.name}" claims line ${line} and IS in GTFS, but missing from LINE_STATION_ORDER`);
      totalIssues++;
    } else if (!inGTFS && !inLocal) {
      console.log(`⚠  "${station.name}" claims line ${line} but is in neither GTFS nor LINE_STATION_ORDER`);
      totalIssues++;
    }
  }
}

console.log(`\n${'═'.repeat(50)}`);
console.log(totalIssues === 0
  ? '✓  All lines and stations match the GTFS feed!'
  : `Found ${totalIssues} issue(s) to investigate.`
);

// ─── Utilities ──────────────────────────────────────────────────────

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function findFirstDivergence(ours, theirs) {
  for (let i = 0; i < Math.min(ours.length, theirs.length); i++) {
    if (ours[i] !== theirs[i]) return { index: i, ours: ours[i], theirs: theirs[i] };
  }
  return { index: Math.min(ours.length, theirs.length) };
}
