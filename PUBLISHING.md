# Publishing Guide — Figma UI Compare

This guide walks through publishing the extension to the **GitHub Releases**, **Chrome Web Store** and **Microsoft Edge Add-ons**.

The build artifact lives in `dist/figma-ui-compare-v1.2.0.zip` and contains:

```
manifest.json
background/  content/  popup/  sidepanel/  lib/  icons/
README.md  USAGE.md
```

A fresh ZIP can be rebuilt with:

```bash
rm -f dist/*.zip && mkdir -p dist
zip -r dist/figma-ui-compare-v$(jq -r .version manifest.json).zip \
  manifest.json background content popup sidepanel lib icons README.md USAGE.md \
  -x '*.DS_Store'
```

---

## 1. GitHub Release (free, immediate)

This is the fastest way to ship — users install the unpacked extension by clicking **Load unpacked** in `chrome://extensions`.

A tag `v1.2.0` is pushed to the repo. To create the release on GitHub:

1. Open <https://github.com/IbrahimOmar8/AngularProjectUsingUnitTest/releases/new>.
2. Pick the tag `v1.2.0` from the dropdown.
3. Set the title: `Figma UI Compare v1.2.0`.
4. Paste the changelog below into the description.
5. Drag `dist/figma-ui-compare-v1.2.0.zip` into the **Attach binaries** area.
6. Click **Publish release**.

**Suggested release notes:**

```
## Features

- Load Figma designs via image upload, Figma REST API, or saved library
- Capture viewport or full-page screenshots of the live UI
- Compare modes: overlay (with Alt-drag positioning), side-by-side with 4× loupe, pixel diff with clickable regions list and perceptual match score, color palette + native EyeDropper
- 8 pt layout grid, on-page measure tool, viewport-width presets
- Keyboard shortcuts (Alt+Shift+O/M/G/P)
- Export diff / side-by-side / report PNGs
- Light / dark / auto theme, all settings persisted

See README.md and USAGE.md for installation and a full walkthrough.
```

---

## 2. Chrome Web Store

**Requirements**

- A Google account.
- A one-time **$5 USD** developer registration fee.
- 1280×800 (or 640×400) **screenshots** of the extension (at least 1, up to 5).
- A 440×280 **small promotional tile** (optional but recommended).
- An **icon 128×128** — already included in `icons/icon128.png`.
- A **privacy policy URL** (this extension does not collect data; you can host a one-paragraph statement on a GitHub Pages or Gist).

**Steps**

1. Go to <https://chrome.google.com/webstore/devconsole>, sign in, pay the $5 registration fee if you have not.
2. Click **Add new item**.
3. Upload `dist/figma-ui-compare-v1.2.0.zip`.
4. Fill in the listing:
   - **Name:** Figma UI Compare
   - **Summary** (132 chars max): *Compare your live web UI to a Figma design — overlay, side-by-side, pixel diff, palette, and on-page measure tools.*
   - **Description:** copy the *Features* list from README.md.
   - **Category:** *Developer Tools*.
   - **Language:** English (add Arabic if you translate the store listing).
5. **Privacy practices** tab:
   - **Single purpose:** *Help developers compare a web page in their browser against a Figma design.*
   - **Permission justifications:**
     - `activeTab`, `tabs`, `scripting` → *Inject the overlay, grid and measure tools into the page the user is comparing.*
     - `storage`, `unlimitedStorage` → *Save the Figma personal access token and the local library of designs on the user's device.*
     - `sidePanel` → *Host the main comparison UI.*
     - `downloads` → *Save diff, side-by-side, and report PNGs to disk.*
     - `host_permissions: <all_urls>` → *Capture the visible tab and overlay the design on the user's site under test.*
     - `host_permissions: api.figma.com` → *Fetch rendered frames from the Figma REST API when the user provides a token.*
   - **Data usage:** select *Does not collect any user data*. Confirm none of the checkboxes for collected data types.
   - **Disclosure on remote code:** *No remote code used.*
6. **Distribution:**
   - Visibility: **Public** (or **Unlisted** if you want a private install link first).
   - Regions: All.
7. Click **Save draft** → **Submit for review**.

**Review time:** typically 1–3 business days for first-time submissions; updates are often faster.

---

## 3. Microsoft Edge Add-ons

**Requirements**

- A Microsoft account.
- **Free** developer registration (no fee).
- Same screenshots / icon / privacy policy as Chrome.

**Steps**

1. Go to <https://partner.microsoft.com/dashboard/microsoftedge>, sign in.
2. **Programs → Microsoft Edge** → **Register**. Choose *Individual* if you are publishing personally.
3. After registration, **Extensions → Create new extension**.
4. Upload `dist/figma-ui-compare-v1.2.0.zip` — Edge accepts the same MV3 package as Chrome.
5. Fill in the Store listing — copy from your Chrome listing (description, summary, screenshots).
6. **Properties** tab → set category *Developer tools*.
7. **Availability** → choose markets.
8. Click **Submit**.

**Review time:** typically 1–7 business days.

---

## After publishing

- Pin the live store URLs into the README so users can install with one click.
- For updates, bump `manifest.json#version` (e.g., `1.2.0 → 1.3.0`), rebuild the ZIP, push a new tag, and upload to each store. Chrome and Edge will queue another review.

---

## Quick checklist

- [ ] `manifest.json` version bumped if needed
- [ ] `dist/figma-ui-compare-vX.Y.Z.zip` built
- [ ] Git tag pushed (`git tag vX.Y.Z && git push origin vX.Y.Z`)
- [ ] GitHub Release created with ZIP attached
- [ ] Chrome Web Store draft submitted
- [ ] Edge Add-ons draft submitted
- [ ] Privacy policy URL ready
- [ ] Store screenshots prepared (1280×800)
