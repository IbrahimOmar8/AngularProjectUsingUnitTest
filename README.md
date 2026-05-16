# Figma UI Compare

Browser extension (Chrome / Edge, Manifest V3) that helps developers match their live UI to a Figma design.

## Features

- **Load the design** in two ways:
  - Upload a PNG/JPG exported from Figma.
  - Paste a Figma frame URL + personal access token — the extension pulls the rendered PNG through the Figma REST API.
- **Capture the current tab** as a screenshot from the side panel.
- **Compare modes**:
  - **Overlay** the design over the live page with opacity, blend mode, offset and scale controls.
  - **Side-by-side** thumbnails of design and capture.
  - **Pixel diff** — highlights differing pixels in magenta with a per-pixel threshold and reports the diff ratio.
- **Measure tool** that injects into the page: hover any element to see size, padding, margin and font; click two points to measure distance and angle.

## Install (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and pick this repository folder.
4. Pin the *Figma UI Compare* action to your toolbar.

## Usage

1. Open the page you are building.
2. Click the extension icon and choose **Open compare panel** (opens the side panel).
3. **Step 1 — Load the design**:
   - *Upload image*: drop the exported PNG/JPG.
   - *Figma API*:
     - Create a personal access token at `figma.com → Settings → Personal access tokens`.
     - In Figma, select the frame, right‑click → **Copy link to selection**. Paste the URL.
     - Click **Fetch from Figma**.
4. **Step 2 — Capture the live UI**: click **Capture current tab**.
5. **Step 3 — Compare**: switch between *Overlay*, *Side by side* and *Pixel diff*.
6. **Step 4 — Measure**: click **Enable measure tool** to inspect spacing and sizes on the live page. Press **Esc** to exit.

## Project structure

```
manifest.json              # MV3 manifest
background/
  service-worker.js        # Routing, screenshot capture, Figma proxy
content/
  content.js               # Page overlay + measurement tool
  content.css
popup/                     # Toolbar popup
sidepanel/                 # Main UI (Chrome side panel)
lib/
  figma-api.js             # Figma REST helpers
  pixel-diff.js            # Canvas-based pixel diff
icons/                     # 16/48/128 PNG icons
```

## Permissions

| Permission | Why |
|---|---|
| `activeTab`, `tabs`, `scripting` | Send overlay / measurement commands to the active page. |
| `storage` | Persist Figma token and last‑used URL locally. |
| `sidePanel` | Host the main UI. |
| `host_permissions` | Capture the visible tab and call `api.figma.com`. |

The Figma token is stored only in `chrome.storage.local`. It is never sent anywhere except `api.figma.com`.

## Privacy

No analytics. No external server. Screenshots and design images never leave your machine — diffs run locally in the side‑panel canvas.
