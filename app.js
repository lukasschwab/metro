import * as d3 from 'd3';
import 'ninja-keys';

// ─── Line colours ───────────────────────────────────────────────────
const LINE_COLORS = {
  1: '#FFCE00', 2: '#003CA6', 3: '#837902', '3bis': '#6EC4E8',
  4: '#CF009E', 5: '#FF7E2E', 6: '#6ECA97', 7: '#FA9ABA',
  '7bis': '#6ECA97', 8: '#E19BDF', 9: '#B6BD00', 10: '#C9910D',
  11: '#704B1C', 12: '#007852', 13: '#6EC4E8', 14: '#62259D',
};

const LINE_ORDER = [1, 2, 3, '3bis', 4, 5, 6, 7, '7bis', 8, 9, 10, 11, 12, 13, 14];

// ─── Explicit station order per line ─────────────────────────────────
// Each line maps to an array of segments (arrays of station slugs).
// Most lines have one segment; lines with branches/loops have multiple.
// Stations not found in the data for a given line are silently skipped.
const LINE_STATION_ORDER = {
  1: [['la-defense', 'esplanade-de-la-defense', 'pont-de-neuilly', 'les-sablons', 'porte-maillot', 'argentine', 'charles-de-gaulle-etoile', 'george-v', 'franklin-d-roosevelt', 'champs-elysees-clemenceau', 'concorde', 'tuileries', 'palais-royal-musee-du-louvre', 'louvre-rivoli', 'chatelet', 'hotel-de-ville', 'saint-paul', 'bastille', 'gare-de-lyon', 'reuilly-diderot', 'nation', 'porte-de-vincennes', 'saint-mande', 'berault', 'chateau-de-vincennes']],

  2: [['porte-dauphine', 'victor-hugo', 'charles-de-gaulle-etoile', 'ternes', 'courcelles', 'monceau', 'villiers', 'rome', 'place-de-clichy', 'blanche', 'pigalle', 'anvers', 'barbes-rochechouart', 'la-chapelle', 'stalingrad', 'jaures', 'colonel-fabien', 'belleville', 'couronnes', 'menilmontant', 'pere-lachaise', 'philippe-auguste', 'alexandre-dumas', 'avron', 'nation']],

  3: [['pont-de-levallois-becon', 'anatole-france', 'louise-michel', 'porte-de-champerret', 'pereire', 'wagram', 'malesherbes', 'villiers', 'europe', 'saint-lazare', 'havre-caumartin', 'opera', 'quatre-septembre', 'bourse', 'sentier', 'reaumur-sebastopol', 'arts-et-metiers', 'temple', 'republique', 'parmentier', 'rue-saint-maur', 'pere-lachaise', 'gambetta', 'porte-de-bagnolet', 'gallieni']],

  '3bis': [['gambetta', 'pelleport', 'saint-fargeau', 'porte-des-lilas']],

  4: [['porte-de-clignancourt', 'simplon', 'marcadet-poissonniers', 'chateau-rouge', 'barbes-rochechouart', 'gare-du-nord', 'gare-de-lest', 'chateau-deau', 'strasbourg-saint-denis', 'reaumur-sebastopol', 'etienne-marcel', 'chatelet', 'cite', 'saint-michel', 'odeon', 'saint-germain-des-pres', 'saint-sulpice', 'saint-placide', 'montparnasse-bienvenue', 'vavin', 'raspail', 'denfert-rochereau', 'mouton-duvernet', 'alesia', 'porte-dorleans', 'mairie-de-montrouge', 'barbara']],

  5: [['bobigny-pablo-picasso', 'bobigny-pantin-raymond-queneau', 'eglise-de-pantin', 'hoche', 'porte-de-pantin', 'ourcq', 'laumiere', 'jaures', 'stalingrad', 'gare-du-nord', 'gare-de-lest', 'jacques-bonsergent', 'republique', 'oberkampf', 'richard-lenoir', 'breguet-sabin', 'bastille', 'quai-de-la-rapee', 'gare-dausterlitz', 'saint-marcel', 'campo-formio', 'place-ditalie']],

  6: [['charles-de-gaulle-etoile', 'kleber', 'boissiere', 'trocadero', 'passy', 'bir-hakeim', 'dupleix', 'la-motte-picquet-grenelle', 'cambronne', 'sevres-lecourbe', 'pasteur', 'montparnasse-bienvenue', 'edgar-quinet', 'raspail', 'denfert-rochereau', 'saint-jacques', 'glaciere', 'corvisart', 'place-ditalie', 'nationale', 'chevaleret', 'quai-de-la-gare', 'bercy', 'dugommier', 'daumesnil', 'bel-air', 'picpus', 'nation']],

  7: [['la-courneuve-8-mai-1945', 'fort-daubervilliers', 'aubervilliers-pantin-quatre-chemins', 'porte-de-la-villette', 'corentin-cariou', 'crimee', 'riquet', 'stalingrad', 'louis-blanc', 'chateau-landon', 'gare-de-lest', 'poissonniere', 'cadet', 'le-peletier', 'chaussee-dantin-la-fayette', 'opera', 'pyramides', 'palais-royal-musee-du-louvre', 'pont-neuf', 'chatelet', 'pont-marie', 'sully-morland', 'jussieu', 'place-monge', 'censier-daubenton', 'les-gobelins', 'place-ditalie', 'tolbiac', 'maison-blanche', 'le-kremlin-bicetre', 'villejuif-leo-lagrange', 'villejuif-paul-vaillant-couturier', 'villejuif-louis-aragon']],

  '7bis': [
    // Main line + one side of loop
    ['louis-blanc', 'jaures', 'bolivar', 'buttes-chaumont', 'botzaris', 'place-des-fetes', 'pre-saint-gervais'],
    // Loop return via Danube
    ['pre-saint-gervais', 'danube', 'botzaris'],
  ],

  8: [['balard', 'lourmel', 'boucicaut', 'felix-faure', 'commerce', 'la-motte-picquet-grenelle', 'ecole-militaire', 'la-tour-maubourg', 'invalides', 'concorde', 'madeleine', 'opera', 'richelieu-drouot', 'grands-boulevards', 'bonne-nouvelle', 'strasbourg-saint-denis', 'republique', 'filles-du-calvaire', 'saint-sebastien-froissart', 'chemin-vert', 'bastille', 'ledru-rollin', 'faidherbe-chaligny', 'reuilly-diderot', 'montgallet', 'daumesnil', 'michel-bizot', 'porte-doree', 'porte-de-charenton', 'liberte', 'charenton-ecoles', 'ecole-veterinaire-de-maisons-alfort', 'maisons-alfort-stade', 'maisons-alfort-les-juilliottes', 'creteil-lechat', 'creteil-universite', 'creteil-prefecture', 'pointe-du-lac']],

  9: [['pont-de-sevres', 'billancourt', 'marcel-sembat', 'porte-de-saint-cloud', 'exelmans', 'michel-ange-molitor', 'michel-ange-auteuil', 'jasmin', 'ranelagh', 'la-muette', 'rue-de-la-pompe', 'trocadero', 'iena', 'alma-marceau', 'franklin-d-roosevelt', 'saint-philippe-du-roule', 'miromesnil', 'saint-augustin', 'havre-caumartin', 'chaussee-dantin-la-fayette', 'richelieu-drouot', 'grands-boulevards', 'bonne-nouvelle', 'strasbourg-saint-denis', 'republique', 'oberkampf', 'saint-ambroise', 'voltaire', 'charonne', 'rue-des-boulets', 'nation', 'buzenval', 'maraichers', 'porte-de-montreuil', 'robespierre', 'croix-de-chavaux', 'mairie-de-montreuil']],

  10: [
    // Main route (eastbound)
    ['boulogne-pont-de-saint-cloud', 'boulogne-jean-jaures', 'michel-ange-molitor', 'chardon-lagache', 'mirabeau', 'javel-andre-citroen', 'charles-michels', 'avenue-emile-zola', 'la-motte-picquet-grenelle', 'segur', 'duroc', 'vaneau', 'sevres-babylone', 'mabillon', 'odeon', 'cluny-la-sorbonne', 'maubert-mutualite', 'cardinal-lemoine', 'jussieu', 'gare-dausterlitz'],
    // Auteuil branch (loop between Boulogne-JJ and Javel)
    ['boulogne-jean-jaures', 'porte-dauteuil', 'michel-ange-auteuil', 'eglise-dauteuil', 'javel-andre-citroen'],
  ],

  11: [['chatelet', 'hotel-de-ville', 'rambuteau', 'arts-et-metiers', 'republique', 'goncourt', 'belleville', 'pyrenees', 'jourdain', 'place-des-fetes', 'telegraphe', 'porte-des-lilas', 'mairie-des-lilas', 'serge-gainsbourg', 'romainville-carnot', 'montreuil-hopital', 'la-dhuys', 'rosny-bois-perrier']],

  12: [['mairie-dissy', 'corentin-celton', 'porte-de-versailles', 'convention', 'vaugirard', 'volontaires', 'pasteur', 'falguiere', 'montparnasse-bienvenue', 'notre-dame-des-champs', 'rennes', 'sevres-babylone', 'rue-du-bac', 'solferino', 'assemblee-nationale', 'concorde', 'madeleine', 'saint-lazare', 'trinite-destienne-dorves', 'notre-dame-de-lorette', 'saint-georges', 'pigalle', 'abbesses', 'lamarck-caulaincourt', 'jules-joffrin', 'marcadet-poissonniers', 'marx-dormoy', 'porte-de-la-chapelle', 'front-populaire', 'aime-cesaire']],

  13: [
    // Main trunk (south to La Fourche)
    ['chatillon-montrouge', 'malakoff-rue-etienne-dolet', 'malakoff-plateau-de-vanves', 'porte-de-vanves', 'plaisance', 'pernety', 'gaite', 'montparnasse-bienvenue', 'duroc', 'saint-francois-xavier', 'varenne', 'invalides', 'champs-elysees-clemenceau', 'miromesnil', 'saint-lazare', 'liege', 'place-de-clichy', 'la-fourche'],
    // Saint-Denis branch (northeast)
    ['la-fourche', 'guy-moquet', 'porte-de-saint-ouen', 'garibaldi', 'mairie-de-saint-ouen', 'carrefour-pleyel', 'saint-denis-porte-de-paris', 'basilique-de-saint-denis'],
    // Les Courtilles branch (northwest)
    ['la-fourche', 'brochant', 'porte-de-clichy', 'gabriel-peri', 'les-agnettes', 'les-courtilles'],
  ],

  14: [['aeroport-dorly', 'thiais-orly', 'chevilly-larue', 'villejuif-gustave-roussy', 'hopital-bicetre', 'maison-blanche', 'olympiades', 'bibliotheque-francois-mitterrand', 'cour-saint-emilion', 'bercy', 'gare-de-lyon', 'chatelet', 'pyramides', 'madeleine', 'saint-lazare', 'pont-cardinet', 'porte-de-clichy', 'mairie-de-saint-ouen', 'saint-denis-pleyel']],
};

const CATEGORIES = [
  { id: 'government', label: 'Government' },
  { id: 'military', label: 'Military' },
  { id: 'writer', label: 'Writers' },
  { id: 'artist', label: 'Artists' },
  { id: 'scientist', label: 'Scientists' },
  { id: 'religion', label: 'Religion' },
  { id: 'institution', label: 'Institutions' },
  { id: 'place', label: 'Places' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'trade', label: 'Trade' },
  { id: 'foreign', label: 'Foreign' },
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
  view: new URLSearchParams(window.location.search).get('view') === 'table' ? 'table' : 'map',
  tableSort: { col: 'name', dir: 'asc' },
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
// Uses explicit station ordering from LINE_STATION_ORDER. Each line has
// one or more segments (branches/loops have multiple). Stations listed
// in the order but missing from the data are silently skipped.
function buildLinePaths(stations) {
  const bySlug = new Map(stations.map(s => [s.slug, s]));
  const result = {};

  for (const line of LINE_ORDER) {
    const segments = LINE_STATION_ORDER[line];
    if (!segments) { result[line] = []; continue; }

    result[line] = segments.map(slugs => {
      return slugs
        .map(slug => {
          const s = bySlug.get(slug);
          if (!s) return null;
          // Verify this station is actually on this line (or allow shared
          // stations that appear as segment endpoints for branches)
          const pos = projection(s);
          if (!pos) return null;
          return { ...s, pos };
        })
        .filter(Boolean);
    }).filter(seg => seg.length >= 2);
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

// ─── View toggle ────────────────────────────────────────────────────
function toggleView(view) {
  state.view = view;
  document.getElementById('map-container').classList.toggle('hidden', view === 'table');
  document.getElementById('table-container').classList.toggle('hidden', view === 'map');
  document.getElementById('sidebar').classList.toggle('hidden', view === 'table');

  const link = document.getElementById('view-toggle');
  if (view === 'table') {
    link.textContent = 'Map';
    link.href = '?view=map';
  } else {
    link.textContent = 'Table';
    link.href = '?view=table';
  }

  history.replaceState(null, '', view === 'map' ? window.location.pathname : '?view=table');
  render();
}

function updateSortHeaders() {
  document.querySelectorAll('#station-table th[data-sort]').forEach(th => {
    const col = th.dataset.sort;
    const arrow = col === state.tableSort.col
      ? (state.tableSort.dir === 'asc' ? ' \u25B4' : ' \u25BE')
      : '';
    th.textContent = th.dataset.label + arrow;
  });
}

function renderTable() {
  const tbody = document.querySelector('#station-table tbody');
  const active = state.stations.filter(s => isActive(s));

  const { col, dir } = state.tableSort;
  const m = dir === 'asc' ? 1 : -1;
  // Stable name sort as baseline
  active.sort((a, b) => a.name.localeCompare(b.name));
  if (col === 'opened') {
    active.sort((a, b) => m * ((a.opening || '') < (b.opening || '') ? -1 : (a.opening || '') > (b.opening || '') ? 1 : 0));
  } else if (col === 'lines') {
    active.sort((a, b) => m * (a.lines.length - b.lines.length));
  } else {
    active.sort((a, b) => m * a.name.localeCompare(b.name));
  }

  updateSortHeaders();

  tbody.innerHTML = active.map(s => {
    const lineDots = s.lines.map(l =>
      `<span class="list-line-dot" style="background:${LINE_COLORS[l] || '#666'}"></span>`
    ).join('');
    const cats = s.categories.map(c => `<span class="detail-category">${c}</span>`).join(' ');
    const year = s.opening ? s.opening.slice(0, 4) : '?';

    const layoutLink = s.layout_image
      ? ` <a class="table-layout-link" href="http://estacions.albertguillaumes.cat/img/paris/${s.layout_image}.png" target="_blank" rel="noopener">Station layout &rarr;</a>`
      : '';

    return `<tr class="station-row" data-slug="${s.slug}">
        <td class="expand-arrow">&#9656;</td>
        <td>${s.name}</td>
        <td><span class="list-lines">${lineDots}</span></td>
        <td>${year}</td>
        <td class="arr-col">${s.arrondissement || ''}</td>
        <td>${cats}</td>
      </tr>
      <tr class="station-detail" data-slug="${s.slug}">
        <td colspan="6"><div class="detail-inner">
          <div class="detail-etymology">${s.etymology}${layoutLink}</div>
        </div></td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.station-row').forEach(row => {
    row.addEventListener('click', () => {
      const slug = row.dataset.slug;
      const detail = tbody.querySelector(`.station-detail[data-slug="${slug}"]`);
      const isOpen = detail.classList.toggle('open');
      row.querySelector('.expand-arrow').innerHTML = isOpen ? '&#9662;' : '&#9656;';
    });
  });
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
      if (d.lines.length > 1) return '#fff';
      return LINE_COLORS[d.lines[0]] || '#fff';
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

  // Update sidebar station list (if no station selected)
  renderSidebarList();

  if (state.view === 'table') {
    renderTable();
  }
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
      .style('color', [1, '3bis', 5, 6, 7, '7bis', 8, 9, 10, 13].includes(line) ? '#000' : '#fff')
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
  const closeBtn = document.getElementById('sidebar-close');

  // Remove highlight
  gStations.selectAll('.station-dot')
    .attr('stroke-width', d => station && d.slug === station.slug ? 2 : 0.5)
    .attr('stroke', '#fff');

  if (!station) {
    closeBtn.classList.add('hidden');
    renderSidebarList();
    return;
  }

  closeBtn.classList.remove('hidden');

  const linesBadges = station.lines.map(l =>
    `<span class="detail-line-badge" style="background:${LINE_COLORS[l] || '#666'};${[1, '3bis', 5, 6, 7, '7bis', 8, 9, 10, 13].includes(l) ? 'color:#000' : ''}">${l}</span>`
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

  document.getElementById('sidebar-content').innerHTML = `
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
}

function renderSidebarList() {
  if (state.selectedStation) return;
  const active = state.stations.filter(s => isActive(s));
  active.sort((a, b) => a.name.localeCompare(b.name));

  document.getElementById('sidebar-content').innerHTML = active.map(s => {
    const lineDots = s.lines.map(l =>
      `<span class="list-line-dot" style="background:${LINE_COLORS[l] || '#666'}"></span>`
    ).join('');
    return `<div class="station-list-item" data-slug="${s.slug}">
      <span class="list-name">${s.name}</span>
      <span class="list-lines">${lineDots}</span>
    </div>`;
  }).join('');

  // Bind clicks
  document.querySelectorAll('.station-list-item').forEach(el => {
    el.addEventListener('click', () => {
      const station = state.stations.find(s => s.slug === el.dataset.slug);
      if (station) {
        selectStation(station);
        panToStation(station);
      }
    });
  });
}

document.getElementById('sidebar-close').addEventListener('click', () => {
  selectStation(null);
});

document.getElementById('view-toggle').addEventListener('click', (e) => {
  e.preventDefault();
  toggleView(state.view === 'map' ? 'table' : 'map');
});

document.querySelectorAll('#station-table th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (state.tableSort.col === col) {
      state.tableSort.dir = state.tableSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      state.tableSort.col = col;
      state.tableSort.dir = 'asc';
    }
    renderTable();
  });
});

// ─── Command palette (ninja-keys) ───────────────────────────────────
function initCommandPalette(stations) {
  const ninja = document.querySelector('ninja-keys');
  if (!ninja) return;

  // Line toggle actions
  const lineActions = LINE_ORDER.map(line => ({
    id: `line-${line}`,
    title: `Toggle Line ${line}`,
    icon: `<span style="display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;margin-right:4px"><svg viewBox="0 0 16 16" width="12" height="12"><circle cx="8" cy="8" r="7" fill="${LINE_COLORS[line]}"/></svg></span>`,
    section: 'Lines',
    handler: () => {
      const label = String(line);
      const btn = document.querySelector(`.line-btn[data-line="${label}"]`);
      if (state.activeLines.has(label)) {
        state.activeLines.delete(label);
        btn?.classList.remove('active');
      } else {
        state.activeLines.add(label);
        btn?.classList.add('active');
      }
      render();
    },
  }));

  // Category toggle actions
  const catActions = CATEGORIES.map(cat => ({
    id: `cat-${cat.id}`,
    title: `Toggle ${cat.label}`,
    section: 'Categories',
    handler: () => {
      const btn = document.querySelector(`.cat-btn[data-cat="${cat.id}"]`);
      if (state.activeCategories.has(cat.id)) {
        state.activeCategories.delete(cat.id);
        btn?.classList.remove('active');
      } else {
        state.activeCategories.add(cat.id);
        btn?.classList.add('active');
      }
      render();
    },
  }));

  // Timeline actions
  const timelineActions = [
    {
      id: 'timeline-play',
      title: 'Play / Pause Timeline',
      section: 'Timeline',
      handler: () => { state.playing ? stopPlay() : startPlay(); },
    },
    {
      id: 'timeline-reset',
      title: 'Reset Timeline to 2026',
      section: 'Timeline',
      handler: () => {
        state.timelineYear = 2026;
        document.getElementById('year-slider').value = 2026;
        document.getElementById('year-label').textContent = '2026';
        render();
      },
    },
  ];

  // Utility actions
  const utilActions = [
    {
      id: 'clear-filters',
      title: 'Clear All Filters',
      section: 'View',
      handler: () => {
        state.activeLines.clear();
        state.activeCategories.clear();
        document.querySelectorAll('.line-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        render();
      },
    },
    {
      id: 'deselect-station',
      title: 'Deselect Station',
      section: 'View',
      handler: () => { selectStation(null); },
    },
  ];

  // Station actions
  const stationActions = stations.map(s => ({
    id: `station-${s.slug}`,
    title: s.name,
    section: 'Stations',
    keywords: s.lines.map(l => `line ${l}`).join(' '),
    handler: () => {
      selectStation(s);
      panToStation(s);
    },
  }));

  ninja.data = [...lineActions, ...catActions, ...timelineActions, ...utilActions, ...stationActions];
}

// Mobile drawer toggle
const sidebarToggle = document.getElementById('sidebar-toggle');
sidebarToggle.addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const collapsed = sidebar.classList.toggle('collapsed');
  sidebarToggle.innerHTML = collapsed ? '[+]' : '[&minus;]';
});

// ─── Keyboard station navigation (j/k, arrows) ─────────────────────
function getFilteredStationList() {
  return state.stations.filter(s => isActive(s)).sort((a, b) => a.name.localeCompare(b.name));
}

function navigateStation(direction) {
  if (!state.selectedStation) return;
  const list = getFilteredStationList();
  const idx = list.findIndex(s => s.slug === state.selectedStation.slug);
  if (idx === -1) return;
  const next = idx + direction;
  if (next < 0 || next >= list.length) return;
  selectStation(list[next]);
  panToStation(list[next]);
}

document.addEventListener('keydown', (e) => {
  // Don't intercept when typing in an input or when command palette is open
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (document.querySelector('ninja-keys')?.opened) return;

  if (!state.selectedStation) return;

  if (e.key === 'j' || e.key === 'ArrowDown') {
    e.preventDefault();
    navigateStation(1);
  } else if (e.key === 'k' || e.key === 'ArrowUp') {
    e.preventDefault();
    navigateStation(-1);
  } else if (e.key === 'Escape') {
    selectStation(null);
  }
});

// ─── Init ───────────────────────────────────────────────────────────
async function init() {
  const resp = await fetch(import.meta.env.BASE_URL + 'stations.json');
  const stations = await resp.json();
  state.stations = stations;

  initMap(stations);
  initControls(stations);
  initCommandPalette(stations);

  // Apply initial view from URL
  if (state.view === 'table') {
    toggleView('table');
  } else {
    render();
  }

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
