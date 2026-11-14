(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const scenes = $$('.scene');
  const total = scenes.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = -1, timers = [], muted = true, ac = null, confettiRAF = 0;

  /* ---------- Sound (synthesised, starts muted) ---------- */
  function tone(f, t = 0, d = .2, type = 'sine', v = .12, slide) {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(), s = ac.currentTime + t;
      o.type = type; o.frequency.setValueAtTime(f, s);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, s + d);
      g.gain.setValueAtTime(v, s); g.gain.exponentialRampToValueAtTime(.0001, s + d);
      o.connect(g).connect(ac.destination); o.start(s); o.stop(s + d + .05);
    } catch (e) { /* audio unavailable: ignore */ }
  }
  const sfx = {
    ding: () => { tone(1318, 0, .9, 'sine', .15); tone(1760, .12, .9, 'sine', .1); },
    buzz: () => { for (let i = 0; i < 12; i++) tone(180 + (i % 2) * 25, i * .1, .12, 'sawtooth', .04); },
    cry: () => { tone(700, 0, .35, 'triangle', .1, 420); tone(720, .45, .35, 'triangle', .1, 400); },
    magic: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .09, .4, 'sine', .1)),
    pop: () => tone(520, 0, .12, 'sine', .1, 900),
    page: () => tone(220, 0, .15, 'triangle', .06, 120),
    stamp: () => tone(120, 0, .2, 'square', .1, 60),
    cheer: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * .11, .3, 'triangle', .1))
  };
  const notes = [523, 587, 659, 784, 880];
  setInterval(() => { if (!muted) tone(notes[Math.floor(Math.random() * notes.length)] / 2, 0, 1.4, 'sine', .035); }, 800);
  const soundBtn = $('#sound');
  soundBtn.addEventListener('click', () => {
    muted = !muted;
    soundBtn.textContent = muted ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-pressed', String(!muted));
    soundBtn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
    if (!muted) sfx.pop();
  });

  /* ---------- Scene engine ---------- */
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function enter(i) {
    const sc = scenes[i];
    clearTimers();
    stopConfetti();
    $$('[data-step],[data-act]', sc).forEach(el => el.classList.remove('show'));
    sc.classList.remove('opened');
    if (i === 0) $('#book').classList.remove('open');
    if (i === 7) $('#notebook').classList.remove('open');
    if (i === 8) $('#secret').classList.remove('show');
    $$('[data-step],[data-act]', sc).forEach(el => {
      const at = reduce ? Math.min(+el.dataset.at, 600) : +el.dataset.at;
      timers.push(setTimeout(() => {
        el.classList.add('show');
        if (el.dataset.sfx && sfx[el.dataset.sfx]) sfx[el.dataset.sfx]();
      }, at));
    });
    if (i === 8) { timers.push(setTimeout(() => { sfx.cheer(); startConfetti(); }, 300)); }
  }

  function go(n) {
    if (n < 0 || n >= total || n === cur) return;
    const dir = n > cur ? 1 : -1;
    if (cur >= 0) {
      const old = scenes[cur];
      old.classList.remove('active'); old.classList.add('out');
      setTimeout(() => old.classList.remove('out'), 450);
      sfx.page();
    }
    const sc = scenes[n];
    sc.style.setProperty('--dx', dir > 0 ? '60px' : '-60px');
    sc.classList.remove('out');
    sc.classList.add('active');
    cur = n;
    $('#counter').textContent = `${String(n + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    $('#bar').style.width = `${((n + 1) / total) * 100}%`;
    $('#prev').disabled = n === 0;
    $('#next').disabled = n === total - 1;
    enter(n);
  }

  function next() { cur === 0 ? openBook() : go(cur + 1); }
  function prev() { go(cur - 1); }

  /* ---------- Interactions ---------- */
  let opening = false;
  function openBook() {
    if (opening) return;
    opening = true;
    $('#book').classList.add('open');
    sfx.magic();
    setTimeout(() => { go(1); opening = false; }, reduce ? 200 : 1300);
  }
  $('#openBook').addEventListener('click', openBook);
  $('#openMemory').addEventListener('click', () => {
    $('#notebook').classList.add('open');
    sfx.magic();
    setTimeout(() => $('#memory').classList.add('opened'), reduce ? 100 : 1500);
  });
  $('#surprise').addEventListener('click', () => { $('#secret').classList.add('show'); sfx.magic(); startConfetti(); });
  $('#again').addEventListener('click', () => go(0));
  $('#restart').addEventListener('click', () => go(0));
  $('#prev').addEventListener('click', prev);
  $('#next').addEventListener('click', next);

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if ((e.key === ' ' || e.key === 'Enter') && tag !== 'button') { e.preventDefault(); next(); }
  });

  let sx = 0, sy = 0;
  const stage = $('#stage');
  stage.addEventListener('touchstart', e => { sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) dx < 0 ? next() : prev();
  }, { passive: true });

  /* ---------- Ambient floaters ---------- */
  const amb = $('#ambient'), sym = ['♥', '★', '✿', '✦'];
  if (!reduce) for (let i = 0; i < 12; i++) {
    const s = document.createElement('span');
    s.className = 'float'; s.textContent = sym[i % sym.length];
    s.style.cssText = `left:${Math.random() * 96}%;font-size:${14 + Math.random() * 16}px;animation-duration:${9 + Math.random() * 8}s;animation-delay:${Math.random() * 12}s`;
    amb.appendChild(s);
  }

  /* ---------- Confetti ---------- */
  const cv = $('#confetti'), cx = cv.getContext('2d');
  function stopConfetti() { cancelAnimationFrame(confettiRAF); cx.clearRect(0, 0, cv.width, cv.height); }
  function startConfetti() {
    if (reduce) return;
    cancelAnimationFrame(confettiRAF);
    cv.width = cv.clientWidth; cv.height = cv.clientHeight;
    const cols = ['#FFE8A3', '#FFDCE5', '#DCEEFF', '#DDF2DF', '#e0566f', '#E8A93A'];
    const ps = Array.from({ length: 110 }, () => ({
      x: Math.random() * cv.width, y: -Math.random() * cv.height * .6, w: 6 + Math.random() * 7, h: 4 + Math.random() * 6,
      vy: 2 + Math.random() * 3, vx: -1 + Math.random() * 2, r: Math.random() * 6, vr: -.15 + Math.random() * .3,
      c: cols[Math.floor(Math.random() * cols.length)]
    }));
    const t0 = performance.now();
    (function frame(t) {
      cx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.strokeStyle = '#795548'; cx.lineWidth = .8;
        cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      });
      if (t - t0 < 5000) confettiRAF = requestAnimationFrame(frame); else cx.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  go(0);
})();
