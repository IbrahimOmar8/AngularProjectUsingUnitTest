import { parseFigmaUrl } from '../lib/figma-api.js';
import { computePixelDiff } from '../lib/pixel-diff.js';

const state = {
  designDataUrl: null,
  liveDataUrl: null
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

function setDesign(dataUrl) {
  state.designDataUrl = dataUrl;
  renderThumb('#thumbDesign', dataUrl);
  pushOverlayState();
}

function setLive(dataUrl) {
  state.liveDataUrl = dataUrl;
  renderThumb('#thumbLive', dataUrl);
  $('#reloadCapture').disabled = !dataUrl;
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

$$('.tabs .tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tabs .tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const key = tab.dataset.tab;
    $$('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== key));
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

const dropzone = $('#dropzone');
const fileInput = $('#fileInput');

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag');
});
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

$('#captureBtn').addEventListener('click', captureLive);
$('#reloadCapture').addEventListener('click', captureLive);

async function captureLive() {
  try {
    setStatus('Capturing tab…');
    const { dataUrl } = await send({ type: 'CAPTURE_VISIBLE_TAB' });
    setLive(dataUrl);
    $('#captureStatus').textContent = 'Captured ✓';
    setStatus('Tab captured', 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

const opacity = $('#opacity');
const blendMode = $('#blendMode');
const offsetX = $('#offsetX');
const offsetY = $('#offsetY');
const overlayScale = $('#overlayScale');

[opacity, blendMode, offsetX, offsetY, overlayScale].forEach((el) =>
  el.addEventListener('input', pushOverlayState)
);

async function pushOverlayState(forceVisible) {
  if (!state.designDataUrl) return;
  try {
    await send({
      type: 'SET_OVERLAY',
      payload: {
        dataUrl: state.designDataUrl,
        opacity: Number(opacity.value) / 100,
        blendMode: blendMode.value,
        offsetX: Number(offsetX.value),
        offsetY: Number(offsetY.value),
        scale: Number(overlayScale.value) / 100,
        visible: forceVisible === true ? true : undefined
      }
    });
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

$('#pushOverlay').addEventListener('click', () => pushOverlayState(true));
$('#hideOverlay').addEventListener('click', async () => {
  try {
    await send({ type: 'SET_OVERLAY', payload: { visible: false } });
  } catch (e) { setStatus(e.message, 'error'); }
});

$('#runDiff').addEventListener('click', async () => {
  if (!state.designDataUrl || !state.liveDataUrl) {
    setStatus('Need both a design and a capture', 'error');
    return;
  }
  setStatus('Running diff…');
  try {
    const threshold = Number($('#diffThreshold').value);
    const result = await computePixelDiff(state.designDataUrl, state.liveDataUrl, { threshold });
    const out = $('#diffOutput');
    out.innerHTML = '';
    const img = new Image();
    img.src = result.diffDataUrl;
    out.appendChild(img);
    const pct = (result.diffRatio * 100).toFixed(2);
    $('#diffStats').textContent = `${result.diffPixels.toLocaleString()} of ${result.totalPixels.toLocaleString()} pixels differ (${pct}%) at ${result.width}×${result.height}`;
    setStatus('Diff ready', 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
  }
});

$('#measureToggle').addEventListener('click', async () => {
  try { await send({ type: 'TOGGLE_MEASURE' }); }
  catch (e) { setStatus(e.message, 'error'); }
});

if (location.hash === '#help') {
  setStatus('1) Load a design  2) Capture the page  3) Compare via overlay, side-by-side or pixel diff.');
}
