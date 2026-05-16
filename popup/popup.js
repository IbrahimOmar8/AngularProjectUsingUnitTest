async function send(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.ok === false) reject(new Error(response.error));
      else resolve(response?.data);
    });
  });
}

document.getElementById('openPanel').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) throw new Error('No active window');
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'sidepanel/sidepanel.html',
      enabled: true
    });
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  } catch (e) {
    alert(e.message);
  }
});

document.getElementById('toggleOverlay').addEventListener('click', async () => {
  try { await send({ type: 'TOGGLE_OVERLAY' }); } catch (e) { alert(e.message); }
});

document.getElementById('toggleGrid').addEventListener('click', async () => {
  try { await send({ type: 'TOGGLE_GRID' }); } catch (e) { alert(e.message); }
});

document.getElementById('toggleMeasure').addEventListener('click', async () => {
  try { await send({ type: 'TOGGLE_MEASURE' }); } catch (e) { alert(e.message); }
});

document.getElementById('helpLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel/sidepanel.html#help') });
});
