import { parseFigmaUrl } from '../lib/figma-api.js';
import { computePixelDiff, loadImage, trimDesignWhitespace } from '../lib/pixel-diff.js';
import { extractPalette } from '../lib/palette.js';
import { listDesigns, saveDesign, removeDesign } from '../lib/library.js';

const SETTINGS_KEY = 'fcSettings';

const state = {
  designDataUrl: null,
  liveDataUrl: null,
  diffDataUrl: null,
  diffStats: null,
  diffRegions: [],
  activeDesignId: null,
  blinkTimer: null,
  loupeOn: false,
  sampledColors: []
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

$('#fitOverlay').addEventListener('click', async () => {
  if (!state.designDataUrl) {
    setStatus('Load a design first', 'error');
    return;
  }
  try {
    const [img, metrics] = await Promise.all([
      loadImage(state.designDataUrl),
      send({ type: 'GET_PAGE_METRICS' })
    ]);
    const innerWidth = metrics?.data?.innerWidth ?? metrics?.innerWidth;
    if (!innerWidth) throw new Error('Could not read page width');
    const scalePct = Math.round((innerWidth / img.naturalWidth) * 100);
    overlayScale.value = scalePct;
    offsetX.value = 0;
    offsetY.value = 0;
    pushOverlayState(true);
    setStatus(`Fit to ${innerWidth}px (${scalePct}%)`, 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
});

$('#blinkOverlay').addEventListener('click', () => {
  if (state.blinkTimer) {
    clearInterval(state.blinkTimer);
    state.blinkTimer = null;
    $('#blinkOverlay').textContent = 'Blink';
    send({ type: 'SET_OVERLAY', payload: { opacity: Number(opacity.value) / 100 } }).catch(() => {});
    return;
  }
  if (!state.designDataUrl) {
    setStatus('Load a design first', 'error');
    return;
  }
  pushOverlayState(true);
  let on = true;
  const target = Number(opacity.value) / 100 || 1;
  $('#blinkOverlay').textContent = 'Stop blink';
  state.blinkTimer = setInterval(() => {
    on = !on;
    send({ type: 'SET_OVERLAY', payload: { opacity: on ? target : 0 } }).catch(() => {});
  }, 550);
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
    const autoTrim = $('#autoTrim').checked;
    const designSrc = autoTrim ? await trimDesignWhitespace(state.designDataUrl) : state.designDataUrl;
    const result = await computePixelDiff(designSrc, state.liveDataUrl, { threshold });
    state.diffDataUrl = result.diffDataUrl;
    state.diffStats = result;
    state.diffRegions = result.regions || [];
    const out = $('#diffOutput');
    out.innerHTML = '';
    const img = new Image();
    img.src = result.diffDataUrl;
    out.appendChild(img);
    const pct = (result.diffRatio * 100).toFixed(2);
    const ssim = (result.perceptualScore * 100).toFixed(1);
    $('#diffStats').textContent = `${result.diffPixels.toLocaleString()} / ${result.totalPixels.toLocaleString()} px differ (${pct}%) · perceptual match ${ssim}% · ${result.width}×${result.height}`;
    $('#exportDiff').disabled = false;
    $('#exportReport').disabled = false;
    renderRegions(result.regions || [], result.width, result.height);
    setStatus('Diff ready', 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
});

function renderRegions(regions, refWidth, refHeight) {
  const root = $('#diffRegions');
  root.innerHTML = '';
  if (!regions.length) return;
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const item = document.createElement('div');
    item.className = 'region';
    item.innerHTML = `
      <span class="swatch-dot"></span>
      <span>#${i + 1}</span>
      <span class="geom">${r.x},${r.y} · ${r.w}×${r.h}</span>
      <span class="pixels">${r.pixels.toLocaleString()} px</span>
    `;
    item.addEventListener('click', () => focusRegion(r, refWidth, refHeight));
    root.appendChild(item);
  }
}

async function focusRegion(region, refWidth, refHeight) {
  try {
    await send({
      type: 'HIGHLIGHT_REGION',
      payload: { region, refWidth, refHeight, durationMs: 2200 }
    });
    setStatus(`Highlighting region at ${region.x},${region.y}`, 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

$('#exportDiff').addEventListener('click', async () => {
  if (!state.diffDataUrl) return;
  await send({ type: 'DOWNLOAD', dataUrl: state.diffDataUrl, filename: timestampedName('diff') });
});

// ===== Loupe (magnifier) =====

const loupe = $('#loupe');
const sideViewer = $('#sideViewer');
const LOUPE_ZOOM = 4;
const LOUPE_SIZE = 180;

$('#toggleLoupe').addEventListener('click', () => {
  state.loupeOn = !state.loupeOn;
  $('#toggleLoupe').textContent = state.loupeOn ? 'Stop loupe' : 'Loupe (4x)';
  loupe.hidden = !state.loupeOn;
  if (!state.loupeOn) loupe.style.display = 'none';
});

sideViewer.addEventListener('mousemove', (e) => {
  if (!state.loupeOn) return;
  const designImg = $('#thumbDesign img');
  const liveImg = $('#thumbLive img');
  if (!designImg || !liveImg) return;
  const dRect = designImg.getBoundingClientRect();
  const lRect = liveImg.getBoundingClientRect();
  const inDesign = e.clientX >= dRect.left && e.clientX <= dRect.right && e.clientY >= dRect.top && e.clientY <= dRect.bottom;
  const inLive = e.clientX >= lRect.left && e.clientX <= lRect.right && e.clientY >= lRect.top && e.clientY <= lRect.bottom;
  if (!inDesign && !inLive) {
    loupe.style.display = 'none';
    return;
  }
  loupe.style.display = 'block';
  const designU = inDesign ? (e.clientX - dRect.left) / dRect.width : (e.clientX - lRect.left) / lRect.width;
  const designV = inDesign ? (e.clientY - dRect.top) / dRect.height : (e.clientY - lRect.top) / lRect.height;
  const dW = designImg.naturalWidth * LOUPE_ZOOM;
  const dH = designImg.naturalHeight * LOUPE_ZOOM;
  const lW = liveImg.naturalWidth * LOUPE_ZOOM;
  const lH = liveImg.naturalHeight * LOUPE_ZOOM;
  loupe.style.left = (e.clientX - LOUPE_SIZE / 2) + 'px';
  loupe.style.top = (e.clientY - LOUPE_SIZE / 2) + 'px';
  loupe.style.backgroundImage = `url('${state.designDataUrl}'), url('${state.liveDataUrl}')`;
  loupe.style.setProperty('--bg-size', `${dW}px ${dH}px`);
  loupe.style.backgroundSize = `${dW}px ${dH}px, ${lW}px ${lH}px`;
  const dx = LOUPE_SIZE / 2 - designU * dW;
  const dy = LOUPE_SIZE / 4 - designV * dH;
  const lx = LOUPE_SIZE / 2 - designU * lW;
  const ly = LOUPE_SIZE * 0.75 - designV * lH;
  loupe.style.backgroundPosition = `${dx}px ${dy}px, ${lx}px ${ly}px`;
  loupe.style.backgroundClip = 'padding-box';
});

sideViewer.addEventListener('mouseleave', () => { loupe.style.display = 'none'; });

// ===== Eyedropper =====

$('#eyedropper').addEventListener('click', async () => {
  if (typeof window.EyeDropper !== 'function') {
    setStatus('EyeDropper not supported in this browser', 'error');
    return;
  }
  try {
    const dropper = new EyeDropper();
    const result = await dropper.open();
    state.sampledColors.unshift(result.sRGBHex.toUpperCase());
    state.sampledColors = state.sampledColors.slice(0, 12);
    renderSampledColors();
    setStatus(`Sampled ${result.sRGBHex.toUpperCase()}`, 'ok');
  } catch (e) {
    if (e?.name !== 'AbortError') setStatus(e.message, 'error');
  }
});

function renderSampledColors() {
  const root = $('#sampledSwatches');
  root.innerHTML = '';
  for (const hex of state.sampledColors) {
    const sw = document.createElement('button');
    sw.className = 'swatch';
    sw.style.background = hex;
    sw.textContent = hex;
    sw.title = `${hex} · click to copy`;
    sw.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(hex);
        sw.classList.add('copied');
        setTimeout(() => sw.classList.remove('copied'), 800);
      } catch {}
    });
    root.appendChild(sw);
  }
}

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

// ===== Theme =====

function applyTheme(theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  $$('.theme-btn').forEach((b) => b.classList.toggle('active', b.dataset.theme === theme));
}

$$('.theme-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
    saveSettings();
  });
});

// ===== Settings persistence =====

const SETTING_INPUTS = [
  ['opacity', 'opacity', 'value'],
  ['blendMode', 'blendMode', 'value'],
  ['overlayScale', 'overlayScale', 'value'],
  ['diffThreshold', 'diffThreshold', 'value'],
  ['autoTrim', 'autoTrim', 'checked'],
  ['gridSize', 'gridSize', 'value'],
  ['gridMajor', 'gridMajor', 'value'],
  ['gridColor', 'gridColor', 'value'],
  ['gridOpacity', 'gridOpacity', 'value']
];

async function saveSettings() {
  const out = { theme: document.documentElement.getAttribute('data-theme') || 'auto' };
  for (const [key, id, prop] of SETTING_INPUTS) {
    const el = document.getElementById(id);
    if (el) out[key] = el[prop];
  }
  await chrome.storage.local.set({ [SETTINGS_KEY]: out });
}

async function loadSettings() {
  const { [SETTINGS_KEY]: s } = await chrome.storage.local.get(SETTINGS_KEY);
  if (!s) return applyTheme('auto');
  applyTheme(s.theme || 'auto');
  for (const [key, id, prop] of SETTING_INPUTS) {
    const el = document.getElementById(id);
    if (el && s[key] !== undefined) el[prop] = s[key];
  }
}

document.addEventListener('input', (e) => {
  const id = e.target?.id;
  if (SETTING_INPUTS.some(([, k]) => k === id)) saveSettings();
});

// ===== Init =====

(async function init() {
  await loadSettings();
  await refreshLibrary();
  if (location.hash === '#help') {
    setStatus('1) Load a design  2) Capture the page  3) Compare. Use Alt+drag on the overlay to align.');
  }
})();
