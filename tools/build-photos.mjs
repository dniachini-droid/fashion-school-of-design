#!/usr/bin/env node
/*
 * The pictures on the page come from the photos/ folder.
 *
 * The owner drops files into photos/ on GitHub and does nothing else. On the
 * next deploy Netlify runs this, which:
 *
 *   1. turns every photograph into a web-sized JPEG in img/ — iPhone HEIC
 *      files included, which no browser but Safari can show, and multi-megabyte
 *      originals, which would make the page slow;
 *   2. rewrites four marked regions of index.html: the picture behind the
 *      headline, Anna's portrait, the "Made here" grid, and the certificate.
 *
 * It always writes every region from whatever is in the folder right now, so
 * running it twice gives the same files, and removing a photograph removes it
 * from the page. With an empty folder it writes the tidy empty states back.
 *
 * It never stops the deploy. A photograph it cannot read is reported and left
 * out; the page goes up without it.
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_DIR = path.join(root, 'photos');
const OUT_DIR = path.join(root, 'img');
const PAGE = path.join(root, 'index.html');

const WEB_SAFE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const APPLE = new Set(['.heic', '.heif']);
const RESERVED = ['hero', 'anna', 'certificate'];
const MAX_EDGE = 1600;   // plenty for a phone screen, small enough to load fast
const QUALITY = 78;

// Loaded only if they are there. Without them the originals are copied across
// untouched and HEIC files are left out, rather than the deploy failing.
let sharp = null;
let heicConvert = null;
try { sharp = (await import('sharp')).default; } catch {}
try { heicConvert = (await import('heic-convert')).default; } catch {}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// "linen-dress.jpg" makes a usable description. "IMG_3060-preview.HEIC" does
// not, so a camera's filename is never read out to anyone on a screen reader.
function altFor(file) {
  const stem = path.basename(file, path.extname(file));
  const words = stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const noise = /^((img|dsc|dscn|pxl|photo|image|screenshot|preview|copy|edited|final|\d+)\s*)+$/i;
  if (!words || noise.test(words)) return 'A garment made by a student at the Fashion School of Design';
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
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => {
      const ext = path.extname(n).toLowerCase();
      return WEB_SAFE.has(ext) || APPLE.has(ext);
    })
    .sort((a, b) => a.localeCompare(b, 'en'));
}

/* One photograph in, one web-sized JPEG in img/ out. Returns the path the page
   should use, or null if the file could not be read. */
async function prepare(file) {
  const ext = path.extname(file).toLowerCase();
  const stem = path.basename(file, path.extname(file));
  const source = path.join(PHOTO_DIR, file);

  if (!sharp) {
    if (APPLE.has(ext)) {
      console.warn(`  skipped ${file}: HEIC needs the image tools, which are not installed here.`);
      return null;
    }
    const copy = `${stem}${ext}`;
    await writeFile(path.join(OUT_DIR, copy), await readFile(source));
    console.warn(`  copied ${file} as-is: the image tools are not installed here.`);
    return `img/${copy}`;
  }

  try {
    let input = await readFile(source);
    if (APPLE.has(ext)) {
      if (!heicConvert) {
        console.warn(`  skipped ${file}: no HEIC reader installed.`);
        return null;
      }
      input = Buffer.from(await heicConvert({ buffer: input, format: 'JPEG', quality: 0.92 }));
    }
    const out = `${stem}.jpg`;
    await sharp(input)
      .rotate()                                            // honour the phone's orientation tag
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(path.join(OUT_DIR, out));
    return `img/${out}`;
  } catch (error) {
    console.warn(`  skipped ${file}: ${error.message}`);
    return null;
  }
}

const files = await listPhotos();

// img/ is rebuilt from scratch, so a photograph taken out of photos/ leaves
// nothing behind.
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const ready = [];
for (const file of files) {
  const href = await prepare(file);
  if (href) ready.push({ file, href });
}

const stemOf = (f) => path.basename(f, path.extname(f)).toLowerCase();
const named = (stem) => ready.find((p) => stemOf(p.file) === stem);

const hero = named('hero');
const anna = named('anna');
const certificate = named('certificate');
// Anything not claimed by one of the three names is students' work.
const gallery = ready.filter((p) => !RESERVED.includes(stemOf(p.file)));
// No hero.jpg? Then the first photograph does that job, and still shows in the grid.
const heroPhoto = hero || gallery[0];

const heroRegion = heroPhoto
  ? `  <img class="hero__photo" src="${heroPhoto.href}" alt="" fetchpriority="high">\n  <div class="hero__veil"></div>`
  : '';

const annaRegion = anna
  ? `  <img class="portrait" src="${anna.href}" alt="Anna in her studio">`
  : `  <div class="slot slot--portrait"><span class="slot__label">Photo: Anna, in the studio</span></div>`;

const certificateRegion = certificate
  ? `  <img class="portrait" src="${certificate.href}" alt="The certificate issued by SITAM in Italy" loading="lazy">`
  : `  <div class="slot slot--cert"><span class="slot__label">Photo of the SITAM certificate, coming</span></div>`;

const gridRegion = gallery.length
  ? `  <div class="grid">\n` +
    gallery
      .map((p) => `    <img src="${p.href}" alt="${escapeHtml(altFor(p.file))}" loading="lazy" decoding="async">`)
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
  `photos: ${files.length} found, ${ready.length} used — ` +
    `hero:${heroPhoto ? path.basename(heroPhoto.href) : 'plain black'} ` +
    `anna:${anna ? path.basename(anna.href) : 'empty slot'} ` +
    `certificate:${certificate ? path.basename(certificate.href) : 'empty slot'} ` +
    `grid:${gallery.length || 'empty slots'}`
);
