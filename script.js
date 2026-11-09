'use strict';

/* =====================================================================
   SCRIPT.JS: shows one page at a time, fades sections in, and plays
   the audio you add in index.html. You normally do not need to edit this.
   ===================================================================== */

const pages = Array.from(document.querySelectorAll('.page'));
const navLinks = Array.from(document.querySelectorAll('nav a'));
const nav = document.getElementById('mainNav');
const menuBtn = document.getElementById('menuBtn');
const soundBtn = document.getElementById('soundBtn');
const hoverSfx = document.getElementById('hoverSfx');
const clickSfx = document.getElementById('clickSfx');

let soundOn = false;

/* An audio element only counts if you un-commented a <source> inside it. */
const hasSource = (audio) => Boolean(audio && audio.querySelector('source'));
const pageAudio = (page) =>
  document.querySelectorAll(`.page-audio[data-page="${page.dataset.page}"]`);
function playAudio(audio, restart) {
  if (!soundOn || !hasSource(audio)) return;
  if (restart) audio.currentTime = 0;
  audio.play().catch(() => { /* browser blocked playback until the next click */ });
}

function stopPageAudio() {
  document.querySelectorAll('.page-audio').forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

/* ---------- FADE-IN SECTIONS ---------- */
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

/* ---------- PAGE SWITCHING (uses the #/page-name part of the address) ---------- */
function showPage() {
  let name = (location.hash.replace('#/', '') || 'home');
  if (name === 'quiz') name = 'trial';   /* old Quiz links open the Final Class Trial */
  const target = document.getElementById('page-' + name) || document.getElementById('page-home');
  const key = target.dataset.page;

  pages.forEach((page) => page.classList.toggle('active', page === target));

  /* Highlight the matching menu button (lesson pages highlight "Lessons") */
  const section = key.startsWith('lesson-') ? 'lessons' : key.startsWith('member-') ? 'members' : key;
  navLinks.forEach((link) => link.classList.toggle('active', link.dataset.nav === section));

  window.scrollTo(0, 0);
  nav.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');

  target.querySelectorAll('.fade:not(.visible)').forEach((el) => fadeObserver.observe(el));

  /* Music and sound effect for this page */
  pageAudio(target).forEach((audio) => {
  playAudio(audio, true);
});
}

window.addEventListener('hashchange', showPage);

/* ---------- MENU BUTTON (mobile) ---------- */
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});

/* ---------- SOUND ON / OFF ---------- */
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  soundBtn.textContent = 'Sound: ' + (soundOn ? 'On' : 'Off');
  if (soundOn) {
    const active = document.querySelector('.page.active');
    if (active) pageAudio(active).forEach((audio) => playAudio(audio, false));
  } else {
    stopPageAudio();
  }
});

/* ---------- HOVER AND CLICK SOUND EFFECTS ---------- */
document.querySelectorAll('.card, .btn').forEach((el) => {
  el.addEventListener('mouseenter', () => playAudio(hoverSfx, true));
  el.addEventListener('click', () => playAudio(clickSfx, true));
});

showPage();

/* =====================================================================
   FINAL CLASS TRIAL
   Edit the three numbers below to change the rules.
   ===================================================================== */
(() => {
  const TOTAL_SECONDS = 300;   /* CHANGE THIS: starting time in seconds */
  const DANGER_AT = 15;       /* CHANGE THIS: timer turns red at this many seconds left */
  const PASS_SCORE = 32;       /* CHANGE THIS: correct answers needed to pass */
  const HOME_URL = 'index.html';

  const $ = (id) => document.getElementById(id);
  const intro = $('trialIntro');
  const run = $('trialRun');
  const timerEl = $('trialTimer');
  const progressEl = $('trialProgress');
  const winOverlay = $('winOverlay');
  const guiltyOverlay = $('guiltyOverlay');
  const videoWrap = $('executionWrap');
  const video = $('executionVideo');
  const questions = Array.from(document.querySelectorAll('.q'));
  const sfx = {
    correct: $('sfxCorrect'), wrong: $('sfxWrong'), guilty: $('sfxGuilty'),
    execution: $('sfxExecution'), success: $('sfxSuccess')
  };

  let state = 'idle';   /* idle | running | judging | done */
  let endTime = 0;
  let ticker = null;
  let score = 0;
  let answered = 0;
  let videoPlaying = false;
  const timeouts = [];

  const later = (fn, ms) => timeouts.push(setTimeout(fn, ms));
  const goHome = () => { window.location.href = HOME_URL; };
  const formatTime = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  /* A sound plays only if you un-commented its <source> in index.html */
  function playSfx(audio) {
    if (!audio || !audio.querySelector('source')) return;
    audio.currentTime = 0;
    audio.play().catch(() => { /* playback blocked by the browser */ });
  }

  function resetTrial() {
    clearInterval(ticker);
    timeouts.splice(0).forEach(clearTimeout);
    state = 'idle'; score = 0; answered = 0; videoPlaying = false;
    questions.forEach((q) => {
      q.classList.remove('locked');
      q.querySelectorAll('.opt').forEach((o) => o.classList.remove('chosen', 'right', 'wrong'));
    });
    timerEl.textContent = formatTime(TOTAL_SECONDS);
    timerEl.classList.remove('danger');
    progressEl.textContent = 'Answered 0 / ' + questions.length;
    intro.hidden = false;
    run.hidden = true;
    [winOverlay, guiltyOverlay].forEach((o) => { o.hidden = true; o.classList.remove('show'); });
    video.pause();
    videoWrap.hidden = true;
    Object.values(sfx).forEach((a) => { a.pause(); });
  }

  function startTrial() {
    resetTrial();
    state = 'running';
    intro.hidden = true;
    run.hidden = false;
    window.scrollTo(0, 0);
    endTime = Date.now() + TOTAL_SECONDS * 1000;
    ticker = setInterval(updateTimer, 200);
    updateTimer();
  }

  function updateTimer() {
    if (state !== 'running') return;
    const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    timerEl.textContent = formatTime(left);
    timerEl.classList.toggle('danger', left <= DANGER_AT);
    if (left === 0) finishTrial(false);
  }

  function chooseAnswer(opt) {
    const q = opt.closest('.q');
    if (state !== 'running' || q.classList.contains('locked')) return;
    const right = opt.dataset.letter === q.dataset.correct;
    q.classList.add('locked');
    opt.classList.add('chosen', right ? 'right' : 'wrong');
    playSfx(right ? sfx.correct : sfx.wrong);
    if (right) score += 1;
    answered += 1;
    progressEl.textContent = 'Answered ' + answered + ' / ' + questions.length;
    if (answered === questions.length) {
      state = 'judging';
      clearInterval(ticker);
      later(() => finishTrial(score >= PASS_SCORE), 800);
    }
  }

   function finishTrial(passed) {
    if (state === 'done') return;
    state = 'done';
    clearInterval(ticker);
    stopMusic();   /* time is up or every question is answered: the main music stops */
    passed ? showWin() : showGuilty();
  }

  /* Stops the page music only (home and lesson music). Answer and verdict sounds are not affected. */
  function stopMusic() {
    document.querySelectorAll('.page-audio').forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /* ---------- PASS: YOU ARE FREE, then redirect after 5 seconds ---------- */
  function showWin() {
    winOverlay.hidden = false;
    void winOverlay.offsetWidth;
    winOverlay.classList.add('show');
    playSfx(sfx.success);
    later(goHome, 5000);
  }

  /* ---------- FAIL: VERDICT GUILTY, red flash, execution video after 2 seconds ---------- */
  function showGuilty() {
    guiltyOverlay.hidden = false;
    void guiltyOverlay.offsetWidth;
    guiltyOverlay.classList.add('show');
    playSfx(sfx.guilty);
    later(playExecution, 2000);
  }

  function playExecution() {
    videoWrap.hidden = false;
    playSfx(sfx.execution);
    if (videoWrap.requestFullscreen) videoWrap.requestFullscreen().catch(() => {});
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;               /* retry silently if the browser blocks sound */
      video.play().catch(videoFailed);
    });
    if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) videoFailed();   /* file missing */
    later(() => { if (!videoPlaying) videoFailed(); }, 15000);   /* video missing or stuck */
  }

  /* If the video cannot play, say why on screen, then return to the home page */
  function videoFailed() {
    if (videoPlaying || state !== 'done') return;
    $('videoError').hidden = false;
    later(goHome, 7000);
  }

  video.addEventListener('playing', () => { videoPlaying = true; });
  video.addEventListener('ended', goHome);
  video.addEventListener('error', videoFailed);
  const videoSource = video.querySelector('source');
  if (videoSource) videoSource.addEventListener('error', videoFailed);

  /* Unskippable: resume if paused, and block right-click and keyboard shortcuts while it plays */
  video.addEventListener('pause', () => {
    if (!video.ended && !videoWrap.hidden) video.play().catch(() => {});
  });
  document.addEventListener('contextmenu', (e) => { if (!videoWrap.hidden) e.preventDefault(); });
  document.addEventListener('keydown', (e) => { if (!videoWrap.hidden) e.preventDefault(); });

  $('trialStart').addEventListener('click', startTrial);
  run.addEventListener('click', (e) => {
    const opt = e.target.closest('.opt');
    if (opt) chooseAnswer(opt);
  });

  /* Leaving the page cancels the trial so it always restarts from the Begin screen */
  window.addEventListener('hashchange', resetTrial);
  resetTrial();
})();

(() => {
  const slider = document.getElementById('volume');
  const applyVolume = () => {
    const level = Number(slider.value) / 100;
    document.querySelectorAll('audio, video').forEach((media) => { media.volume = level; });
  };
  slider.addEventListener('input', applyVolume);
  applyVolume();
})();

/* =====================================================================
   ==================  PRESENTATION LAYER  =============================
   Everything below only re-frames content that already exists in
   index.html. No lesson, dossier, question or answer text is edited:
   the lesson reformatter moves the original nodes into new containers
   and refuses to apply itself if the text would change by one character.
   ===================================================================== */

const ui = (() => {
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const sfx = (node) => {
    node.addEventListener('mouseenter', () => playAudio(hoverSfx, true));
    node.addEventListener('click', () => playAudio(clickSfx, true));
    return node;
  };
  const pad = (n) => String(n).padStart(2, '0');
  const headerH = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 64;
  const compact = () => window.matchMedia('(max-width: 1040px)').matches;
  /* On narrow screens the evidence index becomes a sticky bar, so anchors must clear it too */
  const sideOffset = (side) => {
    if (!compact() || !side) return 0;
    const panel = side.querySelector('.side-collapsible');
    const expanded = side.classList.contains('is-open') && panel ? panel.getBoundingClientRect().height : 0;
    return side.getBoundingClientRect().height - expanded + 14;
  };
  return { make, sfx, pad, headerH, compact, sideOffset };
})();

/* ---------- The seven case files, read straight from the archive cards ---------- */
const archive = Array.from(document.querySelectorAll('#page-lessons .lesson-card')).map((card, i) => ({
  n: i + 1,
  key: card.getAttribute('href').replace('#/', ''),
  href: card.getAttribute('href'),
  label: card.querySelector('h2').textContent.trim(),
  title: card.querySelector('.card-body p').textContent.trim(),
  card
}));

/* ---------- Investigation log (which case files have been opened / closed) ---------- */
const caseLog = (() => {
  const KEY = 'mil-group5-case-log';
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  };
  const write = (log) => {
    try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* private browsing */ }
    document.dispatchEvent(new CustomEvent('caselog'));
  };
  return {
    state: (key) => read()[key] || 'new',
    set: (key, value) => { const log = read(); if (value === 'new') delete log[key]; else log[key] = value; write(log); },
    closed: () => archive.filter((l) => read()[l.key] === 'closed').length,
    next: () => archive.find((l) => read()[l.key] !== 'closed') || archive[0]
  };
})();

/* ---------- Glitch overlay, scroll rail, back-to-top, page wipe ---------- */
(() => {
  document.querySelectorAll('.glitch').forEach((el) => { el.dataset.text = el.textContent.trim(); });

  const rail = document.getElementById('readRail');
  const toTop = document.getElementById('toTop');
  const wipe = document.getElementById('pageWipe');
  let queued = false;

  const measure = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    rail.style.width = (max > 0 ? Math.min(1, window.scrollY / max) * 100 : 0) + '%';
    toTop.classList.toggle('is-visible', window.scrollY > 420);
  };
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { measure(); queued = false; });
  }, { passive: true });
  window.addEventListener('resize', measure);
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  ui.sfx(toTop);

  window.addEventListener('hashchange', () => {
    wipe.classList.remove('is-on');
    void wipe.offsetWidth;
    wipe.classList.add('is-on');
    measure();
  });
  measure();
})();

/* =====================================================================
   LESSON PROSE: the original words, re-set as readable evidence entries
   ===================================================================== */
(() => {
  const { make } = ui;

  const linesOf = (paragraph) => {
    const lines = [];
    let current = [];
    Array.from(paragraph.childNodes).forEach((node) => {
      if (node.nodeName === 'BR') { lines.push(current); current = []; }
      else current.push(node);
    });
    lines.push(current);
    return lines.map((nodes) => {
      const text = nodes.map((n) => n.textContent).join('');
      return {
        nodes,
        text,
        blank: text.trim() === '',
        bullet: /^\s*\u2022/.test(text),
        rule: /^\s*-{3,}\s*$/.test(text),
        heading: text.trim() !== '' && nodes.every((n) => n.nodeName === 'B' || n.textContent.trim() === '')
      };
    });
  };

  document.querySelectorAll('.page-lesson').forEach((page) => {
    const key = page.dataset.page;
    page.querySelectorAll('.lesson-block').forEach((block, blockIndex) => {
      block.classList.add(blockIndex === 0 ? 'is-summary' : 'is-reflection');
      const heading = block.querySelector('h2');
      heading.dataset.index = ui.pad(blockIndex + 1);
      block.id = 'sec-' + key + '-' + blockIndex;

      block.querySelectorAll(':scope > p').forEach((paragraph) => {
        const original = paragraph.textContent;
        const lines = linesOf(paragraph);
        const hasTerms = lines.some((l) => l.heading);
        const wrap = make('div', 'lv');
        let entry = null;
        let def = null;
        let para = null;
        let list = null;
        let closing = false;
        let anchor = 0;

        const target = () => def || wrap;
        const closeRun = () => { para = null; list = null; };

        lines.forEach((line, i) => {
          if (line.blank) { target().append(...line.nodes); closeRun(); return; }

          if (line.rule) {
            const rule = make('div', 'lv-rule');
            const dashes = make('span', 'lv-rule-text');
            dashes.append(...line.nodes);
            rule.append(dashes);
            wrap.append(rule);
            entry = def = null; closeRun(); closing = true;
            return;
          }

          if (line.heading) {
            const term = make('h3', 'lv-term');
            term.append(...line.nodes);
            const body = lines.slice(i + 1).find((l) => !l.blank);
            const ownsBody = body && !body.heading && !body.rule;
            closeRun();
            if (ownsBody) {
              entry = make('section', 'lv-entry');
              entry.id = 'ev-' + key + '-' + blockIndex + '-' + (anchor++);
              def = make('div', 'lv-def');
              entry.append(term, def);
              wrap.append(entry);
            } else {
              term.classList.add('is-group');
              wrap.append(term);
              entry = def = null;
            }
            return;
          }

          if (line.bullet) {
            if (!list) { list = make('ul', 'lv-list'); target().append(list); }
            const item = make('li', 'lv-item');
            item.append(...line.nodes);
            list.append(item);
            para = null;
            return;
          }

          list = null;
          if (!para) {
            const cls = closing && !entry ? 'lv-close' : (hasTerms && !entry ? 'lv-lead' : 'lv-line');
            para = make('p', cls);
            target().append(para);
          }
          para.append(...line.nodes);
        });

        /* Content guard: apply the new layout only if every character survived. */
        if (wrap.textContent === original && original.trim() !== '') {
          paragraph.replaceWith(wrap);
        }
      });
    });
  });
})();

/* =====================================================================
   LESSON SHELL: sticky evidence index, reading meter and case pager
   ===================================================================== */
const lessonViews = (() => {
  const { make, sfx } = ui;
  const views = [];

  archive.forEach((lesson) => {
    const page = document.getElementById('page-' + lesson.key);
    if (!page) return;
    const body = page.querySelector('.lesson-body');
    const pager = page.querySelector('.lesson-nav');
    const shell = make('div', 'lesson-shell');
    const main = make('div', 'lesson-main');
    const side = make('aside', 'lesson-side');
    side.setAttribute('aria-label', 'Case file navigation');

    const head = make('div', 'side-head');
    head.append(make('span', 'side-case', lesson.label), make('span', 'side-title', lesson.title));

    const progress = make('div', 'side-progress');
    const progressLabel = make('span');
    progressLabel.innerHTML = 'Read <b>0%</b>';
    const meter = make('div', 'meter');
    const meterFill = make('i');
    meter.append(meterFill);
    progress.append(progressLabel, meter);

    const toggle = make('button', 'side-toc-toggle', 'Evidence Index');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    const setOpen = (open) => {
      side.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!side.classList.contains('is-open')));
    sfx(toggle);

    const jump = (node) => {
      if (ui.compact()) setOpen(false);
      scrollToAnchor(node, side);
    };

    const collapsible = make('div', 'side-collapsible');
    const toc = make('ul', 'side-toc');
    const anchors = [];
    body.querySelectorAll('.lesson-block').forEach((block) => {
      const top = make('li');
      const link = make('button', null, block.querySelector('h2').textContent);
      link.type = 'button';
      link.addEventListener('click', () => jump(block));
      top.append(link);
      toc.append(top);
      anchors.push({ node: block, link });

      const entries = Array.from(block.querySelectorAll('.lv-entry'));
      if (!entries.length) return;
      const sub = make('li', 'toc-sub');
      const subList = make('ul', 'side-toc');
      entries.forEach((entry) => {
        const item = make('li');
        const subLink = make('button', null, entry.querySelector('.lv-term').textContent.trim());
        subLink.type = 'button';
        subLink.addEventListener('click', () => jump(entry));
        item.append(subLink);
        subList.append(item);
        anchors.push({ node: entry, link: subLink });
      });
      sub.append(subList);
      toc.append(sub);
    });

    const railWrap = make('div', 'side-rail');
    const railDots = archive.map((other) => {
      const dot = make('a', 'rail-dot', String(other.n));
      dot.href = other.href;
      dot.title = other.label + ' — ' + other.title;
      sfx(dot);
      railWrap.append(dot);
      return dot;
    });

    collapsible.append(make('p', 'side-label', 'Evidence Index'), toc, make('p', 'side-label', 'Case Files'), railWrap);

    const actions = make('div', 'side-actions');
    const closeBtn = make('button', 'case-toggle', 'Close Case File');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => {
      caseLog.set(lesson.key, caseLog.state(lesson.key) === 'closed' ? 'open' : 'closed');
    });
    sfx(closeBtn);
    const indexLink = make('a', 'btn', 'All Case Files');
    indexLink.href = '#/lessons';
    actions.append(closeBtn, indexLink);

    collapsible.append(actions);
    side.append(head, progress, toggle, collapsible);
    body.before(shell);
    shell.append(side, main);
    main.append(body, pager);

    /* Pager rebuilt from the archive so every case shows its real neighbours */
    const prev = archive[lesson.n - 2];
    const next = archive[lesson.n];
    pager.replaceChildren();
    const prevCell = prev
      ? Object.assign(make('a', 'pager pager-prev'), { href: prev.href })
      : make('span', 'pager is-empty');
    if (prev) prevCell.append(make('small', null, 'Previous Case'), make('strong', null, prev.title));
    const mid = make('a', 'pager-mid', 'Archive Index');
    mid.href = '#/lessons';
    const nextCell = Object.assign(make('a', 'pager pager-next'), { href: next ? next.href : '#/trial' });
    nextCell.append(make('small', null, next ? 'Next Case' : 'Final Stage'), make('strong', null, next ? next.title : 'Final Class Trial'));
    pager.append(prevCell, mid, nextCell);
    [prevCell, mid, nextCell].forEach((cell) => { if (cell.tagName === 'A') sfx(cell); });

    views.push({ lesson, page, body, side, meterFill, progressLabel, railDots, closeBtn, anchors });
  });

  function scrollToAnchor(node, side) {
    const top = node.getBoundingClientRect().top + window.scrollY - ui.headerH() - 28 - ui.sideOffset(side);
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function refresh() {
    views.forEach((view) => {
      const state = caseLog.state(view.lesson.key);
      view.closeBtn.classList.toggle('is-closed', state === 'closed');
      view.closeBtn.textContent = state === 'closed' ? 'Case Closed \u2713' : 'Close Case File';
      view.railDots.forEach((dot, i) => {
        const other = archive[i];
        dot.classList.toggle('is-closed', caseLog.state(other.key) === 'closed');
        dot.classList.toggle('is-open', caseLog.state(other.key) === 'open');
        dot.classList.toggle('is-current', other.key === view.lesson.key);
      });
    });
  }

  /* Reading meter + scroll spy, only for the lesson actually on screen */
  let queued = false;
  const track = () => {
    const active = views.find((v) => v.page.classList.contains('active'));
    if (!active) return;
    const rect = active.body.getBoundingClientRect();
    const offset = ui.headerH() + 40 + ui.sideOffset(active.side);
    const span = Math.max(1, rect.height - window.innerHeight + offset + 60);
    const ratio = Math.min(1, Math.max(0, (offset - rect.top) / span));
    active.meterFill.style.width = (ratio * 100) + '%';
    active.progressLabel.innerHTML = 'Read <b>' + Math.round(ratio * 100) + '%</b>';
    if (ratio >= 0.999 && rect.height > 600 && caseLog.state(active.lesson.key) !== 'closed') {
      caseLog.set(active.lesson.key, 'closed');
    }
    let current = active.anchors[0] || null;
    active.anchors.forEach((a) => {
      if (a.node.getBoundingClientRect().top <= offset + 60) current = a;
    });
    active.anchors.forEach((a) => a.link.classList.toggle('is-active', a === current));
  };
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { track(); queued = false; });
  }, { passive: true });
  window.addEventListener('resize', track);

  return { refresh, track };
})();

/* =====================================================================
   ARCHIVE HUB, HOME LOG AND TRIAL READINESS
   ===================================================================== */
const archiveViews = (() => {
  const { make, pad, sfx } = ui;
  const stamps = new Map();

  archive.forEach((lesson) => {
    const stamp = make('span', 'card-stamp', 'Unopened');
    lesson.card.querySelector('.card-img').append(stamp);
    stamps.set(lesson.key, stamp);
  });

  const boardFiles = document.getElementById('boardFiles');
  const boardCells = archive.map((lesson) => {
    const item = make('li');
    const link = make('a', 'board-file');
    link.href = lesson.href;
    link.title = lesson.title;
    link.append(make('b', null, pad(lesson.n)), make('span', null, 'Case ' + pad(lesson.n)));
    sfx(link);
    item.append(link);
    boardFiles.append(item);
    return link;
  });

  const countEl = document.getElementById('archiveCount');
  const archiveBar = document.getElementById('archiveBar');
  const archiveContinue = document.getElementById('archiveContinue');
  const boardBar = document.getElementById('boardBar');
  const boardNote = document.getElementById('boardNote');
  const boardContinue = document.getElementById('boardContinue');
  const readiness = document.getElementById('trialReadiness');
  const emptyNote = document.getElementById('archiveEmpty');
  const filters = document.getElementById('archiveFilters');
  let filter = 'all';

  const applyFilter = () => {
    let shown = 0;
    archive.forEach((lesson) => {
      const match = filter === 'all' || caseLog.state(lesson.key) === filter;
      lesson.card.classList.toggle('is-filtered', !match);
      if (match) shown += 1;
    });
    emptyNote.hidden = shown > 0;
  };

  filters.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filter = chip.dataset.filter;
    filters.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
    applyFilter();
  });
  filters.querySelectorAll('.chip').forEach(sfx);

  function refresh() {
    const closed = caseLog.closed();
    const opened = archive.filter((l) => caseLog.state(l.key) === 'open').length;
    const next = caseLog.next();

    archive.forEach((lesson, i) => {
      const state = caseLog.state(lesson.key);
      const stamp = stamps.get(lesson.key);
      stamp.textContent = state === 'closed' ? 'Closed \u2713' : state === 'open' ? 'In Progress' : 'Unopened';
      stamp.classList.toggle('is-open', state === 'open');
      stamp.classList.toggle('is-closed', state === 'closed');
      lesson.card.classList.toggle('is-closed', state === 'closed');
      boardCells[i].classList.toggle('is-open', state === 'open');
      boardCells[i].classList.toggle('is-closed', state === 'closed');
    });

    countEl.textContent = closed;
    archiveBar.style.width = (closed / archive.length * 100) + '%';
    boardBar.style.width = (closed / archive.length * 100) + '%';
    archiveContinue.href = next.href;
    archiveContinue.textContent = closed === archive.length ? 'Review Archive' : 'Continue: Case ' + pad(next.n);
    boardContinue.href = next.href;
    boardContinue.textContent = closed === archive.length ? 'Review the Case Files' : 'Continue: Case File ' + pad(next.n);
    boardNote.textContent = closed === archive.length
      ? 'All eight case files are closed. The Class Trial is ready.'
      : closed + ' of ' + archive.length + ' case files closed \u00b7 ' + opened + ' in progress \u00b7 ' + (archive.length - closed - opened) + ' unopened.';
    readiness.textContent = 'Case files closed: ' + closed + ' / ' + archive.length;
    applyFilter();
  }

  document.querySelectorAll('.route').forEach(sfx);
  return { refresh };
})();

/* =====================================================================
   ROSTER SUMMARY AND CHARACTER PROFILE NAVIGATION
   ===================================================================== */
(() => {
  const { make, pad, sfx } = ui;
  const cards = Array.from(document.querySelectorAll('#page-members .member-card'));
  const rosterLine = document.getElementById('rosterLine');
  const legend = document.getElementById('rosterLegend');

  const roles = new Map();
  cards.forEach((card) => {
    const role = card.querySelector('.card-body p').textContent.trim();
    roles.set(role, (roles.get(role) || 0) + 1);
  });
  rosterLine.innerHTML = '<b>' + cards.length + '</b> character dossiers on file';
  roles.forEach((count, role) => {
    const tag = make('span', 'legend-tag role-' + role.toLowerCase().replace(/[^a-z]+/g, '-'));
    tag.append(make('i'), make('span', null, role), make('b', null, String(count)));
    legend.append(tag);
  });

  const members = cards.map((card, i) => ({
    n: i + 1,
    key: card.getAttribute('href').replace('#/', ''),
    href: card.getAttribute('href'),
    name: card.querySelector('h3').textContent.trim(),
    image: card.querySelector('.card-img').style.backgroundImage
  }));

  members.forEach((member) => {
    const page = document.getElementById('page-' + member.key);
    if (!page) return;
    const stage = page.querySelector('.mp-stage');
    const dossier = page.querySelector('.mp-dossier');
    const desc = page.querySelector('.mp-desc');
    const column = make('div', 'mp-column');
    dossier.before(column);
    column.append(dossier, desc);

    /* Step between dossiers without going back to the roster */
    const prev = members[(member.n - 2 + members.length) % members.length];
    const next = members[member.n % members.length];
    page.querySelectorAll('.mp-top, .mp-bottom').forEach((bar) => {
      const step = make('div', 'mp-step');
      const back = make('a', 'step-btn', '\u2039');
      back.href = prev.href;
      back.title = prev.name;
      back.setAttribute('aria-label', 'Previous dossier: ' + prev.name);
      const fwd = make('a', 'step-btn', '\u203A');
      fwd.href = next.href;
      fwd.title = next.name;
      fwd.setAttribute('aria-label', 'Next dossier: ' + next.name);
      step.append(back, make('span', 'step-count', pad(member.n) + ' / ' + pad(members.length)), fwd);
      sfx(back); sfx(fwd);
      bar.insertBefore(step, bar.children[1] || null);
    });

    const rail = make('div', 'mp-rail');
    rail.setAttribute('role', 'navigation');
    rail.setAttribute('aria-label', 'Other dossiers');
    const list = make('div', 'mp-rail-list');
    members.forEach((other) => {
      const link = make('a', 'rail-link' + (other.key === member.key ? ' is-current' : ''));
      link.href = other.href;
      link.title = other.name;
      const thumb = make('i');
      thumb.style.backgroundImage = other.image;
      link.append(thumb, make('span', null, 'File ' + pad(other.n)));
      sfx(link);
      list.append(link);
    });
    rail.append(make('p', 'mp-rail-label', 'Personnel Archive'), list);
    page.querySelector('.mp-bottom').before(rail);
  });
})();

/* =====================================================================
   TRIAL NAVIGATOR: mirrors the existing trial state, never changes it
   ===================================================================== */
(() => {
  const { make, sfx } = ui;
  const run = document.getElementById('trialRun');
  const map = document.getElementById('trialMap');
  const bar = document.getElementById('trialBar');
  const jump = document.getElementById('trialJump');
  const auto = document.getElementById('trialAuto');
  const questions = Array.from(run.querySelectorAll('.q'));
  if (!questions.length) return;

  const dots = questions.map((q, i) => {
    const dot = make('button', 'map-dot', String(i + 1));
    dot.type = 'button';
    dot.title = 'Question ' + (i + 1);
    dot.setAttribute('aria-label', 'Go to question ' + (i + 1));
    dot.addEventListener('click', () => goTo(q));
    sfx(dot);
    map.append(dot);
    return dot;
  });

  function goTo(q) {
    window.scrollTo({ top: q.getBoundingClientRect().top + window.scrollY - ui.headerH() - 140, behavior: 'smooth' });
  }
  const firstUnanswered = () => questions.find((q) => !q.classList.contains('locked'));

  function sync() {
    const answered = questions.filter((q) => q.classList.contains('locked')).length;
    bar.style.width = (answered / questions.length * 100) + '%';
    dots.forEach((dot, i) => dot.classList.toggle('is-answered', questions[i].classList.contains('locked')));
    jump.disabled = answered === questions.length;
    if (run.hidden) {
      questions.forEach((q) => { if (q.classList.contains('is-current')) q.classList.remove('is-current'); });
      dots.forEach((d) => { if (d.classList.contains('is-current')) d.classList.remove('is-current'); });
    }
  }

  /* The trial code owns the score. This only watches the classes it writes. */
  const watcher = new MutationObserver(sync);
  questions.forEach((q) => watcher.observe(q, { attributes: true, attributeFilter: ['class'] }));
  watcher.observe(run, { attributes: true, attributeFilter: ['hidden'] });

  jump.addEventListener('click', () => { const q = firstUnanswered(); if (q) goTo(q); });
  sfx(jump);

  /* Registered after the trial's own click handler, so the answer is already locked in. */
  run.addEventListener('click', (e) => {
    if (!e.target.closest('.opt') || !auto.checked) return;
    window.setTimeout(() => { const q = firstUnanswered(); if (q) goTo(q); }, 620);
  });

  let queued = false;
  const markCurrent = () => {
    if (run.hidden || !document.getElementById('page-trial').classList.contains('active')) return;
    const line = ui.headerH() + run.querySelector('.trial-hud').offsetHeight + 40;
    let index = 0;
    questions.forEach((q, i) => { if (q.getBoundingClientRect().top <= line) index = i; });
    questions.forEach((q, i) => q.classList.toggle('is-current', i === index));
    dots.forEach((d, i) => d.classList.toggle('is-current', i === index));
  };
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { markCurrent(); queued = false; });
  }, { passive: true });

  sync();
})();

/* ---------- Keep every view in step with the log and the current route ---------- */
(() => {
  const refreshAll = () => { archiveViews.refresh(); lessonViews.refresh(); };
  document.addEventListener('caselog', refreshAll);

  const onRoute = () => {
    const active = document.querySelector('.page.active');
    if (active && active.dataset.page.startsWith('lesson-') && caseLog.state(active.dataset.page) === 'new') {
      caseLog.set(active.dataset.page, 'open');
    }
    refreshAll();
    lessonViews.track();
  };
  window.addEventListener('hashchange', onRoute);
  onRoute();
})();
