import * as d3 from 'd3';

// ─── Line colours ───────────────────────────────────────────────────
const LINE_COLORS = {
  1: '#FFCE00', 2: '#003CA6', 3: '#837902', '3bis': '#6EC4E8',
  4: '#CF009E', 5: '#FF7E2E', 6: '#6ECA97', 7: '#FA9ABA',
  '7bis': '#6ECA97', 8: '#E19BDF', 9: '#B6BD00', 10: '#C9910D',
  11: '#704B1C', 12: '#007852', 13: '#6EC4E8', 14: '#62259D',
};

const LINE_ORDER = [1, 2, 3, '3bis', 4, 5, 6, 7, '7bis', 8, 9, 10, 11, 12, 13, 14];

const CATEGORIES = [
  { id: 'battle', label: 'Battles' },
  { id: 'ruler', label: 'Rulers' },
  { id: 'politician', label: 'Politicians' },
  { id: 'military', label: 'Military' },
  { id: 'writer', label: 'Writers' },
  { id: 'artist', label: 'Artists' },
  { id: 'scientist', label: 'Scientists' },
  { id: 'religion', label: 'Religion' },
  { id: 'institution', label: 'Institutions' },
  { id: 'geographic', label: 'Geographic' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'trade', label: 'Trade' },
  { id: 'foreign', label: 'Foreign' },
  { id: 'street', label: 'Streets' },
];

// ─── State ──────────────────────────────────────────────────────────
const state = {
  stations: [],
  activeLines: new Set(),
  activeCategories: new Set(),
  timelineYear: 2026,
  selectedStation: null,
  playing: false,
  playTimer: null,
};

// ─── Projection: geo → SVG coordinates ──────────────────────────────
// We use a Mercator-like projection fitted to the Paris metro extent
let projection;
let svgWidth, svgHeight;

function setupProjection(stations) {
  const lats = stations.map(s => s.latitude).filter(Boolean);
  const lngs = stations.map(s => s.longitude).filter(Boolean);
  const pad = 0.005;

  const latMin = d3.min(lats) - pad, latMax = d3.max(lats) + pad;
  const lngMin = d3.min(lngs) - pad, lngMax = d3.max(lngs) + pad;

  // Correct for longitude compression at Paris's latitude (~48.85°)
  const cosLat = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);

  // Geographic extent in equalised units (degrees × cosLat for lng)
  const geoW = (lngMax - lngMin) * cosLat;
  const geoH = latMax - latMin;

  const container = document.getElementById('map-container');
  svgWidth = container.clientWidth;
  svgHeight = container.clientHeight;

  const padding = 40;
  const availW = svgWidth - 2 * padding;
  const availH = svgHeight - 2 * padding;

  // Single scale so the map is never warped — fill the window (may exceed bounds)
  const scale = Math.max(availW / geoW, availH / geoH);

  // Centre the map in the available space
  const offX = padding + (availW - geoW * scale) / 2;
  const offY = padding + (availH - geoH * scale) / 2;

  projection = (station) => {
    if (!station.latitude || !station.longitude) return null;
    return [
      offX + (station.longitude - lngMin) * cosLat * scale,
      offY + (latMax - station.latitude) * scale,
    ];
  };
}

// ─── Tooltip ────────────────────────────────────────────────────────
function createTooltip() {
  const tt = document.createElement('div');
  tt.id = 'tooltip';
  tt.innerHTML = '<div class="tt-name"></div><div class="tt-lines"></div><div class="tt-year"></div>';
  document.body.appendChild(tt);
  return tt;
}

function showTooltip(tt, station, event) {
  tt.querySelector('.tt-name').textContent = station.name;
  tt.querySelector('.tt-lines').textContent = 'Line ' + station.lines.join(', ');
  tt.querySelector('.tt-year').textContent = 'Opened ' + (station.opening ? station.opening.slice(0, 4) : '?');
  tt.style.left = (event.clientX + 12) + 'px';
  tt.style.top = (event.clientY - 10) + 'px';
  tt.classList.add('visible');
}

function hideTooltip(tt) {
  tt.classList.remove('visible');
}

// ─── Line paths (connect stations on same line) ─────────────────────
// Uses nearest-neighbor traversal from a terminus to capture true station
// order, then splits at large jumps to handle Y-shaped branches (L7, L13).
function buildLinePaths(stations) {
  const result = {};

  for (const line of LINE_ORDER) {
    const sts = stations
      .filter(s => s.lines.includes(line))
      .map(s => ({ ...s, pos: projection(s) }))
      .filter(s => s.pos);

    if (sts.length < 2) { result[line] = [sts]; continue; }

    // Pick a terminus: the station farthest from the centroid
    const cx = d3.mean(sts, s => s.pos[0]);
    const cy = d3.mean(sts, s => s.pos[1]);
    let maxDist = -1, startIdx = 0;
    sts.forEach((s, i) => {
      const d = Math.hypot(s.pos[0] - cx, s.pos[1] - cy);
      if (d > maxDist) { maxDist = d; startIdx = i; }
    });

    // Nearest-neighbor chain from the terminus
    const ordered = [sts[startIdx]];
    const visited = new Set([startIdx]);
    const stepDists = [];

    while (ordered.length < sts.length) {
      const last = ordered[ordered.length - 1];
      let bestDist = Infinity, bestIdx = -1;
      sts.forEach((s, i) => {
        if (visited.has(i)) return;
        const d = Math.hypot(s.pos[0] - last.pos[0], s.pos[1] - last.pos[1]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      if (bestIdx === -1) break;
      visited.add(bestIdx);
      ordered.push(sts[bestIdx]);
      stepDists.push(bestDist);
    }

    // Split into segments at large jumps (Y-branch detection)
    const sortedDists = [...stepDists].sort((a, b) => a - b);
    const median = sortedDists[Math.floor(sortedDists.length / 2)];
    const threshold = median * 3;

    const segments = [];
    let seg = [ordered[0]];

    for (let i = 0; i < stepDists.length; i++) {
      if (stepDists[i] > threshold) {
        segments.push(seg);
        // Connect new branch back to closest station in previous segments
        const next = ordered[i + 1];
        let closest = null, closestDist = Infinity;
        for (const prev of segments) {
          for (const s of prev) {
            const d = Math.hypot(s.pos[0] - next.pos[0], s.pos[1] - next.pos[1]);
            if (d < closestDist) { closestDist = d; closest = s; }
          }
        }
        seg = closest ? [closest, next] : [next];
      } else {
        seg.push(ordered[i + 1]);
      }
    }
    segments.push(seg);

    result[line] = segments;
  }
  return result;
}

const lineGen = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveCatmullRom.alpha(0.5));

function drawLinePaths(stations) {
  gLines.selectAll('.line-path').remove();
  const lineStations = buildLinePaths(stations);
  for (const [line, segments] of Object.entries(lineStations)) {
    for (const seg of segments) {
      if (seg.length < 2) continue;
      gLines.append('path')
        .attr('class', 'line-path')
        .attr('data-line', line)
        .attr('d', lineGen(seg.map(s => s.pos)))
        .attr('stroke', LINE_COLORS[line] || '#666')
        .attr('stroke-width', 2.5)
        .attr('opacity', 0.6);
    }
  }
}

// ─── Seine river path ───────────────────────────────────────────────
// Waypoints tracing the Seine through the Paris metro area (SE → NW)
const SEINE_COORDS = [
  [48.811, 2.420], [48.821, 2.405], [48.833, 2.385], [48.840, 2.375],
  [48.845, 2.365], [48.850, 2.356], [48.854, 2.347], [48.857, 2.341],
  [48.860, 2.333], [48.862, 2.323], [48.863, 2.314], [48.863, 2.304],
  [48.863, 2.296], [48.860, 2.289], [48.855, 2.285], [48.849, 2.278],
  [48.843, 2.268], [48.839, 2.256], [48.835, 2.242], [48.836, 2.230],
  [48.842, 2.224], [48.850, 2.220], [48.860, 2.222], [48.870, 2.234],
  [48.880, 2.252], [48.888, 2.270], [48.894, 2.295], [48.900, 2.320],
  [48.912, 2.345], [48.930, 2.365],
];

function drawSeine(gRiver) {
  gRiver.selectAll('.seine').remove();
  const pts = SEINE_COORDS
    .map(([lat, lng]) => projection({ latitude: lat, longitude: lng }))
    .filter(Boolean);
  if (pts.length < 2) return;
  gRiver.append('path')
    .attr('class', 'seine')
    .attr('d', lineGen(pts))
    .attr('fill', 'none')
    .attr('stroke', 'rgba(80, 140, 210, 0.15)')
    .attr('stroke-width', 18)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round');
}

// ─── Filter logic ───────────────────────────────────────────────────
function isActive(station) {
  const lineMatch = state.activeLines.size === 0 ||
    station.lines.some(l => state.activeLines.has(String(l)));
  const catMatch = state.activeCategories.size === 0 ||
    station.categories.some(c => state.activeCategories.has(c));
  const yearMatch = !station.openingYear || station.openingYear <= state.timelineYear;
  return lineMatch && catMatch && yearMatch;
}

// ─── Render / update ────────────────────────────────────────────────
let svg, gLines, gStations, gLabels, tooltip, zoom;

function initMap(stations) {
  setupProjection(stations);
  tooltip = createTooltip();

  const container = d3.select('#map-container');
  svg = container.select('#metro-map')
    .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const gMain = svg.append('g').attr('class', 'main-group');
  const gRiver = gMain.append('g').attr('class', 'river');
  gLines = gMain.append('g').attr('class', 'lines');
  gStations = gMain.append('g').attr('class', 'stations');
  gLabels = gMain.append('g').attr('class', 'labels');

  drawSeine(gRiver);

  // Zoom
  zoom = d3.zoom()
    .scaleExtent([0.5, 12])
    .on('zoom', (event) => {
      gMain.attr('transform', event.transform);
      // Scale labels inversely to maintain readability
      gLabels.selectAll('.station-label')
        .attr('font-size', Math.max(2, 3.5 / event.transform.k) + 'px');
      gStations.selectAll('.station-dot')
        .attr('r', Math.max(1.5, 3 / event.transform.k));
    });
  svg.call(zoom);

  // Draw line paths
  drawLinePaths(stations);

  // Draw station dots
  const stationsWithPos = stations.filter(s => projection(s));

  gStations.selectAll('.station-dot')
    .data(stationsWithPos, d => d.slug)
    .join('circle')
    .attr('class', 'station-dot')
    .attr('cx', d => projection(d)[0])
    .attr('cy', d => projection(d)[1])
    .attr('r', 3)
    .attr('fill', d => {
      const mainLine = d.lines[0];
      return LINE_COLORS[mainLine] || '#fff';
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.5)
    .on('mouseenter', function(event, d) {
      showTooltip(tooltip, d, event);
      d3.select(this).attr('r', 5);
    })
    .on('mousemove', (event, d) => {
      tooltip.style.left = (event.clientX + 12) + 'px';
      tooltip.style.top = (event.clientY - 10) + 'px';
    })
    .on('mouseleave', function() {
      hideTooltip(tooltip);
      const k = d3.zoomTransform(svg.node()).k;
      d3.select(this).attr('r', Math.max(1.5, 3 / k));
    })
    .on('click', (event, d) => {
      event.stopPropagation();
      selectStation(d);
    });

  // Draw labels
  gLabels.selectAll('.station-label')
    .data(stationsWithPos, d => d.slug)
    .join('text')
    .attr('class', 'station-label')
    .attr('x', d => projection(d)[0] + 4)
    .attr('y', d => projection(d)[1] + 1)
    .text(d => d.name)
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      event.stopPropagation();
      selectStation(d);
    })
    .on('mouseenter', function() { d3.select(this).attr('text-decoration', 'underline'); })
    .on('mouseleave', function() { d3.select(this).attr('text-decoration', 'none'); });

  // Click on background to deselect
  svg.on('click', () => selectStation(null));

  // Centre on Île de la Cité
  const ileCenter = projection({ latitude: 48.854, longitude: 2.347 });
  if (ileCenter) {
    const initialTransform = d3.zoomIdentity
      .translate(svgWidth / 2 - ileCenter[0], svgHeight / 2 - ileCenter[1]);
    svg.call(zoom.transform, initialTransform);
  }
}

function render() {
  const activeCount = state.stations.filter(s => isActive(s)).length;
  document.getElementById('station-count').textContent =
    `${activeCount} of ${state.stations.length} stations`;

  // Update station dots
  gStations.selectAll('.station-dot')
    .transition().duration(300)
    .attr('opacity', d => isActive(d) ? 1 : 0.08);

  // Update labels
  gLabels.selectAll('.station-label')
    .transition().duration(300)
    .attr('opacity', d => isActive(d) ? 1 : 0);

  // Update line paths
  gLines.selectAll('.line-path').each(function() {
    const line = d3.select(this).attr('data-line');
    const active = state.activeLines.size === 0 || state.activeLines.has(line);
    d3.select(this)
      .transition().duration(300)
      .attr('opacity', active ? 0.6 : 0.06);
  });
}

// ─── Controls ───────────────────────────────────────────────────────
function initControls(stations) {
  // Line filter buttons
  const lineFilter = d3.select('#line-filter');
  LINE_ORDER.forEach(line => {
    const label = String(line);
    lineFilter.append('button')
      .attr('class', 'line-btn')
      .attr('data-line', label)
      .style('background-color', LINE_COLORS[line])
      .style('color', [1, 9].includes(line) ? '#000' : '#fff')
      .text(label)
      .on('click', function() {
        const btn = d3.select(this);
        if (state.activeLines.has(label)) {
          state.activeLines.delete(label);
          btn.classed('active', false);
        } else {
          state.activeLines.add(label);
          btn.classed('active', true);
        }
        render();
      });
  });

  // Category filter buttons
  const catFilter = d3.select('#category-filter');
  CATEGORIES.forEach(cat => {
    catFilter.append('button')
      .attr('class', 'cat-btn')
      .attr('data-cat', cat.id)
      .text(cat.label)
      .on('click', function() {
        const btn = d3.select(this);
        if (state.activeCategories.has(cat.id)) {
          state.activeCategories.delete(cat.id);
          btn.classed('active', false);
        } else {
          state.activeCategories.add(cat.id);
          btn.classed('active', true);
        }
        render();
      });
  });

  // Timeline slider
  const slider = document.getElementById('year-slider');
  const yearLabel = document.getElementById('year-label');
  slider.addEventListener('input', () => {
    state.timelineYear = parseInt(slider.value);
    yearLabel.textContent = state.timelineYear;
    render();
  });

  // Play button
  const playBtn = document.getElementById('play-btn');
  playBtn.addEventListener('click', () => {
    if (state.playing) {
      stopPlay();
    } else {
      startPlay();
    }
  });

  // Search
  const searchInput = document.getElementById('search');
  const searchResults = document.getElementById('search-results');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (q.length < 2) {
      searchResults.classList.remove('open');
      return;
    }
    const matches = stations
      .filter(s => s.name.toLowerCase().includes(q))
      .slice(0, 10);
    searchResults.innerHTML = matches.map(s =>
      `<div class="search-item" data-slug="${s.slug}">
        ${s.name}
        <span class="lines-badge">${s.lines.map(l => 'L' + l).join(' ')}</span>
      </div>`
    ).join('');
    searchResults.classList.add('open');

    searchResults.querySelectorAll('.search-item').forEach(el => {
      el.addEventListener('click', () => {
        const slug = el.dataset.slug;
        const station = stations.find(s => s.slug === slug);
        if (station) {
          selectStation(station);
          searchInput.value = '';
          searchResults.classList.remove('open');
          panToStation(station);
        }
      });
    });
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => searchResults.classList.remove('open'), 200);
  });
}

function startPlay() {
  state.playing = true;
  document.getElementById('play-btn').classList.add('playing');
  document.getElementById('play-btn').innerHTML = '&#9646;&#9646;';

  const slider = document.getElementById('year-slider');
  if (state.timelineYear >= 2026) {
    state.timelineYear = 1900;
    slider.value = 1900;
  }

  state.playTimer = setInterval(() => {
    state.timelineYear++;
    slider.value = state.timelineYear;
    document.getElementById('year-label').textContent = state.timelineYear;
    render();
    if (state.timelineYear >= 2026) {
      stopPlay();
    }
  }, 80);
}

function stopPlay() {
  state.playing = false;
  clearInterval(state.playTimer);
  document.getElementById('play-btn').classList.remove('playing');
  document.getElementById('play-btn').innerHTML = '&#9654;';
}

function panToStation(station) {
  const pos = projection(station);
  if (!pos) return;

  const transform = d3.zoomTransform(svg.node());
  const scale = Math.max(transform.k, 3);

  svg.transition().duration(600)
    .call(zoom.transform,
      d3.zoomIdentity
        .translate(svgWidth / 2, svgHeight / 2)
        .scale(scale)
        .translate(-pos[0], -pos[1])
    );
}

// ─── Sidebar ────────────────────────────────────────────────────────
function selectStation(station) {
  state.selectedStation = station;
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebar-content');

  if (!station) {
    sidebar.classList.add('hidden');
    // Remove highlight
    gStations.selectAll('.station-dot')
      .attr('stroke-width', 0.5)
      .attr('stroke', '#fff');
    return;
  }

  // Highlight selected station
  gStations.selectAll('.station-dot')
    .attr('stroke-width', d => d.slug === station.slug ? 2 : 0.5)
    .attr('stroke', d => d.slug === station.slug ? '#fff' : '#fff');

  const linesBadges = station.lines.map(l =>
    `<span class="detail-line-badge" style="background:${LINE_COLORS[l] || '#666'};${[1, 9].includes(l) ? 'color:#000' : ''}">${l}</span>`
  ).join('');

  const priorNames = station.prior_names && station.prior_names.length > 0
    ? `<div class="detail-prior-names">
        <h3>Previous names</h3>
        ${station.prior_names.map(p => `<div class="prior-name-item">${p.name} (until ${p.until})</div>`).join('')}
      </div>`
    : '';

  const layoutLink = station.layout_image
    ? `<a class="layout-link" href="http://estacions.albertguillaumes.cat/img/paris/${station.layout_image}.png" target="_blank" rel="noopener">View station layout diagram &rarr;</a>`
    : '';

  content.innerHTML = `
    <h2>${station.name}</h2>
    <div class="detail-lines">${linesBadges}</div>
    <div class="detail-meta">
      Opened: ${station.opening || 'Unknown'}<br>
      ${station.arrondissement ? station.arrondissement : ''}
    </div>
    <div class="detail-categories">${station.categories.map(c => `<span class="detail-category">${c}</span>`).join(' ')}</div>
    <div class="detail-etymology">${station.etymology}</div>
    ${priorNames}
    ${layoutLink}
  `;

  sidebar.classList.remove('hidden');
}

document.getElementById('sidebar-close').addEventListener('click', () => {
  selectStation(null);
});

// ─── Init ───────────────────────────────────────────────────────────
async function init() {
  const resp = await fetch(import.meta.env.BASE_URL + 'stations.json');
  const stations = await resp.json();
  state.stations = stations;

  initMap(stations);
  initControls(stations);
  render();

  // Handle resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setupProjection(stations);
      svg.attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
      // Re-position elements
      gStations.selectAll('.station-dot')
        .attr('cx', d => projection(d)?.[0])
        .attr('cy', d => projection(d)?.[1]);
      gLabels.selectAll('.station-label')
        .attr('x', d => (projection(d)?.[0] || 0) + 4)
        .attr('y', d => (projection(d)?.[1] || 0) + 1);
      // Rebuild river and line paths
      drawSeine(svg.select('.river'));
      drawLinePaths(stations);
    }, 200);
  });
}

init();
