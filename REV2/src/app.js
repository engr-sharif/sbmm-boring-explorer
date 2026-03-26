const SUBPROJECT_COLORS = {
  'South Cell Subproject': '#c0392b',
  'North Cell Subproject': '#2471a3',
  'Northwest Cell Subproject': '#d4860b',
  'Disturbed Rock and Northern Waste Rock Dam Subproject': '#7d3c98',
  'Herman Impoundment': '#1e8449',
  Unknown: '#6b7280'
};

const state = {
  features: [],
  boundaryFeatures: [],
  activeCampaign: 'all',
  search: '',
  activeFacets: { subproject: new Set(), year: new Set(), company: new Set() },
  toggles: { mw: true, sb: true, tp: true, labels: false, boundaries: true },
  selectedKey: null,
  compare: []
};

const map = L.map('map', { center: [39.003, -122.667], zoom: 15, zoomControl: true });
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Esri World Imagery'
}).addTo(map);

const markerCluster = L.markerClusterGroup({ disableClusteringAtZoom: 17 });
const markerByKey = new Map();
const boundaryLayer = L.geoJSON(null, {
  style: () => ({ color: '#f8fafc', weight: 2, fillColor: '#0f172a', fillOpacity: 0.12 }),
  onEachFeature: (feature, layer) => layer.bindTooltip(feature.properties.name)
});

map.addLayer(markerCluster);
map.addLayer(boundaryLayer);

const el = {
  resultList: document.getElementById('result-list'),
  visibleCount: document.getElementById('visible-count'),
  compareContent: document.getElementById('compare-content'),
  search: document.getElementById('search-input')
};

const getKey = (p) => `${p.campaign}:${p.id}`;
const typeBucket = (type) => {
  if (type === 'Test Pit') return 'tp';
  if (type === 'Soil Boring') return 'sb';
  return 'mw';
};

const inFacet = (value, set) => set.size === 0 || set.has(value ?? 'Unknown');

function toMarker(feature) {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const color = SUBPROJECT_COLORS[p.subproject] || SUBPROJECT_COLORS.Unknown;
  const marker = L.circleMarker([lat, lng], {
    radius: 6,
    color: p.campaign === '2025' ? '#fbbf24' : '#f8fafc',
    weight: 2,
    fillColor: color,
    fillOpacity: 0.92
  });

  marker.bindTooltip(p.id, { permanent: state.toggles.labels, direction: 'right' });
  marker.on('click', () => selectFeature(getKey(p)));
  return marker;
}

function passes(feature) {
  const p = feature.properties;
  if (state.activeCampaign !== 'all' && p.campaign !== state.activeCampaign) return false;
  if (state.search && !String(p.id).toLowerCase().includes(state.search.toLowerCase())) return false;
  if (!state.toggles[typeBucket(p.type)]) return false;
  if (!inFacet(p.subproject ?? 'Unknown', state.activeFacets.subproject)) return false;
  if (!inFacet(p.year ?? 'Unknown', state.activeFacets.year)) return false;
  if (!inFacet(p.company ?? 'Unknown', state.activeFacets.company)) return false;
  return true;
}

function renderFacets() {
  const facets = { subproject: new Map(), year: new Map(), company: new Map() };
  state.features
    .filter((f) => state.activeCampaign === 'all' || f.properties.campaign === state.activeCampaign)
    .forEach((f) => {
      ['subproject', 'year', 'company'].forEach((k) => {
        const v = f.properties[k] ?? 'Unknown';
        facets[k].set(v, (facets[k].get(v) || 0) + 1);
      });
    });

  Object.entries(facets).forEach(([facet, mapVals]) => {
    const container = document.getElementById(`facet-${facet}`);
    container.innerHTML = '';
    [...mapVals.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([value, count]) => {
        const btn = document.createElement('button');
        btn.className = `facet-chip${state.activeFacets[facet].has(value) ? ' active' : ''}`;
        btn.textContent = `${value} (${count})`;
        btn.addEventListener('click', () => {
          if (state.activeFacets[facet].has(value)) state.activeFacets[facet].delete(value);
          else state.activeFacets[facet].add(value);
          render();
        });
        container.appendChild(btn);
      });
  });
}

function renderCompare() {
  if (state.compare.length === 0) {
    el.compareContent.textContent = 'Select borings using the “+ Compare” button.';
    return;
  }
  el.compareContent.innerHTML = '';
  state.compare.forEach((key) => {
    const f = state.features.find((x) => getKey(x.properties) === key);
    if (!f) return;
    const p = f.properties;
    const card = document.createElement('article');
    card.className = 'compare-card';
    card.innerHTML = `
      <h4>${p.id} (${p.campaign})</h4>
      <div>Type: ${p.type}</div>
      <div>Subproject: ${p.subproject}</div>
      <div>Depth (ft): ${p.depth_ft ?? '—'}</div>
      <div>GW Depth (ft): ${p.gw_depth_ft ?? '—'}</div>
      <div>Company: ${p.company ?? '—'}</div>
      <button data-remove-compare="${key}">Remove</button>
    `;
    el.compareContent.appendChild(card);
  });

  el.compareContent.querySelectorAll('[data-remove-compare]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.compare = state.compare.filter((k) => k !== btn.dataset.removeCompare);
      renderCompare();
    });
  });
}

function selectFeature(key) {
  state.selectedKey = key;
  const marker = markerByKey.get(key);
  if (marker) {
    map.panTo(marker.getLatLng(), { animate: true });
    marker.openTooltip();
  }
  renderList();
}

function renderList() {
  const visible = state.features.filter(passes);
  el.visibleCount.textContent = `(${visible.length})`;
  markerCluster.clearLayers();

  visible.forEach((f) => {
    const key = getKey(f.properties);
    const marker = markerByKey.get(key);
    if (marker) {
      marker.setStyle({ radius: state.selectedKey === key ? 9 : 6 });
      marker.bindTooltip(f.properties.id, { permanent: state.toggles.labels, direction: 'right' });
      markerCluster.addLayer(marker);
    }
  });

  el.resultList.innerHTML = '';
  visible.forEach((f) => {
    const p = f.properties;
    const key = getKey(p);
    const li = document.createElement('li');
    li.className = state.selectedKey === key ? 'selected' : '';
    li.tabIndex = 0;
    li.innerHTML = `
      <strong>${p.id}</strong> · ${p.type}<br />
      <small>${p.subproject} · ${p.year ?? 'Unknown'} · ${p.company ?? 'Unknown'}</small>
      <div class="result-actions">
        <button data-select="${key}">Zoom</button>
        <button data-compare="${key}">+ Compare</button>
      </div>
    `;
    li.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') selectFeature(key);
    });
    el.resultList.appendChild(li);
  });

  el.resultList.querySelectorAll('[data-select]').forEach((btn) => btn.addEventListener('click', () => selectFeature(btn.dataset.select)));
  el.resultList.querySelectorAll('[data-compare]').forEach((btn) => btn.addEventListener('click', () => {
    const key = btn.dataset.compare;
    if (!state.compare.includes(key) && state.compare.length < 3) state.compare.push(key);
    renderCompare();
  }));
}

function render() {
  renderFacets();
  renderList();
  renderCompare();

  if (state.toggles.boundaries && !map.hasLayer(boundaryLayer)) map.addLayer(boundaryLayer);
  if (!state.toggles.boundaries && map.hasLayer(boundaryLayer)) map.removeLayer(boundaryLayer);
}

function exportCsv() {
  const visible = state.features.filter(passes);
  const cols = ['id', 'campaign', 'type', 'subproject', 'year', 'company', 'depth_ft', 'gw_depth_ft', 'elevation_ft'];
  const csv = [cols.join(',')]
    .concat(visible.map((f) => cols.map((c) => JSON.stringify(f.properties[c] ?? '')).join(',')))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, 'sbmm-rev2-filtered.csv');
}

function exportGeoJson() {
  const visible = state.features.filter(passes);
  const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features: visible }, null, 2)], { type: 'application/geo+json' });
  downloadBlob(blob, 'sbmm-rev2-filtered.geojson');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function saveView() {
  const snapshot = {
    activeCampaign: state.activeCampaign,
    search: state.search,
    toggles: state.toggles,
    facets: Object.fromEntries(Object.entries(state.activeFacets).map(([k, v]) => [k, [...v]])),
    center: map.getCenter(),
    zoom: map.getZoom()
  };
  localStorage.setItem('sbmm_rev2_saved_view', JSON.stringify(snapshot));
}

function loadView() {
  const raw = localStorage.getItem('sbmm_rev2_saved_view');
  if (!raw) return;
  const snapshot = JSON.parse(raw);
  state.activeCampaign = snapshot.activeCampaign;
  state.search = snapshot.search;
  state.toggles = snapshot.toggles;
  ['subproject', 'year', 'company'].forEach((k) => {
    state.activeFacets[k] = new Set(snapshot.facets[k] || []);
  });
  el.search.value = state.search;
  syncControls();
  map.setView(snapshot.center, snapshot.zoom);
  render();
}

function syncControls() {
  document.querySelectorAll('.campaign-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.campaign === state.activeCampaign);
  });
  document.getElementById('toggle-mw').checked = state.toggles.mw;
  document.getElementById('toggle-sb').checked = state.toggles.sb;
  document.getElementById('toggle-tp').checked = state.toggles.tp;
  document.getElementById('toggle-labels').checked = state.toggles.labels;
  document.getElementById('toggle-boundaries').checked = state.toggles.boundaries;
}

function bindEvents() {
  document.querySelectorAll('.campaign-btn').forEach((btn) => btn.addEventListener('click', () => {
    state.activeCampaign = btn.dataset.campaign;
    render();
  }));

  el.search.addEventListener('input', (evt) => {
    state.search = evt.target.value.trim();
    renderList();
  });

  document.getElementById('toggle-mw').addEventListener('change', (e) => { state.toggles.mw = e.target.checked; renderList(); });
  document.getElementById('toggle-sb').addEventListener('change', (e) => { state.toggles.sb = e.target.checked; renderList(); });
  document.getElementById('toggle-tp').addEventListener('change', (e) => { state.toggles.tp = e.target.checked; renderList(); });
  document.getElementById('toggle-labels').addEventListener('change', (e) => { state.toggles.labels = e.target.checked; renderList(); });
  document.getElementById('toggle-boundaries').addEventListener('change', (e) => { state.toggles.boundaries = e.target.checked; render(); });

  document.getElementById('save-view-btn').addEventListener('click', saveView);
  document.getElementById('load-view-btn').addEventListener('click', loadView);
  document.getElementById('export-csv-btn').addEventListener('click', exportCsv);
  document.getElementById('export-geojson-btn').addEventListener('click', exportGeoJson);
}

async function init() {
  const [boringsResp, boundariesResp] = await Promise.all([
    fetch('./data/borings.geojson'),
    fetch('./data/boundaries.geojson')
  ]);

  const boringsGeoJson = await boringsResp.json();
  const boundariesGeoJson = await boundariesResp.json();

  state.features = boringsGeoJson.features;
  state.boundaryFeatures = boundariesGeoJson.features;

  state.features.forEach((f) => {
    const marker = toMarker(f);
    markerByKey.set(getKey(f.properties), marker);
  });

  boundaryLayer.addData(boundariesGeoJson);
  bindEvents();
  syncControls();
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
