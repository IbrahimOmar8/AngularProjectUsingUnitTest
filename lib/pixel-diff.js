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
  const total = width * height;
  const d = designData.data;
  const a = actualData.data;
  const o = out.data;

  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i], dg = d[i + 1], db = d[i + 2];
    const ar = a[i], ag = a[i + 1], ab = a[i + 2];
    const delta = Math.abs(dr - ar) + Math.abs(dg - ag) + Math.abs(db - ab);

    if (delta > threshold) {
      o[i] = highlight[0];
      o[i + 1] = highlight[1];
      o[i + 2] = highlight[2];
      o[i + 3] = highlight[3];
      diffPixels++;
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

  return {
    diffDataUrl: outCanvas.toDataURL('image/png'),
    diffPixels,
    totalPixels: total,
    diffRatio: diffPixels / total,
    width,
    height
  };
}
