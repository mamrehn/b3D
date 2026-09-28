// ============================================================
// NetzWerk-Lab – Steuerung (Levelwechsel, Timer, Fortschritt)
// ============================================================

import { Engine } from './engine.js';
import { LEVELS, HELP, starsFor } from './data.js';
import * as UI from './ui.js';
import { icon } from './icons.js';
import { Level1 } from './levels/level1.js';
import { Level2 } from './levels/level2.js';
import { Level3 } from './levels/level3.js';
import { Level4 } from './levels/level4.js';

const { $ } = UI;
const LEVEL_CLASSES = { 1: Level1, 2: Level2, 3: Level3, 4: Level4 };
const STORAGE_KEY = 'netzwerk-lab/progress/v1';
const isTouch = window.matchMedia('(pointer: coarse)').matches;

const app = {
    engine: null,
    level: null,
    token: null,
    levelId: 1,
    phase: 'menu',          // menu | briefing | playing | result
    menuOpen: true,
    timer: { start: 0, running: false, acc: 0 },
    helpRevealed: new Set(),
    progress: loadProgress(),
    lastSecond: -1
};

function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(app.progress)); } catch { /* privater Modus */ }
}

// ------------------------------------------------------------
// Timer
// ------------------------------------------------------------

function elapsed() {
    const t = app.timer;
    return t.acc + (t.running ? (performance.now() - t.start) / 1000 : 0);
}
function startTimer() { app.timer = { start: performance.now(), running: true, acc: 0 }; app.lastSecond = -1; }
function pauseTimer() {
    if (!app.timer.running) return;
    app.timer.acc = elapsed();
    app.timer.running = false;
}
function resumeTimer() {
    if (app.timer.running) return;
    app.timer.start = performance.now();
    app.timer.running = true;
}

function updateTimerDisplay() {
    const lv = LEVELS[app.levelId - 1];
    const e = elapsed();
    if (lv.timeLimit) {
        const rest = Math.max(0, lv.timeLimit - e);
        UI.setTimer(UI.formatTime(Math.ceil(rest)), rest <= 30 && app.phase === 'playing' ? 'critical' : 'countdown');
    } else {
        UI.setTimer(UI.formatTime(e));
    }
    const sec = Math.floor(e);
    if (app.phase === 'playing' && sec !== app.lastSecond) {
        app.lastSecond = sec;
        app.level?.onTick?.(e);
    }
}

// ------------------------------------------------------------
// Kontext für die Level
// ------------------------------------------------------------

// Jedes Level bekommt einen eigenen Kontext. Nach einem Levelwechsel werden
// verspätete Aufrufe (z. B. aus laufenden Animationen) ignoriert.
function makeContext() {
    const token = {};
    const live = () => app.token === token;
    return {
        token,
        get engine() { return app.engine; },
        isTouch,
        toast: (...a) => { if (live()) UI.toast(...a); },
        refresh: () => { if (live()) refresh(); },
        finish: (r) => { if (live()) finish(r); },
        elapsed,
        stopTimer: () => { if (live()) pauseTimer(); },
        helpPenalty: () => HELP[app.levelId].penalty * app.helpRevealed.size,
        helpCount: () => app.helpRevealed.size,
        tap: (lower = false) => (isTouch ? (lower ? 'tippe auf' : 'Tippe auf') : (lower ? 'klicke auf' : 'Klicke auf')),
        get playing() { return live() && app.phase === 'playing'; },
        get alive() { return live(); },
        progress: () => app.progress
    };
}

// ------------------------------------------------------------
// Levelwechsel
// ------------------------------------------------------------

function loadLevel(id, { briefing = true } = {}) {
    if (app.level?.dispose) app.level.dispose();
    UI.hideModal('#result');
    UI.hideModal('#help');
    UI.hideModal('#briefing');
    UI.clearToasts();
    $('#terminal').hidden = true;
    app.engine.clearWorld();

    app.levelId = id;
    app.helpRevealed = new Set();
    app.phase = 'briefing';
    app.timer = { start: 0, running: false, acc: 0 };

    const lv = LEVELS[id - 1];
    const ctx = makeContext();
    app.token = ctx.token;
    const level = app.level = new LEVEL_CLASSES[id](ctx, lv);
    level.build();
    app.engine.onPick = (obj, hit) => { if (app.phase === 'playing') level.onPick(obj, hit); };
    app.engine.interactive = false;

    UI.renderPanelHead(lv);
    UI.renderKnowledge(lv);
    UI.renderStepper(id, app.progress, selectLevel);
    refresh();
    updateTimerDisplay();
    if (briefing) UI.renderBriefing(lv, isTouch, { onStart: startLevel, onMenu: openMenu });
}

function startLevel() {
    UI.hideModal('#briefing');
    app.phase = 'playing';
    startTimer();
    app.engine.interactive = true;
    app.level.start();
    refresh();
    showNavHint();
}

function selectLevel(id) {
    if (!app.menuOpen && app.phase === 'playing' && id !== app.levelId &&
        !confirm(`Zu Station ${id} wechseln? Der Fortschritt dieser Station geht verloren.`)) return;
    closeMenu(false);
    loadLevel(id);
}

function refresh() {
    const level = app.level;
    if (!level) return;
    UI.renderMission(level.steps());
    UI.setObjective(app.phase === 'playing' ? level.objective() : null);
    level.renderControls($('#controls-card'));
    UI.setActions(level.actions());
    app.engine.setHints(app.phase === 'playing' ? level.hints() : []);
}

function finish(result) {
    pauseTimer();
    app.phase = 'result';
    app.engine.interactive = false;
    app.engine.setHints([]);
    UI.setObjective(null);
    const lv = LEVELS[app.levelId - 1];
    const stars = starsFor(result.score, result.success);
    if (result.success) {
        const prev = app.progress[lv.id];
        const time = Math.round(result.time ?? elapsed());
        if (!prev || result.score > prev.score || (result.score === prev.score && time < prev.time)) {
            app.progress[lv.id] = { score: result.score, stars, time };
            saveProgress();
        }
        UI.renderStepper(lv.id, app.progress, selectLevel);
        UI.confetti();
    }
    UI.renderResult(lv, result, stars, handleResultAction);
}

function handleResultAction(a) {
    switch (a.action) {
        case 'next':
            if (app.levelId < 4) loadLevel(app.levelId + 1);
            else openMenu();
            break;
        case 'retry':
            loadLevel(app.levelId);
            break;
        case 'continue':
            UI.hideModal('#result');
            app.phase = 'playing';
            app.engine.interactive = true;
            resumeTimer();
            if (a.onContinue) a.onContinue();
            refresh();
            break;
        case 'menu':
        default:
            openMenu();
    }
}

// ------------------------------------------------------------
// Übersicht (Menü)
// ------------------------------------------------------------

function openMenu() {
    UI.hideModal('#help');
    UI.hideModal('#result');
    UI.hideModal('#briefing');
    if (app.phase === 'playing') pauseTimer();
    app.engine.interactive = false;
    app.menuOpen = true;
    UI.renderMenu(app.progress, selectLevel, () => {
        if (!confirm('Gesamten Fortschritt (Punkte & Sterne) wirklich löschen?')) return;
        app.progress = {};
        saveProgress();
        UI.renderMenu(app.progress, selectLevel, () => {});
        UI.renderStepper(app.levelId, app.progress, selectLevel);
    });
    const foot = $('#menu-foot');
    if (app.phase === 'playing' || app.phase === 'briefing') {
        foot.insertAdjacentHTML('afterbegin', `<button class="btn btn-ghost" type="button" id="menu-resume">${icon('play')} Zurück zu Station ${app.levelId}</button>`);
        $('#menu-resume').addEventListener('click', () => closeMenu(true));
    }
    UI.showMenu(true);
}

function closeMenu(resume) {
    UI.showMenu(false);
    app.menuOpen = false;
    if (!resume) return;
    if (app.phase === 'playing') {
        resumeTimer();
        app.engine.interactive = true;
    } else if (app.phase === 'briefing') {
        UI.renderBriefing(LEVELS[app.levelId - 1], isTouch, { onStart: startLevel, onMenu: openMenu });
    }
}

// ------------------------------------------------------------
// Hilfe
// ------------------------------------------------------------

function openHelp() {
    if (app.menuOpen) return;
    const render = () => UI.renderHelp(app.levelId, app.helpRevealed, (tier) => {
        app.helpRevealed.add(tier);
        render();
        refresh();
    });
    render();
    $('#help').hidden = false;
}

// ------------------------------------------------------------
// Navigationshinweis
// ------------------------------------------------------------

let navHintTimer = null;
function showNavHint() {
    const el = $('#nav-hint');
    el.innerHTML = isTouch
        ? `<span>${icon('touch')}<b>1 Finger</b> drehen</span><span><b>2 Finger</b> zoomen &amp; verschieben</span><span><b>Tippen</b> auswählen</span>`
        : `<span>${icon('mouse')}<b>Linke Taste</b> drehen</span><span><b>Mausrad</b> zoomen</span><span><b>Rechte Taste</b> verschieben</span>`;
    el.classList.remove('faded');
    clearTimeout(navHintTimer);
    navHintTimer = setTimeout(() => el.classList.add('faded'), 14000);
}

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

function bindUi() {
    UI.initTopbarIcons();
    $('#brand-btn').addEventListener('click', openMenu);
    $('#menu-btn').addEventListener('click', openMenu);
    $('#help-btn').addEventListener('click', openHelp);
    $('#help-close').addEventListener('click', () => UI.hideModal('#help'));
    $('#restart-btn').addEventListener('click', () => {
        if (app.phase === 'playing' && !confirm('Station wirklich neu starten? Der aktuelle Fortschritt geht verloren.')) return;
        closeMenu(false);
        loadLevel(app.levelId);
    });
    $('#view-reset').addEventListener('click', () => app.engine.goHome(0.9));
    $('#undo-btn').addEventListener('click', () => { if (app.phase === 'playing') app.level.onUndo?.(); });
    $('#check-btn').addEventListener('click', () => { if (app.phase === 'playing') app.level.onCheck?.(); });

    $('#help').addEventListener('click', e => { if (e.target.id === 'help') UI.hideModal('#help'); });

    document.addEventListener('keydown', e => {
        const typing = e.target.matches('input, textarea');
        if (e.key === 'Escape') {
            if (!$('#help').hidden) { UI.hideModal('#help'); return; }
            if (app.level?.onEscape?.()) return;
            if (app.menuOpen && (app.phase === 'playing' || app.phase === 'briefing')) closeMenu(true);
            return;
        }
        if (typing) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            if (app.phase === 'playing' && !$('#undo-btn').disabled) { e.preventDefault(); app.level.onUndo?.(); }
            return;
        }
        if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey && app.phase !== 'menu') openHelp();
    });

    ['pointerdown', 'wheel'].forEach(ev => $('#scene').addEventListener(ev, () => {
        clearTimeout(navHintTimer);
        navHintTimer = setTimeout(() => $('#nav-hint').classList.add('faded'), 4000);
    }, { passive: true }));

    setInterval(updateTimerDisplay, 250);
}

async function init() {
    bindUi();
    try {
        await Promise.race([
            document.fonts ? document.fonts.load('650 16px "Inter Variable"') : Promise.resolve(),
            new Promise(r => setTimeout(r, 1500))
        ]);
    } catch { /* Fallback-Schrift */ }

    try {
        app.engine = new Engine({ canvas: $('#scene'), container: $('#viewport'), tooltip: $('#tooltip') });
    } catch (err) {
        console.error(err);
        $('#loading').innerHTML = `<p style="max-width:420px;text-align:center">${icon('warn')}<br>WebGL konnte nicht gestartet werden. Bitte aktiviere die Hardwarebeschleunigung im Browser oder nutze einen aktuellen Browser (Chrome, Edge, Firefox, Safari).</p>`;
        return;
    }

    // Station 1 als lebendiger Hintergrund der Übersicht
    loadLevel(1, { briefing: false });
    app.phase = 'menu';
    openMenu();
    requestAnimationFrame(() => $('#loading').classList.add('done'));

    // Für Tests & Lehrkräfte (Konsole)
    window.__lab = { app, loadLevel, startLevel, openMenu, closeMenu };
}

init();
