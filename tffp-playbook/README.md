# TFFP Digital Playbook

An interactive, page-turning web edition of *The Forgotten Folklore
Project* playbook by Lanuangla Tsudir (Sauramandala Foundation,
Meghalaya). Plain HTML/CSS/JS — no build step, no framework, no npm
install.

## What's here

- `index.html` — the reader: a real animated page-flip (3D CSS
  transform, not a scroll), driven by click, swipe, or arrow keys, plus
  nav, a full table of contents, a progress bar, and a togglable
  page-turn sound (mute state persists in `localStorage`). Falls back to
  a quick crossfade instead of the 3D flip when the OS-level "reduce
  motion" preference is on. Clicking the mascot logo (top left) jumps
  back to the cover from anywhere in the book.
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
  from `pages/002.jpg` and knocked out to a transparent background. Used
  as both the nav logo and the browser tab favicon.

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
