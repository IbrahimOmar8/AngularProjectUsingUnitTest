export async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function drawToCanvas(img, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, ctx };
}

export async function computePixelDiff(designSrc, actualSrc, options = {}) {
  const threshold = options.threshold ?? 32;
  const highlight = options.highlight ?? [255, 0, 80, 220];
  const regionGrid = options.regionGrid ?? 16;
  const regionMinDiff = options.regionMinDiff ?? 0.15;

  const [designImg, actualImg] = await Promise.all([
    loadImage(designSrc),
    loadImage(actualSrc)
  ]);

  const width = Math.min(designImg.naturalWidth, actualImg.naturalWidth);
  const height = Math.min(designImg.naturalHeight, actualImg.naturalHeight);
  if (!width || !height) throw new Error('Invalid image dimensions');

  const { ctx: dctx } = drawToCanvas(designImg, width, height);
  const { ctx: actx } = drawToCanvas(actualImg, width, height);

  const designData = dctx.getImageData(0, 0, width, height);
  const actualData = actx.getImageData(0, 0, width, height);
  const out = new ImageData(width, height);

  let diffPixels = 0;
  let perceptualSum = 0;
  const total = width * height;
  const d = designData.data;
  const a = actualData.data;
  const o = out.data;
  const isDiff = new Uint8Array(total);

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const dr = d[i], dg = d[i + 1], db = d[i + 2];
    const ar = a[i], ag = a[i + 1], ab = a[i + 2];
    const dY = 0.299 * dr + 0.587 * dg + 0.114 * db;
    const aY = 0.299 * ar + 0.587 * ag + 0.114 * ab;
    const delta = Math.abs(dr - ar) + Math.abs(dg - ag) + Math.abs(db - ab);
    const lumDelta = Math.abs(dY - aY);
    perceptualSum += lumDelta;

    if (delta > threshold) {
      o[i] = highlight[0];
      o[i + 1] = highlight[1];
      o[i + 2] = highlight[2];
      o[i + 3] = highlight[3];
      diffPixels++;
      isDiff[p] = 1;
    } else {
      const gray = Math.round((ar + ag + ab) / 3);
      o[i] = gray;
      o[i + 1] = gray;
      o[i + 2] = gray;
      o[i + 3] = 70;
    }
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  outCanvas.getContext('2d').putImageData(out, 0, 0);

  const regions = clusterRegions(isDiff, width, height, regionGrid, regionMinDiff);
  const perceptualScore = 1 - (perceptualSum / (total * 255));

  return {
    diffDataUrl: outCanvas.toDataURL('image/png'),
    diffPixels,
    totalPixels: total,
    diffRatio: diffPixels / total,
    perceptualScore,
    regions,
    width,
    height
  };
}

function clusterRegions(isDiff, width, height, cellSize, minRatio) {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const hot = new Uint8Array(cols * rows);
  const counts = new Uint32Array(cols * rows);
  const cellArea = cellSize * cellSize;
  for (let p = 0; p < isDiff.length; p++) {
    if (!isDiff[p]) continue;
    const x = p % width;
    const y = (p / width) | 0;
    const cx = (x / cellSize) | 0;
    const cy = (y / cellSize) | 0;
    counts[cy * cols + cx]++;
  }
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] / cellArea >= minRatio) hot[i] = 1;
  }
  const visited = new Uint8Array(cols * rows);
  const regions = [];
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const idx = cy * cols + cx;
      if (!hot[idx] || visited[idx]) continue;
      let minX = cx, maxX = cx, minY = cy, maxY = cy, pixels = 0;
      const stack = [idx];
      visited[idx] = 1;
      while (stack.length) {
        const i = stack.pop();
        const x = i % cols;
        const y = (i / cols) | 0;
        pixels += counts[i];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (hot[ni] && !visited[ni]) {
            visited[ni] = 1;
            stack.push(ni);
          }
        }
      }
      regions.push({
        x: minX * cellSize,
        y: minY * cellSize,
        w: Math.min(width, (maxX + 1) * cellSize) - minX * cellSize,
        h: Math.min(height, (maxY + 1) * cellSize) - minY * cellSize,
        pixels
      });
    }
  }
  regions.sort((a, b) => b.pixels - a.pixels);
  return regions.slice(0, 20);
}

export function trimDesignWhitespace(dataUrl, tolerance = 8) {
  return loadImage(dataUrl).then((img) => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    const bg = [data[0], data[1], data[2], data[3]];
    function matches(i) {
      return Math.abs(data[i] - bg[0]) <= tolerance
        && Math.abs(data[i + 1] - bg[1]) <= tolerance
        && Math.abs(data[i + 2] - bg[2]) <= tolerance
        && Math.abs(data[i + 3] - bg[3]) <= tolerance;
    }
    let top = 0, bottom = h - 1, left = 0, right = w - 1;
    outer1: for (; top < h; top++) for (let x = 0; x < w; x++) if (!matches((top * w + x) * 4)) break outer1;
    outer2: for (; bottom > top; bottom--) for (let x = 0; x < w; x++) if (!matches((bottom * w + x) * 4)) break outer2;
    outer3: for (; left < w; left++) for (let y = top; y <= bottom; y++) if (!matches((y * w + left) * 4)) break outer3;
    outer4: for (; right > left; right--) for (let y = top; y <= bottom; y++) if (!matches((y * w + right) * 4)) break outer4;
    const nw = right - left + 1;
    const nh = bottom - top + 1;
    if (nw === w && nh === h) return dataUrl;
    const out = document.createElement('canvas');
    out.width = nw;
    out.height = nh;
    out.getContext('2d').drawImage(canvas, left, top, nw, nh, 0, 0, nw, nh);
    return out.toDataURL('image/png');
  });
}
