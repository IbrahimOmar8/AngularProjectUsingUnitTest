const QUANTIZE_BITS = 4;

export async function extractPalette(dataUrl, maxColors = 6) {
  const img = await loadImage(dataUrl);
  const max = 160;
  const ratio = Math.min(max / img.naturalWidth, max / img.naturalHeight, 1);
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const buckets = new Map();
  const shift = 8 - QUANTIZE_BITS;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i] >> shift;
    const g = data[i + 1] >> shift;
    const b = data[i + 2] >> shift;
    const sat = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    if (sat < 8 && (lum < 12 || lum > 244)) continue;
    const key = (r << (QUANTIZE_BITS * 2)) | (g << QUANTIZE_BITS) | b;
    const entry = buckets.get(key);
    if (entry) {
      entry.count++;
      entry.r += data[i];
      entry.g += data[i + 1];
      entry.b += data[i + 2];
    } else {
      buckets.set(key, { count: 1, r: data[i], g: data[i + 1], b: data[i + 2] });
    }
  }

  const top = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(maxColors * 3, 18));

  const picked = [];
  for (const c of top) {
    const r = Math.round(c.r / c.count);
    const g = Math.round(c.g / c.count);
    const b = Math.round(c.b / c.count);
    const tooClose = picked.some((p) => colorDistance(p, { r, g, b }) < 40);
    if (!tooClose) picked.push({ r, g, b, count: c.count });
    if (picked.length >= maxColors) break;
  }
  return picked.map(({ r, g, b, count }) => ({ r, g, b, hex: toHex(r, g, b), share: count }));
}

function colorDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function toHex(r, g, b) {
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for palette'));
    img.src = src;
  });
}
