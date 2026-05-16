import { parseFigmaUrl } from '../lib/figma-api.js';
import { computePixelDiff, loadImage } from '../lib/pixel-diff.js';
import { extractPalette } from '../lib/palette.js';
import { listDesigns, saveDesign, removeDesign } from '../lib/library.js';

const state = {
  designDataUrl: null,
  liveDataUrl: null,
  diffDataUrl: null,
  diffStats: null,
  activeDesignId: null
};

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function send(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (response?.ok === false) return reject(new Error(response.error));
      resolve(response?.data);
    });
  });
}

function setStatus(text, kind) {
  const bar = $('#statusBar');
  bar.textContent = text || '';
  bar.style.color = kind === 'error' ? 'var(--danger)' : kind === 'ok' ? 'var(--good)' : 'var(--muted)';
}

function renderThumb(sel, dataUrl) {
  const el = $(sel);
  el.innerHTML = '';
  if (!dataUrl) {
    const span = document.createElement('span');
    span.className = 'muted small';
    span.textContent = 'No image';
    el.appendChild(span);
    return;
  }
  const img = new Image();
  img.src = dataUrl;
  el.appendChild(img);
}

function setDesign(dataUrl, opts = {}) {
  state.designDataUrl = dataUrl;
  state.activeDesignId = opts.id ?? null;
  renderThumb('#thumbDesign', dataUrl);
  pushOverlayState();
  refreshLibraryActive();
}

function setLive(dataUrl) {
  state.liveDataUrl = dataUrl;
  renderThumb('#thumbLive', dataUrl);
  $('#reloadCapture').disabled = !dataUrl;
}

// ===== Tabs =====

$$('.tabs .tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tabs .tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const key = tab.dataset.tab;
    $$('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== key));
    if (key === 'library') refreshLibrary();
  });
});

$$('.modes .tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.modes .tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const key = tab.dataset.mode;
    $$('.mode-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.modePanel !== key));
  });
});

// ===== Upload =====

const dropzone = $('#dropzone');
const fileInput = $('#fileInput');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  const file = e.dataTransfer.files?.[0];
  if (file) await loadFile(file);
});
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (file) await loadFile(file);
});

async function loadFile(file) {
  if (!file.type.startsWith('image/')) {
    setStatus('Please choose an image file', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    setDesign(reader.result);
    setStatus('Design loaded', 'ok');
  };
  reader.readAsDataURL(file);
}

// ===== Figma API =====

const figmaUrlInput = $('#figmaUrl');
const figmaTokenInput = $('#figmaToken');
const figmaScale = $('#figmaScale');

chrome.storage.local.get(['figmaToken', 'figmaUrl', 'figmaScale']).then((stored) => {
  if (stored.figmaToken) figmaTokenInput.value = stored.figmaToken;
  if (stored.figmaUrl) figmaUrlInput.value = stored.figmaUrl;
  if (stored.figmaScale) figmaScale.value = stored.figmaScale;
});

figmaTokenInput.addEventListener('change', () => chrome.storage.local.set({ figmaToken: figmaTokenInput.value }));
figmaUrlInput.addEventListener('change', () => chrome.storage.local.set({ figmaUrl: figmaUrlInput.value }));
figmaScale.addEventListener('change', () => chrome.storage.local.set({ figmaScale: figmaScale.value }));

$('#fetchFigma').addEventListener('click', async () => {
  try {
    setStatus('Fetching from Figma…');
    const parsed = parseFigmaUrl(figmaUrlInput.value);
    if (!parsed?.fileKey || !parsed?.nodeId) {
      throw new Error('URL must include the file key and a node-id query param. Open a specific frame and use "Copy link".');
    }
    const result = await send({
      type: 'FETCH_FIGMA_IMAGE',
      fileKey: parsed.fileKey,
      nodeId: parsed.nodeId,
      token: figmaTokenInput.value.trim(),
      scale: Number(figmaScale.value)
    });
    setDesign(result.dataUrl);
    setStatus('Design fetched from Figma', 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
});

// ===== Library =====

async function refreshLibrary() {
  const list = $('#libraryList');
  list.innerHTML = '';
  const items = await listDesigns();
  if (!items.length) {
    list.innerHTML = '<p class="muted small">No saved designs yet.</p>';
    return;
  }
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'item' + (item.id === state.activeDesignId ? ' active' : '');
    card.innerHTML = `
      <img alt="" />
      <div class="row-tight">
        <span class="name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <button class="x" title="Remove" data-id="${item.id}">×</button>
      </div>
    `;
    card.querySelector('img').src = item.dataUrl;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.x')) return;
      setDesign(item.dataUrl, { id: item.id });
      setStatus(`Loaded "${item.name}"`, 'ok');
    });
    card.querySelector('.x').addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeDesign(item.id);
      refreshLibrary();
    });
    list.appendChild(card);
  }
}

function refreshLibraryActive() {
  $$('.library .item').forEach((el, i) => el.classList.toggle('active', false));
  if (!state.activeDesignId) return;
  listDesigns().then((items) => {
    const idx = items.findIndex((d) => d.id === state.activeDesignId);
    const cards = $$('.library .item');
    if (cards[idx]) cards[idx].classList.add('active');
  });
}

$('#saveDesign').addEventListener('click', async () => {
  if (!state.designDataUrl) {
    setStatus('Load a design first', 'error');
    return;
  }
  const name = $('#designName').value;
  const entry = await saveDesign({ name, dataUrl: state.designDataUrl, source: 'manual' });
  state.activeDesignId = entry.id;
  $('#designName').value = '';
  setStatus(`Saved "${entry.name}"`, 'ok');
  if ($('[data-tab="library"]').classList.contains('active')) refreshLibrary();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== Capture =====

$('#captureBtn').addEventListener('click', captureLive);
$('#reloadCapture').addEventListener('click', captureLive);
$('#captureFullPage').addEventListener('click', captureFullPage);

async function captureLive() {
  try {
    setStatus('Capturing tab…');
    const { dataUrl } = await send({ type: 'CAPTURE_VISIBLE_TAB' });
    setLive(dataUrl);
    $('#captureStatus').textContent = 'Captured ✓ viewport';
    setStatus('Tab captured', 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

async function captureFullPage() {
  try {
    setStatus('Capturing full page (this may take a moment)…');
    const result = await send({ type: 'CAPTURE_FULL_PAGE' });
    const stitched = await stitchTiles(result);
    setLive(stitched);
    $('#captureStatus').textContent = `Captured ✓ full page (${result.pageWidth}×${result.pageHeight})`;
    setStatus('Full page captured', 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

async function stitchTiles({ tiles, pageWidth, pageHeight, devicePixelRatio = 1 }) {
  if (!tiles?.length) throw new Error('No tiles returned');
  const dpr = devicePixelRatio;
  const canvas = document.createElement('canvas');
  canvas.width = pageWidth * dpr;
  canvas.height = pageHeight * dpr;
  const ctx = canvas.getContext('2d');
  for (const tile of tiles) {
    const img = await loadImage(tile.dataUrl);
    ctx.drawImage(img, 0, tile.y * dpr, img.naturalWidth, img.naturalHeight);
  }
  return canvas.toDataURL('image/png');
}

// ===== Viewport presets =====

$('#applyViewport').addEventListener('click', async () => {
  const width = Number($('#viewportPreset').value);
  if (!width) {
    setStatus('Pick a viewport size first', 'error');
    return;
  }
  try {
    await send({ type: 'RESIZE_WINDOW', width });
    setStatus(`Window resized to ${width}px wide`, 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
});

// ===== Overlay =====

const opacity = $('#opacity');
const blendMode = $('#blendMode');
const offsetX = $('#offsetX');
const offsetY = $('#offsetY');
const overlayScale = $('#overlayScale');

[opacity, blendMode, offsetX, offsetY, overlayScale].forEach((el) =>
  el.addEventListener('input', () => pushOverlayState())
);

let lastOverlayPush = null;
async function pushOverlayState(forceVisible) {
  if (!state.designDataUrl) return;
  const payload = {
    dataUrl: state.designDataUrl,
    opacity: Number(opacity.value) / 100,
    blendMode: blendMode.value,
    offsetX: Number(offsetX.value),
    offsetY: Number(offsetY.value),
    scale: Number(overlayScale.value) / 100,
    visible: forceVisible === true ? true : undefined
  };
  const serialized = JSON.stringify(payload);
  if (serialized === lastOverlayPush) return;
  lastOverlayPush = serialized;
  try {
    await send({ type: 'SET_OVERLAY', payload });
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

$('#pushOverlay').addEventListener('click', () => pushOverlayState(true));
$('#hideOverlay').addEventListener('click', async () => {
  try { await send({ type: 'SET_OVERLAY', payload: { visible: false } }); }
  catch (e) { setStatus(e.message, 'error'); }
});
$('#resetOverlay').addEventListener('click', () => {
  offsetX.value = 0;
  offsetY.value = 0;
  overlayScale.value = 100;
  pushOverlayState(true);
});

// Sync inputs when user drags the overlay on the page
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'OVERLAY_DRAGGED') {
    const p = msg.payload || {};
    if (typeof p.offsetX === 'number') offsetX.value = p.offsetX;
    if (typeof p.offsetY === 'number') offsetY.value = p.offsetY;
    if (typeof p.scale === 'number') overlayScale.value = Math.round(p.scale * 100);
  }
});

// ===== Diff =====

$('#runDiff').addEventListener('click', async () => {
  if (!state.designDataUrl || !state.liveDataUrl) {
    setStatus('Need both a design and a capture', 'error');
    return;
  }
  setStatus('Running diff…');
  try {
    const threshold = Number($('#diffThreshold').value);
    const result = await computePixelDiff(state.designDataUrl, state.liveDataUrl, { threshold });
    state.diffDataUrl = result.diffDataUrl;
    state.diffStats = result;
    const out = $('#diffOutput');
    out.innerHTML = '';
    const img = new Image();
    img.src = result.diffDataUrl;
    out.appendChild(img);
    const pct = (result.diffRatio * 100).toFixed(2);
    $('#diffStats').textContent = `${result.diffPixels.toLocaleString()} of ${result.totalPixels.toLocaleString()} pixels differ (${pct}%) at ${result.width}×${result.height}`;
    $('#exportDiff').disabled = false;
    $('#exportReport').disabled = false;
    setStatus('Diff ready', 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
});

$('#exportDiff').addEventListener('click', async () => {
  if (!state.diffDataUrl) return;
  await send({ type: 'DOWNLOAD', dataUrl: state.diffDataUrl, filename: timestampedName('diff') });
});

$('#exportSide').addEventListener('click', async () => {
  if (!state.designDataUrl || !state.liveDataUrl) {
    setStatus('Need both a design and a capture', 'error');
    return;
  }
  const png = await makeSideBySide(state.designDataUrl, state.liveDataUrl);
  await send({ type: 'DOWNLOAD', dataUrl: png, filename: timestampedName('side-by-side') });
});

$('#exportReport').addEventListener('click', async () => {
  if (!state.diffDataUrl || !state.diffStats) return;
  const png = await makeReportImage();
  await send({ type: 'DOWNLOAD', dataUrl: png, filename: timestampedName('report') });
});

async function makeSideBySide(a, b) {
  const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)]);
  const h = Math.max(ia.naturalHeight, ib.naturalHeight);
  const w = ia.naturalWidth + ib.naturalWidth + 12;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f0f12';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(ia, 0, 0);
  ctx.drawImage(ib, ia.naturalWidth + 12, 0);
  return canvas.toDataURL('image/png');
}

async function makeReportImage() {
  const [design, live, diff] = await Promise.all([
    loadImage(state.designDataUrl),
    loadImage(state.liveDataUrl),
    loadImage(state.diffDataUrl)
  ]);
  const w = design.naturalWidth + live.naturalWidth + diff.naturalWidth + 24;
  const h = Math.max(design.naturalHeight, live.naturalHeight, diff.naturalHeight) + 72;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f0f12';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f5f5f7';
  ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Figma UI Compare — report', 16, 30);
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const pct = (state.diffStats.diffRatio * 100).toFixed(2);
  ctx.fillStyle = '#9ca3af';
  ctx.fillText(`${state.diffStats.diffPixels.toLocaleString()} / ${state.diffStats.totalPixels.toLocaleString()} px differ (${pct}%) — ${new Date().toLocaleString()}`, 16, 52);
  let x = 0;
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Design', x + 6, 72);
  ctx.drawImage(design, x, 76);
  x += design.naturalWidth + 12;
  ctx.fillText('Live', x + 6, 72);
  ctx.drawImage(live, x, 76);
  x += live.naturalWidth + 12;
  ctx.fillText('Diff', x + 6, 72);
  ctx.drawImage(diff, x, 76);
  return c.toDataURL('image/png');
}

function timestampedName(prefix) {
  const t = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `figma-compare-${prefix}-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.png`;
}

// ===== Palette =====

$('#extractPalette').addEventListener('click', async () => {
  if (!state.designDataUrl) {
    setStatus('Load a design first', 'error');
    return;
  }
  setStatus('Extracting palette…');
  try {
    const colors = await extractPalette(state.designDataUrl, 12);
    const root = $('#paletteSwatches');
    root.innerHTML = '';
    for (const c of colors) {
      const sw = document.createElement('button');
      sw.className = 'swatch';
      sw.style.background = c.hex;
      sw.textContent = c.hex;
      sw.title = `${c.hex} · click to copy`;
      sw.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(c.hex);
          sw.classList.add('copied');
          setTimeout(() => sw.classList.remove('copied'), 800);
        } catch {}
      });
      root.appendChild(sw);
    }
    setStatus('Palette ready — click to copy hex', 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
});

// ===== Grid =====

const gridSize = $('#gridSize');
const gridMajor = $('#gridMajor');
const gridColor = $('#gridColor');
const gridOpacity = $('#gridOpacity');

let gridVisible = false;
$('#gridToggle').addEventListener('click', async () => {
  gridVisible = !gridVisible;
  await pushGrid(gridVisible);
  $('#gridToggle').textContent = gridVisible ? 'Hide grid' : 'Toggle grid';
});

[gridSize, gridMajor, gridColor, gridOpacity].forEach((el) =>
  el.addEventListener('input', () => { if (gridVisible) pushGrid(true); })
);

async function pushGrid(visible) {
  try {
    await send({
      type: 'SET_GRID',
      payload: {
        size: Number(gridSize.value),
        majorEvery: Number(gridMajor.value),
        color: gridColor.value,
        opacity: Number(gridOpacity.value) / 100,
        visible
      }
    });
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

// ===== Measure =====

$('#measureToggle').addEventListener('click', async () => {
  try { await send({ type: 'TOGGLE_MEASURE' }); }
  catch (e) { setStatus(e.message, 'error'); }
});

// ===== Init =====

refreshLibrary();

if (location.hash === '#help') {
  setStatus('1) Load a design  2) Capture the page  3) Compare. Use Alt+drag on the overlay to align.');
}
