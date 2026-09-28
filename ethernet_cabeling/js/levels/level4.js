// ============================================================
// Station 4: PCs anschließen & mit ping testen (Büro, Meter)
// ============================================================

import * as THREE from 'three';
import { BaseLevel, fmtPts } from './base.js';
import {
    V, at, box, rbox, cyl, hitbox, buildRoom, buildDuct, ductCover, dataOutlet, schukoOutlet,
    pcTower, monitor, keyboard, mouse, desk, officeChair, plant, whiteboard, windowPanel, ceilingLight,
    patchCoil, rj45Plug, orientPlug, plugAnchorWorld, cableMesh, setTubeProgress
} from '../models.js';
import { std, parquetTexture, jacketMaterial } from '../materials.js';
import { makeLabel } from '../labels.js';
import { Ease } from '../engine.js';
import { icon } from '../icons.js';
import { formatTime, $ } from '../ui.js';
import { LEVELS } from '../data.js';

const DUCT_Y = 1.0, DUCT_D = 0.065;
const DESK_H = 0.74;
const IP = { 1: '192.168.1.1', 2: '192.168.1.2' };
const MAC = { 1: '3c-52-82-1a-4f-01', 2: '3c-52-82-1a-4f-02' };
const PATCH_GREY = '#3b73d9';

export class Level4 extends BaseLevel {
    build() {
        const e = this.engine;
        this.hand = null;                  // aufgenommene Kabelrolle
        this.pending = null;               // { pc?, jack? } halb gesteckt
        this.links = { 1: null, 2: null }; // { jack, meshes }
        this.history = [];
        this.mistakes = 0;
        this.pingOk = false;
        this.pinging = false;
        this.term = { lines: [], open: false, history: [], hIdx: 0, arp: false };
        this.done = false;

        this.lights({
            hemi: 0.36, env: 0.36,
            sun: { position: [-2.4, 2.6, 2.4], target: [0, 0.8, 0.3], intensity: 1.75, size: 2.2, color: '#fff3e0' }
        });
        this.buildRoom();
        this.buildDuctAndOutlets();
        this.buildWorkplaces();
        this.setupTerminal();
        this.drawScreens();

        e.onFrame((dt, t) => this.animate(t));
        e.configureControls({ minDistance: 0.2, maxDistance: 5.5, maxPolarAngle: 1.52, minAzimuthAngle: -1.3, maxAzimuthAngle: 1.3 });
        const home = { position: V(0, 1.58, 2.5), target: V(0, 0.92, 0.3) };
        e.setHome(home);
        e.setView(home);
        e.optimizeShadows(0.012);
    }

    // ------------------------------------------------------------
    // Szene
    // ------------------------------------------------------------

    buildRoom() {
        this.add(buildRoom({ width: 5.2, depth: 4.6, height: 2.8, floorMap: parquetTexture(), floorRepeat: [5, 4.5], wallColor: '#e2dccf' }));
        const win = windowPanel({ w: 1.3, h: 1.35 });
        win.rotation.y = Math.PI / 2;
        win.position.set(-2.599, 1.55, 1.7);
        this.add(win);
        const wb = whiteboard(1.4, 0.9);
        wb.rotation.y = -Math.PI / 2;
        wb.position.set(2.59, 1.5, 1.6);
        this.add(wb);
        this.add(at(plant(1.0), -2.2, 0, 0.45));
        for (const [x, z] of [[-1.2, 1.0], [1.2, 1.0], [-1.2, 2.6], [1.2, 2.6]]) this.add(at(ceilingLight(), x, 2.79, z));
    }

    buildDuctAndOutlets() {
        const duct = buildDuct({ length: 5.2, capLeft: false, capRight: false });
        duct.group.position.set(-2.6, DUCT_Y, 0);
        this.add(duct.group);
        // Oberteile mit Aussparungen für die Geräteträger
        for (const [x0, x1] of [[-2.6, -0.6], [-0.2, 0.2], [0.6, 2.6]]) {
            const c = ductCover({ length: x1 - x0 });
            c.position.set(x0, DUCT_Y, DUCT_D);
            this.add(c);
        }
        const white = std('#f4f2ec', 0.38);
        for (const x of [-0.4, 0.4]) this.add(at(rbox(0.4, 0.128, 0.004, 0.0015, white), x, DUCT_Y, DUCT_D + 0.002));

        this.outlets = {};
        this.jacks = {};
        [[1, -0.3], [2, 0.3]].forEach(([k, x]) => {
            const o = dataOutlet({ title: `DD${k}`, ports: [`DD${k}-1`, `DD${k}-2`] });
            o.group.position.set(x, DUCT_Y, DUCT_D + 0.004);
            this.add(o.group);
            this.outlets[k] = o;
            o.jacks.forEach(j => {
                j.group.userData = { kind: 'jack', name: j.name };
                this.jacks[j.name] = j;
                this.engine.addPickable(j.group, { tooltip: () => this.jackTooltip(j.name) });
            });
            const s = schukoOutlet();
            s.position.set(x < 0 ? -0.5 : 0.5, DUCT_Y, DUCT_D + 0.004);
            this.add(s);
            this.add(at(makeLabel(`DD${k}`, { height: 0.05, sub: k === 1 ? 'für PC 1' : 'für PC 2', accent: '#4f8cff', anchor: 'bottom' }), x, DUCT_Y + 0.1, DUCT_D + 0.03));
        });
        this.add(at(makeLabel('→ Technikraum', { height: 0.06, sub: 'Patchpanel & Switch (Station 3)', accent: '#ee7a16' }), 2.2, DUCT_Y + 0.17, 0.08));
    }

    buildWorkplaces() {
        this.pcs = {};
        this.coils = [];
        [[1, -0.7], [2, 0.7]].forEach(([k, x]) => {
            this.add(at(desk({ w: 1.4, d: 0.8, h: DESK_H }), k === 1 ? -0.75 : 0.75, 0, 0.52));
            const chair = officeChair(k === 1 ? '#2a3140' : '#3a2f2f');
            chair.position.set(x + (k === 1 ? 0.1 : -0.1), 0, 1.35);
            chair.rotation.y = Math.PI + (k === 1 ? 0.2 : -0.2);
            this.add(chair);

            const mon = monitor();
            mon.group.position.set(x, DESK_H, 0.36);
            mon.group.userData = { kind: 'screen', pc: k };
            this.add(mon.group);
            this.engine.addPickable(mon.group, { glowScale: 0.3, tooltip: k === 1 ? '<strong>PC 1 · Bildschirm</strong><span class="tt-sub">Eingabeaufforderung öffnen</span>' : '<strong>PC 2 · Bildschirm</strong><span class="tt-sub">192.168.1.2</span>' });
            // Pickable klont Materialien → Textur-Referenz des Bildschirms aktualisieren
            mon.texture = mon.screen.material.map;

            this.add(at(keyboard(), x, DESK_H, 0.66));
            this.add(at(mouse(), x + 0.33, DESK_H, 0.68));

            // Tower am äußeren Tischende, Rückseite zur Seitenwand
            const tower = pcTower({ accent: k === 1 ? '#3b82f6' : '#22c55e' });
            const tx = k === 1 ? -1.23 : 1.23;
            tower.group.position.set(tx, DESK_H, 0.38);
            tower.group.rotation.y = k === 1 ? Math.PI / 2 : -Math.PI / 2;
            this.add(tower.group);
            tower.group.updateMatrixWorld(true);
            const lanGroup = tower.lan;
            lanGroup.userData = { kind: 'lan', pc: k };
            this.engine.addPickable(lanGroup, { tooltip: () => this.lanTooltip(k) });
            tower.body.userData = { kind: 'tower', pc: k };
            this.engine.addPickable(tower.body, { glowScale: 0.35, tooltip: `<strong>PC ${k}</strong><span class="tt-sub">LAN-Anschluss ist auf der Rückseite</span>` });
            const lanPos = tower.group.localToWorld(tower.lanLocal.clone());
            const lanOut = tower.lanOutLocal.clone().applyQuaternion(tower.group.quaternion);
            this.pcs[k] = { tower, mon, lanGroup, lanPos, lanOut, x, tx };

            this.add(at(makeLabel(`PC ${k}`, { height: 0.07, sub: IP[k], accent: k === 1 ? '#3b82f6' : '#22c55e', anchor: 'bottom' }), x, DESK_H + 0.56, 0.36));

            // Netzkabel zur Steckdose (Schuko)
            const inlet = tower.group.localToWorld(tower.psuInletLocal.clone());
            const sx = k === 1 ? -0.5 : 0.5;
            const pw = [inlet, inlet.clone().add(lanOut.clone().multiplyScalar(0.06)), V(inlet.x + lanOut.x * 0.1, DESK_H - 0.05, 0.1), V((inlet.x + sx) / 2, DESK_H - 0.12, 0.07), V(sx, DUCT_Y - 0.25, 0.08), V(sx, DUCT_Y - 0.03, DUCT_D + 0.04)];
            this.add(cableMesh(pw, 0.0035, std('#15171a', 0.6), { radial: 8 }));
            this.add(at(cyl(0.018, 0.02, 0.04, std('#1b1d20', 0.5), 20).rotateX(Math.PI / 2), sx, DUCT_Y, DUCT_D + 0.035));

            // Patchkabel liegt auf dem Tisch
            const coil = patchCoil({ color: PATCH_GREY, bootColor: PATCH_GREY });
            coil.position.set(k === 1 ? -0.2 : 0.2, DESK_H, 0.42);
            coil.rotation.y = k === 1 ? 0.3 : -0.3 + Math.PI;
            coil.userData = { kind: 'coil', id: k };
            this.add(coil);
            this.engine.addPickable(coil, { tooltip: '<strong>Patchkabel</strong><span class="tt-sub">Cat.6A S/FTP · 2 m</span>', enabled: () => coil.visible });
            this.coils.push(coil);
        });
    }

    // ------------------------------------------------------------
    // Tooltips
    // ------------------------------------------------------------

    jackTooltip(name) {
        const owner = Object.entries(this.links).find(([, l]) => l?.jack === name);
        const doc = name === 'DD1-1' ? 'laut Doku: PC 1' : name === 'DD2-1' ? 'laut Doku: PC 2' : 'Reserve';
        return `<strong>Netzwerkdose ${name}</strong><span class="tt-sub">${owner ? `<span class="tt-ok">verbunden mit PC ${owner[0]}</span>` : doc}</span>`;
    }

    lanTooltip(k) {
        const l = this.links[k];
        return `<strong>PC ${k} · LAN-Port (RJ45)</strong><span class="tt-sub">${l ? '<span class="tt-ok">Link ● verbunden</span>' : this.pending?.pc === k ? 'Stecker steckt' : 'Link-LED aus'}</span>`;
    }

    // ------------------------------------------------------------
    // Interaktion
    // ------------------------------------------------------------

    isLinked(k) { return !!this.links[k]; }

    onPick(obj) {
        if (!obj || this.done) return;
        const d = obj.userData;
        switch (d.kind) {
            case 'coil': return this.pickCoil(obj);
            case 'lan': return this.clickLan(d.pc);
            case 'jack': return this.clickJack(d.name);
            case 'tower': return this.viewRear(d.pc, true);
            case 'screen':
                if (d.pc === 1) return this.openTerminal();
                return this.toast('PC 2 wartet auf einen ping von PC 1. Die Eingabeaufforderung öffnest du auf PC 1.', 'info');
        }
    }

    pickCoil(coil) {
        if (this.hand) { this.toast('Du hast schon ein Patchkabel in der Hand.', 'info'); return; }
        const next = [1, 2].find(k => !this.isLinked(k));
        if (!next) return;
        this.hand = coil;
        this.engine.removePickable(coil);
        const p0 = coil.position.clone();
        this.engine.tween({ duration: 0.4, ease: Ease.inOutCubic, onUpdate: k => { coil.position.y = p0.y + Math.sin(k * Math.PI) * 0.12; coil.scale.setScalar(1 - k * 0.999); }, onComplete: () => { coil.visible = false; } });
        this.toast(`Patchkabel aufgenommen. Stecke ein Ende in den <strong>LAN-Port von PC ${next}</strong> – die Kamera zeigt dir die Rückseite.`, 'success', 3800);
        this.viewRear(next, false);
        this.refresh();
    }

    viewRear(k, fromClick) {
        const p = this.pcs[k];
        const sx = k === 1 ? -1 : 1;
        this.engine.flyTo(V(sx * 2.0, 1.3, 1.0), V(p.lanPos.x, p.lanPos.y - 0.08, p.lanPos.z), { duration: 1.2 });
        if (fromClick && !this.hand && !this.isLinked(k)) this.toast(`Hier auf der Rückseite sitzt der LAN-Port von PC ${k}.`, 'info', 2400);
    }

    viewSocket(k) {
        const x = k === 1 ? -0.3 : 0.3;
        this.engine.flyTo(V(x + (k === 1 ? 0.2 : -0.2), 1.16, 0.6), V(x, DUCT_Y - 0.03, 0.07), { duration: 1.2 });
    }

    clickLan(k) {
        if (this.isLinked(k)) { this.toast(`PC ${k} ist bereits verbunden.`, 'info'); return; }
        if (this.pending?.pc === k) { this.toast(`Das Kabel steckt schon in PC ${k} – jetzt noch die Dose DD${k}-1.`, 'info'); return; }
        if (!this.hand) { this.toast('Nimm zuerst ein Patchkabel vom Schreibtisch.', 'warn'); return; }
        if (this.pending?.pc) { this.toast(`Das Kabel steckt bereits in PC ${this.pending.pc}. Stecke das andere Ende in DD${this.pending.pc}-1.`, 'warn'); return; }
        if (this.pending?.jack) {
            const owner = this.pending.jack === 'DD1-1' ? 1 : 2;
            if (owner !== k) {
                this.mistakes++;
                this.toast(`Das Kabel steckt in <strong>${this.pending.jack}</strong> – laut Dokumentation gehört dort <strong>PC ${owner}</strong> dran. −5 P`, 'warn', 4000);
                this.refresh();
                return;
            }
            this.plugPc(k);
            this.completeLink(k, this.pending.jack);
            return;
        }
        this.plugPc(k);
        this.pending = { pc: k, plugs: this.pending?.plugs || [] };
        this.toast(`Klick – Stecker im LAN-Port von PC ${k}. Jetzt das andere Ende in die Dose <strong>DD${k}-1</strong>.`, 'success', 3200);
        this.viewSocket(k);
        this.refresh();
    }

    clickJack(name) {
        const owner = Object.entries(this.links).find(([, l]) => l?.jack === name);
        if (owner) { this.toast(`${name} ist bereits mit PC ${owner[0]} verbunden.`, 'info'); return; }
        if (!this.hand) { this.toast('Nimm zuerst ein Patchkabel vom Schreibtisch.', 'warn'); return; }
        if (this.pending?.jack) { this.toast(`Das Kabel steckt bereits in ${this.pending.jack}. Stecke das andere Ende in den passenden PC.`, 'warn'); return; }
        const doc = { 'DD1-1': 1, 'DD2-1': 2 }[name];
        if (this.pending?.pc) {
            const k = this.pending.pc;
            if (name !== `DD${k}-1`) {
                this.mistakes++;
                const why = doc ? `${name} ist laut Dokumentation für <strong>PC ${doc}</strong> vorgesehen.` : `${name} ist ein Reserve-Anschluss.`;
                this.toast(`${why} PC ${k} gehört an <strong>DD${k}-1</strong>. −5 P`, 'warn', 4200);
                this.refresh();
                return;
            }
            this.plugJack(name);
            this.completeLink(k, name);
            return;
        }
        if (!doc) {
            this.mistakes++;
            this.toast(`${name} ist ein Reserve-Anschluss. Laut Dokumentation: PC 1 → DD1-1, PC 2 → DD2-1. −5 P`, 'warn', 4200);
            this.refresh();
            return;
        }
        if (this.isLinked(doc)) {
            this.toast(`PC ${doc} ist bereits angeschlossen.`, 'info');
            return;
        }
        this.plugJack(name);
        this.pending = { jack: name, plugs: this.pending?.plugs || [] };
        this.toast(`Stecker in ${name}. Jetzt das andere Ende in den LAN-Port von <strong>PC ${doc}</strong>.`, 'success', 3200);
        this.viewRear(doc, false);
        this.refresh();
    }

    plugPc(k) {
        const p = this.pcs[k];
        const plug = orientPlug(rj45Plug({ bootColor: PATCH_GREY }), p.lanPos, p.lanOut, 0.012);
        this.add(plug);
        this.slidePlug(plug, p.lanOut);
        this.pending = this.pending || {};
        (this.pending.plugs ||= []).push({ type: 'pc', k, plug });
    }

    plugJack(name) {
        const j = this.jacks[name];
        j.group.updateMatrixWorld(true);
        const pos = j.group.localToWorld(j.localPos.clone());
        const out = j.localOut.clone().applyQuaternion(j.group.getWorldQuaternion(new THREE.Quaternion())).normalize();
        const plug = orientPlug(rj45Plug({ bootColor: PATCH_GREY }), pos, out, 0.012);
        this.add(plug);
        this.slidePlug(plug, out);
        this.engine.tween({ duration: 0.25, onUpdate: k => { j.shutter.rotation.x = -1.7 * k; } });
        this.pending = this.pending || {};
        (this.pending.plugs ||= []).push({ type: 'jack', name, plug, out, pos });
    }

    slidePlug(plug, out) {
        const final = plug.position.clone();
        const lift = out.clone().multiplyScalar(0.035);
        plug.position.add(lift);
        this.engine.tween({ duration: 0.3, ease: Ease.outCubic, onUpdate: k => plug.position.copy(final).addScaledVector(lift, 1 - k) });
    }

    completeLink(k, jackName) {
        const plugs = this.pending.plugs;
        const pcPlug = plugs.find(p => p.type === 'pc').plug;
        const jackEntry = plugs.find(p => p.type === 'jack');
        const e = this.engine;
        const link = { jack: jackName, meshes: plugs.map(p => p.plug), jackEntry };
        // Kabel erst nach dem Einschieben der Stecker berechnen
        e.later(() => {
            if (this.disposed || this.links[k] !== link) return;
            const a = plugAnchorWorld(pcPlug);
            const b = plugAnchorWorld(jackEntry.plug);
            const p = this.pcs[k];
            const sx = k === 1 ? -1 : 1;
            const jx = b.x;
            const pts = [
                a, a.clone().addScaledVector(p.lanOut, 0.05),
                V(a.x + p.lanOut.x * 0.1, a.y - 0.16, a.z - 0.05),
                V(a.x + p.lanOut.x * 0.07, DESK_H + 0.02, 0.2),
                V(p.tx - sx * 0.1, DESK_H + 0.01, 0.1),
                V((p.tx + jx) / 2, DESK_H - 0.03, 0.07),
                V(jx + sx * 0.12, DESK_H + 0.05, 0.075),
                V(jx, b.y - 0.1, b.z + 0.01),
                b
            ];
            const cable = cableMesh(pts, 0.0029, jacketMaterial(PATCH_GREY, 0.5), { radial: 10, maxSegments: 260 });
            this.add(cable);
            setTubeProgress(cable, 0);
            e.tween({ duration: 0.7, ease: Ease.outCubic, onUpdate: t => setTubeProgress(cable, t) });
            link.meshes.push(cable);
        }, 320);
        this.links[k] = link;
        this.history.push(k);
        this.pending = null;
        this.hand = null;
        e.later(() => {
            if (this.disposed) return;
            this.drawScreens();
            this.toast(`<strong>PC ${k}</strong> ist verbunden – die Link-LED am Netzwerkanschluss leuchtet.`, 'success', 3000);
            const next = [1, 2].find(i => !this.isLinked(i));
            if (next) e.goHome(1.3);
            else {
                this.toast('Beide PCs sind angeschlossen. Teste die Verbindung: Öffne auf PC 1 die Eingabeaufforderung.', 'info', 4200);
                e.flyTo(V(-0.45, 1.33, 1.4), V(-0.7, 1.05, 0.36), { duration: 1.4 });
            }
            this.refresh();
        }, 900);
        this.refresh();
    }

    onUndo() {
        if (this.done || this.pinging) return;
        if (this.pending) {
            this.pending.plugs?.forEach(p => this.removePlug(p));
            this.pending = null;
            this.toast('Stecker wieder gezogen.', 'info', 1600);
            this.refresh();
            return;
        }
        const k = this.history.pop();
        if (!k) return;
        const l = this.links[k];
        l.meshes.forEach(m => this.disposeObj(m));
        if (l.jackEntry) this.jacks[l.jackEntry.name].shutter.rotation.x = 0;
        this.links[k] = null;
        const coil = this.coils.find(c => !c.visible);
        if (coil) {
            coil.visible = true;
            coil.scale.setScalar(1);
            this.engine.addPickable(coil, coil.userData.pick);
        }
        this.pingOk = false;
        this.drawScreens();
        this.toast(`Patchkabel von PC ${k} entfernt.`, 'info', 1800);
        this.refresh();
    }

    removePlug(p) {
        this.disposeObj(p.plug);
        if (p.type === 'jack') this.jacks[p.name].shutter.rotation.x = 0;
    }

    disposeObj(obj) {
        obj.removeFromParent();
        obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }

    onEscape() {
        if (this.term.open) { this.closeTerminal(); return true; }
        return false;
    }

    dispose() {
        super.dispose();
        clearTimeout(this.pingTimer);
        this.closeTerminal(true);
    }

    // ------------------------------------------------------------
    // Animation (LEDs)
    // ------------------------------------------------------------

    animate(t) {
        for (const k of [1, 2]) {
            const leds = this.pcs[k].tower.leds;
            const linked = this.isLinked(k);
            leds.link.material.color.set(linked ? '#3cff7a' : '#1f2a22');
            const busy = linked && (this.pinging ? Math.sin(t * 30 + k) > 0 : Math.sin(t * 3.3 + k * 2) > 0.92);
            leds.act.material.color.set(busy ? '#ffb13b' : '#2a2418');
        }
    }

    // ------------------------------------------------------------
    // Bildschirme
    // ------------------------------------------------------------

    drawScreens() {
        for (const k of [1, 2]) this.drawScreen(k);
    }

    drawScreen(k) {
        const { ctx, canvas, texture } = this.pcs[k].mon;
        const W = canvas.width, H = canvas.height;
        const linked = this.isLinked(k);
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#0b2a6f'); g.addColorStop(0.55, '#1557c0'); g.addColorStop(1, '#3a8dde');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.ellipse(W * 0.72, H * 0.55, W * 0.35, H * 0.5, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(W * 0.8, H * 0.4, W * 0.2, H * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();

        // Fenster "Netzwerkverbindungen"
        const wx = 60, wy = 60, ww = 560, wh = 250;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(wx + 6, wy + 8, ww, wh);
        ctx.fillStyle = '#f3f3f3'; ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(wx, wy, ww, 44);
        ctx.fillStyle = '#1f1f1f'; ctx.font = '600 22px "Segoe UI", Arial'; ctx.textBaseline = 'middle';
        ctx.fillText('Netzwerkverbindungen', wx + 18, wy + 22);
        ctx.fillStyle = '#555'; ctx.fillText('—   ☐   ✕', wx + ww - 120, wy + 22);
        // Adapterkarte
        const ax = wx + 30, ay = wy + 80;
        ctx.fillStyle = '#e1ecfa'; ctx.fillRect(ax - 10, ay - 12, ww - 40, 140);
        ctx.fillStyle = '#3c4a5c'; ctx.fillRect(ax + 6, ay + 12, 70, 46); ctx.fillStyle = '#9fc3f0'; ctx.fillRect(ax + 12, ay + 18, 58, 34);
        ctx.fillStyle = '#3c4a5c'; ctx.fillRect(ax + 30, ay + 58, 22, 10); ctx.fillRect(ax + 20, ay + 68, 42, 6);
        if (!linked) {
            ctx.fillStyle = '#d13438'; ctx.beginPath(); ctx.arc(ax + 72, ay + 64, 14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax + 66, ay + 58); ctx.lineTo(ax + 78, ay + 70); ctx.moveTo(ax + 78, ay + 58); ctx.lineTo(ax + 66, ay + 70); ctx.stroke();
        }
        ctx.fillStyle = '#1f1f1f'; ctx.font = '600 24px "Segoe UI", Arial';
        ctx.fillText('Ethernet', ax + 100, ay + 12);
        ctx.font = '400 20px "Segoe UI", Arial';
        ctx.fillStyle = linked ? '#1f1f1f' : '#b3261e';
        ctx.fillText(linked ? 'Netzwerk – Kein Internetzugriff' : 'Netzwerkkabel wurde entfernt', ax + 100, ay + 44);
        ctx.fillStyle = '#555';
        ctx.fillText('Intel(R) Ethernet Connection I219-V', ax + 100, ay + 74);
        ctx.fillText(`IPv4: ${IP[k]} / 255.255.255.0`, ax + 100, ay + 104);

        if (k === 1 && this.term.open) this.drawCmd(ctx, W, H);

        // Taskleiste
        ctx.fillStyle = 'rgba(20, 24, 33, 0.92)'; ctx.fillRect(0, H - 56, W, 56);
        const sx = W / 2 - 150;
        ctx.fillStyle = '#4ea1ff';
        for (const [dx, dy] of [[0, 0], [16, 0], [0, 16], [16, 16]]) ctx.fillRect(sx + dx, H - 44 + dy, 14, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(sx + 50, H - 44, 200, 32);
        ctx.fillStyle = '#c8cdd6'; ctx.font = '400 18px "Segoe UI", Arial'; ctx.fillText('Suchen', sx + 64, H - 28);
        if (k === 1) { ctx.fillStyle = '#1f1f1f'; ctx.fillRect(sx + 270, H - 44, 32, 32); ctx.fillStyle = '#ddd'; ctx.font = '700 16px Consolas, monospace'; ctx.fillText('>_', sx + 274, H - 28); }
        // Netzwerksymbol
        const nx = W - 190, ny = H - 28;
        ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2.5;
        ctx.strokeRect(nx, ny - 11, 22, 15); ctx.beginPath(); ctx.moveTo(nx + 11, ny + 4); ctx.lineTo(nx + 11, ny + 10); ctx.moveTo(nx + 4, ny + 11); ctx.lineTo(nx + 18, ny + 11); ctx.stroke();
        if (!linked) {
            ctx.fillStyle = '#e81123'; ctx.beginPath(); ctx.arc(nx + 20, ny + 6, 8, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(nx + 16, ny + 2); ctx.lineTo(nx + 24, ny + 10); ctx.moveTo(nx + 24, ny + 2); ctx.lineTo(nx + 16, ny + 10); ctx.stroke();
        }
        ctx.fillStyle = '#e5e7eb'; ctx.font = '400 17px "Segoe UI", Arial'; ctx.textAlign = 'right';
        ctx.fillText('10:42', W - 20, H - 38); ctx.fillText('27.09.2026', W - 20, H - 17);
        ctx.textAlign = 'left';
        texture.needsUpdate = true;
    }

    drawCmd(ctx, W, H) {
        const x = 130, y = 150, w = W - 200, h = H - 230;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 8, y + 10, w, h);
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x, y, w, 38);
        ctx.fillStyle = '#e6e6e6'; ctx.font = '400 19px "Segoe UI", Arial'; ctx.fillText('Eingabeaufforderung', x + 16, y + 19);
        ctx.fillStyle = '#0c0c0c'; ctx.fillRect(x, y + 38, w, h - 38);
        ctx.font = '400 19px Consolas, "Courier New", monospace';
        const lineH = 23;
        const maxLines = Math.floor((h - 50) / lineH);
        const all = [...this.term.lines.flatMap(l => l.split('\n')), this.pinging ? '' : 'C:\\Users\\Azubi>' + ($('#term-input')?.value || '') + '_'];
        const shown = all.slice(-maxLines);
        shown.forEach((line, i) => {
            ctx.fillStyle = /Antwort von 192\.168\.1\.2|Empfangen = 4, Verloren = 0/.test(line) && this.pingOk ? '#7CFC9A' : '#cccccc';
            ctx.fillText(line.slice(0, 90), x + 12, y + 60 + i * lineH);
        });
    }

    // ------------------------------------------------------------
    // Eingabeaufforderung (DOM + Spiegelung auf den Monitor)
    // ------------------------------------------------------------

    setupTerminal() {
        const input = $('#term-input');
        this.onTermKey = (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                if (this.pinging) return;
                const cmd = input.value;
                input.value = '';
                if (cmd.trim()) { this.term.history.push(cmd); this.term.hIdx = this.term.history.length; }
                this.exec(cmd);
            } else if (ev.key === 'ArrowUp') {
                ev.preventDefault();
                if (this.term.hIdx > 0) { this.term.hIdx--; input.value = this.term.history[this.term.hIdx] || ''; }
            } else if (ev.key === 'ArrowDown') {
                ev.preventDefault();
                if (this.term.hIdx < this.term.history.length) { this.term.hIdx++; input.value = this.term.history[this.term.hIdx] || ''; }
            } else if (ev.key === 'Escape') {
                ev.preventDefault();
                this.closeTerminal();
            }
        };
        this.onTermInput = () => this.drawScreen(1);
        this.onTermClose = () => this.closeTerminal();
        this.onTermBody = () => input.focus();
        input.addEventListener('keydown', this.onTermKey);
        input.addEventListener('input', this.onTermInput);
        $('#term-close').addEventListener('click', this.onTermClose);
        $('#term-body').addEventListener('click', this.onTermBody);
        $('#term-title').textContent = 'Eingabeaufforderung – PC 1 (192.168.1.1)';
        $('#term-quick').innerHTML = ['ping 192.168.1.2', 'ipconfig', 'ping 192.168.1.1', 'arp -a', 'cls']
            .map(c => `<button type="button" data-cmd="${c}">${c}</button>`).join('');
        this.onQuick = (ev) => {
            const b = ev.target.closest('button[data-cmd]');
            if (!b || this.pinging) return;
            input.value = '';
            this.term.history.push(b.dataset.cmd);
            this.term.hIdx = this.term.history.length;
            this.exec(b.dataset.cmd);
            input.focus();
        };
        $('#term-quick').addEventListener('click', this.onQuick);
        this.term.lines = ['Microsoft Windows [Version 10.0.22631.4317]', '(c) Microsoft Corporation. Alle Rechte vorbehalten.', ''];
        $('#term-out').textContent = this.term.lines.join('\n') + '\n';
    }

    openTerminal() {
        if (!this.ctx.playing) return;
        this.term.open = true;
        $('#terminal').hidden = false;
        $('#term-input').focus();
        this.drawScreen(1);
        this.refresh();
    }

    closeTerminal(detach = false) {
        this.term.open = false;
        $('#terminal').hidden = true;
        if (detach) {
            const input = $('#term-input');
            input.removeEventListener('keydown', this.onTermKey);
            input.removeEventListener('input', this.onTermInput);
            $('#term-close').removeEventListener('click', this.onTermClose);
            $('#term-body').removeEventListener('click', this.onTermBody);
            $('#term-quick').removeEventListener('click', this.onQuick);
            input.value = '';
            return;
        }
        this.drawScreen(1);
        this.refresh();
    }

    print(text) {
        this.term.lines.push(text);
        if (this.term.lines.length > 400) this.term.lines.splice(0, 100);
        const out = $('#term-out');
        out.textContent = this.term.lines.join('\n') + '\n';
        const body = $('#term-body');
        body.scrollTop = body.scrollHeight;
        this.drawScreen(1);
    }

    exec(raw) {
        const line = raw.trim();
        this.print(`C:\\Users\\Azubi>${raw}`);
        if (!line) return;
        const [cmdRaw, ...args] = line.split(/\s+/);
        const cmd = cmdRaw.toLowerCase();
        const argl = args.map(a => a.toLowerCase());
        switch (cmd) {
            case 'cls':
                this.term.lines = [];
                this.print('');
                return;
            case 'help': case 'hilfe': case '/?':
                this.print('Verfügbare Befehle in dieser Übung:\n  ping <IP-Adresse> [-n Anzahl]   Verbindung testen (ICMP)\n  ipconfig [/all]                  IP-Konfiguration anzeigen\n  arp -a                           ARP-Tabelle (IP ↔ MAC) anzeigen\n  hostname                         Rechnernamen anzeigen\n  cls                              Bildschirm löschen\n  exit                             Fenster schließen\n');
                return;
            case 'exit':
                this.closeTerminal();
                return;
            case 'hostname':
                this.print('PC-01\n');
                return;
            case 'ipconfig':
                return this.ipconfig(argl.includes('/all'));
            case 'arp':
                if (!argl.includes('-a') && !argl.includes('/a')) { this.print('Zeigt die IP-zu-MAC-Adressübersetzungstabelle an.\n\nARP -a\n'); return; }
                if (!this.isLinked(1)) { this.print('Keine ARP-Einträge gefunden.\n'); return; }
                this.print(`\nSchnittstelle: ${IP[1]} --- 0xc\n  Internetadresse       Physische Adresse     Typ\n${this.term.arp ? `  ${IP[2]}           ${MAC[2]}     dynamisch\n` : ''}  192.168.1.255         ff-ff-ff-ff-ff-ff     statisch\n  224.0.0.22            01-00-5e-00-00-16     statisch\n`);
                return;
            case 'ping':
                return this.ping(args);
            default:
                this.print(`Der Befehl "${cmdRaw}" ist entweder falsch geschrieben oder\nkonnte nicht gefunden werden.\n`);
        }
    }

    ipconfig(all) {
        const linked = this.isLinked(1);
        let s = '\nWindows-IP-Konfiguration\n\n';
        if (all) s += '   Hostname  . . . . . . . . . . . . : PC-01\n   Knotentyp . . . . . . . . . . . . : Hybrid\n\n';
        s += 'Ethernet-Adapter Ethernet:\n\n';
        if (!linked) {
            s += '   Medienstatus. . . . . . . . . . . : Medium getrennt\n   Verbindungsspezifisches DNS-Suffix:\n';
            if (all) s += '   Beschreibung. . . . . . . . . . . : Intel(R) Ethernet Connection I219-V\n   Physische Adresse . . . . . . . . : 3C-52-82-1A-4F-01\n   DHCP aktiviert. . . . . . . . . . : Nein\n';
        } else {
            s += '   Verbindungsspezifisches DNS-Suffix:\n';
            if (all) s += '   Beschreibung. . . . . . . . . . . : Intel(R) Ethernet Connection I219-V\n   Physische Adresse . . . . . . . . : 3C-52-82-1A-4F-01\n   DHCP aktiviert. . . . . . . . . . : Nein\n';
            s += '   Verbindungslokale IPv6-Adresse  . : fe80::1c4a:9b2f:5e7d:a1%12\n';
            s += `   IPv4-Adresse  . . . . . . . . . . : ${IP[1]}\n   Subnetzmaske  . . . . . . . . . . : 255.255.255.0\n   Standardgateway . . . . . . . . . :\n`;
        }
        this.print(s);
    }

    ping(args) {
        let count = 4;
        let target = null;
        for (let i = 0; i < args.length; i++) {
            const a = args[i].toLowerCase();
            if (a === '-n' || a === '/n') { count = Math.max(1, Math.min(10, parseInt(args[i + 1], 10) || 4)); i++; } else if (a === '-t' || a === '/t') { count = 6; } else if (!a.startsWith('-') && !a.startsWith('/')) target = args[i];
        }
        if (!target) {
            this.print('\nSyntax: ping [-t] [-n Anzahl] Zielname\n\nOptionen:\n    -t             Sendet fortlaufend Ping-Signale (hier: 6).\n    -n Anzahl      Anzahl zu sendender Echoanforderungen.\n');
            return;
        }
        const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(target);
        if (!ipv4 || ipv4.slice(1).some(o => +o > 255)) {
            this.print(`Die Ping-Anforderung konnte Host "${target}" nicht finden. Überprüfen Sie den Namen,\nund versuchen Sie es erneut.\n`);
            return;
        }
        const ip = ipv4.slice(1).map(Number).join('.');
        const linked1 = this.isLinked(1), linked2 = this.isLinked(2);
        let mode;
        if (ip.startsWith('127.')) mode = 'ok';
        else if (!linked1) mode = 'general';
        else if (ip === IP[1]) mode = 'ok';
        else if (ip === IP[2]) mode = linked2 ? 'ok' : 'unreach';
        else if (ip.startsWith('192.168.1.')) mode = 'unreach';
        else mode = 'general';

        this.pinging = true;
        this.refresh();
        this.print(`\nPing wird ausgeführt für ${ip} mit 32 Bytes Daten:`);
        const times = [];
        let i = 0;
        const step = () => {
            if (this.disposed) return;
            if (i < count) {
                if (mode === 'ok') {
                    const t = Math.random() < 0.7 ? 0 : 1;
                    times.push(t);
                    this.print(`Antwort von ${ip.startsWith('127.') ? '127.0.0.1' : ip}: Bytes=32 Zeit${t === 0 ? '<1ms' : '=1ms'} TTL=128`);
                } else if (mode === 'unreach') {
                    this.print(`Antwort von ${IP[1]}: Zielhost nicht erreichbar.`);
                } else {
                    this.print('PING: Fehler bei der Übertragung. Allgemeiner Fehler.');
                }
                i++;
                this.pingTimer = setTimeout(step, 620);
                return;
            }
            const recv = mode === 'general' ? 0 : count;
            const lost = count - recv;
            let s = `\nPing-Statistik für ${ip}:\n    Pakete: Gesendet = ${count}, Empfangen = ${recv}, Verloren = ${lost}\n    (${Math.round(lost / count * 100)}% Verlust),`;
            if (mode === 'ok') s += `\nCa. Zeitangaben in Millisek.:\n    Minimum = ${Math.min(...times)}ms, Maximum = ${Math.max(...times)}ms, Mittelwert = ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms`;
            this.print(s + '\n');
            this.pinging = false;
            if (mode === 'ok' && ip === IP[2]) {
                this.term.arp = true;
                this.pingSuccess();
            } else if (ip === IP[2]) {
                this.explainFailure(mode);
            }
            this.refresh();
        };
        this.pingTimer = setTimeout(step, 450);
    }

    explainFailure(mode) {
        if (mode === 'general') this.toast('<strong>„Allgemeiner Fehler“</strong>: PC 1 hat selbst keine Netzwerkverbindung – ist sein Patchkabel gesteckt?', 'warn', 5200);
        else this.toast('<strong>„Zielhost nicht erreichbar“</strong>: PC 1 ist im Netz, aber PC 2 antwortet nicht – ist PC 2 angeschlossen?', 'warn', 5200);
    }

    pingSuccess() {
        if (this.pingOk) return;
        this.pingOk = true;
        this.done = true;
        this.toast('ping erfolgreich: 4 Echo-Replies von PC 2 – die Strecke steht!', 'success', 3500);
        this.drawScreens();
        this.engine.later(() => this.finishLevel(), 2600);
    }

    finishLevel() {
        const t = this.ctx.elapsed();
        const timePen = -this.timePenalty(t, [[120, 0], [180, 5], [300, 10], [99999, 15]]);
        const breakdown = [
            { label: 'Beide PCs korrekt angeschlossen & ping erfolgreich', points: 0, value: '100' },
            { label: `Zeit (${formatTime(t)})`, points: timePen, value: fmtPts(timePen), kind: timePen ? 'minus' : '' },
            { label: `Falsche Dose (${this.mistakes}×)`, points: -5 * this.mistakes, value: fmtPts(-5 * this.mistakes), kind: this.mistakes ? 'minus' : '' }
        ];
        const score = this.scoreResult({ breakdown });
        const prog = { ...this.ctx.progress() };
        const prevBest = prog[4];
        if (!prevBest || score > prevBest.score) prog[4] = { score, stars: score >= 90 ? 3 : score >= 70 ? 2 : 1, time: Math.round(t) };
        const rows = LEVELS.map(l => {
            const p = prog[l.id];
            return `<tr><td>${l.id}. ${l.title}</td><td>${p ? '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : '–'}</td><td>${p ? p.score : '–'}</td></tr>`;
        }).join('');
        const total = LEVELS.reduce((s, l) => s + (prog[l.id]?.score || 0), 0);
        const allDone = LEVELS.every(l => prog[l.id]);
        this.ctx.finish({
            success: true, score, time: t,
            title: allDone ? 'Alle Stationen gemeistert!' : 'Netzwerk steht – ping erfolgreich!',
            subtitle: 'PC 1 erreicht PC 2 über die komplette strukturierte Verkabelung.',
            stats: [
                { label: 'Punkte', value: score },
                { label: 'Zeit', value: formatTime(t) },
                { label: 'Fehler', value: this.mistakes }
            ],
            sections: [
                { title: 'Die komplette Übertragungsstrecke', icon: 'network', html: pathDiagram() },
                { title: 'Deine Stationen', icon: 'trophy', html: `<table class="summary-table"><thead><tr><th>Station</th><th>Sterne</th><th>Punkte</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>Gesamt</td><td></td><td>${total} / 400</td></tr></tfoot></table>${allDone ? '' : '<p class="small muted" style="margin:0.6rem 0 0">Spiele die fehlenden Stationen, um die Gesamtwertung zu vervollständigen.</p>'}` }
            ],
            breakdown,
            actions: [
                { label: 'Nochmal', action: 'retry', icon: 'restart' },
                { label: 'Zur Übersicht', action: 'menu', icon: 'grid', primary: true }
            ]
        });
    }

    // ------------------------------------------------------------
    // UI
    // ------------------------------------------------------------

    steps() {
        return [
            { text: 'PC 1 → <strong>DD1-1</strong> verbinden', meta: this.isLinked(1) ? 'Link ●' : this.pending && (this.pending.pc === 1 || this.pending.jack === 'DD1-1') ? 'ein Ende steckt' : '', done: this.isLinked(1) },
            { text: 'PC 2 → <strong>DD2-1</strong> verbinden', meta: this.isLinked(2) ? 'Link ●' : this.pending && (this.pending.pc === 2 || this.pending.jack === 'DD2-1') ? 'ein Ende steckt' : '', done: this.isLinked(2) },
            { text: 'Auf PC 1: <code>ping 192.168.1.2</code>', done: this.pingOk }
        ];
    }

    objective() {
        if (this.done) return 'Geschafft!';
        if (this.pending?.pc) return `Stecke das andere Ende in die Dose <strong>DD${this.pending.pc}-1</strong> im Brüstungskanal.`;
        if (this.pending?.jack) return `Stecke das andere Ende in den LAN-Port von <strong>PC ${this.pending.jack === 'DD1-1' ? 1 : 2}</strong>.`;
        const next = [1, 2].find(k => !this.isLinked(k));
        if (next && this.hand) return `${this.ctx.tap()} den <strong>LAN-Port</strong> auf der Rückseite von PC ${next}.`;
        if (next) return `${this.ctx.tap()} ein <strong>Patchkabel</strong> auf dem Schreibtisch, um PC ${next} anzuschließen.`;
        if (this.pinging) return 'ping läuft …';
        return this.term.open ? 'Tippe <code>ping 192.168.1.2</code> und drücke Enter.' : `${this.ctx.tap()} den Bildschirm von PC 1, um die Eingabeaufforderung zu öffnen.`;
    }

    hints() {
        if (this.done) return [];
        if (this.pending?.pc) return [this.jacks[`DD${this.pending.pc}-1`].group];
        if (this.pending?.jack) return [this.pcs[this.pending.jack === 'DD1-1' ? 1 : 2].lanGroup];
        const next = [1, 2].find(k => !this.isLinked(k));
        if (next && this.hand) return [this.pcs[next].lanGroup];
        if (next) return this.coils.filter(c => c.visible);
        if (!this.term.open && !this.pinging) return [this.pcs[1].mon.group];
        return [];
    }

    renderControls(el) {
        const row = (k) => {
            const l = this.links[k];
            const half = this.pending && (this.pending.pc === k || this.pending.jack === `DD${k}-1`);
            return `<div class="status-row ${l ? 'ok' : half ? 'half' : ''}">${icon('monitor')}
                <div><strong>PC ${k}</strong> → DD${k}-1<small>${IP[k]} / 24</small></div>
                <span class="st">${l ? 'Link ●' : half ? 'halb gesteckt' : 'getrennt'}</span></div>`;
        };
        el.innerHTML = `
            <h3 class="card-title">Anschlüsse <span class="count">${[1, 2].filter(k => this.isLinked(k)).length}/2</span></h3>
            <div class="status-rows">${row(1)}${row(2)}
                <div class="status-row ${this.pingOk ? 'ok' : ''}">${icon('terminal')}<div><strong>ping</strong> PC 1 → PC 2<small>ICMP Echo Request / Reply</small></div><span class="st">${this.pingOk ? 'erfolgreich' : this.pinging ? 'läuft …' : 'ausstehend'}</span></div>
            </div>
            <div class="hand ${this.hand ? 'on' : ''}">${icon('cable')} ${this.hand ? (this.pending ? 'Ein Ende steckt – das andere Ende ist in deiner Hand' : 'Patchkabel in der Hand') : 'Kein Patchkabel in der Hand'}</div>
            <button class="btn ${this.isLinked(1) && this.isLinked(2) && !this.term.open ? 'btn-primary' : 'btn-ghost'} btn-block" type="button" id="l4-term" style="margin-top:0.7rem">${icon('terminal')} Eingabeaufforderung (PC 1)</button>`;
        el.querySelector('#l4-term').addEventListener('click', () => (this.term.open ? $('#term-input').focus() : this.openTerminal()));
    }

    actions() {
        return {
            undo: { label: this.pending ? 'Stecker ziehen' : 'Kabel entfernen', enabled: !this.done && !this.pinging && (!!this.pending || this.history.length > 0) },
            check: null
        };
    }
}

function pathDiagram() {
    const node = (x, y, w, title, sub, color) => `
        <g transform="translate(${x},${y})">
            <rect width="${w}" height="46" rx="10" fill="#131d35" stroke="${color}" stroke-width="1.5"/>
            <text x="${w / 2}" y="20" text-anchor="middle" fill="#e7edf7" font-size="13" font-weight="700">${title}</text>
            <text x="${w / 2}" y="36" text-anchor="middle" fill="#93a1b8" font-size="10.5">${sub}</text>
        </g>`;
    const seg = (x1, x2, y, color, label, dash = '') => `
        <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="4" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>
        <text x="${(x1 + x2) / 2}" y="${y - 9}" text-anchor="middle" fill="#b6c2d6" font-size="10">${label}</text>`;
    return `<svg class="path-diagram" viewBox="0 0 720 262" role="img" aria-label="Übertragungsstrecke">
        <style>text{font-family:Inter,'Segoe UI',system-ui,sans-serif}</style>
        ${seg(92, 150, 45, '#3b73d9', 'Patchkabel')}
        ${seg(236, 330, 45, '#ee7a16', 'Verlegekabel ≤ 90 m')}
        ${seg(416, 500, 45, '#2f6fe0', 'Patchkabel')}
        ${seg(92, 150, 175, '#3b73d9', 'Patchkabel')}
        ${seg(236, 330, 175, '#e3c01e', 'Verlegekabel ≤ 90 m')}
        ${seg(416, 500, 175, '#2f6fe0', 'Patchkabel')}
        <path d="M586 68 L618 100 M586 152 L618 124" stroke="#4f8cff" stroke-width="3" fill="none"/>
        ${node(6, 22, 86, 'PC 1', '192.168.1.1', '#3b82f6')}
        ${node(150, 22, 86, 'DD1-1', 'Station 1 + 2', '#ee7a16')}
        ${node(330, 22, 86, 'PP-Port 1', 'Station 3', '#94a3b8')}
        ${node(500, 22, 86, 'SW Port 1', 'Büro 1', '#2f6fe0')}
        ${node(6, 152, 86, 'PC 2', '192.168.1.2', '#22c55e')}
        ${node(150, 152, 86, 'DD2-1', 'Büro 1', '#e3c01e')}
        ${node(330, 152, 86, 'PP-Port 3', 'Station 3', '#94a3b8')}
        ${node(500, 152, 86, 'SW Port 3', 'Büro 1', '#2f6fe0')}
        ${node(612, 89, 102, 'Switch Büro 1', 'Frames per MAC', '#4f8cff')}
        <text x="300" y="118" text-anchor="middle" fill="#93a1b8" font-size="11">Channel (gesamte Strecke je PC) ≤ 100 m</text>
        <text x="360" y="252" text-anchor="middle" fill="#93a1b8" font-size="11">Link-LEDs an PC &amp; Switch leuchten = Schicht 1 ok · ping erfolgreich = Schicht 3 ok</text>
    </svg>`;
}
