const KEY = 'designLibrary';
const MAX_ITEMS = 24;

export async function listDesigns() {
  const { [KEY]: items } = await chrome.storage.local.get(KEY);
  return Array.isArray(items) ? items : [];
}

export async function saveDesign({ name, dataUrl, source = 'upload', meta = {} }) {
  const items = await listDesigns();
  const id = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const entry = {
    id,
    name: name?.trim() || `Design ${items.length + 1}`,
    dataUrl,
    source,
    meta,
    createdAt: Date.now()
  };
  const next = [entry, ...items].slice(0, MAX_ITEMS);
  await chrome.storage.local.set({ [KEY]: next });
  return entry;
}

export async function removeDesign(id) {
  const items = await listDesigns();
  const next = items.filter((d) => d.id !== id);
  await chrome.storage.local.set({ [KEY]: next });
}

export async function renameDesign(id, name) {
  const items = await listDesigns();
  const next = items.map((d) => (d.id === id ? { ...d, name } : d));
  await chrome.storage.local.set({ [KEY]: next });
}

export async function clearLibrary() {
  await chrome.storage.local.remove(KEY);
}
