const FIGMA_API_BASE = 'https://api.figma.com/v1';

export function parseFigmaUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes('figma.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'file' || p === 'design' || p === 'proto');
    const fileKey = idx >= 0 ? parts[idx + 1] : null;
    const nodeId = u.searchParams.get('node-id');
    return {
      fileKey: fileKey || null,
      nodeId: nodeId ? decodeURIComponent(nodeId).replace('-', ':') : null
    };
  } catch (e) {
    return null;
  }
}

async function figmaRequest(path, token) {
  if (!token) throw new Error('Missing Figma personal access token');
  const res = await fetch(`${FIGMA_API_BASE}${path}`, {
    headers: { 'X-Figma-Token': token }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Figma API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

export async function fetchFigmaImage(fileKey, nodeId, token, scale = 2) {
  if (!fileKey) throw new Error('Missing Figma file key');
  if (!nodeId) throw new Error('Missing Figma node id (open a specific frame in Figma)');
  const params = new URLSearchParams({
    ids: nodeId,
    format: 'png',
    scale: String(scale)
  });
  const data = await figmaRequest(`/images/${fileKey}?${params}`, token);
  const url = data?.images?.[nodeId];
  if (!url) throw new Error('Figma did not return an image URL for this node');
  const blob = await (await fetch(url)).blob();
  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, sourceUrl: url };
}

export async function fetchFigmaFileMeta(fileKey, token) {
  return figmaRequest(`/files/${fileKey}?depth=1`, token);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
