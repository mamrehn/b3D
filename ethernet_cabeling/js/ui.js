// ============================================================
// DOM-Oberfläche: Kopfzeile, Seitenleiste, Dialoge, Toasts
// ============================================================

import { icon } from './icons.js';
import { LEVELS, HELP } from './data.js';

export const $ = (sel) => document.querySelector(sel);

export function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function starsHtml(n, cls = 'stars') {
    return `<span class="${cls}">${[1, 2, 3].map(i => `<span class="${i <= n ? 'on' : ''}">${icon('star')}</span>`).join('')}</span>`;
}

export function fillTemplate(text, isTouch) {
    return text
        .replaceAll('{tap}', isTouch ? 'Tippe auf' : 'Klicke auf')
        .replaceAll('{tapLower}', isTouch ? 'tippe auf' : 'klicke auf');
}

// ------------------------------------------------------------
// Toasts
// ------------------------------------------------------------

const TOAST_ICON = { success: 'success', warn: 'warn', error: 'error', info: 'info' };

export function toast(message, type = 'info', ms = 3200) {
    const host = $('#toasts');
    // gleiche Meldung nicht stapeln
    for (const el of host.children) if (el.dataset.msg === message) el.remove();
    while (host.children.length >= 3) host.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.dataset.msg = message;
    el.innerHTML = `${icon(TOAST_ICON[type] || 'info')}<div>${message}</div>`;
    host.appendChild(el);
    setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 260);
    }, ms);
}

export function clearToasts() { $('#toasts').innerHTML = ''; }

export function confetti() {
    const host = document.createElement('div');
    host.className = 'confetti';
    const colors = ['#4f8cff', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#ee7a16', '#a78bfa'];
    for (let i = 0; i < 90; i++) {
        const p = document.createElement('i');
        p.style.left = `${Math.random() * 100}%`;
        p.style.background = colors[i % colors.length];
        p.style.animationDuration = `${1.8 + Math.random() * 1.8}s`;
        p.style.animationDelay = `${Math.random() * 0.5}s`;
        p.style.transform = `rotate(${Math.random() * 360}deg)`;
        host.appendChild(p);
    }
    document.body.appendChild(host);
    setTimeout(() => host.remove(), 4200);
}

// ------------------------------------------------------------
// Kopfzeile
// ------------------------------------------------------------

export function renderStepper(currentId, progress, onSelect) {
    const nav = $('#stepper');
    nav.innerHTML = LEVELS.map((lv, i) => {
        const done = !!progress[lv.id];
        const cls = ['step', done ? 'done' : '', lv.id === currentId ? 'active' : ''].join(' ');
        const line = i < LEVELS.length - 1 ? `<span class="step-line ${done ? 'done' : ''}"></span>` : '';
        return `<button class="${cls}" type="button" data-level="${lv.id}" title="Station ${lv.id}: ${lv.title}">
                    <span class="step-num">${done && lv.id !== currentId ? icon('check') : lv.id}</span>
                    <span class="step-text">${lv.title}</span>
                </button>${line}`;
    }).join('');
    nav.querySelectorAll('.step').forEach(btn => btn.addEventListener('click', () => onSelect(+btn.dataset.level)));
}

export function initTopbarIcons() {
    $('#timer .timer-icon').outerHTML = icon('clock');
    $('#help-btn').insertAdjacentHTML('afterbegin', icon('help'));
    $('#restart-btn').insertAdjacentHTML('afterbegin', icon('restart'));
    $('#menu-btn').insertAdjacentHTML('afterbegin', icon('grid'));
    $('#view-reset').insertAdjacentHTML('afterbegin', icon('focus'));
    $('#help-close').insertAdjacentHTML('afterbegin', icon('close'));
}

export function setTimer(text, mode = '') {
    $('#timer-value').textContent = text;
    const t = $('#timer');
    t.classList.toggle('countdown', mode === 'countdown' || mode === 'critical');
    t.classList.toggle('critical', mode === 'critical');
}

// ------------------------------------------------------------
// Stationsübersicht
// ------------------------------------------------------------

export function renderMenu(progress, onSelect, onReset) {
    $('#journey').innerHTML = LEVELS.map(lv => {
        const p = progress[lv.id];
        return `<button class="station ${p ? 'done' : ''}" type="button" data-level="${lv.id}">
            <div class="station-top">
                <span class="station-icon">${icon(lv.icon)}</span>
                <span class="station-no">Station ${lv.id}</span>
            </div>
            <h3>${lv.title}</h3>
            <p class="desc">${lv.subtitle}</p>
            <span class="place">${icon('target')}${lv.place}</span>
            <ul>${lv.goals.map(g => `<li>${g}</li>`).join('')}</ul>
            <div class="station-foot">
                <span>${starsHtml(p ? p.stars : 0)}<br><span class="best">${p ? `Bestwert ${p.score} P · ${formatTime(p.time)}` : 'Noch nicht gespielt'}</span></span>
                <span class="go">${p ? 'Wiederholen' : 'Starten'} ${icon('arrowRight')}</span>
            </div>
        </button>`;
    }).join('');
    $('#journey').querySelectorAll('.station').forEach(b => b.addEventListener('click', () => onSelect(+b.dataset.level)));

    const done = LEVELS.filter(l => progress[l.id]).length;
    const total = LEVELS.reduce((s, l) => s + (progress[l.id]?.score || 0), 0);
    $('#menu-foot').innerHTML = `
        <span>${icon('trophy')} ${done}/4 Stationen abgeschlossen · ${total} Punkte gesamt</span>
        <span>Alle Stationen sind frei wählbar – empfohlen ist die Reihenfolge 1 → 4.</span>
        ${done ? '<button class="link-btn" type="button" id="reset-progress">Fortschritt zurücksetzen</button>' : ''}`;
    const rp = $('#reset-progress');
    if (rp) rp.addEventListener('click', onReset);
}

export function showMenu(show) { $('#menu').hidden = !show; }

// ------------------------------------------------------------
// Seitenleiste
// ------------------------------------------------------------

export function renderPanelHead(lv) {
    $('#panel-head').innerHTML = `
        <span class="station-badge">${icon(lv.icon)}</span>
        <div>
            <p class="eyebrow">Station ${lv.id} von 4</p>
            <h2>${lv.title}</h2>
            <p>${lv.place}</p>
        </div>`;
}

export function renderMission(steps) {
    const activeIdx = steps.findIndex(s => !s.done);
    const doneCount = steps.filter(s => s.done).length;
    $('#mission-card').innerHTML = `
        <h3 class="card-title">Auftrag <span class="count">${doneCount}/${steps.length}</span></h3>
        <ol class="mission-list">
            ${steps.map((s, i) => {
                const state = s.done ? 'done' : i === activeIdx ? 'active' : '';
                return `<li class="mission-item ${state}">
                    <span class="mi-dot">${s.done ? icon('check') : i + 1}</span>
                    <span>${s.text}${s.meta ? `<span class="mi-meta">${s.meta}</span>` : ''}</span>
                </li>`;
            }).join('')}
        </ol>`;
}

export function renderKnowledge(lv) {
    const el = $('#knowledge-card');
    el.open = false;
    el.innerHTML = `
        <summary>${icon('bulb')} Gut zu wissen ${icon('chevronDown', 'chev')}</summary>
        <dl class="knowledge-list">
            ${lv.knowledge.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}
        </dl>`;
}

export function setObjective(text) {
    const el = $('#objective');
    if (!text) { el.hidden = true; el.dataset.text = ''; return; }
    if (el.dataset.text === text && !el.hidden) return;
    el.dataset.text = text;
    el.hidden = false;
    el.innerHTML = `<span class="objective-icon">${icon('target')}</span>
        <div><div class="objective-label">Nächster Schritt</div><div class="objective-text">${text}</div></div>`;
    // Animation neu starten
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
}

export function setActions(actions) {
    const undo = $('#undo-btn');
    const check = $('#check-btn');
    const bar = undo.parentElement;
    if (actions.undo) {
        undo.hidden = false;
        undo.innerHTML = `${icon('undo')}<span>${actions.undo.label}</span>`;
        undo.disabled = !actions.undo.enabled;
    } else {
        undo.hidden = true;
    }
    if (actions.check) {
        check.hidden = false;
        check.innerHTML = `${icon(actions.check.icon || 'check')}<span>${actions.check.label}</span>`;
        check.disabled = !actions.check.enabled;
        check.classList.toggle('pulse', !!actions.check.pulse && actions.check.enabled);
    } else {
        check.hidden = true;
    }
    bar.classList.toggle('single', !actions.undo || !actions.check);
    bar.hidden = !actions.undo && !actions.check;
}

// ------------------------------------------------------------
// Briefing
// ------------------------------------------------------------

export function renderBriefing(lv, isTouch, { onStart, onMenu }) {
    const tap = s => fillTemplate(s, isTouch);
    $('#briefing-body').innerHTML = `
        <div class="brief-head">
            <span class="station-icon">${icon(lv.icon)}</span>
            <div>
                <p class="eyebrow">Station ${lv.id} von 4 · ${lv.place}</p>
                <h2 id="briefing-title">${lv.title}</h2>
            </div>
        </div>
        <p class="brief-story">${lv.story}</p>
        <div class="brief-grid">
            <div class="brief-box">
                <h3>${icon('target')} Lernziele</h3>
                <ul class="goal-list">${lv.goals.map(g => `<li>${icon('check')}<span>${g}</span></li>`).join('')}</ul>
            </div>
            <div class="brief-box">
                <h3>${icon(isTouch ? 'touch' : 'mouse')} So geht's</h3>
                <ol>${lv.howto.map(h => `<li>${tap(h)}</li>`).join('')}</ol>
            </div>
        </div>
        <div class="tip">${icon('bulb')}<div>${tap(lv.tip)}</div></div>
        <div class="brief-actions">
            <button class="btn btn-ghost" type="button" id="brief-menu">${icon('grid')} Übersicht</button>
            <button class="btn btn-primary btn-lg" type="button" id="brief-start">${icon('play')} Los geht's</button>
        </div>`;
    $('#brief-start').addEventListener('click', onStart);
    $('#brief-menu').addEventListener('click', onMenu);
    $('#briefing').hidden = false;
    $('#briefing .dialog').scrollTop = 0;
    setTimeout(() => $('#brief-start')?.focus({ preventScroll: true }), 50);
}

// ------------------------------------------------------------
// Hilfe
// ------------------------------------------------------------

export function renderHelp(levelId, revealed, onReveal) {
    const help = HELP[levelId];
    const lv = LEVELS.find(l => l.id === levelId);
    $('#help-title').innerHTML = `${icon('bulb')} Hilfe · ${lv.title}`;
    const intro = help.penalty
        ? `Die Hilfen sind gestuft. Jede aufgedeckte Stufe kostet <strong>${help.penalty} Punkte</strong> – versuche es erst selbst!`
        : 'Die Hilfen dieser Station sind kostenlos.';
    const nextIdx = help.tiers.findIndex((_, i) => !revealed.has(i));
    $('#help-body').innerHTML = `
        <p class="help-intro">${intro}</p>
        <div class="help-tiers">
            ${help.tiers.map(([title, html], i) => {
                const open = revealed.has(i);
                const canOpen = i === nextIdx;
                return `<div class="help-tier ${open ? 'revealed' : ''}">
                    <div class="help-tier-head">
                        <h3>${title}</h3>
                        ${open ? `<span class="cost" style="color:var(--success)">${icon('check')}</span>`
                               : `${help.penalty ? `<span class="cost">−${help.penalty} P</span>` : ''}
                                  <button class="btn ${canOpen ? 'btn-ghost' : 'btn-ghost'}" type="button" data-tier="${i}" ${canOpen ? '' : 'disabled'}>${canOpen ? 'Aufdecken' : icon('lock')}</button>`}
                    </div>
                    ${open ? `<div class="help-tier-body">${html}</div>` : ''}
                </div>`;
            }).join('')}
        </div>`;
    $('#help-body').querySelectorAll('[data-tier]').forEach(b => b.addEventListener('click', () => onReveal(+b.dataset.tier)));
}

// ------------------------------------------------------------
// Ergebnis
// ------------------------------------------------------------

export function renderResult(lv, r, stars, onAction) {
    const badge = r.success ? icon('trophy') : icon('warn');
    const sections = (r.sections || []).map(s => `
        <section class="result-section ${s.cls || ''}">
            <h3>${icon(s.icon || 'info')} ${s.title}</h3>
            ${s.html}
        </section>`).join('');
    const breakdown = r.breakdown && r.breakdown.length ? `
        <section class="result-section">
            <h3>${icon('target')} Punkte</h3>
            <div class="breakdown">
                ${r.breakdown.map(b => `<div class="${b.kind || ''}"><span>${b.label}</span><b>${b.value}</b></div>`).join('')}
            </div>
        </section>` : '';
    const knowledge = r.success ? `
        <section class="result-section">
            <h3>${icon('bulb')} Merke</h3>
            <ul>${lv.knowledge.slice(0, 3).map(([t, d]) => `<li><strong>${t}:</strong> ${d}</li>`).join('')}</ul>
        </section>` : '';
    const buttons = (r.actions || []).map((a, i) => `
        <button class="btn ${a.primary ? 'btn-primary btn-lg' : 'btn-ghost btn-lg'}" type="button" data-action="${i}">
            ${a.icon ? icon(a.icon) : ''}${a.label}
        </button>`).join('');

    $('#result-body').innerHTML = `
        <div class="result-hero">
            <span class="result-badge ${r.success ? '' : 'fail'}">${badge}</span>
            <h2 id="result-title">${r.title}</h2>
            ${r.subtitle ? `<p>${r.subtitle}</p>` : ''}
            ${r.success ? starsHtml(stars, 'result-stars') : ''}
        </div>
        ${r.stats ? `<div class="stat-grid">${r.stats.map(s => `<div class="stat"><b>${s.value}</b><span>${s.label}</span></div>`).join('')}</div>` : ''}
        ${sections}
        ${breakdown}
        ${knowledge}
        <div class="result-actions">${buttons}</div>`;
    $('#result-body').querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => onAction(r.actions[+b.dataset.action])));
    $('#result').hidden = false;
    const primary = $('#result-body .btn-primary');
    $('#result .dialog').scrollTop = 0;
    setTimeout(() => primary?.focus({ preventScroll: true }), 60);
}

export function hideModal(id) { $(id).hidden = true; }
