// ============================================================
// Station 1: Verlegekabel im Brüstungskanal verlegen (Meter)
// ============================================================

import * as THREE from 'three';
import { BaseLevel, fmtPts } from './base.js';
import {
    V, at, box, rbox, cyl, hitbox, buildRoom, buildDuct, ductCover, cableMesh,
    setTubeProgress, schukoOutlet, windowPanel, ceilingLight, plant, cableCurve
} from '../models.js';
import { std, parquetTexture, printedJacket, makeCanvas, canvasTexture } from '../materials.js';
import { makeLabel, makeTextPlane } from '../labels.js';
import { Ease } from '../engine.js';
import { icon } from '../icons.js';

const X0 = -0.8, X1 = 0.7;                // Kanal-Enden (linkes Ende an der Wand)
const DY = 0.95, DH = 0.13, DD = 0.065;   // Mittelhöhe, Höhe, Tiefe
const LOW_Y = DY - 0.034;                 // Mitte der unteren (Daten-)Kammer
const CZ = 0.025;                         // Kabellage in der Kammer
const R = 0.0037;                         // Kabelradius (≈ 7,5 mm Ø)
const CLIPS_X = [-0.64, -0.43, -0.22, -0.01, 0.2, 0.4];
const DD1_X = 0.548, SCHUKO_X = 0.645, COVER_END = 0.5;
const ORANGE = '#ee7a16';
const PRINT = 'S/FTP CAT.7  4x2xAWG23/1  1000 MHz  LSZH  ·  NetzWerk-Lab  ·  0412 m  ·  ';

export class Level1 extends BaseLevel {
    build() {
        const e = this.engine;
        this.placed = 0;
        this.holding = false;
        this.coverClosed = false;
        this.busy = false;
        this.mistakes = { chamber: 0, order: 0 };
        this.clips = [];

        this.lights({
            hemi: 0.34, env: 0.36,
            sun: { position: [1.6, 2.6, 2.6], target: [0, 0.6, 0.1], intensity: 1.75, size: 1.5, color: '#fff3e0' }
        });

        // Raum
        const room = buildRoom({ width: 4.4, depth: 4.2, height: 2.7, floorMap: parquetTexture(), floorRepeat: [4, 4], wallColor: '#e2dccf' });
        room.position.x = 1.4;
        this.add(room);
        const win = windowPanel({ w: 1.1, h: 1.3 });
        win.position.set(2.1, 1.55, 0.001);
        this.add(win);
        for (const [x, z] of [[0, 1.2], [1.8, 1.2]]) this.add(at(ceilingLight(), x, 2.69, z));
        this.add(at(plant(0.9), 1.3, 0, 0.35));
        this.buildProps();

        // Kanal
        const duct = buildDuct({ length: X1 - X0, height: DH, depth: DD, capLeft: false, capRight: true });
        duct.group.position.set(X0, DY, 0);
        this.add(duct.group);
        this.buildWallHole();
        this.buildPowerLine();
        this.buildCarrier();
        this.buildClips();

        // Obere Kammer als "falsche" Zielfläche
        this.upper = hitbox(X1 - X0, 0.058, 0.06);
        this.upper.position.set((X0 + X1) / 2, DY + 0.033, 0.032);
        this.upper.userData.kind = 'upper';
        this.add(this.upper);
        e.addPickable(this.upper, {
            tooltip: '<strong>Obere Kammer</strong><span class="tt-sub">230-V-Leitung NYM-J 3×1,5 mm²</span>'
        });

        // Kabel: Ring am Boden + loses Stück
        this.coil = this.buildCoil();
        this.coil.position.set(-0.52, 0, 0.36);
        this.coil.userData.kind = 'coil';
        this.add(this.coil);
        e.addPickable(this.coil, {
            tooltip: () => this.holding
                ? '<strong>Kabelring</strong><span class="tt-sub">wird beim Verlegen nachgezogen</span>'
                : '<strong>Verlegekabel S/FTP Cat.7</strong><span class="tt-sub">aufnehmen</span>'
        });
        this.laid = null;
        this.loose = null;
        this.endCap = new THREE.Mesh(new THREE.SphereGeometry(R, 12, 8), std(ORANGE, 0.5));
        this.endCap.visible = false;
        this.add(this.endCap);
        this.rebuildCable(false);

        // Deckel (Oberteil) liegt vor der Wand auf dem Boden
        this.cover = ductCover({ length: COVER_END - X0, height: DH });
        this.cover.userData.kind = 'cover';
        this.coverStart = { pos: V(X0 + 0.05, 0.0026, 0.62), rotX: -Math.PI / 2, rotY: 0.035 };
        this.cover.position.copy(this.coverStart.pos);
        this.cover.rotation.set(this.coverStart.rotX, this.coverStart.rotY, 0);
        const coverHit = hitbox(COVER_END - X0, 0.012, DH + 0.02);
        coverHit.position.set((COVER_END - X0) / 2, 0.0, 0.0);
        coverHit.rotation.x = Math.PI / 2;
        this.cover.add(coverHit);
        this.add(this.cover);
        e.addPickable(this.cover, {
            tooltip: () => this.placed < 6
                ? '<strong>Kanal-Oberteil</strong><span class="tt-sub">erst nach dem Verlegen aufsetzen</span>'
                : '<strong>Kanal-Oberteil</strong><span class="tt-sub">jetzt aufsetzen</span>',
            enabled: () => !this.coverClosed
        });

        // Beschriftungen
        this.add(at(makeLabel('Wanddurchbruch', { height: 0.036, sub: 'vom Technikraum', accent: ORANGE }), X0 + 0.14, DY - 0.16, 0.08));
        this.add(at(makeLabel('Kanal-Oberteil', { height: 0.034, sub: 'Deckel' }), X0 + 0.65, 0.07, 0.75));

        e.configureControls({ minDistance: 0.25, maxDistance: 3.4, maxPolarAngle: 1.5, minAzimuthAngle: -1.15, maxAzimuthAngle: 1.15 });
        const home = { position: V(0.02, 1.3, 1.8), target: V(-0.04, 0.6, 0.12) };
        e.setHome(home);
        e.setView(home);
        e.optimizeShadows(0.012);
    }

    // ------------------------------------------------------------
    // Szenenaufbau
    // ------------------------------------------------------------

    buildProps() {
        // Kabelkarton & Werkzeugkoffer
        const [c, ctx] = makeCanvas(512, 256);
        ctx.fillStyle = '#b98a57'; ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = '#1f2937'; ctx.font = '800 54px Arial'; ctx.fillText('CAT.7 S/FTP', 34, 96);
        ctx.font = '600 30px Arial'; ctx.fillText('Verlegekabel · 500 m', 36, 150);
        ctx.fillStyle = ORANGE; ctx.fillRect(34, 180, 440, 26);
        const cardboard = std('#b98a57', 0.9);
        const printed = std('#ffffff', 0.9, 0, { map: canvasTexture(c, { wrap: false }) });
        const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), [cardboard, cardboard, cardboard, cardboard, printed, cardboard]);
        boxMesh.castShadow = boxMesh.receiveShadow = true;
        boxMesh.position.set(1.0, 0.21, 0.3);
        boxMesh.rotation.y = -0.25;
        this.add(boxMesh);

        const kit = new THREE.Group();
        at(rbox(0.46, 0.14, 0.32, 0.02, std('#c0262d', 0.45)), 0, 0.07, 0, kit);
        at(rbox(0.47, 0.02, 0.33, 0.008, std('#1f2328', 0.5)), 0, 0.14, 0, kit);
        const handle = at(rbox(0.16, 0.025, 0.03, 0.01, std('#1f2328', 0.5)), 0, 0.17, 0, kit);
        handle.castShadow = true;
        kit.position.set(0.35, 0, 0.62);
        kit.rotation.y = 0.35;
        this.add(kit);
    }

    buildWallHole() {
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.016, 32), std('#15171a', 0.95));
        hole.rotation.y = Math.PI / 2;
        hole.position.set(X0 + 0.0015, LOW_Y, CZ);
        this.add(hole);
        const sleeve = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 10, 32), std('#9ca3af', 0.5));
        sleeve.rotation.y = Math.PI / 2;
        sleeve.position.set(X0 + 0.002, LOW_Y, CZ);
        this.add(sleeve);
    }

    buildPowerLine() {
        const grey = std('#a3a8ae', 0.55);
        const pts = [V(X0, DY + 0.03, 0.022), V(0.3, DY + 0.03, 0.022), V(0.52, DY + 0.028, 0.024), V(0.6, DY + 0.02, 0.034), V(SCHUKO_X - 0.02, DY + 0.006, 0.05)];
        this.add(cableMesh(pts, 0.0048, grey));
        for (const x of [-0.55, -0.1, 0.35]) {
            at(rbox(0.014, 0.016, 0.03, 0.002, std('#c9ccd1', 0.5)), x, DY + 0.03, 0.016, this.engine.world);
        }
        // Warnaufkleber
        const [c, ctx] = makeCanvas(256, 96);
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.roundRect(0, 0, 256, 96, 12); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(48, 14); ctx.lineTo(86, 82); ctx.lineTo(10, 82); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(52, 34); ctx.lineTo(40, 58); ctx.lineTo(50, 58); ctx.lineTo(44, 76); ctx.lineTo(60, 50); ctx.lineTo(50, 50); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#111'; ctx.font = '800 44px Arial'; ctx.textBaseline = 'middle'; ctx.fillText('230 V', 100, 50);
        const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.028), std('#ffffff', 0.4, 0, { map: canvasTexture(c, { wrap: false }), polygonOffset: true, polygonOffsetFactor: -2 }));
        sticker.position.set(-0.32, DY + 0.042, 0.0027);
        this.add(sticker);
    }

    buildCarrier() {
        const white = std('#f4f2ec', 0.38);
        at(rbox(X1 - COVER_END - 0.004, DH - 0.002, 0.004, 0.0015, white), (COVER_END + X1) / 2, DY, DD + 0.002, this.engine.world);
        const cut = at(rbox(0.05, 0.05, 0.002, 0.004, std('#1b1e24', 0.9)), DD1_X, DY, DD + 0.0045, this.engine.world);
        cut.castShadow = false;
        const tag = makeTextPlane('DD1', { width: 0.032, height: 0.012, fg: '#1f2937', bg: '#ffffff', fontScale: 0.8 });
        at(tag, DD1_X, DY + 0.042, DD + 0.0048, this.engine.world);
        const schuko = schukoOutlet();
        schuko.position.set(SCHUKO_X, DY, DD + 0.004);
        this.add(schuko);
        this.add(at(makeLabel('Aussparung für Netzwerkdose DD1', { height: 0.03 }), DD1_X, DY + 0.1, DD + 0.02));
    }

    buildClips() {
        const plastic = std('#d9dce1', 0.45);
        CLIPS_X.forEach((x, i) => {
            const g = new THREE.Group();
            at(box(0.018, 0.05, 0.003, plastic), 0, 0, 0.004, g);
            at(rbox(0.018, 0.005, 0.034, 0.0015, plastic), 0, 0.0098, 0.019, g);
            at(rbox(0.018, 0.005, 0.034, 0.0015, plastic), 0, -0.0098, 0.019, g);
            at(rbox(0.018, 0.0045, 0.005, 0.0015, plastic), 0, 0.0062, 0.034, g);
            at(rbox(0.018, 0.0045, 0.005, 0.0015, plastic), 0, -0.0062, 0.034, g);
            const hit = hitbox(0.07, 0.062, 0.075);
            hit.position.z = 0.03;
            g.add(hit);
            g.position.set(x, LOW_Y, 0);
            g.userData = { kind: 'clip', index: i };
            this.add(g);
            this.engine.addPickable(g, {
                tooltip: () => i < this.placed
                    ? `<strong>Halteklammer ${i + 1}</strong><span class="tt-sub tt-ok">Kabel liegt drin</span>`
                    : `<strong>Halteklammer ${i + 1}</strong><span class="tt-sub">untere Kammer (Daten)</span>`
            });
            const num = makeLabel(String(i + 1), { height: 0.028, padX: 16, padY: 8, radius: 18 });
            const numDone = makeLabel(String(i + 1), { height: 0.028, padX: 16, padY: 8, radius: 18, bg: 'rgba(22, 120, 78, 0.92)' });
            num.position.set(x, DY - 0.1, DD + 0.02);
            numDone.position.copy(num.position);
            numDone.visible = false;
            this.add(num, numDone);
            this.clips.push({ group: g, num, numDone });
        });
    }

    buildCoil() {
        const g = new THREE.Group();
        const pts = [];
        const r = 0.14, loops = 3.2;
        for (let i = 0; i <= 140; i++) {
            const t = i / 140;
            const a = Math.PI + t * loops * Math.PI * 2;
            const rr = r * (1 - 0.1 * t) + Math.sin(a * 3) * 0.004;
            pts.push(V(Math.cos(a) * rr, R + 0.026 - t * 0.022, Math.sin(a) * rr * 0.9));
        }
        const curve = cableCurve(pts);
        g.add(cableMesh(curve, R, printedJacket(ORANGE, PRINT, curve.getLength())));
        const hit = hitbox(0.34, 0.08, 0.3);
        hit.position.y = 0.03;
        g.add(hit);
        g.userData.start = pts[0].clone();
        return g;
    }

    // ------------------------------------------------------------
    // Kabelgeometrie
    // ------------------------------------------------------------

    laidPoints(n) {
        const pts = [V(X0 - 0.02, LOW_Y, CZ), V(X0 + 0.03, LOW_Y, CZ)];
        for (let i = 0; i < n; i++) pts.push(V(CLIPS_X[i], LOW_Y, CZ - 0.001));
        return pts;
    }

    loosePoints(start, coilStart) {
        const s = start.clone();
        return [
            s,
            V(s.x + 0.05, s.y - 0.006, 0.05),
            V(s.x + 0.09, s.y - 0.1, 0.12),
            V((s.x + coilStart.x) / 2 + 0.05, 0.28, (0.12 + coilStart.z) / 2 + 0.06),
            V(coilStart.x - 0.03, coilStart.y + 0.03, coilStart.z - 0.03),
            coilStart
        ];
    }

    endPoints() {
        const s = V(CLIPS_X[5], LOW_Y, CZ - 0.001);
        return [
            s,
            V(0.46, LOW_Y, CZ),
            V(0.515, LOW_Y + 0.006, 0.03),
            V(DD1_X, DY - 0.006, 0.058),
            V(DD1_X + 0.004, DY - 0.018, 0.1),
            V(DD1_X + 0.012, DY - 0.07, 0.125),
            V(DD1_X + 0.018, DY - 0.13, 0.118)
        ];
    }

    replaceMesh(key, mesh) {
        const old = this[key];
        if (old) {
            old.removeFromParent();
            old.geometry.dispose();
            old.material.map?.dispose();
            old.material.dispose();
        }
        this[key] = mesh;
        if (mesh) this.add(mesh);
    }

    jacketMesh(points) {
        const curve = cableCurve(points);
        return cableMesh(curve, R, printedJacket(ORANGE, PRINT, curve.getLength()));
    }

    rebuildLoose() {
        const coilStart = this.coil.userData.start.clone().add(this.coil.position);
        const start = this.placed === 0 ? V(X0 + 0.03, LOW_Y, CZ) : V(CLIPS_X[this.placed - 1], LOW_Y, CZ - 0.001);
        const pts = this.placed === 0
            ? [V(X0 - 0.02, LOW_Y, CZ), V(X0 + 0.04, LOW_Y - 0.005, CZ + 0.02), V(X0 + 0.07, LOW_Y - 0.08, 0.1), V(coilStart.x - 0.12, 0.22, 0.25), V(coilStart.x - 0.03, coilStart.y + 0.03, coilStart.z - 0.03), coilStart]
            : this.loosePoints(start, coilStart);
        this.replaceMesh('loose', this.jacketMesh(pts));
    }

    rebuildCable(animate = true) {
        const n = this.placed;
        const prevLen = this.laid ? this.laid.userData.length : 0;
        if (n > 0) {
            const mesh = this.jacketMesh(this.laidPoints(n));
            this.replaceMesh('laid', mesh);
            if (animate && prevLen < mesh.userData.length) {
                const from = prevLen / mesh.userData.length;
                setTubeProgress(mesh, from);
                this.engine.tween({ duration: 0.45, ease: Ease.outCubic, onUpdate: k => setTubeProgress(mesh, from + (1 - from) * k) });
            }
        } else {
            this.replaceMesh('laid', null);
        }
        if (n < 6) {
            this.coil.visible = true;
            this.endCap.visible = false;
            this.rebuildLoose();
        } else {
            this.replaceMesh('loose', this.jacketMesh(this.endPoints()));
            const end = this.endPoints().at(-1);
            this.endCap.position.copy(end);
            this.endCap.visible = true;
        }
    }

    moveCoilTo(x, z) {
        const from = this.coil.position.clone();
        const to = V(x, 0, z);
        this.engine.tween({
            duration: 0.45, ease: Ease.inOutSine,
            onUpdate: k => {
                this.coil.position.lerpVectors(from, to, k);
                this.coil.position.y = Math.sin(k * Math.PI) * 0.03;
                if (this.placed < 6) this.rebuildLoose();
            }
        });
    }

    // ------------------------------------------------------------
    // Interaktion
    // ------------------------------------------------------------

    onPick(obj) {
        if (!obj || this.busy) return;
        const kind = obj.userData.kind;
        if (kind === 'coil') return this.pickUp();
        if (kind === 'clip') return this.placeClip(obj.userData.index);
        if (kind === 'upper') return this.wrongChamber();
        if (kind === 'cover') return this.onCheck();
    }

    pickUp() {
        if (this.holding) {
            this.toast(`Du hast das Kabel schon in der Hand – ${this.ctx.tap(true)} jetzt Halteklammer ${this.placed + 1}.`, 'info');
            return;
        }
        this.holding = true;
        this.moveCoilTo(-0.46, 0.34);
        this.toast('Kabel aufgenommen. Drücke es jetzt in die Halteklammern – aber in welche Kammer?', 'success');
        this.refresh();
    }

    wrongChamber() {
        if (this.placed >= 6) return;
        if (!this.holding) {
            this.toast('In der oberen Kammer verläuft die 230-V-Stromleitung (NYM-J 3×1,5 mm²).', 'info');
            return;
        }
        this.mistakes.chamber++;
        this.toast('<strong>Stopp!</strong> Oben liegt die 230-V-Leitung. Datenkabel gehören in die <strong>untere Kammer</strong> – getrennt durch den Trennsteg (EMV, DIN EN 50174-2). −10 P', 'error', 5600);
        this.refresh();
    }

    placeClip(i) {
        if (this.coverClosed) return;
        if (!this.holding) {
            this.toast('Nimm zuerst das Kabel am Wanddurchbruch auf (Kabelring am Boden).', 'warn');
            return;
        }
        if (i < this.placed) {
            this.toast(`In Klammer ${i + 1} liegt das Kabel bereits.`, 'info');
            return;
        }
        if (i > this.placed) {
            this.mistakes.order++;
            this.toast(`Nicht auslassen! Das Kabel muss lückenlos in allen Klammern liegen – als Nächstes Klammer ${this.placed + 1}. −3 P`, 'warn', 4200);
            this.refresh();
            return;
        }
        this.placed++;
        const c = this.clips[i];
        c.num.visible = false;
        c.numDone.visible = true;
        this.rebuildCable(true);
        if (this.placed < 6) {
            this.moveCoilTo(CLIPS_X[i] + 0.2, 0.34);
            this.toast(`Klammer ${this.placed} von 6 ✔`, 'success', 1600);
        } else {
            this.holding = false;
            this.coil.visible = false;
            this.toast('Kabel liegt in allen Klammern – mit Servicereserve an der Dose. Setze jetzt das Kanal-Oberteil auf!', 'success', 4200);
        }
        this.refresh();
    }

    onUndo() {
        if (this.busy || this.coverClosed || this.placed === 0) return;
        this.placed--;
        const c = this.clips[this.placed];
        c.num.visible = true;
        c.numDone.visible = false;
        this.holding = true;
        this.coil.visible = true;
        this.coil.position.set(this.placed > 0 ? CLIPS_X[this.placed - 1] + 0.2 : -0.46, 0, 0.34);
        this.rebuildCable(false);
        this.toast(`Kabel aus Klammer ${this.placed + 1} gelöst.`, 'info', 1800);
        this.refresh();
    }

    async onCheck() {
        if (this.coverClosed || this.busy) return;
        if (this.placed < 6) {
            this.toast('Erst das Kabel vollständig in alle 6 Klammern drücken, dann das Oberteil aufsetzen.', 'warn');
            return;
        }
        this.busy = true;
        this.coverClosed = true;
        this.engine.removePickable(this.cover);
        this.refresh();
        const e = this.engine;
        e.flyTo(V(0.05, 1.2, 1.5), V(-0.05, 0.82, 0.05), { duration: 1.2 });
        const p0 = this.coverStart.pos.clone();
        const p1 = V(X0, DY, DD);
        const ok = await e.tween({
            duration: 1.3, ease: Ease.inOutCubic,
            onUpdate: k => {
                this.cover.position.lerpVectors(p0, p1, k);
                this.cover.position.y += Math.sin(k * Math.PI) * 0.35;
                this.cover.position.z += Math.sin(k * Math.PI) * 0.15;
                this.cover.rotation.x = this.coverStart.rotX * (1 - k);
                this.cover.rotation.y = this.coverStart.rotY * (1 - k);
            }
        }).done;
        if (!ok || !this.alive) return;
        // "Klick" beim Einrasten
        await e.tween({ duration: 0.12, onUpdate: k => { this.cover.position.z = DD + 0.004 * Math.sin(k * Math.PI); } }).done;
        if (!this.alive) return;
        this.clips.forEach(c => { c.numDone.visible = false; });
        this.toast('Klick! Das Oberteil ist eingerastet.', 'success', 2000);
        e.later(() => this.finishLevel(), 900);
    }

    finishLevel() {
        const t = this.ctx.elapsed();
        const timePen = -this.timePenalty(t, [[60, 0], [90, 5], [150, 10], [9999, 15]]);
        const breakdown = [
            { label: 'Kabel korrekt in der Datenkammer verlegt', points: 0, value: '100' },
            { label: `Zeit (${Math.round(t)} s)`, points: timePen, value: fmtPts(timePen), kind: timePen < 0 ? 'minus' : '' },
            { label: `Falsche Kammer (${this.mistakes.chamber}×)`, points: -10 * this.mistakes.chamber, value: fmtPts(-10 * this.mistakes.chamber), kind: this.mistakes.chamber ? 'minus' : '' },
            { label: `Klammer übersprungen (${this.mistakes.order}×)`, points: -3 * this.mistakes.order, value: fmtPts(-3 * this.mistakes.order), kind: this.mistakes.order ? 'minus' : '' }
        ];
        const score = this.scoreResult({ breakdown });
        const errors = this.mistakes.chamber + this.mistakes.order;
        this.ctx.finish({
            success: true,
            score,
            time: t,
            title: 'Kabel sauber verlegt!',
            subtitle: 'Das Verlegekabel liegt getrennt von der 230-V-Leitung in der Datenkammer – mit Reserve für die Dose DD1.',
            stats: [
                { label: 'Punkte', value: score },
                { label: 'Zeit', value: `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` },
                { label: 'Fehler', value: errors }
            ],
            breakdown,
            actions: [
                { label: 'Nochmal', action: 'retry', icon: 'restart' },
                { label: 'Weiter zu Station 2', action: 'next', icon: 'arrowRight', primary: true }
            ]
        });
    }

    // ------------------------------------------------------------
    // UI
    // ------------------------------------------------------------

    steps() {
        return [
            { text: 'Kabel am Wanddurchbruch aufnehmen', done: this.holding || this.placed > 0 },
            { text: 'Richtige Kammer wählen & Kabel in die Klammern 1 → 6 drücken', meta: `${this.placed}/6 Klammern`, done: this.placed === 6 },
            { text: 'Kanal-Oberteil aufsetzen', done: this.coverClosed }
        ];
    }

    objective() {
        if (!this.holding && this.placed === 0) return `${this.ctx.tap()} den orangefarbenen Kabelring am Boden, um das Verlegekabel aufzunehmen.`;
        if (this.placed === 0) return 'Welche Kammer ist für Daten? Drücke das Kabel in <strong>Halteklammer 1</strong>.';
        if (this.placed < 6) return `Drücke das Kabel in <strong>Halteklammer ${this.placed + 1}</strong>.`;
        if (!this.coverClosed) return `${this.ctx.tap()} das Kanal-Oberteil am Boden, um den Kanal zu schließen.`;
        return 'Geschafft!';
    }

    hints() {
        if (!this.holding && this.placed === 0) return [this.coil];
        if (this.placed < 6) return this.placed === 0 && this.mistakes.chamber === 0 ? [] : [this.clips[this.placed].group];
        if (!this.coverClosed) return [this.cover];
        return [];
    }

    renderControls(el) {
        const dataCls = this.placed ? 'data' : 'data empty';
        el.innerHTML = `
            <h3 class="card-title">Brüstungskanal <span class="count">Querschnitt</span></h3>
            <div class="duct-diagram">
                <div class="chamber power"><span>${icon('zap')}</span>230 V <i></i></div>
                <div class="sep"></div>
                <div class="chamber ${dataCls}"><span>${icon('cable')}</span>Daten <i></i></div>
            </div>
            <p class="small muted">Oben: Stromleitung · Trennsteg · Unten: Datenkabel</p>
            <h3 class="card-title" style="margin-top:0.9rem">Halteklammern <span class="count">${this.placed}/6</span></h3>
            <div class="clip-track">
                ${CLIPS_X.map((_, i) => `<span class="${i < this.placed ? 'done' : i === this.placed && this.holding ? 'next' : ''}">${i + 1}</span>`).join('')}
            </div>
            <div class="hand ${this.holding ? 'on' : ''}">${icon('coil')} ${this.holding ? 'Verlegekabel in der Hand' : this.placed === 6 ? 'Kabel verlegt' : 'Hände frei'}</div>
            ${!this.holding && this.placed === 0 ? `<button class="btn btn-ghost btn-block" type="button" id="l1-pick" style="margin-top:0.7rem">${icon('coil')} Kabel aufnehmen</button>` : ''}`;
        el.querySelector('#l1-pick')?.addEventListener('click', () => { if (this.ctx.playing) this.pickUp(); });
    }

    actions() {
        return {
            undo: { label: 'Klammer lösen', enabled: this.placed > 0 && !this.coverClosed },
            check: { label: 'Oberteil aufsetzen', icon: 'duct', enabled: this.placed === 6 && !this.coverClosed, pulse: true }
        };
    }
}
