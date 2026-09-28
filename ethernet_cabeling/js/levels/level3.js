// ============================================================
// Station 3: Patchpanel → Switches patchen (Technikraum, Meter)
// ============================================================

import * as THREE from 'three';
import { BaseLevel, fmtPts } from './base.js';
import { V, at, box, rbox, cyl, buildRoom, cableMesh, setTubeProgress, ceilingLight, texRepeat } from '../models.js';
import { std, raisedFloorTexture, perforatedAlpha, jacketMaterial } from '../materials.js';
import { makeLabel } from '../labels.js';
import { Ease } from '../engine.js';
import { icon } from '../icons.js';
import { formatTime } from '../ui.js';
import {
    uCenter, PP_U, M1_U, M2_U, SW_COLOR, SW_NAME, portX, instancedBoxes,
    buildFullRack, makePatch, updateSwitchLeds
} from '../rack.js';

const LIMIT = 180;
const ORANGE_ACCENT = '#ee7a16';

export class Level3 extends BaseLevel {
    build() {
        const e = this.engine;
        this.connections = [];          // { pp, sw, swPort, meshes:[], plugs:[] }
        this.selected = null;           // { type:'pp'|'sw', n, sw }
        this.mistakes = 0;
        this.done = false;
        this.ledState = { 1: new Array(24).fill(0), 2: new Array(24).fill(0) };

        this.lights({
            hemi: 0.75, env: 0.65, sky: '#e8f0ff', ground: '#3b4250',
            sun: { position: [0.9, 2.9, 2.4], target: [0, 1.3, 0], intensity: 2.5, size: 1.3, color: '#f4f8ff' }
        });
        this.buildRoom();
        this.rack = new THREE.Group();
        this.add(this.rack);
        const r = buildFullRack(this.rack);
        this.sw = r.sw;
        this.serverLeds = r.serverLeds;
        this.ppPorts = r.pp.ports;
        this.swPorts = { 1: r.sw[1].ports, 2: r.sw[2].ports };
        Object.entries(this.ppPorts).forEach(([n, port]) => this.engine.addPickable(port, { tooltip: () => this.ppTooltip(+n) }));
        for (const sw of [1, 2]) {
            Object.entries(this.swPorts[sw]).forEach(([n, port]) => this.engine.addPickable(port, { tooltip: () => this.swTooltip(sw, +n) }));
        }
        this.buildNeighbours();
        this.buildInstallationCables();

        // Beschriftungen auf der Blindplatte bzw. den Rangierpanels über dem jeweiligen Gerät
        const tag = (text, sub, accent, u) => this.add(at(makeLabel(text, { height: 0.022, sub, accent, anchor: 'left', depthTest: false }), -0.236, uCenter(u), 0.012));
        tag('Patchpanel ▾', 'passiv · Ports 1–24', ORANGE_ACCENT, 34);
        tag(`${SW_NAME[1]} ▾`, 'aktiv · für PP 1–12', SW_COLOR[1], M1_U);
        tag(`${SW_NAME[2]} ▾`, 'aktiv · für PP 13–24', SW_COLOR[2], M2_U);

        e.onFrame((dt, t) => this.animateLeds(t));
        e.configureControls({ minDistance: 0.18, maxDistance: 4, maxPolarAngle: 1.62, minAzimuthAngle: -1.25, maxAzimuthAngle: 1.25 });
        const home = { position: V(0.0, 1.49, 0.6), target: V(0, 1.448, 0) };
        e.setHome(home);
        e.setView(home);
        e.optimizeShadows(0.012);
    }

    // ------------------------------------------------------------
    // Raum
    // ------------------------------------------------------------

    buildRoom() {
        const room = buildRoom({ width: 4.4, depth: 4.2, height: 3.0, floorMap: raisedFloorTexture(), floorRepeat: [4.4 / 1.2, 4.2 / 1.2], floorRough: 0.42, wallColor: '#dde2e8' });
        room.position.z = -1.25;
        this.add(room);
        for (const [x, z] of [[0, 0.6], [0, 2.0], [-1.5, 0.6], [1.5, 0.6]]) this.add(at(ceilingLight(0.6, 1.2), x, 2.99, z));

        // Kabelrinne (Gitterrinne) unter der Decke
        const tray = new THREE.Group();
        const mesh = std('#b8bec7', 0.35, 1, { alphaMap: texRepeat(perforatedAlpha(), 40, 3), alphaTest: 0.5, side: THREE.DoubleSide });
        at(box(4.4, 0.004, 0.3, mesh), 0, 0, 0, tray);
        at(box(4.4, 0.06, 0.004, mesh), 0, 0.03, 0.15, tray);
        at(box(4.4, 0.06, 0.004, mesh), 0, 0.03, -0.15, tray);
        for (const x of [-1.6, -0.6, 0.6, 1.6]) at(box(0.012, 0.6, 0.012, std('#8f96a0', 0.4, 1)), x, 0.3, 0, tray);
        tray.position.set(0, 2.35, -0.55);
        this.add(tray);

        // Klimagerät, Feuerlöscher, Schild
        const ac = new THREE.Group();
        at(rbox(1.0, 0.3, 0.22, 0.03, std('#f3f4f6', 0.45)), 0, 0, 0, ac);
        for (let i = 0; i < 8; i++) at(box(0.86, 0.006, 0.02, std('#cfd4da', 0.5)), 0, -0.1 + i * 0.012, 0.11, ac);
        const acLed = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), new THREE.MeshBasicMaterial({ color: '#22c55e', toneMapped: false }));
        at(acLed, 0.42, 0.1, 0.111, ac);
        ac.position.set(-1.1, 2.55, -1.13);
        this.add(ac);
        const ext = new THREE.Group();
        at(cyl(0.075, 0.075, 0.5, std('#c81e1e', 0.35)), 0, 0.25, 0, ext);
        at(cyl(0.03, 0.04, 0.08, std('#222', 0.5)), 0, 0.54, 0, ext);
        ext.position.set(-1.95, 0.35, 0.4);
        this.add(ext);
        this.add(at(makeLabel('Technikraum · Etagenverteiler', { height: 0.09, accent: '#4f8cff' }), -1.0, 2.05, -1.2));
    }

    buildNeighbours() {
        const perf = std('#191b20', 0.5, 0.6, { alphaMap: texRepeat(perforatedAlpha(), 8, 20), alphaTest: 0.5 });
        for (const x of [-0.88, 0.88]) {
            const g = new THREE.Group();
            at(box(0.8, 2.05, 1.0, std('#1b1e24', 0.55, 0.6)), 0, 1.025, -0.52, g);
            at(box(0.76, 1.9, 0.006, perf), 0, 1.05, 0.0, g);
            const inner = at(box(0.7, 1.7, 0.01, std('#0b0c0f', 0.9)), 0, 1.05, -0.08, g);
            inner.castShadow = false;
            const pts = [];
            for (let i = 0; i < 70; i++) pts.push(V(-0.3 + (i % 10) * 0.06, 0.3 + Math.floor(i / 10) * 0.22, -0.07));
            const leds = instancedBoxes(0.006, 0.004, 0.002, new THREE.MeshBasicMaterial({ color: '#4ade80', toneMapped: false }), pts);
            g.add(leds);
            g.userData.leds = leds;
            g.position.x = x;
            this.add(g);
            (this.neighbours ||= []).push(g);
        }
    }

    buildInstallationCables() {
        const yellow = jacketMaterial('#e3c01e', 0.55);
        const orange = jacketMaterial('#ee7a16', 0.5);
        for (let n = 1; n <= 24; n++) {
            const row = (n - 1) % 4, col = Math.floor((n - 1) / 4);
            const zt = -0.62 + row * 0.03;
            const yt = 2.365 + col * 0.008;
            const xd = -0.1 + (n - 1) * 0.0087;
            const pts = [
                V(-2.2, yt, zt), V(-1.0, yt, zt), V(xd - 0.25, yt, zt), V(xd - 0.05, yt - 0.04, zt),
                V(xd, 2.2, zt + 0.02), V(xd, 2.02, -0.55), V(portX(n) * 0.8, 1.8, -0.35),
                V(portX(n), uCenter(PP_U) + 0.05, -0.2), V(portX(n), uCenter(PP_U), -0.09)
            ];
            this.add(cableMesh(pts, 0.0034, n === 1 ? orange : yellow, { radial: 6, maxSegments: 110 }));
        }
        this.add(at(makeLabel('24 Verlegekabel aus den Büros', { height: 0.05, sub: 'orange = dein Kabel (DD1-1)', accent: '#ee7a16' }), -0.95, 2.2, -0.35));
    }

    // ------------------------------------------------------------
    // LEDs
    // ------------------------------------------------------------

    animateLeds(t) {
        for (const sw of [1, 2]) updateSwitchLeds(this.sw[sw], this.ledState[sw], t);
        this.serverLeds.forEach((l, i) => { l.visible = Math.sin(t * (6 + i) + i) > -0.2; });
    }

    // ------------------------------------------------------------
    // Interaktion
    // ------------------------------------------------------------

    connectionOf(type, n, sw) {
        return this.connections.find(c => (type === 'pp' ? c.pp === n : c.sw === sw && c.swPort === n));
    }

    ppTooltip(n) {
        const target = n <= 12 ? 1 : 2;
        const c = this.connectionOf('pp', n);
        const origin = n === 1 ? '<span class="tt-sub" style="color:#fdba74">DD1-1 – dein Kabel aus Station 1 & 2</span>' : `<span class="tt-sub">Verlegekabel aus Büro ${target}</span>`;
        const state = c ? `<span class="tt-sub tt-ok">gepatcht → ${SW_NAME[c.sw]}, Port ${c.swPort}</span>` : '';
        return `<strong>Patchpanel · Port ${n}</strong>${origin}${state}`;
    }

    swTooltip(sw, n) {
        const c = this.connectionOf('sw', n, sw);
        return `<strong>${SW_NAME[sw]} · Port ${n}</strong>` + (c ? `<span class="tt-sub tt-ok">Link ● – verbunden mit PP-Port ${c.pp}</span>` : '<span class="tt-sub">frei · Link-LED aus</span>');
    }

    onPick(obj) {
        if (this.done) return;
        if (!obj) { this.clearSelection(); this.refresh(); return; }
        const d = obj.userData;
        if (d.kind !== 'pp' && d.kind !== 'sw') return;
        const conn = this.connectionOf(d.kind, d.n, d.sw);
        if (conn) {
            this.toast(d.kind === 'pp' ? `PP-Port ${d.n} ist bereits gepatcht.` : `${SW_NAME[d.sw]} Port ${d.n} ist bereits belegt.`, 'info', 2000);
            return;
        }
        const sel = this.selected;
        if (sel && sel.type === d.kind && sel.n === d.n && sel.sw === d.sw) {
            this.clearSelection();
            this.refresh();
            return;
        }
        if (sel && sel.type !== d.kind) {
            const pp = d.kind === 'pp' ? d.n : sel.n;
            const sw = d.kind === 'sw' ? d.sw : sel.sw;
            const swPort = d.kind === 'sw' ? d.n : sel.n;
            const target = pp <= 12 ? 1 : 2;
            if (sw !== target) {
                this.mistakes++;
                this.toast(`PP-Port ${pp} gehört zu <strong>Büro ${target}</strong> → ${SW_NAME[target]} (${target === 1 ? 'oben' : 'unten'}). −2 P`, 'warn', 3200);
                this.refresh();
                return;
            }
            this.clearSelection();
            this.connect(pp, sw, swPort, true);
            return;
        }
        this.clearSelection();
        this.selected = { type: d.kind, n: d.n, sw: d.sw };
        this.engine.setGlow(obj, '#4f8cff', 0.9);
        this.refresh();
    }

    clearSelection() {
        const s = this.selected;
        if (!s) return;
        const obj = s.type === 'pp' ? this.ppPorts[s.n] : this.swPorts[s.sw][s.n];
        this.engine.setGlow(obj, null);
        this.selected = null;
    }

    connect(pp, sw, swPort, animate) {
        const { cable, plugA, plugB } = makePatch(pp, sw, swPort);
        const out = V(0, 0, 1);
        this.rack.add(plugA, plugB, cable);
        const conn = { pp, sw, swPort, meshes: [cable, plugA, plugB] };
        this.connections.push(conn);
        if (animate) {
            // Stecker von vorne einschieben, Kabel wächst vom Patchpanel zum Switch
            const fa = plugA.position.clone(), fb = plugB.position.clone();
            const lift = out.clone().multiplyScalar(0.03);
            plugA.position.copy(fa).add(lift);
            plugB.position.copy(fb).add(lift);
            setTubeProgress(cable, 0);
            this.engine.tween({
                duration: 0.42, ease: Ease.outCubic,
                onUpdate: k => {
                    const ka = Math.min(1, k * 1.8);
                    const kb = THREE.MathUtils.clamp((k - 0.45) / 0.55, 0, 1);
                    plugA.position.copy(fa).addScaledVector(lift, 1 - ka);
                    plugB.position.copy(fb).addScaledVector(lift, 1 - kb);
                    setTubeProgress(cable, k);
                }
            });
            this.engine.later(() => { if (this.connections.includes(conn)) this.ledState[sw][swPort - 1] = 2; }, 700);
        } else {
            this.ledState[sw][swPort - 1] = 2;
        }
        const perSwitch = this.connections.filter(c => c.sw === sw).length;
        if (perSwitch === 12) this.toast(`${SW_NAME[sw]}: alle 12 Ports gepatcht – Link-LEDs leuchten.`, 'success', 2600);
        this.refresh();
        if (this.connections.length === 24) this.complete();
    }

    onUndo() {
        if (this.done) return;
        const c = this.connections.pop();
        if (!c) return;
        c.meshes.forEach(m => {
            m.removeFromParent();
            m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        });
        this.ledState[c.sw][c.swPort - 1] = 0;
        this.toast(`Patchkabel PP ${c.pp} ↔ ${SW_NAME[c.sw]} Port ${c.swPort} entfernt.`, 'info', 1800);
        this.refresh();
    }

    onTick(elapsed) {
        if (this.done) return;
        const rest = LIMIT - elapsed;
        if (rest <= 0) return this.timeUp();
        if (Math.ceil(rest) === 60) this.toast('Noch 1 Minute!', 'warn', 2000);
        if (Math.ceil(rest) === 30) this.toast('Noch 30 Sekunden!', 'warn', 2000);
        this.refreshCountdown(rest);
    }

    refreshCountdown(rest) {
        const ring = document.querySelector('#l3-ring');
        if (!ring) return;
        const frac = Math.max(0, rest) / LIMIT;
        ring.querySelector('.fg').style.strokeDashoffset = String(207.3 * (1 - frac));
        ring.querySelector('.ring-value').textContent = formatTime(Math.ceil(Math.max(0, rest)));
        ring.classList.toggle('warn', rest <= 60 && rest > 30);
        ring.classList.toggle('crit', rest <= 30);
    }

    async complete() {
        this.done = true;
        this.clearSelection();
        const t = Math.min(LIMIT, this.ctx.elapsed());
        this.ctx.stopTimer();
        this.refresh();
        this.toast('Alle 24 Ports gepatcht – beide Büros sind online!', 'success', 2600);
        this.engine.flyTo(V(0.35, 1.62, 1.25), V(0, 1.42, 0), { duration: 1.4 });
        if (!(await this.engine.wait(1.8))) return;
        const oneToOne = this.connections.filter(c => c.swPort === c.pp).length;
        const timeBonus = t <= 90 ? 15 : t <= 120 ? 10 : t <= 150 ? 5 : 0;
        const orderBonus = Math.round(15 * oneToOne / 24);
        const breakdown = [
            { label: 'Alle 24 Ports richtig zugeordnet', points: 0, value: '70' },
            { label: `Tempo (${formatTime(t)} von 03:00)`, points: timeBonus, value: fmtPts(timeBonus), kind: timeBonus ? 'plus' : '' },
            { label: `Ordnung: ${oneToOne}/24 Ports 1 : 1 gepatcht`, points: orderBonus, value: fmtPts(orderBonus), kind: orderBonus ? 'plus' : '' },
            { label: `Falscher Switch (${this.mistakes}×)`, points: -2 * this.mistakes, value: fmtPts(-2 * this.mistakes), kind: this.mistakes ? 'minus' : '' }
        ];
        const score = this.scoreResult({ breakdown, base: 70 });
        this.ctx.finish({
            success: true, score, time: t,
            title: 'Netzwerkschrank fertig gepatcht!',
            subtitle: 'Alle Link-LEDs leuchten: Beide Büros sind jetzt mit ihrem Switch verbunden.',
            stats: [
                { label: 'Punkte', value: score },
                { label: 'Zeit', value: formatTime(t) },
                { label: '1 : 1 gepatcht', value: `${oneToOne}/24` }
            ],
            breakdown,
            sections: oneToOne < 24 ? [{ title: 'Tipp für die Praxis', icon: 'bulb', html: '<p class="small" style="margin:0">Wenn PP-Port <em>n</em> immer auf Switch-Port <em>n</em> gepatcht wird, laufen die Kabel senkrecht und jede Dose ist ohne Suchen dem richtigen Switch-Port zuzuordnen. Das spart bei der Fehlersuche viel Zeit.</p>' }] : [],
            actions: [
                { label: 'Nochmal', action: 'retry', icon: 'restart' },
                { label: 'Weiter zu Station 4', action: 'next', icon: 'arrowRight', primary: true }
            ]
        });
    }

    timeUp() {
        if (this.done) return;
        this.done = true;
        this.clearSelection();
        this.ctx.stopTimer();
        this.refresh();
        const missing = [];
        for (let n = 1; n <= 24; n++) if (!this.connectionOf('pp', n)) missing.push(n);
        this.ctx.finish({
            success: false, score: 0, time: LIMIT,
            title: 'Die Zeit ist abgelaufen',
            subtitle: `${this.connections.length} von 24 Ports sind gepatcht – ${missing.length} Büro-Anschlüsse haben noch keine Verbindung.`,
            stats: [
                { label: 'Gepatcht', value: `${this.connections.length}/24` },
                { label: 'Büro 1', value: `${this.connections.filter(c => c.sw === 1).length}/12` },
                { label: 'Büro 2', value: `${this.connections.filter(c => c.sw === 2).length}/12` }
            ],
            sections: [{ title: 'Noch offen', icon: 'warn', cls: 'errors', html: `<p style="margin:0">PP-Ports ${missing.join(', ')}</p>` }],
            actions: [
                { label: 'Übersicht', action: 'menu', icon: 'grid' },
                { label: 'Nochmal versuchen', action: 'retry', icon: 'restart', primary: true }
            ]
        });
    }

    // ------------------------------------------------------------
    // UI
    // ------------------------------------------------------------

    steps() {
        const s1 = this.connections.filter(c => c.sw === 1).length;
        const s2 = this.connections.filter(c => c.sw === 2).length;
        return [
            { text: 'PP-Ports 1–12 → <strong>Switch Büro 1</strong> (blau)', meta: `${s1}/12 gepatcht`, done: s1 === 12 },
            { text: 'PP-Ports 13–24 → <strong>Switch Büro 2</strong> (grün)', meta: `${s2}/12 gepatcht`, done: s2 === 12 },
            { text: 'Alle Link-LEDs leuchten – fertig in unter 3 Minuten', done: this.done && this.connections.length === 24 }
        ];
    }

    objective() {
        if (this.done) return '';
        const s = this.selected;
        if (s?.type === 'pp') {
            const target = s.n <= 12 ? 1 : 2;
            return `PP-Port ${s.n} gewählt → ${this.ctx.tap(true)} einen freien Port an <strong>${SW_NAME[target]}</strong> (ideal: Port ${s.n}).`;
        }
        if (s?.type === 'sw') return `${SW_NAME[s.sw]} Port ${s.n} gewählt → ${this.ctx.tap(true)} den passenden Patchpanel-Port.`;
        const next = [...Array(24).keys()].map(i => i + 1).find(n => !this.connectionOf('pp', n));
        return `${this.ctx.tap()} einen Patchpanel-Port (z. B. Port ${next}) und dann einen Port am richtigen Switch.`;
    }

    hints() {
        const s = this.selected;
        if (s?.type === 'pp') {
            const target = s.n <= 12 ? 1 : 2;
            const ideal = this.swPorts[target][s.n];
            return this.connectionOf('sw', s.n, target) ? [] : [ideal];
        }
        return [];
    }

    renderControls(el) {
        const s1 = this.connections.filter(c => c.sw === 1).length;
        const s2 = this.connections.filter(c => c.sw === 2).length;
        const rest = Math.max(0, LIMIT - this.ctx.elapsed());
        const s = this.selected;
        const ppText = s?.type === 'pp' ? `Port ${s.n}` : '–';
        const swText = s?.type === 'sw' ? `S${s.sw} · Port ${s.n}` : '–';
        el.innerHTML = `
            <h3 class="card-title">Patch-Fortschritt <span class="count">${s1 + s2}/24</span></h3>
            <div class="countdown">
                <div class="ring" id="l3-ring">
                    <svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="33"/><circle class="fg" cx="40" cy="40" r="33" stroke-dasharray="207.3" stroke-dashoffset="${207.3 * (1 - rest / LIMIT)}"/></svg>
                    <span class="ring-value">${formatTime(Math.ceil(rest))}</span>
                </div>
                <div class="bars">
                    <div class="bar-row"><span><span class="dot" style="background:${SW_COLOR[1]}"></span>Büro 1</span><b>${s1}/12</b><div class="progress sw1"><span style="width:${s1 / 12 * 100}%"></span></div></div>
                    <div class="bar-row"><span><span class="dot" style="background:${SW_COLOR[2]}"></span>Büro 2</span><b>${s2}/12</b><div class="progress sw2"><span style="width:${s2 / 12 * 100}%"></span></div></div>
                </div>
            </div>
            <div class="patch-now">
                <div class="patch-slot ${s?.type === 'pp' ? 'on' : ''}"><small>Patchpanel</small><b>${ppText}</b></div>
                <span class="patch-arrow">${icon('cable')}</span>
                <div class="patch-slot ${s?.type === 'sw' ? 'on' : ''}"><small>Switch</small><b>${swText}</b></div>
            </div>
            <div class="legend"><span><span class="dot" style="background:#3cff7a"></span>Link-LED</span><span><span class="dot" style="background:#ffb13b"></span>Aktivität</span><span><span class="dot" style="background:#ee7a16"></span>DD1-1</span></div>`;
        this.refreshCountdown(rest);
    }

    actions() {
        return {
            undo: { label: 'Letztes Kabel entfernen', enabled: this.connections.length > 0 && !this.done },
            check: null
        };
    }
}

