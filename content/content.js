(() => {
  if (window.__figmaCompareInjected) return;
  window.__figmaCompareInjected = true;

  const OVERLAY_ID = 'figma-compare-overlay-root';
  const MEASURE_ID = 'figma-compare-measure-root';

  const overlayState = {
    visible: false,
    dataUrl: null,
    opacity: 0.5,
    blendMode: 'difference',
    offsetX: 0,
    offsetY: 0,
    scale: 1
  };

  const measureState = {
    enabled: false,
    points: []
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message?.type) {
        case 'TOGGLE_OVERLAY':
          overlayState.visible = !overlayState.visible;
          renderOverlay();
          sendResponse({ ok: true, data: { visible: overlayState.visible } });
          break;
        case 'SET_OVERLAY':
          Object.assign(overlayState, sanitize(message.payload));
          if (message.payload?.visible === true) overlayState.visible = true;
          else if (message.payload?.visible === false) overlayState.visible = false;
          renderOverlay();
          sendResponse({ ok: true, data: { visible: overlayState.visible } });
          break;
        case 'TOGGLE_MEASURE':
          measureState.enabled = !measureState.enabled;
          measureState.points = [];
          renderMeasure();
          sendResponse({ ok: true, data: { enabled: measureState.enabled } });
          break;
        case 'GET_PAGE_METRICS':
          sendResponse({ ok: true, data: { dpr: devicePixelRatio, width: innerWidth, height: innerHeight } });
          break;
        default:
          sendResponse({ ok: false, error: 'Unknown message in content script' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message ?? String(e) });
    }
    return true;
  });

  function sanitize(payload) {
    if (!payload) return {};
    const out = {};
    for (const key of ['dataUrl', 'opacity', 'blendMode', 'offsetX', 'offsetY', 'scale']) {
      if (payload[key] !== undefined) out[key] = payload[key];
    }
    return out;
  }

  // ===== Overlay =====

  function ensureOverlayRoot() {
    let root = document.getElementById(OVERLAY_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.className = 'fc-overlay-root';

    const img = document.createElement('img');
    img.className = 'fc-overlay-img';
    img.alt = '';

    const toolbar = document.createElement('div');
    toolbar.className = 'fc-overlay-toolbar';
    toolbar.innerHTML = `
      <span>Figma overlay</span>
      <button class="fc-btn" data-act="hide" title="Hide overlay">Hide</button>
    `;
    toolbar.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'hide') {
        overlayState.visible = false;
        renderOverlay();
      }
    });

    root.appendChild(img);
    root.appendChild(toolbar);
    document.documentElement.appendChild(root);
    return root;
  }

  function renderOverlay() {
    const root = document.getElementById(OVERLAY_ID) || (overlayState.visible ? ensureOverlayRoot() : null);
    if (!root) return;
    if (!overlayState.visible) {
      root.style.display = 'none';
      return;
    }
    root.style.display = 'block';
    const img = root.querySelector('.fc-overlay-img');
    if (overlayState.dataUrl && img.src !== overlayState.dataUrl) img.src = overlayState.dataUrl;
    img.style.opacity = overlayState.opacity;
    img.style.mixBlendMode = overlayState.blendMode;
    img.style.transform = `translate(${overlayState.offsetX}px, ${overlayState.offsetY}px) scale(${overlayState.scale})`;
  }

  // ===== Measure tool =====

  function ensureMeasureRoot() {
    let root = document.getElementById(MEASURE_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = MEASURE_ID;
    root.className = 'fc-measure-root';

    const label = document.createElement('div');
    label.className = 'fc-measure-label';
    label.textContent = 'Hover an element. Click two points to measure distance. Press Esc to exit.';
    root.appendChild(label);

    const hoverBox = document.createElement('div');
    hoverBox.className = 'fc-measure-hover';
    root.appendChild(hoverBox);

    const distLine = document.createElement('div');
    distLine.className = 'fc-measure-line';
    root.appendChild(distLine);

    const pointA = document.createElement('div');
    pointA.className = 'fc-measure-point';
    root.appendChild(pointA);
    const pointB = document.createElement('div');
    pointB.className = 'fc-measure-point';
    root.appendChild(pointB);

    document.documentElement.appendChild(root);
    return root;
  }

  let lastHoverEl = null;

  function renderMeasure() {
    if (!measureState.enabled) {
      const root = document.getElementById(MEASURE_ID);
      if (root) root.remove();
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onMeasureClick, true);
      document.removeEventListener('keydown', onMeasureKey, true);
      lastHoverEl = null;
      return;
    }
    ensureMeasureRoot();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onMeasureClick, true);
    document.addEventListener('keydown', onMeasureKey, true);
  }

  function onMouseMove(e) {
    if (!measureState.enabled) return;
    const el = e.target;
    if (!el || el.closest(`#${OVERLAY_ID}, #${MEASURE_ID}`)) return;
    if (el === lastHoverEl) return;
    lastHoverEl = el;
    const root = ensureMeasureRoot();
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const hover = root.querySelector('.fc-measure-hover');
    hover.style.left = rect.left + window.scrollX + 'px';
    hover.style.top = rect.top + window.scrollY + 'px';
    hover.style.width = rect.width + 'px';
    hover.style.height = rect.height + 'px';

    const label = root.querySelector('.fc-measure-label');
    const tag = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    label.innerHTML = `
      <strong>${tag}</strong>
      <span>${Math.round(rect.width)} × ${Math.round(rect.height)}</span>
      <span>padding: ${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}</span>
      <span>margin: ${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}</span>
      <span>font: ${style.fontSize} / ${style.lineHeight} · color ${style.color}</span>
    `;
    label.style.left = Math.min(window.innerWidth - 280, e.clientX + 16) + window.scrollX + 'px';
    label.style.top = Math.min(window.innerHeight - 120, e.clientY + 16) + window.scrollY + 'px';
  }

  function onMeasureClick(e) {
    if (!measureState.enabled) return;
    if (e.target.closest(`#${OVERLAY_ID}, #${MEASURE_ID}`)) return;
    e.preventDefault();
    e.stopPropagation();

    const point = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
    measureState.points.push(point);
    if (measureState.points.length > 2) measureState.points = [point];

    const root = ensureMeasureRoot();
    const points = root.querySelectorAll('.fc-measure-point');
    const line = root.querySelector('.fc-measure-line');
    points.forEach((p, i) => {
      const data = measureState.points[i];
      if (data) {
        p.style.display = 'block';
        p.style.left = data.x + 'px';
        p.style.top = data.y + 'px';
      } else {
        p.style.display = 'none';
      }
    });

    if (measureState.points.length === 2) {
      const [a, b] = measureState.points;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      line.style.display = 'block';
      line.style.left = a.x + 'px';
      line.style.top = a.y + 'px';
      line.style.width = len + 'px';
      line.style.transform = `rotate(${angle}deg)`;
      line.dataset.label = `${Math.round(len)}px (Δx ${Math.round(dx)}, Δy ${Math.round(dy)})`;
    } else {
      line.style.display = 'none';
    }
  }

  function onMeasureKey(e) {
    if (e.key === 'Escape' && measureState.enabled) {
      measureState.enabled = false;
      renderMeasure();
    }
  }
})();
