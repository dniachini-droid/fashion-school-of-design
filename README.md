# fashion-school-of-design

The website for Anna's dressmaking school in Woodville South, Adelaide — the SITAM method of pattern drafting.

One page. Plain HTML and CSS, no framework.

- `index.html` — the page.
- `styles.css` — how it looks.
- `script.js` — sends the enquiry form without leaving the page.
- `photos/` — drop photographs here; they appear on the site at the next deploy. See `photos/README.md`.
- `tools/build-photos.mjs` — reads `photos/` at deploy time and writes the pictures into the page.
- `netlify.toml` — tells Netlify to run that, then serve the page.
- `docs/screenshots/` — how the page looked at phone width when it was built.

Enquiries go to Anna by email through Netlify Forms. Nothing to log in to.
