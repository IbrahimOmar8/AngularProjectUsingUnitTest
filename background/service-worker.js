import { fetchFigmaImage } from '../lib/figma-api.js';

const CAPTURE_INTERVAL_MS = 650;
let lastCaptureAt = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, data: result }))
    .catch((err) => sendResponse({ ok: false, error: err?.message ?? String(err) }));
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  try {
    switch (command) {
      case 'toggle-overlay':
        await forwardToContent({ type: 'TOGGLE_OVERLAY' });
        break;
      case 'toggle-measure':
        await forwardToContent({ type: 'TOGGLE_MEASURE' });
        break;
      case 'toggle-grid':
        await forwardToContent({ type: 'TOGGLE_GRID' });
        break;
      case 'open-panel': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.windowId) {
          await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel/sidepanel.html', enabled: true });
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
        break;
      }
    }
  } catch (e) {
    console.warn('[figma-compare] command failed', command, e);
  }
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case 'CAPTURE_VISIBLE_TAB':
      return captureVisibleTab(message.windowId);
    case 'CAPTURE_FULL_PAGE':
      return captureFullPage(message);
    case 'FETCH_FIGMA_IMAGE':
      return fetchFigmaImage(message.fileKey, message.nodeId, message.token, message.scale);
    case 'RESIZE_WINDOW':
      return resizeWindow(message.width, message.height);
    case 'DOWNLOAD':
      return download(message.dataUrl, message.filename);
    case 'TOGGLE_OVERLAY':
    case 'SET_OVERLAY':
    case 'TOGGLE_MEASURE':
    case 'TOGGLE_GRID':
    case 'SET_GRID':
    case 'GET_PAGE_METRICS':
    case 'SET_SCROLL':
    case 'HIDE_FIXED':
      return forwardToContent(message);
    case 'OVERLAY_DRAGGED':
      // Sidepanel listens for this directly via runtime.onMessage from the content script.
      return { ok: true };
    default:
      throw new Error(`Unknown message type: ${message?.type}`);
  }
}

async function captureVisibleTab(windowId) {
  await throttleCapture();
  const id = windowId ?? chrome.windows.WINDOW_ID_CURRENT;
  const dataUrl = await chrome.tabs.captureVisibleTab(id, { format: 'png' });
  return { dataUrl };
}

async function throttleCapture() {
  const now = Date.now();
  const wait = lastCaptureAt + CAPTURE_INTERVAL_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCaptureAt = Date.now();
}

async function captureFullPage({ hideFixed = true } = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');

  const metrics = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_METRICS' });
  if (!metrics?.ok) throw new Error(metrics?.error || 'Failed to read page metrics');
  const { scrollHeight, innerHeight, innerWidth, devicePixelRatio = 1 } = metrics.data;

  if (hideFixed) await chrome.tabs.sendMessage(tab.id, { type: 'HIDE_FIXED', payload: { hide: true } });

  const stepHeight = Math.max(100, innerHeight - 60);
  const steps = [];
  for (let y = 0; y < scrollHeight; y += stepHeight) {
    steps.push(Math.min(y, Math.max(0, scrollHeight - innerHeight)));
  }
  if (!steps.length) steps.push(0);

  const tiles = [];
  for (const y of steps) {
    await chrome.tabs.sendMessage(tab.id, { type: 'SET_SCROLL', payload: { y } });
    await new Promise((r) => setTimeout(r, 250));
    const { dataUrl } = await captureVisibleTab(tab.windowId);
    tiles.push({ y, dataUrl });
  }

  if (hideFixed) await chrome.tabs.sendMessage(tab.id, { type: 'HIDE_FIXED', payload: { hide: false } });
  await chrome.tabs.sendMessage(tab.id, { type: 'SET_SCROLL', payload: { y: 0 } });

  return {
    tiles,
    pageWidth: innerWidth,
    pageHeight: scrollHeight,
    viewportHeight: innerHeight,
    devicePixelRatio
  };
}

async function resizeWindow(width, height) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.windowId) throw new Error('No active window');
  const update = {};
  if (width) update.width = width;
  if (height) update.height = height;
  update.state = 'normal';
  await chrome.windows.update(tab.windowId, update);
  return { ok: true };
}

async function download(dataUrl, filename) {
  if (!dataUrl) throw new Error('Missing dataUrl');
  const id = await chrome.downloads.download({
    url: dataUrl,
    filename: filename || 'figma-compare.png',
    saveAs: true
  });
  return { id };
}

async function forwardToContent(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return chrome.tabs.sendMessage(tab.id, message);
}
