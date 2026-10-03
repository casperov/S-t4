// генерирует music/tracks.json — пригодится для GitHub Pages / чистого статика
// запуск: node make-manifest.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MUSIC_DIR = path.join(__dirname, 'music');
const OUT       = path.join(MUSIC_DIR, 'tracks.json');

const AUDIO_EXT = new Set([
  '.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus',
  '.wav', '.flac', '.weba', '.webm',
]);

function humanize(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  let s = base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s && s === s.toLowerCase()) s = s.replace(/\b\w/g, c => c.toUpperCase());
  return s || base;
}

async function main() {
  const entries = await fs.readdir(MUSIC_DIR, { withFileTypes: true });
  const files = entries
    .filter(e => e.isFile() && AUDIO_EXT.has(path.extname(e.name).toLowerCase()))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const tracks = files.map((f, i) => ({
    index: i + 1,
    file: f,
    url: 'music/' + encodeURIComponent(f),
    title: humanize(f),
    artist: null,
    ext: path.extname(f).slice(1).toLowerCase(),
  }));

  await fs.writeFile(OUT, JSON.stringify({ tracks }, null, 2));
  console.log(`wrote ${OUT} (${tracks.length} tracks)`);
}

main().catch(err => { console.error(err); process.exit(1); });
