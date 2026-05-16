(() => {
  if (window.__figmaCompareInjected) return;
  window.__figmaCompareInjected = true;

  const OVERLAY_ID = 'figma-compare-overlay-root';
  const MEASURE_ID = 'figma-compare-measure-root';
  const GRID_ID = 'figma-compare-grid-root';

  const overlayState = {
    visible: false,
    dataUrl: null,
    opacity: 0.5,
    blendMode: 'difference',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    locked: false
  };

  const measureState = { enabled: false, points: [] };

  const gridState = {
    visible: false,
    size: 8,
    majorEvery: 8,
    color: '#5b5bd6',
    opacity: 0.25
  };

  const fixedHider = { active: false, stash: [] };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message?.type) {
        case 'TOGGLE_OVERLAY':
          overlayState.visible = !overlayState.visible && !!overlayState.dataUrl;
          renderOverlay();
          sendResponse({ ok: true, data: { visible: overlayState.visible } });
          break;
        case 'SET_OVERLAY':
          Object.assign(overlayState, sanitize(message.payload, ['dataUrl', 'opacity', 'blendMode', 'offsetX', 'offsetY', 'scale', 'locked']));
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
        case 'TOGGLE_GRID':
          gridState.visible = !gridState.visible;
          renderGrid();
          sendResponse({ ok: true, data: { visible: gridState.visible } });
          break;
        case 'SET_GRID':
          Object.assign(gridState, sanitize(message.payload, ['size', 'majorEvery', 'color', 'opacity']));
          if (message.payload?.visible === true) gridState.visible = true;
          else if (message.payload?.visible === false) gridState.visible = false;
          renderGrid();
          sendResponse({ ok: true, data: { visible: gridState.visible } });
          break;
        case 'GET_PAGE_METRICS':
          sendResponse({
            ok: true,
            data: {
              dpr: devicePixelRatio,
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight,
              scrollHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
              scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
              devicePixelRatio
            }
          });
          break;
        case 'SET_SCROLL':
          window.scrollTo({ left: message.payload?.x ?? 0, top: message.payload?.y ?? 0, behavior: 'instant' });
          sendResponse({ ok: true });
          break;
        case 'HIDE_FIXED':
          toggleFixedHider(message.payload?.hide === true);
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: 'Unknown message in content script' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message ?? String(e) });
    }
    return true;
  });

  function sanitize(payload, keys) {
    if (!payload) return {};
    const out = {};
    for (const key of keys) if (payload[key] !== undefined) out[key] = payload[key];
    return out;
  }

  // ===== Overlay (with drag-to-position) =====

  function ensureOverlayRoot() {
    let root = document.getElementById(OVERLAY_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.className = 'fc-overlay-root';

    const img = document.createElement('img');
    img.className = 'fc-overlay-img';
    img.alt = '';
    img.draggable = false;

    const toolbar = document.createElement('div');
    toolbar.className = 'fc-overlay-toolbar';
    toolbar.innerHTML = `
      <span class="fc-tag">Figma overlay</span>
      <span class="fc-hint">Alt+drag to move</span>
      <button class="fc-btn" data-act="reset" title="Reset position">Reset</button>
      <button class="fc-btn" data-act="lock" title="Lock movement">Lock</button>
      <button class="fc-btn" data-act="hide" title="Hide overlay">Hide</button>
    `;
    toolbar.addEventListener('mousedown', (e) => e.stopPropagation());
    toolbar.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'hide') {
        overlayState.visible = false;
        renderOverlay();
        notifyOverlay();
      } else if (act === 'reset') {
        overlayState.offsetX = 0;
        overlayState.offsetY = 0;
        overlayState.scale = 1;
        renderOverlay();
        notifyOverlay();
      } else if (act === 'lock') {
        overlayState.locked = !overlayState.locked;
        renderOverlay();
      }
    });

    root.appendChild(img);
    root.appendChild(toolbar);
    attachDrag(root, img);
    document.documentElement.appendChild(root);
    return root;
  }

  function attachDrag(root, img) {
    let dragging = false;
    let startX = 0, startY = 0, baseX = 0, baseY = 0;

    img.addEventListener('mousedown', (e) => {
      if (overlayState.locked) return;
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      baseX = overlayState.offsetX;
      baseY = overlayState.offsetY;
      root.style.cursor = 'grabbing';
      root.style.pointerEvents = 'auto';
      img.style.pointerEvents = 'auto';
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      overlayState.offsetX = Math.round(baseX + (e.clientX - startX));
      overlayState.offsetY = Math.round(baseY + (e.clientY - startY));
      applyOverlayTransform();
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      root.style.cursor = '';
      img.style.pointerEvents = '';
      root.style.pointerEvents = '';
      notifyOverlay();
    });

    window.addEventListener('wheel', (e) => {
      if (!overlayState.visible || overlayState.locked || !e.altKey) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      overlayState.scale = Math.min(4, Math.max(0.1, overlayState.scale * factor));
      applyOverlayTransform();
      notifyOverlay();
    }, { passive: false });
  }

  function notifyOverlay() {
    chrome.runtime.sendMessage({
      type: 'OVERLAY_DRAGGED',
      payload: {
        offsetX: overlayState.offsetX,
        offsetY: overlayState.offsetY,
        scale: overlayState.scale,
        visible: overlayState.visible
      }
    }).catch(() => {});
  }

  function applyOverlayTransform() {
    const root = document.getElementById(OVERLAY_ID);
    if (!root) return;
    const img = root.querySelector('.fc-overlay-img');
    if (img) img.style.transform = `translate(${overlayState.offsetX}px, ${overlayState.offsetY}px) scale(${overlayState.scale})`;
  }

  function renderOverlay() {
    if (!overlayState.visible) {
      const existing = document.getElementById(OVERLAY_ID);
      if (existing) existing.style.display = 'none';
      return;
    }
    const root = ensureOverlayRoot();
    root.style.display = 'block';
    root.classList.toggle('fc-locked', overlayState.locked === true);
    const img = root.querySelector('.fc-overlay-img');
    if (overlayState.dataUrl && img.src !== overlayState.dataUrl) img.src = overlayState.dataUrl;
    img.style.opacity = overlayState.opacity;
    img.style.mixBlendMode = overlayState.blendMode;
    applyOverlayTransform();
    const lockBtn = root.querySelector('[data-act="lock"]');
    if (lockBtn) lockBtn.textContent = overlayState.locked ? 'Unlock' : 'Lock';
  }

  // ===== Grid =====

  function ensureGridRoot() {
    let root = document.getElementById(GRID_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = GRID_ID;
    root.className = 'fc-grid-root';
    document.documentElement.appendChild(root);
    return root;
  }

  function renderGrid() {
    if (!gridState.visible) {
      const existing = document.getElementById(GRID_ID);
      if (existing) existing.remove();
      return;
    }
    const root = ensureGridRoot();
    const size = Math.max(2, gridState.size);
    const major = Math.max(1, gridState.majorEvery) * size;
    const c = gridState.color;
    const a = Math.max(0, Math.min(1, gridState.opacity));
    root.style.backgroundImage = `
      linear-gradient(to right, rgba(${hexToRgb(c)}, ${a}) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(${hexToRgb(c)}, ${a}) 1px, transparent 1px),
      linear-gradient(to right, rgba(${hexToRgb(c)}, ${Math.min(1, a + 0.25)}) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(${hexToRgb(c)}, ${Math.min(1, a + 0.25)}) 1px, transparent 1px)
    `;
    root.style.backgroundSize = `${size}px ${size}px, ${size}px ${size}px, ${major}px ${major}px, ${major}px ${major}px`;
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  // ===== Fixed-element hider (for full-page screenshots) =====

  function toggleFixedHider(hide) {
    if (hide === fixedHider.active) return;
    if (hide) {
      fixedHider.stash = [];
      const all = document.body?.querySelectorAll('*') ?? [];
      for (const el of all) {
        if (el.id === OVERLAY_ID || el.id === MEASURE_ID || el.id === GRID_ID) continue;
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'sticky') {
          fixedHider.stash.push({ el, visibility: el.style.visibility });
          el.style.visibility = 'hidden';
        }
      }
      fixedHider.active = true;
    } else {
      for (const { el, visibility } of fixedHider.stash) el.style.visibility = visibility;
      fixedHider.stash = [];
      fixedHider.active = false;
    }
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
    if (!el || el.closest(`#${OVERLAY_ID}, #${MEASURE_ID}, #${GRID_ID}`)) return;
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

    const tag = el.tagName.toLowerCase()
      + (el.id ? `#${el.id}` : '')
      + (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '');
    const label = root.querySelector('.fc-measure-label');
    label.innerHTML = `
      <strong>${tag}</strong>
      <span>${Math.round(rect.width)} × ${Math.round(rect.height)}</span>
      <span>padding: ${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}</span>
      <span>margin: ${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}</span>
      <span>font: ${style.fontSize} / ${style.lineHeight} · color ${style.color}</span>
      <span>bg: ${style.backgroundColor}</span>
    `;
    label.style.left = Math.min(window.innerWidth - 280, e.clientX + 16) + window.scrollX + 'px';
    label.style.top = Math.min(window.innerHeight - 140, e.clientY + 16) + window.scrollY + 'px';
  }

  function onMeasureClick(e) {
    if (!measureState.enabled) return;
    if (e.target.closest(`#${OVERLAY_ID}, #${MEASURE_ID}, #${GRID_ID}`)) return;
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
