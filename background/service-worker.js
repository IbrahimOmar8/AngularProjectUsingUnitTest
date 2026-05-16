import { fetchFigmaImage } from '../lib/figma-api.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, data: result }))
    .catch((err) => sendResponse({ ok: false, error: err?.message ?? String(err) }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case 'CAPTURE_VISIBLE_TAB':
      return captureVisibleTab(message.windowId);
    case 'FETCH_FIGMA_IMAGE':
      return fetchFigmaImage(message.fileKey, message.nodeId, message.token, message.scale);
    case 'TOGGLE_OVERLAY':
    case 'SET_OVERLAY':
    case 'TOGGLE_MEASURE':
    case 'GET_PAGE_METRICS':
      return forwardToContent(message);
    default:
      throw new Error(`Unknown message type: ${message?.type}`);
  }
}

async function captureVisibleTab(windowId) {
  const id = windowId ?? chrome.windows.WINDOW_ID_CURRENT;
  const dataUrl = await chrome.tabs.captureVisibleTab(id, { format: 'png' });
  return { dataUrl };
}

async function forwardToContent(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return chrome.tabs.sendMessage(tab.id, message);
}
