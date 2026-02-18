import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ─── Load station data ──────────────────────────────────────────────
const stations = JSON.parse(readFileSync(join(root, 'data/stations.json'), 'utf-8'));
const bySlug = new Map(stations.map(s => [s.slug, s]));

// ─── Extract LINE_STATION_ORDER from app.js ─────────────────────────
// The object is a plain data literal (no function calls), so we can
// extract and evaluate it safely.
const appJs = readFileSync(join(root, 'app.js'), 'utf-8');
const match = appJs.match(/const LINE_STATION_ORDER\s*=\s*(\{[\s\S]*?\n\};)/);
if (!match) throw new Error('Could not find LINE_STATION_ORDER in app.js');
const LINE_STATION_ORDER = eval('(' + match[1].replace(/;$/, '') + ')');

// Also extract LINE_ORDER for completeness
const lineOrderMatch = appJs.match(/const LINE_ORDER\s*=\s*(\[.*?\]);/);
const LINE_ORDER = eval(lineOrderMatch[1]);

// ─── Helper: normalize line keys to strings ─────────────────────────
function lineStr(l) { return String(l); }

// ─── Tests ──────────────────────────────────────────────────────────

describe('LINE_STATION_ORDER coverage', () => {
  it('has an entry for every line in LINE_ORDER', () => {
    for (const line of LINE_ORDER) {
      assert.ok(
        LINE_STATION_ORDER[lineStr(line)],
        `LINE_STATION_ORDER is missing line ${line}`
      );
    }
  });

  it('has no entries for lines not in LINE_ORDER', () => {
    for (const key of Object.keys(LINE_STATION_ORDER)) {
      const found = LINE_ORDER.some(l => lineStr(l) === key);
      assert.ok(found, `LINE_STATION_ORDER has unexpected line key "${key}"`);
    }
  });
});

describe('Every station slug in LINE_STATION_ORDER exists in station data', () => {
  for (const [line, segments] of Object.entries(LINE_STATION_ORDER)) {
    for (const seg of segments) {
      for (const slug of seg) {
        it(`Line ${line}: "${slug}" exists in station data`, () => {
          assert.ok(bySlug.has(slug), `Station "${slug}" (Line ${line}) not found in data`);
        });
      }
    }
  }
});

describe('LINE_STATION_ORDER → station.lines consistency', () => {
  // If a station appears in LINE_STATION_ORDER for line X, its `lines`
  // array should include X.
  for (const [line, segments] of Object.entries(LINE_STATION_ORDER)) {
    const lineVal = line.includes('bis') ? line : Number(line);
    // Collect unique slugs across all segments (branches share endpoints)
    const slugs = [...new Set(segments.flat())];
    for (const slug of slugs) {
      const station = bySlug.get(slug);
      if (!station) continue; // covered by existence test above
      it(`Line ${line}: "${station.name}" should list line ${line} in its lines`, () => {
        const hasLine = station.lines.some(l => lineStr(l) === lineStr(lineVal));
        assert.ok(
          hasLine,
          `"${station.name}" (${slug}) is in LINE_STATION_ORDER for line ${line} ` +
          `but its lines are [${station.lines}]`
        );
      });
    }
  }
});

describe('station.lines → LINE_STATION_ORDER consistency', () => {
  // If a station's `lines` array includes X, it should appear in
  // LINE_STATION_ORDER for line X.
  for (const station of stations) {
    for (const line of station.lines) {
      it(`"${station.name}" (line ${line}) should appear in LINE_STATION_ORDER[${line}]`, () => {
        const segments = LINE_STATION_ORDER[lineStr(line)];
        assert.ok(segments, `LINE_STATION_ORDER has no entry for line ${line}`);
        const allSlugs = segments.flat();
        assert.ok(
          allSlugs.includes(station.slug),
          `"${station.name}" (${station.slug}) lists line ${line} but is not in LINE_STATION_ORDER[${line}]`
        );
      });
    }
  }
});
