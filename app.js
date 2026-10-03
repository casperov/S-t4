/* ============================================================
   CONFIG — правь только здесь
   ============================================================ */
const CONFIG = {
  profile: {
    name: 'Leek',
    bio: 'Дизайнер интерфейсов. Собираю тёмные темы, которые не утомляют глаза.',
    avatar: 'avatar.jpg',   // положи файл рядом с index.html
    verified: true,
    fallbackInitial: 'L',
  },

  socials: [
    { label: 'Telegram',  href: 'https://t.me/yourname',           icon: 'tg' },
    { label: 'TikTok',    href: 'https://www.tiktok.com/@yourname', icon: 'tt' },
    { label: 'Instagram', href: 'https://instagram.com/yourname',   icon: 'ig' },
    { label: 'VK',        href: 'https://vk.com/yourname',          icon: 'vk' },
  ],

  tracks: {
    folder: 'music',
    prefix: 'ms',           // ms1.mp3, ms2.mp3, ...
    ext: 'mp3',
    max: 50,                // проверяем до ms50.mp3
    // Переопределение названий (ключ — имя файла):
    titles: {
      // 'ms1.mp3': 'Intro',
      // 'ms2.mp3': 'Night Drive',
    },
  },
};

/* ============================================================
   Иконки соцсетей
   ============================================================ */
const ICONS = {
  tg: '<svg viewBox="0 0 24 24"><path d="M21.9 4.3l-3 14.2c-.2 1-.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.5.5-.9.5l.3-4.6L18.9 6c.4-.3-.1-.5-.6-.2L7.6 12.4l-4.4-1.4c-1-.3-1-1 .2-1.4l17-6.6c.8-.3 1.6.2 1.4 1.3z"/></svg>',
  tt: '<svg viewBox="0 0 24 24"><path d="M16 3v3.3A4.7 4.7 0 0 0 19.5 8v3a7.4 7.4 0 0 1-3.5-.9v5a5.1 5.1 0 1 1-4.4-5v3a2.1 2.1 0 1 0 1.5 2V3z"/></svg>',
  ig: '<svg viewBox="0 0 24 24"><path d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9A4.5 4.5 0 0 1 16.5 21h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zm0 1.8A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7zM12 7.6a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8zm0 1.8a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zM17 6.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>',
  vk: '<svg viewBox="0 0 24 24"><path d="M12.8 16.7c-5.3 0-8.4-3.7-8.5-9.7h2.6c.1 4.4 2 6.3 3.6 6.7V7h2.4v3.8c1.6-.2 3.2-1.9 3.7-3.8h2.4c-.4 2.4-2.1 4.1-3.3 4.8 1.2.6 3.1 2 3.8 4.9h-2.7c-.6-1.8-2.1-3.2-4-3.4v3.4z"/></svg>',
};

/* ============================================================
   DOM
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const audio = $('#audio');

const els = {
  avatar:     $('#avatar'),
  avatarImg:  $('#avatar-img'),
  avatarInit: $('#avatar-fallback'),
  name:       $('#name-text'),
  verified:   $('#verified'),
  bio:        $('#bio'),
  tracks:     $('#tracks'),
  tracksCount:$('#tracks-count'),
  socials:    $('#socials'),
  npTitle:    $('#np-title'),
  tCur:       $('#t-cur'),
  tDur:       $('#t-dur'),
  seek:       $('#seek'),
  volume:     $('#volume'),
  btnPlay:    $('#btn-play'),
  btnPrev:    $('#btn-prev'),
  btnNext:    $('#btn-next'),
  btnMute:    $('#btn-mute'),
};

/* ============================================================
   Профиль и соцсети
   ============================================================ */
function renderProfile() {
  const { name, bio, avatar, verified, fallbackInitial } = CONFIG.profile;

  els.name.textContent = name;
  els.bio.textContent  = bio;
  els.avatarInit.textContent = fallbackInitial || name.charAt(0).toUpperCase() || '?';

  // аватар: грузим и, если ок, показываем
  const img = new Image();
  img.onload  = () => { els.avatarImg.src = avatar; els.avatar.classList.add('has-img'); };
  img.onerror = () => { /* остаётся fallback-инициал */ };
  img.src = avatar;

  if (!verified) els.verified.classList.add('hidden');
}

function renderSocials() {
  els.socials.innerHTML = CONFIG.socials.map(s => `
    <a class="social" href="${s.href}" target="_blank" rel="noopener noreferrer">
      ${ICONS[s.icon] ?? ''}
      <span>${s.label}</span>
    </a>
  `).join('');
}

/* ============================================================
   Автодетект треков: ms1.mp3 .. msN.mp3
   ============================================================ */
async function detectTracks() {
  const { folder, prefix, ext, max } = CONFIG.tracks;
  const checks = [];
  for (let i = 1; i <= max; i++) {
    const file = `${prefix}${i}.${ext}`;
    const url  = `${folder}/${file}`;
    checks.push(
      fetch(url, { method: 'HEAD', cache: 'no-store' })
        .then(r => r.ok ? { index: i, file, url } : null)
        .catch(() => null)
    );
  }
  const res = await Promise.all(checks);
  return res.filter(Boolean).sort((a, b) => a.index - b.index);
}

/* ============================================================
   Состояние плеера
   ============================================================ */
const state = {
  tracks: [],
  currentIndex: -1,
  durations: new Map(),   // url -> seconds
};

/* ============================================================
   Рендер списка треков
   ============================================================ */
function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function trackTitle(track) {
  const custom = CONFIG.tracks.titles?.[track.file];
  if (custom) return custom;
  return `Трек ${String(track.index).padStart(2, '0')}`;
}

function renderTracks() {
  if (!state.tracks.length) {
    els.tracks.innerHTML = `
      <div class="tracks-empty">
        Треки не найдены.<br/>
        Положи файлы <code>ms1.mp3</code>, <code>ms2.mp3</code>, … в папку <code>music/</code>.
      </div>`;
    els.tracksCount.textContent = '';
    return;
  }
  els.tracksCount.textContent = `${state.tracks.length}`;
  els.tracks.innerHTML = state.tracks.map((t, i) => `
    <li class="track" data-i="${i}">
      <div class="track-index" data-role="index">${String(t.index).padStart(2, '0')}</div>
      <div class="track-meta">
        <div class="track-title">${trackTitle(t)}</div>
        <div class="track-sub">${t.file}</div>
      </div>
      <div class="track-dur" data-role="dur">—:—</div>
    </li>
  `).join('');

  els.tracks.querySelectorAll('.track').forEach(li => {
    li.addEventListener('click', () => playIndex(Number(li.dataset.i)));
  });

  loadDurations();
}

/* ленивая загрузка длительностей — по одному, чтобы не грузить всё сразу */
function loadDurations() {
  state.tracks.forEach((t, i) => {
    if (state.durations.has(t.url)) return;
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.src = t.url;
    a.addEventListener('loadedmetadata', () => {
      state.durations.set(t.url, a.duration);
      const li = els.tracks.querySelector(`.track[data-i="${i}"]`);
      if (li) li.querySelector('[data-role="dur"]').textContent = fmt(a.duration);
    }, { once: true });
  });
}

/* ============================================================
   Индикация активного трека
   ============================================================ */
function paintActive() {
  els.tracks.querySelectorAll('.track').forEach((li, i) => {
    const active = i === state.currentIndex;
    li.classList.toggle('active', active);
    li.classList.toggle('paused', active && audio.paused);

    const idxBox = li.querySelector('[data-role="index"]');
    if (active) {
      idxBox.innerHTML = '<div class="eq"><i></i><i></i><i></i><i></i></div>';
    } else {
      idxBox.textContent = String(state.tracks[i].index).padStart(2, '0');
    }
  });
}

/* ============================================================
   Управление плеером
   ============================================================ */
function playIndex(i) {
  if (i < 0 || i >= state.tracks.length) return;
  state.currentIndex = i;
  const t = state.tracks[i];
  audio.src = t.url;
  audio.play().catch(() => {});
  els.npTitle.textContent = trackTitle(t);
  els.tCur.textContent = '0:00';
  els.tDur.textContent = fmt(state.durations.get(t.url) ?? 0);
  updateSeekFill(0);
  paintActive();
}

function togglePlay() {
  if (state.currentIndex === -1) { playIndex(0); return; }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function playPrev() {
  if (state.currentIndex === -1) { playIndex(0); return; }
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  playIndex(state.currentIndex === 0 ? state.tracks.length - 1 : state.currentIndex - 1);
}

function playNext() {
  if (state.currentIndex === -1) { playIndex(0); return; }
  playIndex((state.currentIndex + 1) % state.tracks.length);
}

function updateSeekFill(pct) {
  els.seek.style.setProperty('--p', `${pct}%`);
}
function updateVolFill(v) {
  els.volume.style.setProperty('--p', `${Math.round(v * 100)}%`);
}

/* ============================================================
   Слушатели
   ============================================================ */
els.btnPlay.addEventListener('click', togglePlay);
els.btnPrev.addEventListener('click', playPrev);
els.btnNext.addEventListener('click', playNext);

audio.addEventListener('play', () => {
  els.btnPlay.querySelector('.ico-play').style.display  = 'none';
  els.btnPlay.querySelector('.ico-pause').style.display = 'block';
  paintActive();
});
audio.addEventListener('pause', () => {
  els.btnPlay.querySelector('.ico-play').style.display  = 'block';
  els.btnPlay.querySelector('.ico-pause').style.display = 'none';
  paintActive();
});

audio.addEventListener('loadedmetadata', () => {
  if (state.currentIndex === -1) return;
  const t = state.tracks[state.currentIndex];
  state.durations.set(t.url, audio.duration);
  els.tDur.textContent = fmt(audio.duration);
  const li = els.tracks.querySelector(`.track[data-i="${state.currentIndex}"]`);
  if (li) li.querySelector('[data-role="dur"]').textContent = fmt(audio.duration);
});

audio.addEventListener('timeupdate', () => {
  if (!Number.isFinite(audio.duration) || audio.duration === 0) return;
  els.tCur.textContent = fmt(audio.currentTime);
  const pct = (audio.currentTime / audio.duration) * 100;
  updateSeekFill(pct);
});

audio.addEventListener('ended', playNext);

els.seek.addEventListener('input', () => {
  if (!Number.isFinite(audio.duration) || audio.duration === 0) return;
  const pct = Number(els.seek.value) / 1000;
  audio.currentTime = pct * audio.duration;
  updateSeekFill(pct * 100);
});

els.volume.addEventListener('input', () => {
  audio.volume = Number(els.volume.value);
  audio.muted = audio.volume === 0;
  updateVolFill(audio.volume);
  paintMute();
});

els.btnMute.addEventListener('click', () => {
  audio.muted = !audio.muted;
  paintMute();
});

function paintMute() {
  const muted = audio.muted || audio.volume === 0;
  els.btnMute.querySelector('.ico-vol').style.display  = muted ? 'none' : 'block';
  els.btnMute.querySelector('.ico-mute').style.display = muted ? 'block' : 'none';
}

/* горячие клавиши */
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight' && e.shiftKey) playNext();
  if (e.code === 'ArrowLeft'  && e.shiftKey) playPrev();
});

/* ============================================================
   Старт
   ============================================================ */
async function init() {
  renderProfile();
  renderSocials();

  audio.volume = Number(els.volume.value);
  updateVolFill(audio.volume);
  paintMute();
  updateSeekFill(0);

  state.tracks = await detectTracks();
  renderTracks();
}

init();
