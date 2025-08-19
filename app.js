// ===== Загрузка TTF для jsPDF: сначала пробуем Google gstatic, затем fallback @fontsource
const GOOGLE_TTF_REG = 'https://fonts.gstatic.com/s/notosans/v27/o-0IIpQlx3QUlC5A4PNj.ttf';
const GOOGLE_TTF_BOLD = 'https://fonts.gstatic.com/s/notosans/v27/o-0NIpQlx3QUlC5A4PNjXhFV.ttf';
const FALLBACK_REG = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-cyrillic-400-normal.ttf';
const FALLBACK_BOLD = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-cyrillic-700-normal.ttf';

const PASSWORD = 'lil memes';           // ← поменяй на своё
let isAuthed = false;

const authGate = document.getElementById('authGate');
const authCard = document.getElementById('authCard');
const authPwd  = document.getElementById('authPwd');
const authOk   = document.getElementById('authOk');
const authMsg  = document.getElementById('authMsg');

// Быстрый выход, если уже авторизованы в этой вкладке
if (sessionStorage.getItem('auth_ok') === '1') {
  unlock();
} else {
  lock();
}

function lock(){
  document.body.classList.add('locked');
  authGate.style.display = 'flex';
  isAuthed = false;
  setTimeout(()=>authPwd.focus(), 0);
}

function unlock(){
  document.body.classList.remove('locked');
  authGate.style.display = 'none';
  isAuthed = true;
}

function submitAuth(){
  const val = (authPwd.value || '').trim();
  if (val === PASSWORD) {
    sessionStorage.setItem('auth_ok', '1');
    unlock();
  } else {
    authMsg.textContent = 'Неверное секретное слово';
    authCard.classList.remove('shake'); void authCard.offsetWidth; authCard.classList.add('shake');
    authPwd.select();
  }
}

authOk.addEventListener('click', submitAuth);
authPwd.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter') submitAuth();
});

let _pdfFontReady = false;
async function loadPdfFonts(doc) {
  if (_pdfFontReady) return;
  async function fetchB64(url) { const r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw new Error('HTTP ' + r.status); const a = await r.arrayBuffer(); let b = ''; const u = new Uint8Array(a); for (let i = 0; i < u.length; i++) b += String.fromCharCode(u[i]); return btoa(b); }
  async function tryUrls(arr) { for (const u of arr) { try { return await fetchB64(u); } catch (e) { } } throw new Error('TTF not loaded'); }
  const regB64 = await tryUrls([GOOGLE_TTF_REG, FALLBACK_REG]);
  const boldB64 = await tryUrls([GOOGLE_TTF_BOLD, FALLBACK_BOLD]);
  doc.addFileToVFS('NotoSans-Regular.ttf', regB64); doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFileToVFS('NotoSans-Bold.ttf', boldB64); doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  _pdfFontReady = true;
}

// ====== Tabs ======
const tabs = document.querySelectorAll('.tab');
tabs.forEach(btn => btn.addEventListener('click', () => {
  const target = btn.dataset.tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + target).classList.add('active');
  if (target === 'bubble') {
    resetGameToInitial();
    bbRender();
  }
}));

// ====== Игра ======
const SECRET_WORD = 'ПРОСТИ';
const FINAL_TEXT = 'Прасти миня ЧЧ';
const ACCEPT_TEXT = 'Спасибо, что даёшь мне шанс. Я постараюсь быть лучше каждый день.';
const SPEED = 240;

const $ = s => document.querySelector(s);
const rnd = (min, max) => Math.random() * (max - min) + min;

const stage = $('#stage');
const hero = $('#hero');
const heartsLayer = $('#hearts');

const state = { w: 0, h: 0, hero: { x: 30, y: 30, size: 56 }, pressed: new Set(), collected: new Set(), badges: [], running: false, last: performance.now() };
const indicator = $('#lettersIndicator');
let revealIndicator = false;

function beep() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = .05; o.start(); setTimeout(() => { g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15); o.stop(ctx.currentTime + 0.16); }, 30); } catch (e) { } }

function buildIndicator() {
  indicator.innerHTML = '';

  for (const ch of SECRET_WORD) {
    const box = document.createElement('div');
    box.className = 'box';
    const got = state.collected.has(ch);

    if (!revealIndicator) {
      // до старта — всегда заглушки
      box.textContent = '•';
      box.classList.add('masked');
    } else {
      // после старта — открываем собранные буквы, остальное — заглушки
      if (got) {
        box.textContent = ch;
        box.classList.add('got');
      } else {
        box.textContent = '•';
        box.classList.add('masked');
      }
    }
    indicator.appendChild(box);
  }
}

const placements = [{ x: .12, y: .22 }, { x: .78, y: .18 }, { x: .56, y: .64 }, { x: .22, y: .76 }, { x: .85, y: .44 }, { x: .38, y: .36 }];
function placeBadges() { for (const b of state.badges) { b.remove(); } state.badges = []; for (let i = 0; i < SECRET_WORD.length; i++) { const ch = SECRET_WORD[i]; const p = placements[i] || { x: rnd(.1, .9), y: rnd(.15, .85) }; const el = document.createElement('div'); el.className = 'badge floating'; el.dataset.letter = ch; el.textContent = ch; el.style.left = (p.x * 100) + '%'; el.style.top = (p.y * 100) + '%'; stage.appendChild(el); state.badges.push(el); } }

function bounds() { const r = stage.getBoundingClientRect(); state.w = r.width; state.h = r.height; }
function setHero(x, y) { state.hero.x = Math.max(0, Math.min(x, state.w - state.hero.size)); state.hero.y = Math.max(0, Math.min(y, state.h - state.hero.size)); hero.style.transform = `translate(${state.hero.x}px, ${state.hero.y}px)`; }
function moveHero(dt) { const step = SPEED * dt; let dx = 0, dy = 0; if (state.pressed.has('ArrowLeft') || state.pressed.has('KeyA')) dx -= step; if (state.pressed.has('ArrowRight') || state.pressed.has('KeyD')) dx += step; if (state.pressed.has('ArrowUp') || state.pressed.has('KeyW')) dy -= step; if (state.pressed.has('ArrowDown') || state.pressed.has('KeyS')) dy += step; if (dx || dy) setHero(state.hero.x + dx, state.hero.y + dy); }
function rect(el) { return el.getBoundingClientRect(); }
function intersects(a, b) { return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }

function sparkle(target) { for (let i = 0; i < 12; i++) { const s = document.createElement('div'); s.className = 'heart'; s.textContent = Math.random() < .5 ? '✨' : '💖'; const r = target.getBoundingClientRect(); const st = stage.getBoundingClientRect(); s.style.left = (r.left - st.left + r.width / 2 + rnd(-20, 20)) + 'px'; s.style.top = (r.top - st.top + r.height / 2 + rnd(-10, 10)) + 'px'; s.style.animationDuration = (2 + Math.random() * 1.4) + 's'; heartsLayer.appendChild(s); setTimeout(() => s.remove(), 3200); } }

function checkCollect() { const hr = rect(hero); for (const b of state.badges) { if (!b || b.classList.contains('collected')) continue; if (intersects(hr, rect(b))) { b.classList.add('collected'); state.collected.add(b.dataset.letter); buildIndicator(); sparkle(b); beep(); setTimeout(() => b.remove(), 220); } } if (state.collected.size === new Set(SECRET_WORD.split('')).size) { win(); } }

function rainHearts() { const count = 60; const w = state.w; for (let i = 0; i < count; i++) { const h = document.createElement('div'); h.className = 'heart'; h.textContent = Math.random() < .5 ? '💗' : '💞'; h.style.left = rnd(0, w) + 'px'; h.style.top = (-rnd(10, 160)) + 'px'; h.style.fontSize = rnd(18, 34) + 'px'; h.style.animationDuration = rnd(2.2, 3.6) + 's'; heartsLayer.appendChild(h); setTimeout(() => h.remove(), 3800); } }

async function typeText(el, text) { el.innerHTML = ''; const cursor = document.createElement('span'); cursor.className = 'cursor'; cursor.textContent = '|'; const wrap = document.createElement('span'); el.appendChild(wrap); el.appendChild(cursor); for (const ch of text) { wrap.textContent += ch; await new Promise(r => setTimeout(r, ch === ' ' ? 20 : 28)); } cursor.remove(); }

function win() { if (!state.running) return; state.running = false; document.getElementById('final').classList.add('show'); typeText(document.getElementById('typed'), FINAL_TEXT); }
function loop(t) { const dt = Math.min(0.035, (t - state.last) / 1000); state.last = t; if (state.running) { moveHero(dt); checkCollect(); requestAnimationFrame(loop); } }
function start() {
  if (!isAuthed) return;
  
  document.getElementById('intro').classList.add('hidden');
  revealIndicator = true;                 // <- показывать прогресс слова
  bounds();
  setHero(20, state.h - 100);
  placeBadges();
  state.collected.clear();
  buildIndicator();
  state.running = true;
  state.last = performance.now();
  requestAnimationFrame(loop);
}

document.getElementById('startBtn').addEventListener('click', start);
document.getElementById('resetBtn').addEventListener('click', () => {
  state.collected.clear(); document.getElementById('final').classList.remove('show'); document.getElementById('typed').textContent = ''; heartsLayer.innerHTML = '';
  if (revealIndicator) {
    placeBadges();
  }

  buildIndicator(); state.running = true; state.last = performance.now(); requestAnimationFrame(loop);
});
document.getElementById('acceptBtn').addEventListener('click', () => { rainHearts(); rainHearts(); rainHearts(); const el = document.createElement('div'); el.className = 'card'; el.style.margin = '20px auto'; el.style.maxWidth = '720px'; el.style.pointerEvents = 'auto'; el.innerHTML = '<h1>💗 Спасибо</h1><p>' + ACCEPT_TEXT + '</p>'; const fin = document.getElementById('final'); fin.innerHTML = ''; fin.appendChild(el); fin.classList.add('show'); });

addEventListener('resize', bounds);
addEventListener('keydown', (e) => {
  if (!isAuthed) return; // ✦ guard
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  if (keys.includes(e.code)) { state.pressed.add(e.code); e.preventDefault(); }
});
addEventListener('keyup', (e) => {
  if (!isAuthed) return; // ✦ guard
  state.pressed.delete(e.code);
});
document.querySelectorAll('.btnc[data-dir]').forEach(btn => {
  btn.addEventListener('touchstart', e => { if (!isAuthed) return; e.preventDefault(); hold(btn.dataset.dir, true); });
  btn.addEventListener('touchend',   e => { if (!isAuthed) return; e.preventDefault(); hold(btn.dataset.dir, false); });
  btn.addEventListener('mousedown',  () => { if (!isAuthed) return; hold(btn.dataset.dir, true); });
  addEventListener('mouseup',        () => { if (!isAuthed) return; hold(btn.dataset.dir, false); });
});
function hold(dir, on) { const map = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }; if (on) state.pressed.add(map[dir]); else state.pressed.delete(map[dir]); }

buildIndicator();

// ===== Сброс игры в начальное состояние =====
function resetGameToInitial() {
  state.running = false;
  state.pressed.clear();
  state.collected.clear();

  document.getElementById('intro').classList.remove('hidden');
  const fin = document.getElementById('final');
  fin.classList.remove('show');
  document.getElementById('typed').textContent = '';
  heartsLayer.innerHTML = '';

  for (const b of state.badges) { b.remove(); }
  state.badges = [];

  bounds();
  setHero(20, state.h - 100);

  revealIndicator = false;   // <- снова маскируем слово
  buildIndicator();
}

// ===== Wishlist =====
const WL_KEY = 'wishlistItems_v1';
const wlModal = document.getElementById('wishlistModal');
const wlList = document.getElementById('wlList');
const wlForm = document.getElementById('wlForm');
const $id = (x) => document.getElementById(x);
const fields = { title: $id('wlTitle'), link: $id('wlLink'), note: $id('wlNote'), category: $id('wlCategory') };

document.getElementById('wishlistBtn').addEventListener('click', () => {
  resetGameToInitial();
  wlModal.classList.add('show');
  renderWL();
});
document.getElementById('wlCloseBtn').addEventListener('click', () => wlModal.classList.remove('show'));
wlModal.addEventListener('click', (e) => { if (e.target === wlModal) wlModal.classList.remove('show'); });

function loadWL() { try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch { return []; } }
function saveWL(items) { localStorage.setItem(WL_KEY, JSON.stringify(items)); }

function renderWL() {
  const items = loadWL();
  wlList.innerHTML = '';
  if (items.length === 0) {
    wlList.innerHTML = '<div class="empty-note">Пока пусто. Добавь первый пункт выше ✨</div>';
    return;
  }
  items.forEach((it, idx) => {
    const card = document.createElement('div');
    card.className = 'wl-item';
    card.innerHTML = `
      <div class="row"><h3>${escapeHtml(it.title)}</h3></div>
      <div class="wl-meta">${it.category ? `<span class="tag">${escapeHtml(it.category)}</span>` : ''}</div>
      ${it.link ? `<div class="link"><a href="${escapeAttr(it.link)}" target="_blank" rel="noopener">${escapeHtml(it.link)}</a></div>` : ''}
      ${it.note ? `<div class="note">${escapeHtml(it.note)}</div>` : ''}
      <div class="ops">
        <button class="btn secondary" data-act="edit" data-i="${idx}" aria-label="Редактировать">✏️</button>
        <button class="btn secondary" data-act="del" data-i="${idx}" aria-label="Удалить">🗑️</button>
      </div>`;
    wlList.appendChild(card);
  });
}

document.getElementById('wlAddBtn').addEventListener('click', () => {
  if (!fields.title.value.trim()) { fields.title.focus(); return; }
  const items = loadWL();
  items.push({ title: fields.title.value.trim(), link: fields.link.value.trim(), note: fields.note.value.trim(), category: fields.category.value.trim() });
  saveWL(items); wlForm.reset(); renderWL();
});
wlList.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const i = Number(btn.dataset.i);
  const items = loadWL();
  if (btn.dataset.act === 'del') { items.splice(i, 1); saveWL(items); renderWL(); }
  else if (btn.dataset.act === 'edit') {
    const it = items[i] || {};
    fields.title.value = it.title || '';
    fields.link.value = it.link || '';
    fields.note.value = it.note || '';
    fields.category.value = it.category || '';
    items.splice(i, 1); saveWL(items); renderWL(); fields.title.focus();
  }
});
document.getElementById('wlClearBtn').addEventListener('click', () => {
  if (confirm('Очистить весь виш-лист?')) { saveWL([]); renderWL(); }
});

// ===== Экспорт в PDF (кириллица) =====
document.getElementById('wlExportBtn').addEventListener('click', async () => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { alert('Не удалось загрузить модуль PDF.'); return; }
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  try { await loadPdfFonts(doc); } catch (e) { alert('Не удалось загрузить кириллический шрифт для PDF. ' + e.message); return; }

  const left = 48, right = 548; let y = 64;
  const items = loadWL();
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(20); doc.text('Список желаний', left, y); y += 18;
  doc.setFont('NotoSans', 'normal'); doc.setFontSize(11); doc.text(new Date().toLocaleDateString('ru-RU'), left, y); y += 20;

  if (items.length === 0) { doc.text('Список пока пуст — но скоро пополнится ✨', left, y); }
  else {
    items.forEach((it, idx) => {
      y += 8; if (y > 780) { doc.addPage(); y = 64; doc.setFont('NotoSans', 'normal'); }
      doc.setFont('NotoSans', 'bold'); doc.setFontSize(13); doc.text(`${idx + 1}. ${it.title}`, left, y); y += 16;
      doc.setFont('NotoSans', 'normal'); doc.setFontSize(11);
      if (it.category) { doc.text(`Категория: ${it.category}`, left, y); y += 14; }
      if (it.link) { y = wrap(doc, `Ссылка: ${it.link}`, left, y, right); y += 4; }
      if (it.note) { y = wrap(doc, it.note, left, y, right); }
      y += 10;
    });
  }
  doc.save('wishlist.pdf');

  function wrap(doc, text, x, y, maxX) {
    const width = maxX - x;
    const lines = doc.splitTextToSize(text || '', width);
    lines.forEach(line => {
      if (y > 780) { doc.addPage(); y = 64; doc.setFont('NotoSans', 'normal'); }
      doc.text(line, x, y); y += 14;
    });
    return y;
  }
});

function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])); }
function escapeAttr(s) { return (s || '').replace(/"/g, '&quot;'); }

// ====== Bubble Tea Builder Logic ======
const bbBase = document.getElementById('bbBase');
const bbMilk = document.getElementById('bbMilk');
const bbFlavor = document.getElementById('bbFlavor');
const bbSweet = document.getElementById('bbSweet');
const bbIce = document.getElementById('bbIce');
const elSweetVal = document.getElementById('bbSweetVal');
const elIceVal = document.getElementById('bbIceVal');

const bbBoba = document.getElementById('bbBoba');
const bbJelly = document.getElementById('bbJelly');
const bbPopping = document.getElementById('bbPopping');
const bbFoam = document.getElementById('bbFoam');

const bbCup = document.getElementById('bbCup');
const liquid = document.getElementById('bbLiquid');
const layerBase = document.getElementById('layer-base');
const layerFlavor = document.getElementById('layer-flavor');
const layerMilk = document.getElementById('layer-milk');
const fizzLayer = document.getElementById('fizzLayer');
const toppingsLayer = document.getElementById('toppingsLayer');
const iceLayer = document.getElementById('iceLayer');
const bbDesc = document.getElementById('bbDesc');

const cupSvg = document.querySelector('#bbCup svg');

const BASE_COLORS = {
  black: '#5a3d2b', green: '#5aa46a', oolong: '#6b6d3f', thai: '#d97706', jasmine: '#76b39d'
};
const FLAVOR_COLORS = {
  none: '#000000', strawberry: '#ff6b81', mango: '#ffb300', taro: '#8e7cc3', matcha: '#5aab5a', caramel: '#b7791f'
};
const MILK_TINTS = { none: 0, dairy: 0.35, oat: 0.28, coconut: 0.32 };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Helpers for bubble tea visuals
function ensureIceDefs() {
  const svg = document.querySelector('#bbCup svg');
  const defs = svg.querySelector('defs') || (function () { const d = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.insertBefore(d, svg.firstChild); return d; })();
  if (!svg.querySelector('#iceGrad')) {
    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.setAttribute('id', 'iceGrad'); grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
    const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#ffffff'); s1.setAttribute('stop-opacity', '0.9');
    const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', '#cfe9f9'); s2.setAttribute('stop-opacity', '0.85');
    grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad);
  }
}

function shakeCup() {
  const svg = document.querySelector('#bbCup svg');
  svg.classList.remove('shake'); void svg.offsetWidth; svg.classList.add('shake');
  [fizzLayer, toppingsLayer, iceLayer].forEach(g => { g.classList.remove('jiggle'); void g.offsetWidth; g.classList.add('jiggle'); });
  setTimeout(() => [fizzLayer, toppingsLayer, iceLayer].forEach(g => g.classList.remove('jiggle')), 700);
}

function bbRender() {
if (!isAuthed) return;

  const base = bbBase.value; const milk = bbMilk.value; const flavor = bbFlavor.value;
  const sweet = Number(bbSweet.value); const ice = Number(bbIce.value);
  elSweetVal.textContent = sweet + '%';
  elIceVal.textContent = ice + '%';

  const baseHeight = clamp(160 + (sweet / 120) * 20, 120, 280);
  const milkHeight = milk === 'none' ? 0 : Math.round(baseHeight * (0.35 + (sweet / 120) * 0.1));
  const flavorHeight = flavor === 'none' ? 0 : Math.round(baseHeight * 0.2);

  const baseY = 330 - baseHeight;
  const milkY = 330 - milkHeight;
  const flavorY = 330 - flavorHeight;

  layerBase.setAttribute('y', baseY); layerBase.setAttribute('height', baseHeight);
  layerFlavor.setAttribute('y', flavorY); layerFlavor.setAttribute('height', flavorHeight);
  layerMilk.setAttribute('y', milkY); layerMilk.setAttribute('height', milkHeight);

  layerBase.setAttribute('fill', BASE_COLORS[base] || '#8b5e3c');
  layerFlavor.setAttribute('fill', FLAVOR_COLORS[flavor] || '#000');

  const milkOpacity = MILK_TINTS[milk] || 0;
  layerMilk.setAttribute('opacity', milkOpacity.toString());

  // фон за стаканом слегка затемнён
  const svg = document.querySelector('#bbCup svg');
  let bgRect = document.getElementById('cupBackground');
  if (!bgRect) {
    bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('id', 'cupBackground');
    bgRect.setAttribute('x', '0'); bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', '300'); bgRect.setAttribute('height', '400');
    bgRect.setAttribute('fill', '#888888'); bgRect.setAttribute('opacity', '0.15');
    svg.insertBefore(bgRect, svg.firstChild);
  }

  // Пузырьки/физз
  fizzLayer.innerHTML = '';
  const fizzCount = Math.round(sweet / 20);
  for (let i = 0; i < fizzCount; i++) {
    const cx = 80 + Math.random() * 160;
    const cy = 320 + Math.random() * 40;
    const r = 2 + Math.random() * 3;
    const dur = 2 + Math.random() * 2.5;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('class', 'fizz');
    c.setAttribute('cx', cx);
    c.setAttribute('cy', cy);
    c.setAttribute('r', r);
    c.setAttribute('fill', '#ffffff');
    c.style.animationDuration = dur + 's';
    fizzLayer.appendChild(c);
  }

  // Топпинги
  const liquidTop = Math.min(baseY, milkHeight ? milkY : baseY, flavorHeight ? flavorY : baseY);
  toppingsLayer.innerHTML = '';
  const cupLeft = 60, cupRight = 240;
  const bottom = 330;
  if (bbBoba.checked) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 2;
      const pad = 6;
      const x = clamp(40 + Math.random() * 220, cupLeft + pad + r, cupRight - pad - r);
      const y = clamp(260 + Math.random() * 80, liquidTop + pad + r, 330 - pad - r);
      const pearl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pearl.setAttribute('class', 'pearl shakeable'); pearl.setAttribute('cx', x); pearl.setAttribute('cy', y); pearl.setAttribute('r', r);
      pearl.setAttribute('fill', '#2b2b2b'); pearl.style.animationDelay = (Math.random() * 1.2) + 's';
      toppingsLayer.appendChild(pearl);
    }
  }
  if (bbJelly.checked) {
    for (let i = 0; i < 10; i++) {
      const w = 10 + Math.random() * 18; const h = 6 + Math.random() * 12;
      const pad = 6;
      const x = clamp(35 + Math.random() * 230, cupLeft + pad, cupRight - pad - w);
      const y = clamp(255 + Math.random() * 90, liquidTop + pad, 330 - pad - h);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', w); rect.setAttribute('height', h);
      rect.setAttribute('fill', '#ffeeaa'); rect.setAttribute('opacity', '0.8'); rect.setAttribute('rx', '2');
      rect.setAttribute('class', 'shakeable');
      toppingsLayer.appendChild(rect);
    }
  }
  if (bbPopping.checked) {
    for (let i = 0; i < 14; i++) {
      const r = 4 + Math.random() * 2.5;
      const pad = 6;
      const x = clamp(40 + Math.random() * 220, cupLeft + pad + r, cupRight - pad - r);
      const y = clamp(265 + Math.random() * 75, liquidTop + pad + r, 330 - pad - r);
      const pop = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pop.setAttribute('cx', x); pop.setAttribute('cy', y); pop.setAttribute('r', r);
      pop.setAttribute('fill', '#ffbe0b'); pop.setAttribute('opacity', '0.9');
      pop.setAttribute('class', 'shakeable');
      toppingsLayer.appendChild(pop);
    }
  }

  // Лёд — более естественные кубики (градиент, поворот) и в пределах жидкости
  ensureIceDefs();
  iceLayer.innerHTML = '';
  const iceCount = Math.round(ice / 25);
  for (let i = 0; i < iceCount; i++) {
    const w = 26 + Math.random() * 8;
    const h = 18 + Math.random() * 8;
    const x = 85 + Math.random() * (160 - w);
    const y = clamp(90 + Math.random() * 60, liquidTop + 6, 330 - h - 6);
    const angle = -10 + Math.random() * 20;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'ice'); g.style.animationDelay = (Math.random() * 2) + 's';
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', w); rect.setAttribute('height', h); rect.setAttribute('rx', '5');
    rect.setAttribute('fill', 'url(#iceGrad)'); rect.setAttribute('opacity', '0.9');
    const cx = x + w / 2, cy = y + h / 2;
    g.setAttribute('transform', `rotate(${angle},${cx},${cy})`);
    const hi = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hi.setAttribute('x', x + 3); hi.setAttribute('y', y + 3); hi.setAttribute('width', w - 6); hi.setAttribute('height', Math.max(3, h * 0.28)); hi.setAttribute('rx', '3');
    hi.setAttribute('fill', '#ffffff'); hi.setAttribute('opacity', '0.35');
    g.appendChild(rect); g.appendChild(hi); iceLayer.appendChild(g);
  }

  // Пена
  const foamId = 'foamLayer';
  const oldFoam = document.getElementById(foamId);
  if (oldFoam) oldFoam.remove();
  if (bbFoam.checked) {
    const foam = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    foam.setAttribute('id', foamId);
    foam.setAttribute('x', '60');
    foam.setAttribute('y', liquidTop - 20);
    foam.setAttribute('width', '180');
    foam.setAttribute('height', '18');
    foam.setAttribute('rx', '8');
    foam.setAttribute('fill', '#fff');
    foam.setAttribute('opacity', '0.95');
    foam.setAttribute('class', 'shakeable');
    svg.appendChild(foam);
  }

  // Цвета слоёв
  layerFlavor.setAttribute('opacity', (flavor === 'none' ? 0 : clamp(0.25 + sweet / 200, 0.25, 0.9)).toString());

  bbDesc.textContent = bbSummary();

  // Встряхивание стакана и компонентов
  svg.classList.remove('shake');
  void svg.offsetWidth;
  svg.classList.add('shake');
  document.querySelectorAll('.shakeable').forEach(el => {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  });
}


function bbSummary() {
  const baseMap = { black: 'чёрный чай', green: 'зелёный чай', oolong: 'улун', thai: 'тайский чай', jasmine: 'жасминовый' };
  const milkMap = { none: 'без молока', dairy: 'молоко', oat: 'овсяное молоко', coconut: 'кокосовое молоко' };
  const flMap = { none: 'классический', strawberry: 'клубника', mango: 'манго', taro: 'таро', matcha: 'матча', caramel: 'карамель' };
  const parts = [baseMap[bbBase.value], flMap[bbFlavor.value] !== 'классический' ? ('+' + flMap[bbFlavor.value]) : null, milkMap[bbMilk.value] !== 'без молока' ? ('+' + milkMap[bbMilk.value]) : null];
  const tops = [bbBoba.checked ? 'тапиока' : null, bbJelly.checked ? 'кокосовое желе' : null, bbPopping.checked ? "поппин' боба" : null, bbFoam.checked ? 'сырная пена' : null].filter(Boolean).join(', ');
  return `Твой бабл-ти: ${parts.filter(Boolean).join(' ')} · сладость ${bbSweet.value}% · лёд ${bbIce.value}%${tops ? ` · топпинги: ${tops}` : ''}`;
}

function bbToWishlist() {
  const items = loadWL();
  items.push({ title: 'Бабл-ти мечты', link: '', category: 'напитки', note: bbSummary() });
  saveWL(items); renderWL();
  wlModal.classList.add('show');
}

// Слушатели
[bbBase, bbMilk, bbFlavor, bbSweet, bbIce, bbBoba, bbJelly, bbPopping, bbFoam].forEach(el => {
  el && el.addEventListener(el.type === 'range' || el.type === 'checkbox' || el.tagName === 'SELECT' ? 'input' : 'change', bbRender);
  el && el.addEventListener('change', bbRender);
});
document.getElementById('bbShake').addEventListener('click', () => { shakeCup(); });
document.getElementById('bbToWishlist').addEventListener('click', bbToWishlist);
document.getElementById('bbCopy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(bbSummary()); alert('Рецепт скопирован 📋'); } catch { alert('Скопируй вручную: ' + bbSummary()); }
});

// Инициализация
bbRender();
function initColors() { layerBase.setAttribute('fill', BASE_COLORS[bbBase.value]); layerFlavor.setAttribute('fill', FLAVOR_COLORS[bbFlavor.value]); }
initColors();
