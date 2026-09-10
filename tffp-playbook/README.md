# TFFP Digital Playbook

An interactive, page-turning web edition of *The Forgotten Folklore
Project* playbook by Lanuangla Tsudir (Sauramandala Foundation,
Meghalaya). Plain HTML/CSS/JS — no build step, no framework, no npm
install.

## What's here

- `index.html` — the reader: pages turn with a soft fade + slide
  transition (not a scroll), driven by click, swipe, or arrow keys, plus
  nav, a full table of contents, a progress bar, and a page-turn sound
  that's off by default (togglable; mute state persists in
  `localStorage`). Only one transition ever runs at a time — mashing
  next/prev rapidly collapses into a single pending destination rather
  than launching overlapping animations, so fast navigation can't corrupt
  the page count or flicker backwards. Skips the slide/fade entirely (an
  instant swap) when the OS-level "reduce motion" preference is on.
  Clicking the mascot logo (top left) jumps back to the cover from
  anywhere in the book.
- `pages/001.jpg` … `pages/110.jpg` — the actual print artwork, exported
  from the source Canva design ("TFFP_playbook print edition 12x6", 110
  pages). Each file is already a complete spread as designed — most are
  wide two-page spreads. Two exceptions are handled specially in
  `index.html` rather than shown as separate pages: `001.jpg` is the
  flattened print cover (back-cover art on its left half, front-cover art
  on its right half — how wraparound covers are laid out for print), so
  it's split in the browser and recombined into two proper spreads: the
  front-cover half is paired with `002.jpg` (title/copyright) as the
  book's opening spread, and the back-cover half is paired with
  `110.jpg` (a blank closing page) as the book's closing spread. This
  avoids ever showing a lone narrow page mid-flip, and avoids showing
  the back cover before the front cover the way the flattened print
  file would if displayed as-is.
- `pages-data.js` — a plain `window.PLAYBOOK_DATA = {...}` assignment
  (not fetched JSON, so it works even opened directly via `file://`)
  describing the 21 real chapters, which page each divider falls on, and
  alt text for every page. The cover split/recombination above happens
  at runtime in `index.html`, not here — this file still describes the
  110 original pages.
- `assets/mascot-icon.png` — the project's mascot character, cropped
  from `pages/002.jpg`, on a solid paper-colored circular badge (not a
  transparent cutout — an earlier fully-transparent version made the
  character's white eyes read as holes showing the dark nav bar through
  them). Used as both the nav logo and the browser tab favicon.
- `links-data.js` + `assets/qr/*.png` — every working link found in the
  book: QR codes (scanned with `zbarimg`, cropping and re-scanning
  individually wherever the print layout packed several codes too close
  together to isolate at once), plain printed URLs, and text citations
  that are hyperlinked in the source design but show no visible URL or
  underline (recovered from the Canva design's own text layer via the
  Canva API — OCR and "look for underlined text" both miss these, since
  the print layout doesn't always style them differently from ordinary
  text). Each hit gets a precisely positioned invisible clickable overlay
  in `index.html` (tap the code or text right where it appears — a link
  whose text wraps across two lines gets two overlays), plus a freshly
  generated, generously spaced QR code shown in that page's "N links"
  panel. An earlier pass of this scan missed several links entirely
  (two text citations on page 46, an illustrator credit on page 25) and
  wrongly assumed two QR codes (page 83's second, page 87's fourth) were
  cut off by the page edge and unrecoverable — they weren't; both were
  fully on the page and just hadn't been isolated and decoded yet. All of
  these are now fixed and included. The "N links" button also gives itself
  a brief pop animation the moment it appears on a page, so it's not easy
  to miss in the corner (skipped under "reduce motion").
- `assets/tffp-logo.png` + `assets/smf-logo.png` — the official TFFP
  circular logo and the Sauramandala Foundation / Centre for Accelerated
  Development wordmark, both supplied directly by the foundation and
  trimmed to their content bounds. Shown together, small and subtle, in
  the Table of Contents panel's footer alongside a credit line and a
  `mailto:info@sauramandala.org` contact line — the print cover artwork
  itself already carries both logos, so nothing is overlaid on the actual
  book pages.

## Regenerating `pages-data.js`

If the source Canva design changes (pages added/removed/reordered), the
chapter map in `pages-data.js` needs to be rebuilt by hand — it was
authored by visually reviewing the real pages, not derived automatically.
Update the `CHAPTERS` / `SPECIFIC_ALT` tables and re-run the generator
script kept alongside this project's build notes, or edit the JSON-like
object in `pages-data.js` directly.

## Deploying

This is a second, independent Netlify site pointed at the same GitHub
repo as the main TFFP platform, with:

- **Base directory**: `tffp-playbook`
- **Build command**: (leave empty)
- **Publish directory**: `.` (relative to the base directory)

`netlify.toml` in this folder sets long-lived caching for `/pages/*` and
short caching for the HTML/data files. No environment variables needed.

## Local preview

Just open `index.html` in a browser — no server required. (Everything is
either a relative file load or an inline `<script>`, so `file://` works.)
