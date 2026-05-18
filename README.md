# Figma UI Compare

Browser extension (Chrome / Edge, Manifest V3) that helps developers match their live UI to a Figma design.

> **Looking for a step‑by‑step walkthrough?** See **[USAGE.md](./USAGE.md)** — installation, every feature, screenshots‑in‑words, troubleshooting, and FAQ.

## Features

### Load the design
- **Upload** a PNG/JPG exported from Figma.
- **Figma REST API** — paste a frame URL + personal access token; the extension pulls the rendered PNG.
- **Library** — save up to 24 named designs and switch between them with one click. Stored locally on this device.

### Capture the live UI
- **Viewport screenshot** of the current tab.
- **Full‑page screenshot** that scrolls and stitches tiles. `position: fixed` / `sticky` elements are temporarily hidden during capture to avoid duplicates.
- **Viewport presets** — resize the window to standard widths (375 / 414 / 768 / 1024 / 1280 / 1440 / 1920).

### Compare
- **Overlay** the design over the live page with opacity, blend mode (Difference, Multiply, Screen, Overlay), offset and scale controls.
- **Drag‑to‑position**: hold <kbd>Alt</kbd> and drag the overlay directly on the page; <kbd>Alt</kbd>+scroll to zoom. The side panel inputs sync live.
- **Lock / Reset / Fit‑to‑width** controls; *Fit to width* auto‑scales the design to the current viewport.
- **Blink mode** — auto‑flips between design and live every 0.55s, the classic onion‑skin trick for spotting misalignment.
- **Side‑by‑side** thumbnails with an optional **loupe (4×)** that magnifies the same point in both images.
- **Pixel diff** — adjustable threshold, perceptual match score, optional **auto‑trim** of design whitespace, and a clickable **regions list** that jumps to and highlights the differing area on the live page.
- **Palette** — extract the dominant colors from the design, plus a **native eyedropper** for sampling any color from your screen.

### Inspect on page
- **Layout grid** with configurable cell size, major every N cells, color and opacity. Useful for 4pt / 8pt grids.
- **Measure tool** — hover any element to see size, padding, margin, font and background color. Click two points to measure distance and angle. Press <kbd>Esc</kbd> to exit.

### Export
- Download the **diff PNG**, a **side‑by‑side comparison PNG**, or a single **report image** that includes design, live capture, diff and stats.

### Side panel
- **Theme switch** (Auto / Light / Dark) in the header.
- All sliders, dropdowns and grid settings are **persisted** between sessions in `chrome.storage.local`.

### Keyboard shortcuts
| Shortcut | Action |
|---|---|
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> | Toggle overlay |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Toggle measure tool |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> | Toggle layout grid |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> | Open the compare side panel |

Customize at `chrome://extensions/shortcuts`.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and pick this repository folder.
4. Pin the *Figma UI Compare* action to your toolbar.

## Usage

1. Open the page you are building.
2. Click the extension icon → **Open compare panel** (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>).
3. **Step 1 — Load a design** via upload, Figma API, or your library.
4. **Step 2 — Capture** the viewport or the full page. Optionally resize the window to a preset width to match the design.
5. **Step 3 — Compare** in Overlay / Side‑by‑side / Pixel diff / Palette modes. Use <kbd>Alt</kbd>+drag on the page to align the overlay.
6. **Step 4 — Grid** — turn on the 4/8pt grid for spacing checks.
7. **Step 5 — Measure** — inspect specific elements; export reports if you need to share findings.

## Project structure

```
manifest.json              # MV3 manifest, permissions, commands
background/
  service-worker.js        # Routing, screenshots, full-page capture, downloads
content/
  content.js               # Overlay + drag + grid + measure + scroll helpers
  content.css
popup/                     # Toolbar popup
sidepanel/                 # Main UI (Chrome side panel)
lib/
  figma-api.js             # Figma REST helpers
  pixel-diff.js            # Canvas pixel diff
  palette.js               # Dominant-color extraction
  library.js               # Saved-design library
icons/                     # 16/48/128 PNG icons
```

## Permissions

| Permission | Why |
|---|---|
| `activeTab`, `tabs`, `scripting` | Send overlay / measurement / capture commands to the active page. |
| `storage`, `unlimitedStorage` | Persist Figma token, last‑used URL, and the saved‑design library. |
| `sidePanel` | Host the main UI. |
| `downloads` | Save diff / comparison / report PNGs to disk. |
| `host_permissions` | Capture the visible tab and call `api.figma.com`. |

The Figma token is stored only in `chrome.storage.local`. It is never sent anywhere except `api.figma.com`.

## Privacy

No analytics, no external server. Screenshots, designs and the library never leave your machine — diffs and palettes run locally in the side‑panel canvas.

## Known limitations

- Full‑page screenshots can take several seconds on long pages because of Chrome's tab‑capture rate limit (~2/sec).
- Pages with very tall, virtualized content (e.g. infinite scroll) won't fully capture beyond what the page renders for the requested scroll position.
- Some pages with strict CSP block `mix-blend-mode` on `:: cross-origin images. If the overlay looks washed out, switch the blend mode to *Normal*.
