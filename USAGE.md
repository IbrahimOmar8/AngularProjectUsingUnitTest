# Figma UI Compare — Usage Guide

A step‑by‑step walkthrough of every feature in the extension, with screenshots‑in‑words, tips, and troubleshooting.

> **TL;DR (60 seconds)**
> 1. Load the extension into Chrome/Edge (Developer mode → Load unpacked).
> 2. Open the page you are building, then open the side panel (toolbar icon → **Open compare panel**, or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>).
> 3. In **1. Load the design**, drop your Figma export PNG.
> 4. In **2. Capture the live UI**, click **Capture viewport**.
> 5. In **3. Compare**, choose *Overlay*, *Side by side*, *Pixel diff*, or *Palette*.

---

## Table of contents

1. [Install the extension](#1-install-the-extension)
2. [Open the compare panel](#2-open-the-compare-panel)
3. [Load a design](#3-load-a-design)
   - [3.1 Upload an image](#31-upload-an-image)
   - [3.2 Fetch from Figma API](#32-fetch-from-figma-api)
   - [3.3 Use the saved library](#33-use-the-saved-library)
4. [Capture the live UI](#4-capture-the-live-ui)
   - [4.1 Viewport capture](#41-viewport-capture)
   - [4.2 Full‑page capture](#42-full-page-capture)
   - [4.3 Viewport presets](#43-viewport-presets)
5. [Compare modes](#5-compare-modes)
   - [5.1 Overlay](#51-overlay)
   - [5.2 Side by side](#52-side-by-side)
   - [5.3 Pixel diff](#53-pixel-diff)
   - [5.4 Palette](#54-palette)
6. [Layout grid](#6-layout-grid)
7. [Measure on page](#7-measure-on-page)
8. [Export](#8-export)
9. [Keyboard shortcuts](#9-keyboard-shortcuts)
10. [Theme & settings](#10-theme--settings)
11. [Troubleshooting](#11-troubleshooting)
12. [FAQ](#12-faq)

---

## 1. Install the extension

The extension is not in the Chrome Web Store yet — install it unpacked.

1. Clone or download this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Toggle **Developer mode** (top‑right).
4. Click **Load unpacked**.
5. Select the project folder (the one that contains `manifest.json`).
6. Pin **Figma UI Compare** to your toolbar (puzzle‑piece icon → pin).

> If you make code changes, click the refresh icon on the extension card in `chrome://extensions` to reload.

---

## 2. Open the compare panel

The extension has two surfaces:

- **Toolbar popup** — small menu with quick toggles (overlay / grid / measure / open panel).
- **Side panel** — the main interface, opens on the right side of the browser.

To open the side panel:

- Click the toolbar icon → **Open compare panel**, *or*
- Press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>.

The panel stays open while you switch tabs. It works on any page (regular websites, `localhost`, intranet, etc.).

---

## 3. Load a design

The side panel’s **section 1** has three tabs: *Upload image*, *Figma API*, *Library*.

### 3.1 Upload an image

The fastest path — works without any Figma credentials.

1. In Figma, select the frame.
2. Right panel → **Export** → choose **PNG**, scale **2×** (recommended).
3. Drop the file into the dropzone (or click to pick).

The thumbnail in **3. Compare → Side by side → Design** updates automatically.

> **Tip:** export at 2× for crisp comparison. Use 1× only if the design and the captured page will both be at the same scale.

### 3.2 Fetch from Figma API

Pulls the rendered PNG directly via the official Figma REST API.

**One‑time setup — create a personal access token:**

1. Go to <https://www.figma.com/settings>.
2. Scroll to **Personal access tokens** → **Generate new token**.
3. Give it a name (e.g., *UI Compare*), set an expiration, and **copy** the token (it starts with `figd_…`). You can only see it once.

**Each time you want a new design:**

1. In Figma, click the frame so it is selected.
2. Right‑click the frame → **Copy link to selection** (or **Copy as → Copy link**).
3. In the side panel, switch to the **Figma API** tab.
4. Paste the link into **Figma frame URL** — it should look like
   `https://www.figma.com/design/abc123FILE/Name?node-id=12-345`.
5. Paste your token into **Personal access token** (stored locally only).
6. Pick a **Render scale** (2× is the sweet spot).
7. Click **Fetch from Figma**.

The extension parses the file key and node id from the URL, calls `api.figma.com/v1/images`, and loads the resulting PNG.

> **Token security:** the token is stored in `chrome.storage.local` on this device only. It is sent only to `api.figma.com`. To rotate or remove it, edit/clear the field and (optionally) revoke it from `figma.com/settings`.

### 3.3 Use the saved library

The **Library** tab lets you save and recall up to **24** designs.

1. Load any design (upload or API).
2. Switch to the **Library** tab.
3. Type a name (e.g., *Home — Hero — Desktop*) → click **Save current**.
4. The card appears with a thumbnail. Click any card to switch designs.
5. Click the **×** on a card to remove it.

This is handy when comparing one page against multiple breakpoints (e.g., *Home / 375*, *Home / 768*, *Home / 1280*).

---

## 4. Capture the live UI

### 4.1 Viewport capture

1. Open the page in the active tab.
2. Side panel → **2. Capture the live UI** → **Capture viewport**.

Captures exactly what is visible in the tab right now.

### 4.2 Full‑page capture

1. Click **Full page**.
2. Wait — the extension scrolls through the page in steps, hides `position: fixed/sticky` elements during capture so they don’t duplicate, takes a screenshot of each tile, and stitches them together.

> **Time:** Chrome throttles tab captures to ~2/sec, so a tall page may take 5–20 seconds.
> **Edge cases:** virtualized lists (infinite scroll) only capture what is rendered at each scroll position. Lazy‑loaded images may need an extra capture pass.

### 4.3 Viewport presets

To compare against a design that targets a specific width:

1. In **2. Capture the live UI**, choose a width from **Viewport preset** (e.g., *Mobile · 375*).
2. Click **Resize window**.

The browser window resizes to that width. Then run a viewport capture again.

> Resizes the **window**, not just the tab. Other tabs in the same window are affected.

---

## 5. Compare modes

Section **3. Compare** has four sub‑tabs.

### 5.1 Overlay

Puts the design on top of the live page so you can see exactly where things shift.

| Control | What it does |
|---|---|
| **Design opacity** | Slider — 0 (invisible) to 100% (fully covers the page). |
| **Blend** | CSS blend mode. *Difference* highlights mismatches in color (best for spotting shifts). *Multiply* good for darkening. *Normal* if blend modes look weird with cross‑origin content. |
| **Offset X / Y** | Pixel offset of the overlay. Useful when the design’s 0,0 isn’t the page’s 0,0. |
| **Scale %** | Resize the overlay. 100% = the design’s natural size. |
| **Show on page** | Push current settings to the active tab. |
| **Hide** | Remove the overlay (keeps your settings). |
| **Fit to width** | Auto‑scale so the design width equals the viewport width. Use this first. |
| **Reset** | Offsets back to 0, scale to 100%. |
| **Blink** | Flips between design and live every 0.55 s — the *onion‑skin* technique for spotting small shifts. Click again to stop. |

**Drag and zoom directly on the page:**

- Hold <kbd>Alt</kbd> and **drag** the overlay to nudge it.
- Hold <kbd>Alt</kbd> and **scroll** to zoom.
- The X / Y / Scale inputs in the side panel update in real time.

There is also a small toolbar on the page itself with **Reset**, **Lock**, **Hide**.

> **Recommended workflow:** *Fit to width* → set blend to *Difference* → opacity ~60% → <kbd>Alt</kbd>+drag to align → switch to *Normal* + opacity ~40% to read it like a tracing.

### 5.2 Side by side

Shows the design and the captured page next to each other.

- **Loupe (4×)** — toggle a magnifying glass that follows your cursor and shows the same coordinates in both images, zoomed 4× — great for checking individual icons or 1px shifts.
- **Export side‑by‑side PNG** — saves both images joined into one PNG for sharing.

### 5.3 Pixel diff

A canvas‑based per‑pixel comparison.

1. Make sure both *design* and *live capture* are loaded.
2. Optional: tick **Auto‑trim** to strip uniform borders from the design (avoids false shifts when the export has padding the page doesn’t have).
3. Move the **Threshold** slider to control sensitivity:
   - **Low (≤16)** — very strict; catches anti‑aliasing differences.
   - **Mid (~32)** — recommended; ignores minor color noise.
   - **High (~80+)** — only flags large color shifts.
4. Click **Run diff**.

You will get:

- A diff image (live capture in grayscale, differing pixels in magenta).
- Stats: `N / M px differ (X.XX%) · perceptual match Y.Y% · WIDTH×HEIGHT`.
- A **Regions** list — the biggest clusters of differing pixels.

**Click any region** in the list → the live page scrolls to that location and pulses a red box around it for 2 seconds. This is the fastest way to fix the actual problem in your code.

### 5.4 Palette

Extract the dominant colors from the design.

1. Load a design.
2. Click **Extract from design**.
3. Up to 12 swatches appear. Click any swatch to copy its hex (e.g., `#5B5BD6`).

To sample a color from anywhere on screen (including your live page):

1. Click **Sample with eyedropper**.
2. Your cursor turns into a picker; click a pixel anywhere on the screen.
3. The hex is appended to **Sampled colors** below. Click to copy.

> The eyedropper uses the browser’s native `EyeDropper` API (Chrome 95+, Edge 95+).

---

## 6. Layout grid

Section **4. Layout grid** overlays a CSS background grid on the page.

| Control | What it does |
|---|---|
| **Cell px** | Size of each grid square. 8 = the classic 8pt baseline. |
| **Major every** | Every N cells, a stronger line is drawn (e.g., 8 cells × 8 px = a 64 px major). |
| **Color** | Line color. |
| **Opacity** | 0–100%. Keep it low (~25%) to avoid visual noise. |
| **Toggle grid** | Show / hide. Or use <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>. |

Common presets:

- *4 pt base, major every 8* — Material 3.
- *8 pt base, major every 8* — most marketing sites.
- *16 px base, major every 4* — when the design is built on a 16/64 grid.

---

## 7. Measure on page

Section **5. Measure on page** turns the cursor into an inspector.

1. Click **Enable measure tool** (or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>).
2. **Hover** any element — a card next to the cursor shows:
   - Selector (tag · id · classes).
   - Size in CSS pixels.
   - `padding`, `margin`, font size / line height, text color, background color.
3. **Click two points** anywhere — a line is drawn between them with the distance in pixels and the X/Y deltas.
4. Press <kbd>Esc</kbd> to exit.

> The tool reads `getComputedStyle()`, so it shows what the browser actually applied, not just the CSS source.

---

## 8. Export

After running a diff, three exports become available:

| Button | File | Content |
|---|---|---|
| **Export side‑by‑side PNG** (in *Side by side*) | `figma-compare-side-by-side-YYYYMMDD-HHMMSS.png` | Design and live joined horizontally. |
| **Export diff PNG** (in *Pixel diff*) | `figma-compare-diff-…png` | Grayscale live + magenta diff pixels. |
| **Export report** (in *Pixel diff*) | `figma-compare-report-…png` | Title + stats + design, live, and diff stacked horizontally — great for PR comments. |

Files go to your browser’s default download folder. A *Save as…* dialog appears so you can rename.

---

## 9. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd> | Toggle overlay |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Toggle measure tool |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> | Toggle layout grid |
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> | Open the side panel |
| <kbd>Alt</kbd>+drag (on page, overlay visible) | Move the overlay |
| <kbd>Alt</kbd>+scroll (on page, overlay visible) | Zoom the overlay |
| <kbd>Esc</kbd> | Exit measure tool |

To change a binding, go to `chrome://extensions/shortcuts`, find **Figma UI Compare**, and click the pencil.

---

## 10. Theme & settings

In the side panel header you can choose **Auto / Light / Dark**. Everything else (sliders, dropdowns, threshold, grid settings, theme) is **auto‑saved** to `chrome.storage.local` and restored next time you open the panel.

To start fresh, you can clear the extension’s storage from `chrome://extensions` → **Details** → **Site data** (or remove and re‑add the extension).

---

## 11. Troubleshooting

**The overlay doesn’t appear after clicking *Show on page*.**
- Check that a design is loaded (the *Design* thumbnail shouldn’t say “No design”).
- The extension can’t run on Chrome internal pages (`chrome://…`, `chrome-extension://…`, the Web Store). Switch to your app.
- If the page sets a very strict CSP that blocks inline styles on `<img>`, switch the blend mode to **Normal**.

**Figma fetch fails with 403 / 404.**
- The token is wrong, expired, or has been revoked. Generate a new one and re‑paste.
- The URL is missing `node-id=…`. Open the frame in Figma, right‑click → **Copy link to selection**.
- The file is in a Figma org you don’t have access to with that token.

**`Capture viewport` errors with `Cannot access contents of the page`.**
- You are on a privileged page (e.g., `chrome://`). Switch to your app.

**Full‑page capture is missing content.**
- Heavily virtualized pages (e.g., long Twitter‑style feeds) only render what is in view. The extension scrolls in tiles but pages that recycle DOM lose earlier content. As a workaround, capture the *viewport* of each section separately.

**The overlay drags but nothing happens / inputs don’t sync.**
- Reload the tab and try again. The content script needs to inject after navigation.
- Disable the extension on that tab if a page script aggressively intercepts mouse events; reload, then re‑enable.

**Window resize did the wrong thing.**
- Some OS window managers (tiling, snapping) override `chrome.windows.update`. Try unsnapping the window, then choose the preset again.

**Pixel diff says 100% different.**
- The design and the capture have different sizes — the smaller dimensions are used, but the *content* may be offset. Use **Fit to width** in *Overlay* first to align, then re‑capture, then diff.

**Eyedropper button does nothing.**
- Your browser doesn’t support the `EyeDropper` API. Update Chrome/Edge to a recent version. Firefox is not yet supported.

---

## 12. FAQ

**Where is my Figma token stored?**
Local to this device in `chrome.storage.local`. The extension only ever sends it to `api.figma.com`.

**Does anything leave my machine?**
No. There are no analytics or external servers. Diffs, palettes, the library — everything runs in your browser.

**Can I use this with Firefox?**
Not yet. The extension uses Manifest V3, the side panel API, and the `EyeDropper` API, which Firefox is still rolling out.

**How big can a saved design be?**
The library uses `unlimitedStorage`. In practice, keep each design under ~5 MB so the thumbnails stay responsive.

**Can I share comparisons with my team?**
Yes — use **Export report** to get a single PNG that includes the design, the live capture, the diff, and stats. Paste it into a PR, Slack, or Linear ticket.

**Does it work on `localhost`?**
Yes. The extension has `<all_urls>` host permission for capture.

**Can I overlay on a Figma page itself?**
Technically yes, but it’s rarely useful. The overlay is meant for comparing a built UI against the design, not designs against designs.

---

If you find something missing from this guide, please open an issue.
