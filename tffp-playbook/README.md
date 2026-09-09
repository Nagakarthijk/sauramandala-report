# TFFP Digital Playbook

A scrollable, responsive web edition of *The Forgotten Folklore Project*
playbook by Lanuangla Tsudir (Sauramandala Foundation, Meghalaya). Plain
HTML/CSS/JS — no build step, no framework, no npm install.

## What's here

- `index.html` — the reader (nav, table of contents, progress bar, cover
  parallax, lazy-loaded pages, keyboard navigation).
- `pages/001.jpg` … `pages/110.jpg` — the actual print artwork, exported
  from the source Canva design ("TFFP_playbook print edition 12x6", 110
  pages). Each file is already a complete spread as designed — most are
  wide two-page spreads, two (`002`, `110`) are single square pages.
- `pages-data.js` — a plain `window.PLAYBOOK_DATA = {...}` assignment
  (not fetched JSON, so it works even opened directly via `file://`)
  describing the 21 real chapters, which page each divider falls on, and
  alt text for every page.

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
