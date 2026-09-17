#!/usr/bin/env node
/*
 * The photo grid comes from the photos/ folder.
 *
 * The owner drops files into photos/ on GitHub and does nothing else. On the
 * next deploy Netlify runs this, which rewrites four marked regions of
 * index.html: the picture behind the headline, Anna's portrait, the "Made
 * here" grid, and the certificate.
 *
 * It always writes every region, from whatever is in the folder right now, so
 * running it twice gives the same file and removing a photo removes it from
 * the page. With an empty folder it writes the empty states back.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_DIR = path.join(root, 'photos');
const PAGE = path.join(root, 'index.html');
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const RESERVED = ['hero', 'anna', 'certificate'];

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// "linen-dress.jpg" becomes a usable description. "IMG_2831.jpg" does not, so
// those fall back to something plain rather than reading a camera's filename out
// loud to anyone using a screen reader.
function altFor(file) {
  const stem = path.basename(file, path.extname(file));
  const words = stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const looksLikeACamera = /^(img|dsc|dscn|pxl|photo|image|screenshot)?\s*\d+$/i.test(words);
  if (!words || looksLikeACamera) return 'A garment made by a student at the Fashion School of Design';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function replaceRegion(html, name, body) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`index.html has no ${name}:start/${name}:end markers — cannot place the photos.`);
  }
  return html.slice(0, from + start.length) + '\n' + body + '\n  ' + html.slice(to);
}

async function listPhotos() {
  let entries;
  try {
    entries = await readdir(PHOTO_DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((e) => e.isFile() && EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'en'));
}

const files = await listPhotos();
const named = (stem) => files.find((f) => path.basename(f, path.extname(f)).toLowerCase() === stem);

const hero = named('hero');
const anna = named('anna');
const certificate = named('certificate');
// Anything not claimed by one of the three names is students' work.
const gallery = files.filter((f) => !RESERVED.includes(path.basename(f, path.extname(f)).toLowerCase()));
// No hero.jpg? Then the first photograph does the job, and still shows in the grid.
const heroFile = hero || gallery[0];

const src = (file) => `photos/${encodeURIComponent(file)}`;

const heroRegion = heroFile
  ? `  <img class="hero__photo" src="${src(heroFile)}" alt="" fetchpriority="high">\n  <div class="hero__veil"></div>`
  : '';

const annaRegion = anna
  ? `  <img class="portrait" src="${src(anna)}" alt="Anna in her studio">`
  : `  <div class="slot slot--portrait"><span class="slot__label">Photo: Anna, in the studio</span></div>`;

const certificateRegion = certificate
  ? `  <img class="portrait" src="${src(certificate)}" alt="The certificate issued by SITAM in Italy" loading="lazy">`
  : `  <div class="slot slot--cert"><span class="slot__label">Photo of the SITAM certificate &mdash; coming</span></div>`;

const gridRegion = gallery.length
  ? `  <div class="grid">\n` +
    gallery
      .map(
        (f) =>
          `    <img src="${src(f)}" alt="${escapeHtml(altFor(f))}" loading="lazy" decoding="async">`
      )
      .join('\n') +
    `\n  </div>`
  : `  <div class="grid">\n` +
    Array.from({ length: 4 })
      .map(() => `    <div class="slot slot--photo"><span class="slot__label">Photo to come</span></div>`)
      .join('\n') +
    `\n  </div>`;

let html = await readFile(PAGE, 'utf8');
html = replaceRegion(html, 'hero', heroRegion);
html = replaceRegion(html, 'anna', annaRegion);
html = replaceRegion(html, 'grid', gridRegion);
html = replaceRegion(html, 'certificate', certificateRegion);
await writeFile(PAGE, html);

console.log(
  `photos: ${files.length} file(s) — hero:${heroFile || 'none'} anna:${anna || 'empty slot'} ` +
    `certificate:${certificate || 'empty slot'} grid:${gallery.length || 'empty slots'}`
);
