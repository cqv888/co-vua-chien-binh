// ===== Helpers =====
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const NAMES = { P: 'Tốt', N: 'Mã', B: 'Tượng', R: 'Xe', Q: 'Hậu', K: 'Vua' };
const VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
const store = {
  get(k, d) { try { const v = localStorage.getItem('cvcb_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cvcb_' + k, JSON.stringify(v)); } catch (e) { } }
};
const pieceSVG = (p, cls) => `<svg class="${cls || ''} ${p[0]}" viewBox="0 0 100 120"><use href="#p-${p[1]}"/></svg>`;

// ===== Sound (Web Audio synth) =====
const Sound = (() => {
  let ctx = null, on = store.get('sound', true);
  const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; };
  function tone(f, t, dur, type, vol, slide) {
    const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .2, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .05);
  }
  function noise(t, dur, vol, f1, f2) {
    const c = ac(); if (!c) return; const n = c.sampleRate * dur, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = 1.2;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur);
  }
  return {
    get on() { return on; }, set on(v) { on = v; store.set('sound', v); },
    unlock() { ac(); },
    move() { if (!on) return; const c = ac(); if (!c) return; const t = c.currentTime; tone(520, t, .08, 'triangle', .15, 330); },
    select() { if (!on) return; const c = ac(); if (!c) return; tone(880, c.currentTime, .06, 'sine', .08); },
    draw() { if (!on) return; const c = ac(); if (!c) return; const t = c.currentTime; noise(t, .28, .25, 1200, 5200); tone(2200, t + .05, .22, 'sine', .05, 4200); },
    swoosh() { if (!on) return; const c = ac(); if (!c) return; noise(c.currentTime, .35, .35, 400, 2400); },
    clang() { if (!on) return; const c = ac(); if (!c) return; const t = c.currentTime; noise(t, .12, .5, 3000, 800); [1800, 2470, 3320, 4100].forEach((f, i) => tone(f, t, .5 - i * .08, 'square', .06)); tone(160, t, .25, 'sine', .3, 60); },
    thud() { if (!on) return; const c = ac(); if (!c) return; const t = c.currentTime; tone(120, t, .3, 'sine', .35, 40); noise(t, .2, .3, 200, 80); },
    check() { if (!on) return; const c = ac(); if (!c) return; const t = c.currentTime; tone(740, t, .12, 'square', .12); tone(740, t + .16, .12, 'square', .12); tone(980, t + .32, .3, 'square', .12); },
    win() { if (!on) return; const c = ac(); if (!c) return; const t = c.currentTime; [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * .12, .25, 'triangle', .18)); },
    lose() { if (!on) return; const c = ac(); if (!c) return; const t = c.currentTime; [392, 349, 311, 262].forEach((f, i) => tone(f, t + i * .22, .35, 'triangle', .15)); },
    ding() { if (!on) return; const c = ac(); if (!c) return; tone(1320, c.currentTime, .3, 'sine', .15); }
  };
})();

// ===== Background music (gentle generative loop, Web Audio - no files needed) =====
const Music = (() => {
  let ctx = null, master = null, timer = null, on = store.get('music', true), nextT = 0, step = 0;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  // I - vi - IV - V in C, then I - iii - IV - V : soft lullaby feel
  const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62], [60, 64, 67], [52, 55, 59], [53, 57, 60], [55, 59, 62]];
  const PENTA = [72, 74, 76, 79, 81, 84];
  const CHORD_LEN = 3.2, BEAT = .8;
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } master = ctx.createGain(); master.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; master.connect(lp).connect(ctx.destination); } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function pad(notes, t) {
    notes.forEach((n, i) => { [0, 7].forEach(dt => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = i === 0 ? 'triangle' : 'sine'; o.frequency.value = midi(n - 12); o.detune.value = dt; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + 1.1); g.gain.setValueAtTime(.05, t + CHORD_LEN - 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + CHORD_LEN + .3); o.connect(g).connect(master); o.start(t); o.stop(t + CHORD_LEN + .4); }); });
  }
  function pluck(n, t, vol) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = midi(n); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .07, t + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); o.connect(g).connect(master); o.start(t); o.stop(t + 1.2); }
  let lastN = 76;
  function schedule() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + .6) {
      const chord = CHORDS[Math.floor(step / 4) % CHORDS.length];
      if (step % 4 === 0) pad(chord, nextT);
      // melody: wander gently within the pentatonic scale, mostly on chord tones
      if (step % 4 !== 3 || Math.random() < .5) {
        const near = PENTA.filter(n => Math.abs(n - lastN) <= 5); const pool = near.length ? near : PENTA;
        let n = pool[Math.floor(Math.random() * pool.length)];
        if (step % 4 === 0) { const ct = chord.map(x => x + 12).filter(x => PENTA.includes(x)); if (ct.length) n = ct[Math.floor(Math.random() * ct.length)]; }
        lastN = n; pluck(n, nextT + (Math.random() < .3 ? BEAT / 2 : 0), .06 + Math.random() * .03);
      }
      nextT += BEAT; step++;
    }
  }
  function start() { if (!ac()) return; if (timer) return; nextT = Math.max(nextT, ctx.currentTime + .1); master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(1, ctx.currentTime, .8); schedule(); timer = setInterval(schedule, 250); }
  function stop() { if (!ctx) return; if (timer) { clearInterval(timer); timer = null; } master.gain.setTargetAtTime(0, ctx.currentTime, .4); }
  return {
    get on() { return on; }, set on(v) { on = v; store.set('music', v); v ? start() : stop(); },
    get playing() { return !!timer; },
    kick() { if (on && !timer) start(); }
  };
})();

// ===== Voice: reads each move aloud in Vietnamese ("Ngựa đi bê 2") =====
const Voice = (() => {
  let on = store.get('voice', true);
  const SPOKEN = { P: 'Tốt', N: 'Ngựa', B: 'Tượng', R: 'Xe', Q: 'Hậu', K: 'Vua' };
  const FILE = { a: 'a', b: 'bê', c: 'xê', d: 'dê', e: 'e', f: 'ép', g: 'gờ', h: 'hát' };
  const sqText = rc => FILE['abcdefgh'[rc[1]]] + ' ' + (8 - rc[0]);
  let viVoice = null;
  function pickVoice() { try { const vs = speechSynthesis.getVoices(); viVoice = vs.find(v => /^vi/i.test(v.lang)) || null; } catch (e) { } }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function say(text) {
    if (!on || !('speechSynthesis' in window)) return;
    try { const u = new SpeechSynthesisUtterance(text); u.lang = 'vi-VN'; u.rate = .95; u.pitch = 1.05; u.volume = 1; if (viVoice) u.voice = viVoice; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { }
  }
  return {
    get on() { return on; }, set on(v) { on = v; store.set('voice', v); if (!v && 'speechSynthesis' in window) speechSynthesis.cancel(); },
    get available() { return 'speechSynthesis' in window; },
    say,
    move(m, st) {
      let t;
      if (m.castle) t = 'Nhập thành';
      else if (m.capture) t = `${SPOKEN[m.piece[1]]} ăn ${SPOKEN[m.capture[1]]} ở ${sqText(m.to)}`;
      else t = `${SPOKEN[m.piece[1]]} đi ${sqText(m.to)}`;
      if (m.promo) t += ', phong Hậu';
      if (st && st.over && st.result === 'checkmate') t += '. Chiếu hết!';
      else if (st && st.check) t += '. Chiếu!';
      say(t);
    }
  };
})();

// ===== Board view (CSS fallback; 3D version in V3) =====
function buildBoard(stage, opts) {
  if (typeof V3 !== 'undefined' && V3) { stage.classList.add('gl3d'); return V3.buildBoard(stage, opts); }
  stage.innerHTML = '<div class="boardbox"><div class="board3d"><div class="squares"></div></div><div class="pieces"></div></div>';
  const sqs = stage.querySelector('.squares');
  for (let i = 0; i < 64; i++) { const b = document.createElement('button'); b.className = 'sqbtn'; b.type = 'button'; sqs.appendChild(b); }
  const view = { stage, sqs, pieces: stage.querySelector('.pieces'), flipped: false, els: new Map(), onClick: opts && opts.onClick };
  view.layout = () => {
    Array.from(sqs.children).forEach((b, i) => {
      const dr = Math.floor(i / 8), dc = i % 8;
      const r = view.flipped ? 7 - dr : dr, c = view.flipped ? 7 - dc : dc;
      b.dataset.r = r; b.dataset.c = c; b.className = 'sqbtn' + ((r + c) % 2 ? ' d' : '');
      b.setAttribute('aria-label', Chess.sq([r, c]));
      b.innerHTML = (dc === 0 || dr === 7) ? `<span class="coord">${dc === 0 ? (8 - r) : ''}${dr === 7 ? 'abcdefgh'[c] : ''}</span>` : '';
    });
  };
  view.layout();
  if (opts && opts.onClick) sqs.addEventListener('click', e => { const b = e.target.closest('.sqbtn'); if (b) opts.onClick(+b.dataset.r, +b.dataset.c); });
  view.sync = (board, anim) => {
    view.pieces.innerHTML = '';
    view.els.clear();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c]; if (!p) continue;
      const el = document.createElement('div'); el.className = 'piece noanim ' + p[0];
      el.innerHTML = `<div class="shadow"></div><div class="fig"><svg viewBox="0 0 100 120"><use href="#p-${p[1]}"/></svg></div>`;
      view.setPos(el, r, c); view.pieces.appendChild(el); view.els.set(r * 8 + c, el);
    }
    requestAnimationFrame(() => view.pieces.querySelectorAll('.noanim').forEach(e => e.classList.remove('noanim')));
  };
  view.setPos = (el, r, c) => { el.style.setProperty('--r', view.flipped ? 7 - r : r); el.style.setProperty('--c', view.flipped ? 7 - c : c); };
  view.sqEl = (r, c) => sqs.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  view.clearMarks = () => { sqs.querySelectorAll('.sqbtn').forEach(b => b.classList.remove('sel', 'move', 'cap', 'last', 'check')); view.pieces.querySelectorAll('.piece.sel').forEach(e => e.classList.remove('sel')); };
  return view;
}

// ===== Chess clock =====
const Clock = {
  minutes: 0, ms: { w: 0, b: 0 }, running: null, timer: null, last: 0,
  setup(min) { this.stop(); this.minutes = min; this.ms = { w: min * 60000, b: min * 60000 }; $('#clocks').classList.toggle('hidden', !min); this.render(); },
  start(color) { if (!this.minutes) return; this.running = color; this.last = performance.now(); if (!this.timer) this.timer = setInterval(() => this.tick(), 200); this.render(); },
  stop() { this.running = null; if (this.timer) clearInterval(this.timer); this.timer = null; this.render(); },
  tick() { if (!this.running) return; const now = performance.now(); this.ms[this.running] = Math.max(0, this.ms[this.running] - (now - this.last)); this.last = now; this.render(); if (this.ms[this.running] === 0) { const loser = this.running; this.stop(); onFlag(loser); } },
  fmt(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },
  render() { if (document.body.classList.contains('fs')) updateFsInfo(); for (const c of ['w', 'b']) { const el = $('#clock' + c.toUpperCase()); if (!el) continue; el.querySelector('b').textContent = this.fmt(this.ms[c]); el.classList.toggle('run', this.running === c); el.classList.toggle('low', this.minutes > 0 && this.ms[c] < 20000); } }
};
function onFlag(loser) {
  if (App.over) return;
  const winner = loser === 'w' ? 'b' : 'w';
  if (App.mode === 'online' && App.net) { if (loser === App.myColor) App.net.send({ t: 'flag' }); else return; }
  endGame({ over: true, result: 'time', winner });
}

// ===== App state =====
const App = {
  mode: null, state: null, history: [], sel: null, legal: [], myColor: 'w', aiLevel: 1,
  hints: store.get('hints', true), fxMode: store.get('fxMode', 'sword'), fxLast: store.get('fxLast', 'sword'), pieceSet: store.get('pieceSet', 'classic'), viewMode: store.get('viewMode', '3d'), clock: store.get('clock', 0),
  names: { w: 'Trắng', b: 'Đen' }, busy: false, over: false, net: null
};
let view;

function myName() { return ($('#myName').value.trim() || 'Bé'); }
function show(id) { $$('.screen').forEach(s => s.classList.remove('on')); $('#scr' + id).classList.add('on'); window.scrollTo(0, 0); }

// ===== Game flow =====
function startGame(mode, opts) {
  opts = opts || {};
  App.mode = mode; App.state = Chess.initial(); App.history = []; App.sel = null; App.legal = []; App.over = false; App.busy = false;
  App.myColor = opts.myColor || 'w';
  App.names = opts.names || (mode === 'ai' ? { w: myName(), b: '🤖 Máy' } : mode === 'hot' ? { w: 'Bạn Trắng', b: 'Bạn Đen' } : { w: 'Trắng', b: 'Đen' });
  view.flipped = App.myColor === 'b'; view.layout();
  $('#btnUndo').classList.toggle('hidden', mode === 'online');
  $('#btnFlip').classList.toggle('hidden', mode === 'online');
  $('#modal').classList.remove('on');
  $('#gameStatus').textContent = '';
  $('#chat').classList.toggle('hidden', mode !== 'online'); if (mode !== 'online') $('#chatLog').innerHTML = '';
  show('Game');
  Clock.setup(opts.clock !== undefined ? opts.clock : App.clock);
  view.sync(App.state.board);
  refresh();
  if (mode === 'ai' && App.state.turn !== App.myColor) aiTurn();
}

function refresh() {
  const s = App.state, st = Chess.status(s);
  view.clearMarks();
  const last = s.moves[s.moves.length - 1];
  if (last) { view.sqEl(...last.from).classList.add('last'); view.sqEl(...last.to).classList.add('last'); }
  if (!st.over && st.check) { const k = Chess.findKing(s.board, s.turn); view.sqEl(...k).classList.add('check'); }
  if (App.sel) { view.sqEl(...App.sel).classList.add('sel'); const pe = view.els.get(App.sel[0] * 8 + App.sel[1]); if (pe) pe.classList.add('sel'); if (App.hints) { App.legal.forEach(m => view.sqEl(...m.to).classList.add(m.capture ? 'cap' : 'move')); if (view.showArrows) view.showArrows(App.sel, App.legal); } }
  $('#turnDot').className = 'dot ' + s.turn;
  $('#turnText').textContent = st.over ? 'Hết ván' : `Lượt ${s.turn === 'w' ? 'Trắng' : 'Đen'} · ${App.names[s.turn]}`;
  const mine = App.mode === 'hot' || s.turn === App.myColor;
  $('#turnSub').textContent = st.over ? '' : st.check ? '⚠️ Vua đang bị chiếu! Phải cứu Vua ngay.' : mine ? 'Chạm vào quân của mình để chọn' : 'Đang chờ đối thủ đi…';
  $('#nameW').textContent = App.names.w; $('#nameB').textContent = App.names.b;
  renderCaps(); renderMoves(); updateFsInfo();
  $('#btnUndo').disabled = App.history.length === 0 || App.busy;
}
function updateFsInfo() {
  const el = $('#fsInfo'); if (!el || !App.state) return;
  const clocks = Clock.minutes ? `<span class="fc ${Clock.running === 'w' ? 'run' : ''}">⬜ ${Clock.fmt(Clock.ms.w)}</span><span class="fc ${Clock.running === 'b' ? 'run' : ''}">⬛ ${Clock.fmt(Clock.ms.b)}</span>` : '';
  el.innerHTML = `<span>${$('#turnText').textContent}</span>${clocks}`;
}
function renderCaps() {
  const s = App.state;
  const sum = arr => arr.reduce((a, p) => a + VALUE[p[1]], 0);
  const sw = sum(s.captured.w), sb = sum(s.captured.b);
  const sortP = arr => arr.slice().sort((a, b) => VALUE[b[1]] - VALUE[a[1]]);
  $('#capsW').innerHTML = sortP(s.captured.w).map(p => pieceSVG(p)).join('');
  $('#capsB').innerHTML = sortP(s.captured.b).map(p => pieceSVG(p)).join('');
  $('#scoreW').textContent = sw > sb ? '+' + (sw - sb) : ''; $('#scoreB').textContent = sb > sw ? '+' + (sb - sw) : '';
}
function renderMoves() {
  const s = App.state, out = []; let st = Chess.initial();
  s.moves.forEach((m, i) => { if (i % 2 === 0) out.push(`<span class="n">${i / 2 + 1}.</span>`); out.push(`<span class="${i === s.moves.length - 1 ? 'cur' : ''}">${Chess.san(st, m)}</span>`); st = Chess.apply(st, m); });
  if (s.moves.length % 2 === 1) out.push('<span></span>');
  const el = $('#moves'); el.innerHTML = out.join('') || '<span class="n">Ván mới</span><span></span><span></span>'; el.scrollTop = el.scrollHeight;
}

function onSquare(r, c) {
  if (App.busy || App.over) return;
  Sound.unlock();
  const s = App.state, p = s.board[r][c];
  const mine = App.mode === 'hot' || s.turn === App.myColor;
  if (!mine) { setTip('Chờ bạn kia đi xong nhé!'); return; }
  if (App.sel) {
    const m = App.legal.find(m => m.to[0] === r && m.to[1] === c);
    if (m) { App.sel = null; App.legal = []; playMove(m, 'me'); return; }
    if (App.sel[0] === r && App.sel[1] === c) { App.sel = null; App.legal = []; refresh(); return; }
  }
  if (p && p[0] === s.turn) {
    App.sel = [r, c]; App.legal = Chess.legal(s, r, c); Sound.select();
    setTip(App.legal.length ? `${NAMES[p[1]]} có ${App.legal.length} nước đi. ${App.hints ? 'Chấm xanh = đi được, vòng đỏ = ăn được.' : ''}` : `${NAMES[p[1]]} này chưa đi được. Chọn quân khác nhé!`);
    refresh();
  } else if (p && App.sel) { setTip('Không đi được ô đó. Chọn ô có chấm xanh hoặc vòng đỏ.'); }
  else if (p) { setTip('Đó là quân của đối thủ. Hãy chọn quân của mình.'); }
}
let tipTimer; function setTip(t) { $('#tip').textContent = t; clearTimeout(tipTimer); tipTimer = setTimeout(() => { $('#tip').textContent = ''; }, 4000); }

async function playMove(m, source) {
  if (App.busy) return; App.busy = true;
  const s = App.state;
  App.history.push(s);
  const next = Chess.apply(s, m);
  if (App.mode === 'online' && source === 'me' && App.net) App.net.send({ t: 'move', from: m.from, to: m.to, promo: m.promo || null });
  view.clearMarks();
  // slide the piece
  const el = view.els.get(m.from[0] * 8 + m.from[1]);
  const victimEl = m.capture ? (m.ep ? view.els.get(m.from[0] * 8 + m.to[1]) : view.els.get(m.to[0] * 8 + m.to[1])) : null;
  if (m.capture && App.fxMode === 'sword' && view.swordFight && el && victimEl) {
    Sound.swoosh();
    await view.swordFight(el, victimEl, m, { onDraw: () => Sound.draw(), onClang: () => { Sound.clang(); document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 300); }, onFall: () => Sound.thud() });
    flashBanner(m.ep ? 'Bắt qua đường!' : [m.capture[1] === 'Q' ? 'Hạ Hậu!' : 'Chém!', 'Trúng rồi!', 'Hạ gục!', 'Tuyệt chiêu!'][Math.floor(Math.random() * 4)]);
    victimEl.remove();
  } else if (m.capture && App.fxMode === 'chase' && view.chase && el && victimEl) {
    Sound.swoosh();
    await view.chase(el, victimEl, m, s.board, () => Sound.move(), () => Sound.thud());
    flashBanner(['Bắt được rồi!', 'Hết đường chạy!', 'Tóm gọn!'][Math.floor(Math.random() * 3)]);
    victimEl.remove();
  } else if (m.capture && App.fxMode === 'duel') {
    Sound.swoosh();
    if (el) view.setPos(el, m.to[0], m.to[1]);
    await wait(250);
    await duel(m.piece, m.capture, m);
    if (victimEl) victimEl.remove();
  } else {
    Sound.move();
    if (el) view.setPos(el, m.to[0], m.to[1]);
    if (victimEl) setTimeout(() => victimEl.remove(), 200);
    if (m.castle) { const home = m.from[0]; const rk = view.els.get(home * 8 + (m.castle === 'K' ? 7 : 0)); if (rk) view.setPos(rk, home, m.castle === 'K' ? 5 : 3); }
    await wait(380);
  }
  App.state = next; view.sync(next.board);
  App.busy = false; refresh();
  const st = Chess.status(next);
  Voice.move(m, st);
  if (st.over) Clock.stop(); else Clock.start(next.turn);
  if (m.promo) setTip('🎉 Tốt đi tới cuối bàn và được phong thành Hậu!');
  if (st.over) { endGame(st); return; }
  if (st.check) { Sound.check(); flashBanner('Chiếu!'); }
  if (App.mode === 'ai' && next.turn !== App.myColor) aiTurn();
}
const wait = ms => new Promise(r => setTimeout(r, ms));

function aiTurn() {
  setTimeout(() => {
    if (App.over || App.mode !== 'ai' || App.busy || App.state.turn === App.myColor) return;
    const m = Chess.bestMove(App.state, App.aiLevel); if (m) playMove(m, 'ai');
  }, 500 + Math.random() * 500);
}

function flashBanner(text, long) { const b = $('#banner'); b.textContent = text; b.classList.add('show'); setTimeout(() => b.classList.remove('show'), long ? 2200 : 1200); }

function endGame(st) {
  App.over = true; Clock.stop();
  let title, text, iWon = null;
  if (st.result === 'time') {
    title = '⏱ Hết giờ!'; text = `${App.names[st.winner]} (${st.winner === 'w' ? 'Trắng' : 'Đen'}) thắng vì đối thủ hết thời gian.`;
    if (App.mode !== 'hot') iWon = st.winner === App.myColor;
  } else if (st.result === 'checkmate') {
    title = '👑 Chiếu hết!'; text = `${App.names[st.winner]} (${st.winner === 'w' ? 'Trắng' : 'Đen'}) thắng ván này!`;
    if (App.mode !== 'hot') iWon = st.winner === App.myColor;
    flashBanner('Chiếu hết!', true);
  } else { title = '🤝 Hoà!'; text = st.result === 'stalemate' ? 'Bên đi không còn nước nào hợp lệ mà Vua không bị chiếu — gọi là "pat", hai bên hoà.' : st.result === 'insufficient' ? 'Không còn đủ quân để chiếu hết. Hai bên hoà.' : 'Quá 50 nước không ăn quân, không đi Tốt — hoà theo luật.'; }
  $('#mTitle').textContent = title; $('#mText').textContent = text;
  if (iWon === true || (App.mode === 'hot' && st.result === 'checkmate')) { Sound.win(); confetti(); } else if (iWon === false) Sound.lose(); else Sound.ding();
  $('#mNew').classList.toggle('hidden', App.mode === 'online' && App.myColor !== 'w');
  setTimeout(() => $('#modal').classList.add('on'), 900);
  refresh();
}
function confetti() {
  const c = $('#confetti'); c.innerHTML = '';
  const colors = ['#f2b636', '#e4483a', '#3f8ef5', '#33c46f', '#fff'];
  for (let i = 0; i < 90; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + 'vw'; s.style.background = colors[i % colors.length]; s.style.animationDuration = (2 + Math.random() * 2) + 's'; s.style.animationDelay = Math.random() * .8 + 's'; c.appendChild(s); }
  setTimeout(() => c.innerHTML = '', 5000);
}

// ===== Duel (3D battle overlay) =====
function duel(att, vic, m) {
  return new Promise(res => {
    const d = $('#duel'), arena = $('#arena');
    $('#fAttUse').setAttribute('href', '#p-' + att[1]); $('#fVicUse').setAttribute('href', '#p-' + vic[1]);
    $('#fAtt').className = 'fighter att ' + att[0]; $('#fVic').className = 'fighter vic ' + vic[0];
    $('#nameA').textContent = `${NAMES[att[1]]} ${App.names[att[0]]}`; $('#nameV').textContent = `${NAMES[vic[1]]} ${App.names[vic[0]]}`;
    const pows = vic[1] === 'Q' ? ['HẠ HẬU!', 'TUYỆT CHIÊU!'] : vic[1] === 'R' ? ['PHÁ XE!', 'CHÍNH XÁC!'] : ['ĂN!', 'CHÉM!', 'HẠ GỤC!', 'TRÚNG RỒI!'];
    $('#pow').textContent = m && m.ep ? 'BẮT QUA ĐƯỜNG!' : pows[Math.floor(Math.random() * pows.length)];
    arena.querySelectorAll('.spark').forEach(e => e.remove());
    for (let i = 0; i < 14; i++) { const s = document.createElement('div'); s.className = 'spark'; const a = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 160; s.style.setProperty('--dx', Math.cos(a) * dist + 'px'); s.style.setProperty('--dy', Math.sin(a) * dist - 40 + 'px'); s.style.background = i % 3 ? '#f2b636' : '#fff'; arena.appendChild(s); }
    // restart animations
    d.classList.remove('on'); void d.offsetWidth; d.classList.add('on'); d.setAttribute('aria-hidden', 'false');
    const use3d = typeof V3 !== 'undefined' && V3;
    d.classList.toggle('three', !!use3d);
    if (use3d) V3.duel3d(arena, att, vic, () => { Sound.clang(); document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 400); }, () => Sound.thud());
    else { setTimeout(() => { Sound.clang(); document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 400); }, 830); setTimeout(() => Sound.thud(), 1350); }
    setTimeout(() => { d.classList.remove('on'); d.setAttribute('aria-hidden', 'true'); res(); }, 1750);
  });
}

// ===== Chat =====
const EMOJIS = ['😀', '😂', '😎', '😮', '😱', '😭', '🤔', '👍', '👏', '🔥', '⚔️', '👑', '🎉', '🙏', '😜', '💪'];
const isEmojiOnly = t => /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+$/u.test(t) && t.trim().length <= 8;
let bubbleTimer;
function addChat(name, text, me) {
  const log = $('#chatLog'); const d = document.createElement('div');
  d.className = 'msg ' + (me ? 'me' : 'them') + (isEmojiOnly(text) ? ' big' : '');
  if (!isEmojiOnly(text)) { const s = document.createElement('small'); s.textContent = name; d.appendChild(s); }
  d.appendChild(document.createTextNode(text)); log.appendChild(d); log.scrollTop = log.scrollHeight;
  while (log.children.length > 60) log.removeChild(log.firstChild);
  if (!me) { const b = $('#bubble'); b.innerHTML = ''; const big = isEmojiOnly(text); b.className = 'bubble show' + (big ? ' big' : ''); if (!big) { const nm = document.createElement('b'); nm.textContent = name + ':'; b.appendChild(nm); } b.appendChild(document.createTextNode(text)); clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.remove('show'), big ? 2200 : 3500); Sound.ding(); }
}
function sendChat(text) {
  text = String(text || '').trim().slice(0, 120); if (!text || !App.net) return;
  App.net.send({ t: 'chat', text }); addChat(myName(), text, true);
}

// ===== Online (PeerJS, WebRTC) =====
const Net = {
  peer: null, conn: null,
  code() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; },
  id: code => 'covua-chienbinh-' + code,
  ready() { return typeof Peer !== 'undefined'; },
  load() { return new Promise(res => { if (this.ready()) return res(true); const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = () => res(this.ready()); s.onerror = () => res(false); document.head.appendChild(s); }); },
  watchOpen(p, status) { const t = setTimeout(() => { if (!p.open) { status('Không kết nối được máy ghép phòng. Hãy mở trang từ địa chỉ web (https) và kiểm tra mạng.', true); try { p.destroy(); } catch (e) { } } }, 9000); p.on('open', () => clearTimeout(t)); },
  cleanup() { try { if (this.conn) this.conn.close(); if (this.peer) this.peer.destroy(); } catch (e) { } this.conn = null; this.peer = null; App.net = null; },
  host(status) {
    this.cleanup();
    const code = this.code();
    const p = this.peer = new Peer(this.id(code), { debug: 0 });
    status('Đang tạo phòng…'); this.watchOpen(p, status);
    p.on('open', () => { $('#roomCode').textContent = code; $('#roomCode').classList.remove('hidden'); status('Đọc mã này cho bạn. Đang chờ bạn vào…'); });
    p.on('connection', c => { this.conn = c; this.wire(c, 'w', status); });
    p.on('error', e => { if (e.type === 'unavailable-id') { this.host(status); return; } status('Lỗi kết nối: ' + (e.type || e), true); });
  },
  join(code, status) {
    this.cleanup();
    const p = this.peer = new Peer({ debug: 0 });
    status('Đang tìm phòng ' + code + '…'); this.watchOpen(p, status);
    p.on('open', () => { const c = p.connect(this.id(code), { reliable: true }); this.conn = c; this.wire(c, 'b', status); });
    p.on('error', e => { status(e.type === 'peer-unavailable' ? 'Không tìm thấy phòng ' + code + '. Kiểm tra lại mã nhé!' : 'Lỗi kết nối: ' + (e.type || e), true); });
  },
  wire(c, myColor, status) {
    const me = this;
    c.on('open', () => {
      status('Đã kết nối! Đang vào ván…', false, true);
      App.net = me;
      const names = myColor === 'w' ? { w: myName(), b: 'Bạn' } : { w: 'Bạn', b: myName() };
      startGame('online', { myColor, names, clock: myColor === 'w' ? App.clock : 0 });
      me.send({ t: 'hello', name: myName(), clock: myColor === 'w' ? App.clock : undefined });
      $('#gameStatus').textContent = '🟢 Đang kết nối với bạn';
    });
    c.on('data', d => me.onData(d, myColor));
    c.on('close', () => { $('#gameStatus').textContent = '🔴 Bạn đã rời phòng'; $('#gameStatus').className = 'status err'; App.net = null; });
    c.on('error', () => { $('#gameStatus').textContent = '🔴 Mất kết nối'; $('#gameStatus').className = 'status err'; });
  },
  send(d) { if (this.conn && this.conn.open) this.conn.send(d); },
  onData(d, myColor) {
    if (!d || typeof d !== 'object') return;
    if (!App.state) return;
    if (d.t === 'hello') { const other = myColor === 'w' ? 'b' : 'w'; App.names[other] = String(d.name || 'Bạn').slice(0, 14); if (typeof d.clock === 'number' && myColor === 'b') { App.clock = d.clock; Clock.setup(d.clock); } refresh(); }
    else if (d.t === 'chat') { const other = myColor === 'w' ? 'b' : 'w'; addChat(App.names[other] || 'Bạn', String(d.text || '').slice(0, 120), false); }
    else if (d.t === 'flag') { if (!App.over) endGame({ over: true, result: 'time', winner: myColor }); }
    else if (d.t === 'move') {
      if (App.state.turn === myColor) return; // not their turn — ignore
      const legal = Chess.legal(App.state, d.from[0], d.from[1]).find(m => m.to[0] === d.to[0] && m.to[1] === d.to[1]);
      if (legal) playMove(legal, 'net');
    }
    else if (d.t === 'new') { if (typeof d.clock === 'number') App.clock = d.clock; startGame('online', { myColor, names: App.names, clock: App.clock }); $('#gameStatus').textContent = '🟢 Ván mới!'; }
  }
};

// ===== Tutorial content =====
function mini(size, pieces, marks, opts) {
  // pieces: {"r,c":"wN"}, marks: {"r,c":"dot|x|hl|arrow"}
  opts = opts || {};
  let h = `<div class="mini" style="grid-template-columns:repeat(${size},30px)">`;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const k = r + ',' + c, p = pieces[k], mk = marks[k] || '';
    h += `<div class="s ${(r + c) % 2 ? 'd' : ''} ${mk} ${p ? p[0] : ''}">${p ? `<svg viewBox="0 0 100 120"><use href="#p-${p[1]}"/></svg>` : ''}</div>`;
  }
  return h + '</div>';
}
function pcard(piece, title, text, board) { return `<div class="pcard"><div class="mini-holder">${board}</div><h3>${pieceSVG(piece)} ${title}</h3><p>${text}</p></div>`; }
function buildLessons() {
  const dots = arr => Object.fromEntries(arr.map(k => [k, 'dot']));
  const xs = arr => Object.fromEntries(arr.map(k => [k, 'x']));
  const P = pcard;
  const l1 = `
    <h2>🌟 Cờ vua là gì?</h2>
    <p class="big">Cờ vua là trò chơi của <b>hai đội</b>: đội <b>Trắng</b> và đội <b>Đen</b>. Mỗi đội có 16 chiến binh. Đội nào <b>bắt được Vua</b> của đội kia là thắng!</p>
    <p>Bàn cờ có 64 ô vuông, xen kẽ sáng và tối. Trắng luôn đi trước, rồi hai bên thay phiên nhau, mỗi lượt đi <b>một</b> quân.</p>
    <h2>🧩 Các chiến binh đi thế nào?</h2>
    <p>Chấm xanh là ô quân được đi tới. Vòng đỏ là quân địch có thể ăn.</p>
    <div class="cards">
      ${P('wP', 'Tốt – chú lính nhỏ', 'Đi <b>thẳng lên 1 ô</b>. Lần đầu tiên được đi 2 ô. Nhưng khi <b>ăn</b> thì ăn <b>chéo</b>! Tốt không đi lùi.', mini(4, { '3,1': 'wP', '2,2': 'bP' }, { '2,1': 'dot', '1,1': 'dot', '2,2': 'x' }))}
      ${P('wR', 'Xe – toà tháp', 'Đi <b>thẳng</b> hoặc <b>ngang</b>, bao nhiêu ô cũng được, miễn không bị chặn.', mini(5, { '2,2': 'wR' }, dots(['0,2', '1,2', '3,2', '4,2', '2,0', '2,1', '2,3', '2,4'])))}
      ${P('wB', 'Tượng – nhà ảo thuật', 'Đi <b>chéo</b>, bao nhiêu ô cũng được. Tượng đứng ô sáng thì cả đời ở ô sáng!', mini(5, { '2,2': 'wB' }, dots(['0,0', '1,1', '3,3', '4,4', '0,4', '1,3', '3,1', '4,0'])))}
      ${P('wN', 'Mã – chú ngựa', 'Nhảy hình <b>chữ L</b>: 2 ô thẳng rồi 1 ô ngang. Mã là quân duy nhất <b>nhảy qua đầu</b> quân khác!', mini(5, { '2,2': 'wN', '1,2': 'bP' }, dots(['0,1', '0,3', '1,0', '1,4', '3,0', '3,4', '4,1', '4,3'])))}
      ${P('wQ', 'Hậu – nữ hoàng mạnh nhất', 'Đi được như Xe <b>và</b> Tượng: thẳng, ngang, chéo — tuỳ ý! Hãy giữ Hậu cẩn thận.', mini(5, { '2,2': 'wQ' }, dots(['0,2', '1,2', '3,2', '4,2', '2,0', '2,1', '2,3', '2,4', '0,0', '1,1', '3,3', '4,4', '0,4', '1,3', '3,1', '4,0'])))}
      ${P('wK', 'Vua – người quan trọng nhất', 'Đi <b>1 ô</b> theo mọi hướng. Vua bị bắt là thua, nên phải luôn bảo vệ Vua!', mini(3, { '1,1': 'wK' }, dots(['0,0', '0,1', '0,2', '1,0', '1,2', '2,0', '2,1', '2,2'])))}
    </div>
    <h2>⚔️ Ăn quân là gì?</h2>
    <p class="big">Khi quân của bé đi tới ô có quân địch, quân địch bị <b>ăn</b> và rời khỏi bàn cờ. Trên trang này, mỗi lần ăn quân sẽ có màn <b>so kiếm 3D</b> thật oách!</p>
    <h2>👑 Chiếu và Chiếu hết</h2>
    <p><b>Chiếu</b> = Vua đang bị doạ ăn. Bé phải cứu Vua ngay: đưa Vua chạy, chặn lại, hoặc ăn quân đang doạ.</p>
    <p><b>Chiếu hết</b> = Vua bị doạ mà không có cách nào cứu. Ván cờ kết thúc, bên chiếu hết thắng! 🎉</p>
    <h2>💡 3 điều nhớ kỹ</h2>
    <ul class="tiplist">
      <li><b>1.</b> Mỗi lượt chỉ đi một quân, nghĩ kỹ rồi hãy chạm.</li>
      <li><b>2.</b> Trước khi đi, hỏi: "Quân mình đi tới đó có bị ăn không?"</li>
      <li><b>3.</b> Luôn nhìn xem Vua mình có an toàn không.</li>
    </ul>`;
  const l5 = `
    <h2>🏆 Xếp bàn cờ</h2>
    <p>Bàn cờ đặt sao cho ô góc bên phải mỗi người là <b>ô sáng</b>. Hàng cuối theo thứ tự: Xe – Mã – Tượng – Hậu – Vua – Tượng – Mã – Xe. Nhớ câu: <b>"Hậu đứng ô cùng màu"</b> (Hậu trắng ở ô sáng, Hậu đen ở ô tối). Hàng trước là 8 Tốt.</p>
    <h2>⚖️ Giá trị các quân</h2>
    <p>Khi đổi quân, hãy so giá trị để biết mình lời hay lỗ:</p>
    <div class="vals">
      <span class="val">${pieceSVG('wP')} Tốt <b>1</b></span><span class="val">${pieceSVG('wN')} Mã <b>3</b></span><span class="val">${pieceSVG('wB')} Tượng <b>3</b></span><span class="val">${pieceSVG('wR')} Xe <b>5</b></span><span class="val">${pieceSVG('wQ')} Hậu <b>9</b></span><span class="val">${pieceSVG('wK')} Vua <b>∞</b></span>
    </div>
    <h2>✨ 3 luật đặc biệt</h2>
    <div class="cards">
      ${P('wK', 'Nhập thành', 'Vua đi <b>2 ô</b> về phía Xe, rồi Xe nhảy qua đứng cạnh Vua. Chỉ được khi: Vua và Xe <b>chưa đi lần nào</b>, giữa hai quân trống, Vua không đang bị chiếu và không đi qua ô bị chiếu. Cách tuyệt vời để giấu Vua vào góc an toàn!', mini(4, { '3,0': 'wK', '3,3': 'wR' }, { '3,2': 'dot', '3,1': 'hl' }))}
      ${P('wP', 'Bắt Tốt qua đường', 'Khi Tốt địch vừa đi 2 ô và <b>dừng ngay cạnh</b> Tốt của bạn, bạn được ăn nó như thể nó chỉ đi 1 ô. Phải ăn <b>ngay lượt sau</b>, không thì mất quyền.', mini(4, { '1,1': 'wP', '1,2': 'bP' }, { '0,2': 'x' }))}
      ${P('wQ', 'Phong cấp', 'Tốt đi tới <b>hàng cuối</b> sẽ biến thành Hậu (hoặc Xe, Tượng, Mã). Trên trang này Tốt tự động thành Hậu — quân mạnh nhất!', mini(4, { '1,2': 'wP' }, { '0,2': 'hl' }))}
    </div>
    <h2>🛡️ Chiếu, chiếu hết, hoà</h2>
    <p><b>Chiếu (check):</b> Vua bị tấn công. Bắt buộc phải xử lý bằng 1 trong 3 cách: <b>chạy</b> Vua, <b>chặn</b> đường, hoặc <b>ăn</b> quân tấn công. Không được đi nước khiến Vua mình bị chiếu.</p>
    <p><b>Chiếu hết (checkmate):</b> bị chiếu mà không có cách xử lý → thua.</p>
    <p><b>Hoà (pat / stalemate):</b> đến lượt mà không còn nước đi hợp lệ nào nhưng Vua <b>không</b> bị chiếu → hoà. Cẩn thận khi đang thắng lớn kẻo "hoà oan"! Ngoài ra còn hoà khi hai bên không đủ quân chiếu hết, hoặc 50 nước không ăn quân/không đi Tốt.</p>
    <h2>🚀 Mẹo khai cuộc cho cao thủ lớp 5</h2>
    <ul class="tiplist">
      <li><b>Chiếm trung tâm:</b> đẩy Tốt e và d lên 2 ô (e4, d4). Quân ở giữa bàn kiểm soát nhiều ô hơn.</li>
      <li><b>Phát triển Mã và Tượng trước:</b> đưa chúng ra khỏi hàng cuối sớm. Đừng đi một quân nhiều lần khi các quân khác còn "ngủ".</li>
      <li><b>Nhập thành sớm</b> (trước nước 10) để Vua an toàn và Xe được nối với nhau.</li>
      <li><b>Đừng mang Hậu ra quá sớm:</b> Hậu dễ bị quân nhỏ đuổi đánh, mất nhịp.</li>
      <li><b>Mỗi nước hỏi 2 câu:</b> "Đối thủ vừa doạ gì?" và "Mình đi xong có bị ăn không?"</li>
      <li><b>Chiến thuật cơ bản:</b> <em>Đôi tấn công</em> (một quân doạ 2 quân cùng lúc — Mã rất giỏi trò này), <em>Ghim</em> (quân địch không dám đi vì phía sau là Vua/Hậu), <em>Xiên</em> (doạ quân to, quân to chạy thì ăn quân sau).</li>
      <li><b>Chiếu hết cơ bản:</b> Hậu + Vua đối Vua đơn; hai Xe "cắt thang". Tập chiếu hết với máy để thành thạo!</li>
    </ul>`;
  const how = `
    <h2>🖱️ Chơi trên trang này</h2>
    <ul class="tiplist">
      <li><b>Chọn quân:</b> chạm (hoặc bấm) vào quân của mình. Quân sẽ nhún nhảy và các ô đi được sẽ hiện chấm xanh, ô ăn được có vòng đỏ.</li>
      <li><b>Đi quân:</b> chạm vào ô chấm xanh/vòng đỏ. Muốn đổi ý, chạm lại quân đó hoặc chọn quân khác.</li>
      <li><b>Ô vàng</b> là nước vừa đi. <b>Ô đỏ nhấp nháy</b> là Vua đang bị chiếu.</li>
      <li><b>💡 Gợi ý nước đi:</b> tắt đi khi bé đã thuộc luật để tự suy nghĩ.</li>
      <li><b>⚔️ Hiệu ứng ăn quân:</b> <b>Đấu kiếm</b> — hai quân rút kiếm chém nhau ngay trên bàn cờ, ai thắng chiếm ô (mặc định); <b>Rượt đuổi</b> — quân bị ăn bỏ chạy, quân ăn đuổi theo; <b>So kiếm</b> — màn đấu 3D phóng to; <b>Tắt</b> để chơi nhanh. Nút <b>🎬 Hoạt cảnh</b> trên cùng bật/tắt nhanh mà không mất lựa chọn kiểu.</li>
      <li><b>🎵 Nhạc</b> nền nhẹ nhàng và <b>🗣️ Đọc nước</b> (máy đọc to "Ngựa đi bê 2", "Chiếu!") — bật/tắt riêng từng cái bằng nút trên cùng. Nút <b>🔊 Tiếng</b> là tiếng động khi đi quân, chém, thắng thua.</li>
      <li><b>♟ Đổi bộ quân:</b> 9 kiểu — Cổ điển, Vàng–Đỏ, Hồng–Xanh, Gỗ, Thuỷ tinh, Neon phát sáng, Đồ chơi (mập tròn), Vàng–Bạc kim loại, Pha lê (khối cạnh). Đổi ngay trong ván, không ảnh hưởng luật chơi.</li>
      <li><b>⛶ Toàn màn hình:</b> nút ở góc bàn cờ, để xem bàn cờ rõ nhất. Bấm ✕ hoặc phím Esc để thoát.</li>
      <li><b>👁 Góc nhìn:</b> <b>2D</b> nhìn từ trên xuống (dễ thấy nhất), <b>3D</b> nhìn nghiêng, <b>Ảo</b> như đang ngồi trước bàn cờ thật. Kéo <b>ngang</b> để xoay vòng, kéo <b>dọc</b> để ngẩng/cúi máy quay; véo 2 ngón hoặc cuộn để phóng to.</li>
      <li><b>Mũi tên mờ</b> khi chọn quân chỉ hướng quân có thể đi tới.</li>
      <li><b>↩️ Đi lại:</b> lùi một nước (chỉ khi chơi với máy hoặc 2 bạn cùng máy).</li>
      <li><b>💬 Trò chuyện:</b> khi đấu online, hai bạn nhắn tin hoặc gửi icon cho nhau — tin nhắn hiện thành bong bóng ngay trên bàn cờ.</li>
      <li><b>🌐 Đấu online:</b> một bạn tạo phòng và đọc mã 4 chữ; bạn kia nhập mã. Người tạo phòng cầm Trắng.</li>
      <li><b>⏱ Đồng hồ thi đấu:</b> chọn ở trang chính (3/5/10/15 phút mỗi bên). Đồng hồ chạy từ nước đi đầu tiên; hết giờ là thua như thi đấu thật. Nhấn <b>+ / −</b> hoặc cuộn chuột / véo 2 ngón để phóng to thu nhỏ bàn cờ.</li>
      <li><b>🤖 Chơi với máy:</b> có 3 mức. "Dễ" máy đi khá ngẫu nhiên, hợp lớp 1. "Vừa" và "Khó" để bạn lớp 5 luyện.</li>
    </ul>`;
  // Video tab. VIDEOS: add YouTube video IDs here (the part after v= in the link), e.g. { id: 'dQw4w9WgXcQ', title: 'Bài 1: Cách đi Tốt' }.
  // Empty list -> only the search links show. Videos load with youtube-nocookie and only when the tab is opened.
  const VIDEOS = [];
  const yts = q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  const video = `
    <h2>📺 Xem video học cờ</h2>
    <p class="big">Bấm để mở YouTube với các bài tìm sẵn. Bố mẹ xem cùng và chọn kênh bé thích, rồi thêm mã video vào trang (xem HANDOFF.md).</p>
    <div class="links">
      <a target="_blank" rel="noopener" href="${yts('dạy cờ vua cho trẻ em cơ bản')}">🌟 Cờ vua cho bé mới bắt đầu</a>
      <a target="_blank" rel="noopener" href="${yts('luật cờ vua cách đi các quân')}">♟ Cách đi từng quân</a>
      <a target="_blank" rel="noopener" href="${yts('chiếu hết cơ bản cờ vua hậu xe')}">👑 Chiếu hết cơ bản</a>
      <a target="_blank" rel="noopener" href="${yts('khai cuộc cờ vua cho người mới')}">🚀 Khai cuộc</a>
      <a target="_blank" rel="noopener" href="${yts('chiến thuật cờ vua đôi tấn công ghim xiên')}">🧠 Chiến thuật lớp 5</a>
      <a target="_blank" rel="noopener" href="${yts('cờ vua trẻ em vui nhộn hoạt hình')}">🎈 Cờ vua vui nhộn</a>
    </div>
    ${VIDEOS.length ? '<h2>🎬 Video bố mẹ đã chọn</h2><div class="vids">' + VIDEOS.map(v => `<div class="vid"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${v.id}" title="${v.title || ''}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><p>${v.title || ''}</p></div>`).join('') + '</div>' : ''}
    <p style="color:#e9dcc9">Mẹo: bật <b>🗣️ Đọc nước</b> và chơi lại thế cờ vừa xem trong video ở chế độ <b>2 bạn cùng máy</b>.</p>`;
  $('#l1').innerHTML = l1; $('#l5').innerHTML = l5; $('#video').innerHTML = video; $('#how').innerHTML = how;
}

// ===== AI level picker (inline in modal) =====
function pickLevel() {
  return new Promise(res => {
    $('#mTitle').textContent = '🤖 Chơi với máy';
    $('#mText').innerHTML = 'Chọn mức máy:';
    const row = $('#modal .row'); row.innerHTML = '';
    [['Dễ 🌱', 1, 'green'], ['Vừa 🌿', 2, 'blue'], ['Khó 🌳', 3, 'red']].forEach(([l, v, c]) => { const b = document.createElement('button'); b.className = 'btn ' + c; b.textContent = l; b.onclick = () => { $('#modal').classList.remove('on'); restoreModalButtons(); res(v); }; row.appendChild(b); });
    const cancel = document.createElement('button'); cancel.className = 'btn ghost'; cancel.textContent = 'Huỷ'; cancel.onclick = () => { $('#modal').classList.remove('on'); restoreModalButtons(); res(null); }; row.appendChild(cancel);
    $('#modal').classList.add('on');
  });
}
function restoreModalButtons() {
  const row = $('#modal .row'); row.innerHTML = '<button class="btn green" id="mNew">🆕 Chơi lại</button><button class="btn ghost" id="mClose">Xem bàn cờ</button>';
  $('#mNew').onclick = newGame; $('#mClose').onclick = () => $('#modal').classList.remove('on');
}
function newGame() {
  $('#modal').classList.remove('on');
  if (App.mode === 'online') { if (App.net) { App.net.send({ t: 'new', clock: App.clock }); startGame('online', { myColor: App.myColor, names: App.names, clock: App.clock }); } return; }
  startGame(App.mode, { myColor: App.mode === 'ai' ? App.myColor : 'w' });
}

// ===== Boot =====
function boot() {
  buildLessons();
  view = buildBoard($('#stage'), { onClick: onSquare });
  const hero = buildBoard($('#heroStage'), { autoOrbit: true });
  const demo = Chess.initial(); hero.sync(demo.board);
  // little demo animation on the hero board
  let demoState = demo, demoMoves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5', 'd7d5', 'e4d5', 'f6d5', 'g5f7'];
  let di = 0;
  const parseSq = s => [8 - +s[1], 'abcdefgh'.indexOf(s[0])];
  setInterval(() => {
    if (di >= demoMoves.length) { di = 0; demoState = Chess.initial(); hero.sync(demoState.board); return; }
    const mv = demoMoves[di++], from = parseSq(mv.slice(0, 2)), to = parseSq(mv.slice(2));
    const m = Chess.legal(demoState, from[0], from[1]).find(x => x.to[0] === to[0] && x.to[1] === to[1]); if (!m) return;
    const el = hero.els.get(from[0] * 8 + from[1]); if (el) hero.setPos(el, to[0], to[1]);
    const v = hero.els.get(to[0] * 8 + to[1]); if (v) setTimeout(() => v.remove(), 250);
    demoState = Chess.apply(demoState, m); setTimeout(() => hero.sync(demoState.board), 420);
  }, 1500);

  $('#myName').value = store.get('name', ''); $('#myName').addEventListener('input', e => store.set('name', e.target.value));
  const setSoundBtn = () => { $('#btnSound').innerHTML = (Sound.on ? '🔊' : '🔇') + ' <span class="lbl">Tiếng</span>'; $('#btnSound').setAttribute('aria-pressed', String(Sound.on)); $('#btnSound').classList.toggle('off', !Sound.on); };
  setSoundBtn();
  $('#btnSound').onclick = () => { Sound.on = !Sound.on; setSoundBtn(); if (Sound.on) Sound.ding(); };
  const setMusicBtn = () => { $('#btnMusic').innerHTML = (Music.on ? '🎵' : '🎵') + ' <span class="lbl">Nhạc</span>'; $('#btnMusic').setAttribute('aria-pressed', String(Music.on)); $('#btnMusic').classList.toggle('off', !Music.on); };
  setMusicBtn();
  $('#btnMusic').onclick = () => { Music.on = !Music.on; setMusicBtn(); };
  // browsers only allow audio after a tap: start music on the first interaction
  const kickMusic = () => { Music.kick(); document.removeEventListener('pointerdown', kickMusic); document.removeEventListener('keydown', kickMusic); };
  document.addEventListener('pointerdown', kickMusic); document.addEventListener('keydown', kickMusic);
  const setVoiceBtn = () => { $('#btnVoice').innerHTML = (Voice.on ? '🗣️' : '🤐') + ' <span class="lbl">Đọc nước</span>'; $('#btnVoice').setAttribute('aria-pressed', String(Voice.on)); $('#btnVoice').classList.toggle('off', !Voice.on); };
  setVoiceBtn();
  if (!Voice.available) $('#btnVoice').classList.add('hidden');
  $('#btnVoice').onclick = () => { Voice.on = !Voice.on; setVoiceBtn(); if (Voice.on) Voice.say('Đã bật đọc nước đi'); };
  // quick on/off for capture animations (Ken likes them, Na wants fast games)
  const setAnimBtn = () => { const onA = App.fxMode !== 'off'; $('#btnAnim').innerHTML = (onA ? '🎬' : '⏩') + ' <span class="lbl">Hoạt cảnh</span>'; $('#btnAnim').setAttribute('aria-pressed', String(onA)); $('#btnAnim').classList.toggle('off', !onA); };
  $('#btnAnim').onclick = () => { if (App.fxMode === 'off') App.fxMode = App.fxLast || 'sword'; else { App.fxLast = App.fxMode; store.set('fxLast', App.fxLast); App.fxMode = 'off'; } store.set('fxMode', App.fxMode); applyFx(); };
  $('#btnHome').onclick = () => go('home'); $('#btnLearn').onclick = () => show('Learn');
  $$('[data-go="home"]').forEach(b => b.onclick = () => go('home'));
  function go(where) { if (App.mode === 'online' && App.net) { if (!confirm('Rời phòng online?')) return; Net.cleanup(); } App.mode = null; show('Home'); }
  $$('.mode').forEach(b => b.onclick = async () => {
    Sound.unlock();
    const m = b.dataset.mode;
    if (m === 'learn') show('Learn');
    else if (m === 'ai') { const lv = await pickLevel(); if (!lv) return; App.aiLevel = lv; startGame('ai', { myColor: 'w' }); }
    else if (m === 'hot') startGame('hot');
    else if (m === 'online') { show('Online'); const ok = await Net.load(); if (!ok) { $('#hostStatus').textContent = $('#joinStatus').textContent = 'Không tải được phần kết nối. Hãy mở trang từ địa chỉ web (https) có mạng.'; $('#hostStatus').className = $('#joinStatus').className = 'status err'; } }
  });
  $('#learnPlayAI').onclick = async () => { const lv = await pickLevel(); if (!lv) return; App.aiLevel = lv; startGame('ai', { myColor: 'w' }); };
  $$('.tab').forEach(t => t.onclick = () => { $$('.tab').forEach(x => x.classList.remove('on')); t.classList.add('on'); $$('.lesson').forEach(l => l.classList.remove('on')); $('#' + t.dataset.lesson).classList.add('on'); });
  // toggles
  const tg = (id, key, apply) => { const el = $(id); el.classList.toggle('on', App[key]); el.onclick = () => { App[key] = !App[key]; store.set(key, App[key]); el.classList.toggle('on', App[key]); apply && apply(); }; };
  tg('#tgHints', 'hints', refresh);
  const applySet = () => { $$('#segSet button').forEach(b => b.classList.toggle('on', b.dataset.set === App.pieceSet)); if (typeof V3 !== 'undefined' && V3) { V3.setPieceSet(App.pieceSet); if (App.state && !App.busy) view.sync(App.state.board); hero.sync(demoState.board); } };
  $$('#segSet button').forEach(b => b.onclick = () => { App.pieceSet = b.dataset.set; store.set('pieceSet', App.pieceSet); applySet(); });
  applySet();
  const applyFx = () => { $$('#segFx button').forEach(b => b.classList.toggle('on', b.dataset.fx === App.fxMode)); setAnimBtn(); };
  $$('#segFx button').forEach(b => b.onclick = () => { App.fxMode = b.dataset.fx; store.set('fxMode', App.fxMode); if (App.fxMode !== 'off') { App.fxLast = App.fxMode; store.set('fxLast', App.fxLast); } applyFx(); });
  applyFx();
  // fullscreen
  const setFs = on => { document.body.classList.toggle('fs', on); if (on) { try { const p = $('.boardwrap').requestFullscreen && $('.boardwrap').requestFullscreen(); if (p && p.catch) p.catch(() => { }); } catch (e) { } } else if (document.fullscreenElement) { document.exitFullscreen().catch(() => { }); } updateFsInfo(); };
  $('#btnFs').onclick = () => setFs(!document.body.classList.contains('fs'));
  $('#btnExitFs').onclick = () => setFs(false);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('fs'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setFs(false); });
  const applyView = () => {
    $$('#segView button').forEach(b => b.classList.toggle('on', b.dataset.view === App.viewMode));
    [view, hero].forEach(v => { if (v.setView) v.setView(App.viewMode); });
    $('#stage').classList.toggle('flat', App.viewMode === '2d'); $('#heroStage').classList.toggle('flat', App.viewMode === '2d');
  };
  $$('#segView button').forEach(b => b.onclick = () => { App.viewMode = b.dataset.view; store.set('viewMode', App.viewMode); applyView(); });
  applyView();
  const applyClockSel = () => $$('#segClock button').forEach(b => b.classList.toggle('on', +b.dataset.tc === App.clock));
  $$('#segClock button').forEach(b => b.onclick = () => { App.clock = +b.dataset.tc; store.set('clock', App.clock); applyClockSel(); });
  applyClockSel();
  $('#zoomIn').onclick = () => view.zoomBy && view.zoomBy(.85); $('#zoomOut').onclick = () => view.zoomBy && view.zoomBy(1.18);
  $('#zoom').classList.toggle('hidden', !view.zoomBy);
  $('#btnUndo').onclick = () => {
    if (App.busy || !App.history.length) return;
    let s = App.history.pop();
    if (App.mode === 'ai' && s.turn !== App.myColor && App.history.length) s = App.history.pop();
    App.state = s; App.sel = null; App.legal = []; App.over = false; $('#modal').classList.remove('on'); view.sync(s.board); refresh(); if (s.moves.length) Clock.start(s.turn); else Clock.stop();
  };
  $('#btnFlip').onclick = () => { view.flipped = !view.flipped; view.layout(); view.sync(App.state.board); refresh(); };
  $('#btnNew').onclick = () => { if (App.state.moves.length && !App.over && !confirm('Bắt đầu ván mới?')) return; newGame(); };
  $('#btnQuit').onclick = () => go('home');
  $('#mNew').onclick = newGame; $('#mClose').onclick = () => $('#modal').classList.remove('on');
  // online
  const setStatus = (el) => (t, err, ok) => { el.textContent = t; el.className = 'status' + (err ? ' err' : ok ? ' ok' : ''); };
  $('#btnCreate').onclick = () => Net.host(setStatus($('#hostStatus')));
  $('#btnJoin').onclick = () => { const code = $('#joinCode').value.trim().toUpperCase(); if (code.length !== 4) { setStatus($('#joinStatus'))('Nhập đủ 4 chữ nhé!', true); return; } Net.join(code, setStatus($('#joinStatus'))); };
  $('#joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnJoin').click(); });
  window.addEventListener('beforeunload', () => Net.cleanup());
  // chat
  $('#emojis').innerHTML = EMOJIS.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('');
  $$('#emojis button').forEach(b => b.onclick = () => sendChat(b.dataset.e));
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat($('#chatIn').value); $('#chatIn').value = ''; });
}
// ===== PWA: install prompt + service worker =====
(function pwa() {
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; const b = $('#btnInstall'); if (b && !isStandalone()) b.classList.remove('hidden'); });
  window.addEventListener('appinstalled', () => { const b = $('#btnInstall'); if (b) b.classList.add('hidden'); const t = $('#installTip'); if (t) t.classList.remove('on'); });
  document.addEventListener('DOMContentLoaded', () => {
    const b = $('#btnInstall');
    if (b) b.onclick = async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (e) { } deferred = null; b.classList.add('hidden'); };
    // iOS has no install prompt: show a one-time hint in Safari
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (ios && !isStandalone() && !store.get('iosTipSeen', false)) { const t = $('#installTip'); if (t) { t.classList.add('on'); t.onclick = () => { t.classList.remove('on'); store.set('iosTipSeen', true); }; } }
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
  }
})();
document.addEventListener('DOMContentLoaded', boot);
