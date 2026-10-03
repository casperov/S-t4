import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT       = Number(process.env.PORT ?? 8080);
const MUSIC_DIR  = path.join(__dirname, 'music');
const ROOT_DIR   = __dirname;

const AUDIO_EXT = new Set([
  '.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus',
  '.wav', '.flac', '.weba', '.webm',
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.m4a':  'audio/mp4',
  '.aac':  'audio/aac',
  '.ogg':  'audio/ogg',
  '.oga':  'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav':  'audio/wav',
  '.flac': 'audio/flac',
  '.weba': 'audio/webm',
  '.webm': 'audio/webm',
};

/* ---------- helpers ---------- */

function humanize(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  // "Artist - Title" уже ок, "track_01" → "Track 01"
  let s = base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  // если всё в нижнем регистре — сделаем Title Case
  if (s && s === s.toLowerCase()) {
    s = s.replace(/\b\w/g, c => c.toUpperCase());
  }
  return s || base;
}

function decodeId3Text(enc, payload) {
  if (enc === 0) return payload.toString('latin1');
  if (enc === 1) return payload.toString('utf16le');
  if (enc === 2) { const c = Buffer.from(payload); c.swap16(); return c.toString('utf16le'); }
  if (enc === 3) return payload.toString('utf8');
  return '';
}

async function readId3(filePath) {
  let fh;
  try { fh = await fsp.open(filePath, 'r'); } catch { return null; }
  try {
    const buf = Buffer.alloc(256 * 1024);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    const b = buf.subarray(0, bytesRead);
    if (b.length < 10 || b.toString('ascii', 0, 3) !== 'ID3') return null;

    const ver   = b[3];
    const flags = b[5];
    const size  = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
    let off = 10;

    if (flags & 0x40) { // extended header
      const extSize = (b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3];
      off += 4 + extSize;
    }

    const end = Math.min(10 + size, b.length);
    const out = {};

    while (off + 10 <= end) {
      const id = b.toString('ascii', off, off + 4);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;

      const frameSize = ver === 4
        ? ((b[off + 4] & 0x7f) << 21) | ((b[off + 5] & 0x7f) << 14) | ((b[off + 6] & 0x7f) << 7) | (b[off + 7] & 0x7f)
        : (b[off + 4] << 24) | (b[off + 5] << 16) | (b[off + 6] << 8) | b[off + 7];

      const start = off + 10;
      const finish = start + frameSize;
      if (frameSize <= 0 || finish > end) break;

      if (id === 'TIT2' || id === 'TPE1' || id === 'TALB') {
        const enc = b[start];
        const payload = b.subarray(start + 1, finish);
        const text = decodeId3Text(enc, payload).replace(/\0+$/g, '').trim();
        if (text) out[id] = text;
      }
      off = finish;
    }
    return out;
  } catch {
    return null;
  } finally {
    try { await fh.close(); } catch {}
  }
}

async function listTracks() {
  let entries;
  try { entries = await fsp.readdir(MUSIC_DIR, { withFileTypes: true }); }
  catch { return []; }

  const files = entries
    .filter(e => e.isFile() && AUDIO_EXT.has(path.extname(e.name).toLowerCase()))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const tracks = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const full = path.join(MUSIC_DIR, f);

    let id3 = null;
    if (/\.(mp3|m4a|flac)$/i.test(f)) id3 = await readId3(full);

    const tagTitle  = id3?.TIT2;
    const tagArtist = id3?.TPE1;

    const title  = tagTitle || humanize(f);
    const artist = tagArtist || null;

    tracks.push({
      index: i + 1,
      file:  f,
      url:   'music/' + encodeURIComponent(f),
      title,
      artist,
      ext:   path.extname(f).slice(1).toLowerCase(),
    });
  }
  return tracks;
}

/* ---------- static ---------- */

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = decoded.replace(/^\/+/, '');
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

function sendFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] ?? 'application/octet-stream';

  let stat;
  try { stat = fs.statSync(filePath); }
  catch { res.writeHead(404); res.end('not found'); return; }
  if (stat.isDirectory()) { res.writeHead(404); res.end('not found'); return; }

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end   = m[2] ? Number(m[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'Content-Type':   type,
        'Content-Length': end - start + 1,
        'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges':  'bytes',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, {
    'Content-Type':   type,
    'Content-Length': stat.size,
    'Accept-Ranges':  'bytes',
    'Cache-Control':  'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

/* ---------- server ---------- */

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  if (req.method === 'GET' && url.split('?')[0] === '/api/tracks') {
    const tracks = await listTracks();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ tracks }));
    return;
  }

  if (req.method === 'GET' && url.split('?')[0] === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  const target = safeJoin(ROOT_DIR, url === '/' ? '/index.html' : url);
  if (!target) { res.writeHead(403); res.end('forbidden'); return; }
  sendFile(req, res, target);
});

server.listen(PORT, () => {
  console.log(`[site] http://localhost:${PORT}`);
  console.log(`[site] music dir: ${MUSIC_DIR}`);
});
