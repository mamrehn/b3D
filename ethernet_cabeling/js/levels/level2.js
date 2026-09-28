// ============================================================
// Station 2: LSA-Klemmen der Doppeldose nach T568A auflegen
// Maßeinheit in dieser Szene: Zentimeter
// ============================================================

import * as THREE from 'three';
import { BaseLevel, fmtPts } from './base.js';
import {
    V, at, box, rbox, cyl, hitbox, cableMesh, cableCurve, setTubeProgress,
    twistedPairPoints, texRepeat
} from '../models.js';
import {
    std, MAT, woodTexture, cuttingMatTexture, printedJacket, wireMaterial,
    makeCanvas, canvasTexture, brushedTexture, paintTexture
} from '../materials.js';
import { makeLabel, makeTextPlane } from '../labels.js';
import { CORES, PAIRS, LSA_TERMINALS, coreForPin, coreSwatchCss } from '../data.js';
import { Ease } from '../engine.js';
import { icon } from '../icons.js';
import { formatTime } from '../ui.js';

const MAT_Y = 0.1;
const BODY_TOP = 3.14;
const BLOCK_TOP = 3.94;
const TERM_TOP = 4.36;
const COL_OFF = [-0.825, -0.275, 0.275, 0.825];
const ROW_Z = { top: -0.55, bottom: 0.55 };
const BLOCK_X = { A: -1.5, B: 1.5 };
const WIRE_R = 0.075;
const JACKET_R = 0.38;
const ORANGE = '#ee7a16';
const PRINT = 'S/FTP CAT.7 4x2xAWG23/1 1000 MHz LSZH · ';
const PAIR_ORDER = [1, 2, 3, 4];

// Welche Klemmen gehören zu welchem Paar (fest durch das LSA-Layout)
const PAIR_TERMINALS = {
    2: { row: 'top', cols: [0, 1] },     // Orange: Pin 3/6
    1: { row: 'top', cols: [2, 3] },     // Blau:   Pin 4/5
    3: { row: 'bottom', cols: [0, 1] },  // Grün:   Pin 1/2
    4: { row: 'bottom', cols: [2, 3] }   // Braun:  Pin 7/8
};

function termPos(side, t) {
    return V(BLOCK_X[side] + COL_OFF[t.col], TERM_TOP, ROW_Z[t.row]);
}

export class Level2 extends BaseLevel {
    build() {
        const e = this.engine;
        this.assign = {};          // terminalKey → coreId (Port A / DD1-1)
        this.history = [];         // für Rückgängig
        this.selected = null;
        this.checks = 0;
        this.success = false;
        this.busy = false;
        this.badTerminals = new Set();
        this.terminals = { A: {}, B: {} };
        this.tails = {};
        this.wires = {};
        this.splits = { A: {}, B: {} };

        e.camera.near = 0.2;
        e.camera.far = 1500;
        e.camera.updateProjectionMatrix();
        this.lights({
            hemi: 0.55, env: 0.55, sky: '#f1f5ff', ground: '#5a4a3a',
            sun: { position: [18, 60, 34], target: [0, 0, 0], intensity: 2.3, size: 26, bias: -0.0003, normalBias: 0.04, color: '#fff7ea' }
        });
        this.buildWorkshop();
        this.buildSocket();
        this.buildCable('A');
        this.buildCable('B');
        this.buildTool();
        this.buildTester();
        this.buildCovers();

        this.add(at(makeLabel('DD1-1', { height: 0.62, sub: 'hier auflegen', accent: '#4f8cff', anchor: 'bottom' }), BLOCK_X.A, 6.1, -1.2));
        this.add(at(makeLabel('DD1-2', { height: 0.62, sub: 'Vorlage – fertig', accent: '#34d399', anchor: 'bottom' }), BLOCK_X.B, 6.1, -1.2));

        e.configureControls({ minDistance: 5, maxDistance: 70, maxPolarAngle: 1.42, minPolarAngle: 0.05 });
        const home = { position: V(0.4, 15.4, 12.6), target: V(-0.3, 3.0, 1.4) };
        e.setHome(home);
        e.setView(home);
        e.optimizeShadows(0.3);
    }

    // ------------------------------------------------------------
    // Werkstatt
    // ------------------------------------------------------------

    buildWorkshop() {
        const bench = rbox(150, 3, 72, 0.6, std('#ffffff', 0.6, 0, { map: texRepeat(woodTexture('#d6b98c'), 2, 1) }));
        bench.position.set(0, -1.5, 4);
        this.add(bench);
        const legMat = std('#3b4048', 0.5, 0.7);
        for (const [x, z] of [[-70, -28], [70, -28], [-70, 36], [70, 36]]) this.add(at(box(5, 72, 5, legMat), x, -39, z));
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), std('#8e949b', 0.85));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -75;
        floor.receiveShadow = true;
        this.add(floor);

        // Lochwand mit Werkzeug
        const [c, ctx] = makeCanvas(512, 512);
        ctx.fillStyle = '#c9ad85'; ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = 'rgba(60,40,20,0.55)';
        for (let y = 16; y < 512; y += 32) for (let x = 16; x < 512; x += 32) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
        const peg = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), std('#ffffff', 0.85, 0, { map: texRepeat(canvasTexture(c), 5, 2.8) }));
        peg.position.set(0, 42, -32);
        peg.receiveShadow = true;
        this.add(peg);
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), std('#ffffff', 0.9, 0, { map: texRepeat(paintTexture('#dfe3e8'), 6, 3) }));
        wall.position.set(0, 60, -33);
        this.add(wall);
        // aufgehängte Patchkabel & Klebeband
        const hookMat = std('#9aa1ab', 0.3, 1);
        [[-40, '#2f6fe0'], [-22, '#22a35a'], [30, '#e8c21c']].forEach(([x, col]) => {
            this.add(at(cyl(0.4, 0.4, 5, hookMat), x, 70, -29).rotateX(Math.PI / 2));
            const coil = new THREE.Mesh(new THREE.TorusGeometry(7, 0.45, 10, 48), std(col, 0.5));
            coil.position.set(x, 62, -30);
            coil.scale.set(1, 1.25, 1);
            coil.castShadow = true;
            this.add(coil);
        });
        this.add(at(new THREE.Mesh(new THREE.TorusGeometry(3.6, 1.6, 16, 32), std('#1d1f22', 0.4)), 48, 66, -30));

        // Schneidematte
        const mat = new THREE.Mesh(new THREE.PlaneGeometry(64, 44), std('#ffffff', 0.72, 0, { map: texRepeat(cuttingMatTexture(), 3.2, 2.2) }));
        mat.rotation.x = -Math.PI / 2;
        mat.position.set(0, MAT_Y - 0.04, 3);
        mat.receiveShadow = true;
        this.add(mat);

        // Abisolierzange & Seitenschneider (vereinfachte Formen)
        const stripper = new THREE.Group();
        at(rbox(1.6, 1.0, 11, 0.45, std('#f59e0b', 0.5)), -0.9, 0, 0, stripper);
        at(rbox(1.6, 1.0, 11, 0.45, std('#1f2937', 0.5)), 0.9, 0, 0, stripper);
        at(rbox(1.2, 0.8, 5, 0.2, MAT.steel()), 0, 0.1, -7.5, stripper);
        stripper.position.set(22, MAT_Y + 0.5, 12);
        stripper.rotation.y = 0.6;
        this.add(stripper);
    }

    // ------------------------------------------------------------
    // Doppeldose (liegt mit der LSA-Seite nach oben)
    // ------------------------------------------------------------

    buildSocket() {
        const white = std('#f3f2ee', 0.42);
        const white2 = std('#fbfbf8', 0.4);
        this.add(at(rbox(5.6, 0.9, 5.4, 0.3, white), 0, MAT_Y + 0.45, 0));
        const frame = at(rbox(7.6, 0.14, 7.6, 0.35, std('#c4cad2', 0.32, 1, { roughnessMap: brushedTexture() })), 0, 1.07, 0);
        this.add(frame);
        const slotMat = std('#2a2e35', 0.8);
        for (const [x, z, rot] of [[0, 3.25, 0], [0, -3.25, 0], [3.25, 0, 1], [-3.25, 0, 1]]) {
            const s = at(rbox(1.8, 0.05, 0.45, 0.2, slotMat), x, 1.13, z);
            s.rotation.y = rot ? Math.PI / 2 : 0;
            this.add(s);
        }
        // Geschirmter Cat.6A-Einsatz: Druckguss-Gehäuse (Zink), darauf die LSA-Leisten aus Kunststoff
        this.add(at(rbox(6.2, 2.0, 4.2, 0.3, std('#aeb4bb', 0.42, 0.85, { roughnessMap: brushedTexture() })), 0, 2.14, 0));
        const tag1 = makeTextPlane('DD1-1', { width: 1.6, height: 0.3, fg: '#1f2937' });
        tag1.rotation.x = -Math.PI / 2;
        this.add(at(tag1, BLOCK_X.A, BODY_TOP + 0.005, 1.93));
        const tag2 = makeTextPlane('DD1-2', { width: 1.6, height: 0.3, fg: '#1f2937' });
        tag2.rotation.x = -Math.PI / 2;
        this.add(at(tag2, BLOCK_X.B, BODY_TOP + 0.005, 1.93));
        const brand = makeTextPlane('CAT.6A · GESCHIRMT · T568A/B · LSA', { width: 3.8, height: 0.22, fg: '#374151', weight: 700 });
        brand.rotation.x = -Math.PI / 2;
        this.add(at(brand, 0, BODY_TOP + 0.005, -1.95));

        for (const side of ['A', 'B']) {
            const bx = BLOCK_X[side];
            this.add(at(rbox(2.7, 0.8, 3.5, 0.15, white2), bx, BODY_TOP + 0.4, 0));
            const print = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 3.5), std('#ffffff', 0.5, 0, {
                map: this.colorCodeTexture(), transparent: true, polygonOffset: true, polygonOffsetFactor: -2
            }));
            print.rotation.x = -Math.PI / 2;
            print.position.set(bx, BLOCK_TOP + 0.003, 0);
            this.add(print);
            for (const t of LSA_TERMINALS) this.buildTerminal(side, t);
        }
    }

    // Aufdruck: pro Klemme oben der A-Code (T568A), darunter der B-Code
    colorCodeTexture() {
        const W = 540, H = 700, s = 200;           // 200 px pro cm
        const [c, ctx] = makeCanvas(W, H);
        const cx = x => (x + 1.35) * s;
        const cz = z => (z + 1.75) * s;
        const drawCode = (core, x, z, w, h) => {
            ctx.fillStyle = core.base;
            ctx.fillRect(cx(x) - w / 2, cz(z) - h / 2, w, h);
            if (core.stripe) {
                ctx.save();
                ctx.beginPath(); ctx.rect(cx(x) - w / 2, cz(z) - h / 2, w, h); ctx.clip();
                ctx.strokeStyle = core.stripe; ctx.lineWidth = 9;
                for (let k = -h; k < w + h; k += 22) { ctx.beginPath(); ctx.moveTo(cx(x) - w / 2 + k, cz(z) - h / 2); ctx.lineTo(cx(x) - w / 2 + k - h, cz(z) + h / 2); ctx.stroke(); }
                ctx.restore();
            }
            ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
            ctx.strokeRect(cx(x) - w / 2, cz(z) - h / 2, w, h);
        };
        ctx.font = '800 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const t of LSA_TERMINALS) {
            const x = COL_OFF[t.col];
            const dir = t.row === 'top' ? -1 : 1;
            drawCode(coreForPin(t.pin, 'A'), x, dir * 1.1, 84, 40);
            drawCode(coreForPin(t.pin, 'B'), x, dir * 1.42, 84, 40);
        }
        for (const dir of [-1, 1]) {
            ctx.fillStyle = '#1d4ed8'; ctx.fillText('A', cx(-1.2), cz(dir * 1.1));
            ctx.fillStyle = '#6b7280'; ctx.fillText('B', cx(-1.2), cz(dir * 1.42));
        }
        return canvasTexture(c, { wrap: false });
    }

    buildTerminal(side, t) {
        const p = termPos(side, t);
        const g = new THREE.Group();
        g.position.set(p.x, BLOCK_TOP, p.z);
        const tower = rbox(0.44, 0.42, 0.72, 0.06, std('#f7f7f4', 0.38));
        tower.position.y = 0.21;
        g.add(tower);
        const slit = box(0.46, 0.2, 0.11, std('#15171b', 0.9));
        slit.position.set(0, 0.33, 0);
        slit.castShadow = false;
        g.add(slit);
        const blade = std('#d6a24a', 0.28, 1);
        for (const dz of [-0.045, 0.045]) at(box(0.3, 0.17, 0.018, blade), 0, 0.33, dz, g);
        const hit = hitbox(0.52, 0.9, 0.62);
        hit.position.y = 0.35;
        g.add(hit);
        g.userData = { kind: 'terminal', side, key: t.key, term: t };
        this.add(g);
        const a = coreForPin(t.pin, 'A'), b = coreForPin(t.pin, 'B');
        this.engine.addPickable(g, {
            tooltip: () => {
                const where = `${t.row === 'top' ? 'obere' : 'untere'} Reihe, Pos. ${t.col + 1}`;
                const placed = side === 'A' ? this.assign[t.key] : coreForPin(t.pin, 'A').id;
                const code = `<span class="tt-sub">Aufdruck: A = ${a.name} · B = ${b.name}</span>`;
                const now = placed ? `<span class="tt-sub">Belegt: <strong>${CORES[placed].name}</strong></span>` : '';
                return `<strong>${side === 'A' ? 'DD1-1' : 'DD1-2 (Vorlage)'} · ${where}</strong>${code}${now}`;
            }
        });
        this.terminals[side][t.key] = g;
    }

    buildCovers() {
        const makeCover = () => {
            const g = new THREE.Group();
            const clear = MAT.clearPlastic();
            clear.opacity = 0.42;
            at(rbox(2.9, 0.1, 3.7, 0.04, clear), 0, 0.95, 0, g);
            at(rbox(2.9, 0.95, 0.08, 0.03, clear), 0, 0.48, 1.81, g);
            at(rbox(2.9, 0.95, 0.08, 0.03, clear), 0, 0.48, -1.81, g);
            g.traverse(o => { if (o.isMesh) o.castShadow = false; });
            return g;
        };
        const coverB = makeCover();
        coverB.position.set(BLOCK_X.B, BLOCK_TOP, 0);
        this.add(coverB);
        this.coverA = makeCover();
        this.coverARest = { pos: V(-8.5, MAT_Y + 1.05, 7.8), rot: new THREE.Euler(Math.PI, 0.4, 0) };
        this.coverA.position.copy(this.coverARest.pos);
        this.coverA.rotation.copy(this.coverARest.rot);
        this.add(this.coverA);
        this.add(at(makeLabel('LSA-Deckel', { height: 0.5 }), -8.5, 2.2, 7.8));
    }

    // ------------------------------------------------------------
    // Kabel & Adernpaare
    // ------------------------------------------------------------

    buildCable(side) {
        const s = side === 'A' ? -1 : 1;
        const jEnd = V(s * 4.05, 3.35, 0);
        const jacketPts = side === 'A'
            ? [V(-40, MAT_Y + JACKET_R, 13), V(-26, MAT_Y + JACKET_R, 9), V(-14, MAT_Y + JACKET_R + 0.05, 4), V(-8.2, 1.2, 0.8), V(-5.6, 2.9, 0), jEnd]
            : [V(40, MAT_Y + JACKET_R, -4), V(26, MAT_Y + JACKET_R, -6), V(14, MAT_Y + JACKET_R + 0.05, -3), V(8.2, 1.2, -0.6), V(5.6, 2.9, 0), jEnd];
        const curve = cableCurve(jacketPts);
        this.add(cableMesh(curve, JACKET_R, printedJacket(ORANGE, PRINT, curve.getLength(), 14), { radial: 18 }));

        // zurückgelegtes Schirmgeflecht + Schirmauflage (Metallschelle)
        const braid = cyl(JACKET_R + 0.07, JACKET_R + 0.05, 0.7, std('#c8ccd2', 0.35, 1, { roughnessMap: brushedTexture() }), 20);
        braid.rotation.z = Math.PI / 2;
        braid.position.set(s * 4.35, 3.35, 0);
        this.add(braid);
        const clamp = new THREE.Mesh(new THREE.TorusGeometry(JACKET_R + 0.16, 0.09, 10, 28, Math.PI * 1.25), std('#b9c0c9', 0.3, 1));
        clamp.rotation.set(0, Math.PI / 2, Math.PI * 0.62);
        clamp.position.set(s * 4.4, 3.35, 0);
        this.add(clamp);
        const bracket = at(box(1.5, 0.12, 1.3, std('#b9c0c9', 0.3, 1)), s * 3.75, 2.86, 0);
        this.add(bracket);
        const clampHit = hitbox(1.4, 1.4, 1.4);
        clampHit.position.set(s * 4.3, 3.2, 0);
        const clampGroup = new THREE.Group();
        clampGroup.add(clampHit);
        this.add(clampGroup);
        this.engine.addPickable(clampGroup, { tooltip: '<strong>Schirmauflage</strong><span class="tt-sub">Kabelschirm großflächig mit der Dose verbinden</span>' });

        // Adernpaare (verdrillt) von der Mantelkante zum Aufteilpunkt
        PAIR_ORDER.forEach(pairNo => {
            const pt = PAIR_TERMINALS[pairNo];
            const far = side === 'A' ? pt.cols[0] >= 2 : pt.cols[0] < 2;
            const zSign = pt.row === 'top' ? -1 : 1;
            const exit = jEnd.clone().add(V(-s * 0.02, far ? 0.11 : -0.1, zSign * 0.13));
            const stage = V(s * (far ? 3.02 : 3.18), far ? 4.72 : 4.46, zSign * (far ? 0.3 : 0.7));
            const mid = V(s * 3.62, (exit.y + stage.y) / 2 - 0.05, (exit.z + stage.z) / 2);
            const trunk = cableCurve([exit, mid, stage]);
            const [ptsA, ptsB] = twistedPairPoints(trunk, { separation: WIRE_R * 2.1, twistsPerUnit: 0.75, samples: 70, phase: pairNo });
            const cores = PAIRS[pairNo].cores.map(id => CORES[id]);
            [ptsA, ptsB].forEach((pts, i) => {
                const len = trunk.getLength();
                this.add(cableMesh(pts, WIRE_R, wireMaterial(cores[i], len, 1.0), { radial: 8 }));
                const dir = pts.at(-1).clone().sub(pts.at(-4)).normalize();
                this.splits[side][cores[i].id] = { point: pts.at(-1).clone(), dir };
            });
            // Folienschirm des Paares (PiMF)
            const foil = cableMesh(cableCurve([exit.clone().add(V(s * 0.02, 0, 0)), exit.clone().lerp(mid, 0.28)]), WIRE_R * 2.3, std('#d7dbe0', 0.25, 1), { radial: 10 });
            this.add(foil);
        });

        if (side === 'B') {
            for (const t of LSA_TERMINALS) {
                const core = coreForPin(t.pin, 'A');
                this.add(this.makeWire('B', core.id, t).mesh);
            }
        } else {
            Object.values(CORES).forEach(core => this.buildTail(core.id));
        }
    }

    wirePath(side, coreId, t) {
        const s = side === 'A' ? -1 : 1;
        const { point, dir } = this.splits[side][coreId];
        const p = termPos(side, t);
        return [
            point,
            point.clone().add(dir.clone().multiplyScalar(0.18)),
            V(p.x + s * 0.8, TERM_TOP + 0.3, p.z + (point.z - p.z) * 0.15),
            V(p.x + s * 0.32, TERM_TOP + 0.05, p.z),
            V(p.x - s * 0.17, TERM_TOP - 0.1, p.z)
        ];
    }

    makeWire(side, coreId, t) {
        const curve = cableCurve(this.wirePath(side, coreId, t), 0.4);
        const mesh = cableMesh(curve, WIRE_R, wireMaterial(CORES[coreId], curve.getLength(), 1.0), { radial: 8 });
        return { mesh, curve };
    }

    buildTail(coreId) {
        const { point, dir } = this.splits.A[coreId];
        const core = CORES[coreId];
        const pairNo = core.pair;
        const idx = PAIRS[pairNo].cores.indexOf(coreId);
        const zSign = Math.sign(point.z) || 1;
        const spread = (idx === 0 ? -1 : 1) * 0.16 + zSign * 0.12;
        const pts = [
            point,
            point.clone().add(dir.clone().multiplyScalar(0.15)),
            point.clone().add(V(-0.12, 0.5, spread * 0.8)),
            point.clone().add(V(-0.42, 1.25, spread * 1.9))
        ];
        const curve = cableCurve(pts);
        const g = new THREE.Group();
        const mesh = cableMesh(curve, WIRE_R, wireMaterial(core, curve.getLength(), 1.0), { radial: 8 });
        g.add(mesh);
        const cap = new THREE.Mesh(new THREE.CircleGeometry(WIRE_R * 0.55, 10), MAT.copper());
        const end = pts.at(-1);
        cap.position.copy(end);
        cap.lookAt(end.clone().add(curve.getTangentAt(1)));
        g.add(cap);
        const hitMat = new THREE.MeshBasicMaterial();
        hitMat.visible = false;
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.24, 6, false), hitMat));
        g.userData = { kind: 'tail', coreId };
        this.add(g);
        this.engine.addPickable(g, {
            tooltip: () => `<strong>Ader ${core.name}</strong><span class="tt-sub">${this.selected === coreId ? 'ausgewählt' : 'auswählen'}</span>`
        });
        this.tails[coreId] = g;
    }

    // ------------------------------------------------------------
    // Werkzeug & Kabeltester
    // ------------------------------------------------------------

    buildTool() {
        const g = new THREE.Group();
        const steel = MAT.steel();
        at(box(0.12, 0.6, 0.95, steel), 0, 0.3, 0, g);
        at(cyl(0.28, 0.28, 2.6, steel, 16), 0, 1.9, 0, g);
        at(rbox(1.9, 10.5, 1.9, 0.7, std('#d23b2f', 0.45)), 0, 8.4, 0, g);
        for (const y of [5.2, 6.2, 7.2]) at(cyl(1.0, 1.0, 0.3, std('#23262d', 0.6), 20), 0, y, 0, g);
        const hook = at(box(0.3, 1.6, 0.3, steel), 0, 14.2, 0, g);
        hook.rotation.z = 0.4;
        g.traverse(o => { if (o.isMesh) o.castShadow = true; });
        this.toolRest = { pos: V(-6.8, MAT_Y + 1.0, 9.5), rotZ: Math.PI / 2, rotY: -0.35 };
        g.position.copy(this.toolRest.pos);
        g.rotation.set(0, this.toolRest.rotY, this.toolRest.rotZ, 'YXZ');
        this.tool = g;
        this.add(g);
        this.add(at(makeLabel('LSA-Anlegewerkzeug', { height: 0.5 }), -13, 2.4, 10.5));
    }

    buildTester() {
        const g = new THREE.Group();
        at(rbox(7.4, 2.0, 12.4, 1.0, std('#f2c21b', 0.55)), 0, 1.0, 0, g);
        at(rbox(6.6, 2.1, 11.6, 0.7, std('#2a2d33', 0.45)), 0, 1.05, 0, g);
        const [c, ctx] = makeCanvas(520, 380);
        this.testerCanvas = c;
        this.testerCtx = ctx;
        this.testerTex = canvasTexture(c, { wrap: false });
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.8), new THREE.MeshBasicMaterial({ map: this.testerTex, toneMapped: false }));
        screen.rotation.x = -Math.PI / 2;
        screen.position.set(0, 2.12, -1.8);
        g.add(screen);
        const btnMat = std('#4b5563', 0.5);
        [[-1.6, 2.4], [0, 2.4], [1.6, 2.4], [0, 4.2]].forEach(([x, z]) => at(cyl(0.5, 0.5, 0.25, x === 0 && z === 4.2 ? std('#16a34a', 0.4) : btnMat, 20), x, 2.14, z, g));
        const jack = at(box(1.4, 1.1, 0.8, std('#0e0f11', 0.8)), 0, 1.1, -6.3, g);
        jack.castShadow = false;
        g.position.set(13.5, MAT_Y, 4.5);
        g.rotation.y = -0.45;
        this.add(g);
        g.updateMatrixWorld(true);
        const start = g.localToWorld(V(0, 1.1, -6.8));
        this.add(cableMesh([start, start.clone().add(V(-1.5, 0, -4)), V(15, MAT_Y + 0.3, -12), V(26, MAT_Y + 0.3, -18), V(40, MAT_Y + 0.3, -20)], 0.28, std('#9aa3ad', 0.5)));
        this.add(at(makeLabel('Kabeltester', { height: 0.55, sub: 'Wiremap' }), 13.5, 4.6, 4.5));
        this.drawTester({ phase: 'idle' });
    }

    drawTester({ phase, map = null, upto = 8, verdict = '' }) {
        const ctx = this.testerCtx, W = 520, H = 380;
        ctx.fillStyle = '#9fb59a';
        ctx.fillRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#1b2a1b';
        ctx.font = '700 30px "Courier New", monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText('WIREMAP  T568A', 22, 32);
        if (phase === 'idle') {
            ctx.font = '600 26px "Courier New", monospace';
            ctx.fillText('Bereit.', 22, 120);
            ctx.fillText('Warte auf Prüfung …', 22, 160);
        } else {
            for (let p = 1; p <= 8; p++) {
                const y = 58 + p * 30;
                ctx.font = '700 24px "Courier New", monospace';
                ctx.fillStyle = '#1b2a1b';
                ctx.fillText(String(p), 40, y);
                if (p <= upto && map) {
                    const q = map[p];
                    const ok = q === p;
                    ctx.strokeStyle = ok ? '#14532d' : '#7f1d1d';
                    ctx.lineWidth = 5;
                    ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(260, 58 + q * 30); ctx.stroke();
                    ctx.fillStyle = ok ? '#14532d' : '#7f1d1d';
                    ctx.fillText(ok ? 'OK' : 'X', 360, y);
                }
                ctx.fillStyle = '#1b2a1b';
                ctx.fillText(String(p), 280, 58 + p * 30);
            }
            if (verdict) {
                ctx.fillStyle = verdict === 'PASS' ? '#14532d' : '#7f1d1d';
                ctx.font = '800 34px "Courier New", monospace';
                ctx.fillText(verdict, 400, 200);
            }
        }
        this.testerTex.needsUpdate = true;
    }

    // ------------------------------------------------------------
    // Interaktion
    // ------------------------------------------------------------

    onPick(obj) {
        if (!obj) return;
        const d = obj.userData;
        if (d.kind === 'tail') return this.selectCore(d.coreId);
        if (d.kind === 'terminal') {
            if (d.side === 'B') {
                this.toast('Das ist Port <strong>DD1-2</strong> – schon fertig aufgelegt. Nutze ihn als Vorlage und lege deine Adern an <strong>DD1-1</strong> auf.', 'info', 4000);
                return;
            }
            return this.clickTerminal(d.term);
        }
    }

    selectCore(coreId) {
        if (this.success) return;
        if (Object.values(this.assign).includes(coreId)) {
            this.toast(`${CORES[coreId].name} ist bereits aufgelegt.`, 'info');
            return;
        }
        if (this.selected) {
            this.engine.setGlow(this.tails[this.selected], null);
        }
        this.selected = this.selected === coreId ? null : coreId;
        if (this.selected) this.engine.setGlow(this.tails[this.selected], '#4f8cff', 0.9);
        this.refresh();
    }

    clickTerminal(t) {
        if (this.busy || this.success) return;   // busy = nur während der Prüfung
        const current = this.assign[t.key];
        if (current) {
            this.removeWire(t.key, true);
            this.toast(`${CORES[current].name} wieder herausgenommen.`, 'info', 1800);
            return;
        }
        if (!this.selected) {
            this.toast('Wähle zuerst eine Ader – in der Seitenleiste oder direkt am Kabelende.', 'warn');
            return;
        }
        this.placeWire(this.selected, t, true);
    }

    placeWire(coreId, t, record) {
        this.assign[t.key] = coreId;
        if (record) this.history.push({ type: 'place', key: t.key, coreId });
        this.engine.setGlow(this.tails[coreId], null);
        this.tails[coreId].visible = false;
        this.engine.removePickable(this.tails[coreId]);
        const { mesh } = this.makeWire('A', coreId, t);
        this.add(mesh);
        this.wires[t.key] = mesh;
        this.badTerminals.delete(t.key);
        this.engine.setGlow(this.terminals.A[t.key], null);
        this.selected = null;
        this.punch(t, mesh, coreId);
        this.refresh();
    }

    removeWire(key, record) {
        const coreId = this.assign[key];
        if (!coreId) return;
        delete this.assign[key];
        if (record) this.history.push({ type: 'remove', key, coreId });
        const mesh = this.wires[key];
        if (mesh && mesh === this.punchWire) {
            // Ader wird gerade eingedrückt → Animation abbrechen, Werkzeug zurücklegen
            this.punchToken = null;
            this.finishPunch = null;
            this.punchWire = null;
            this.parkTool();
        }
        if (mesh) {
            mesh.removeFromParent();
            mesh.geometry.dispose();
            mesh.material.map?.dispose();
            mesh.material.dispose();
            delete this.wires[key];
        }
        this.tails[coreId].visible = true;
        this.engine.addPickable(this.tails[coreId], this.tails[coreId].userData.pick);
        this.badTerminals.delete(key);
        this.engine.setGlow(this.terminals.A[key], null);
        this.refresh();
    }

    /**
     * Anlegewerkzeug: fährt zur Klemme, drückt die Ader ein, schneidet den Überstand ab.
     * Ein neuer Klick unterbricht die laufende Animation – die vorige Ader wird sofort fertig
     * eingelegt, damit schnelle Eingaben nie "verschluckt" werden.
     */
    async punch(t, wireMesh, coreId) {
        const e = this.engine;
        this.finishPunch?.();
        this.toolTween?.cancel();
        const token = {};
        this.punchToken = token;
        const p = termPos('A', t);
        let trimmed = false;
        const trim = () => { if (!trimmed) { trimmed = true; this.dropExcess(p, coreId); } };
        this.punchWire = wireMesh;
        this.finishPunch = () => { setTubeProgress(wireMesh, 1); trim(); this.finishPunch = null; this.punchWire = null; };
        const alive = () => this.punchToken === token && !this.disposed;

        const tool = this.tool;
        const from = tool.position.clone();
        const fromRotZ = tool.rotation.z;
        const fromRotY = tool.rotation.y;
        const above = V(p.x, TERM_TOP + 1.6, p.z);
        setTubeProgress(wireMesh, 0);
        this.toolTween = e.tween({
            duration: 0.34, ease: Ease.inOutCubic,
            onUpdate: k => {
                tool.position.lerpVectors(from, above, k);
                tool.position.y += Math.sin(k * Math.PI) * 3;
                tool.rotation.z = fromRotZ * (1 - k);
                tool.rotation.y = fromRotY * (1 - k);
                setTubeProgress(wireMesh, k);
            }
        });
        if (!(await this.toolTween.done) || !alive()) return;
        const down = V(p.x, TERM_TOP - 0.1, p.z);
        this.toolTween = e.tween({ duration: 0.1, ease: Ease.inCubic, onUpdate: k => tool.position.lerpVectors(above, down, k) });
        if (!(await this.toolTween.done) || !alive()) return;
        this.finishPunch();
        this.toolTween = e.tween({ duration: 0.12, ease: Ease.outCubic, onUpdate: k => tool.position.lerpVectors(down, above, k) });
        if (!(await this.toolTween.done) || !alive()) return;
        this.parkTool(0.25);
    }

    parkTool(delay = 0) {
        const tool = this.tool;
        const top = tool.position.clone();
        const rz = tool.rotation.z, ry = tool.rotation.y;
        this.toolTween?.cancel();
        this.toolTween = this.engine.tween({
            duration: 0.45, delay, ease: Ease.inOutCubic,
            onUpdate: k => {
                tool.position.lerpVectors(top, this.toolRest.pos, k);
                tool.position.y += Math.sin(k * Math.PI) * 2;
                tool.rotation.z = rz + (this.toolRest.rotZ - rz) * k;
                tool.rotation.y = ry + (this.toolRest.rotY - ry) * k;
            }
        });
    }

    dropExcess(p, coreId) {
        // Überstand um den eigenen Mittelpunkt modellieren, damit er natürlich fällt und rollt
        const c = V(p.x + 0.4, TERM_TOP + 0.02, p.z);
        const pts = [V(-0.23, -0.04, 0), V(0, 0, 0), V(0.22, 0.06, 0.03)];
        const stub = cableMesh(cableCurve(pts), WIRE_R, wireMaterial(CORES[coreId], 0.5, 1), { radial: 8 });
        stub.position.copy(c);
        this.add(stub);
        const spin = (Math.random() - 0.5) * 4;
        const drift = V(0.4 + Math.random() * 1.1, 0, (Math.random() - 0.3) * 1.6);
        const fall = c.y - MAT_Y - WIRE_R - 0.02;
        this.engine.tween({
            duration: 0.5, ease: Ease.linear,
            onUpdate: k => {
                stub.position.set(c.x + drift.x * k, c.y - fall * k * k, c.z + drift.z * k);
                stub.rotation.set(0, spin * k, 0.25 * k);
            }
        });
        // Abschnitte bleiben liegen (wie in echt) – werden beim Levelwechsel entsorgt
    }

    onUndo() {
        if (this.busy || this.success) return;
        const last = this.history.pop();
        if (!last) return;
        if (last.type === 'place') {
            this.removeWire(last.key, false);
            this.toast(`${CORES[last.coreId].name} herausgenommen.`, 'info', 1600);
        } else {
            const t = LSA_TERMINALS.find(x => x.key === last.key);
            if (!this.assign[t.key]) this.placeWire(last.coreId, t, false);
        }
        this.refresh();
    }

    // ------------------------------------------------------------
    // Prüfung mit dem Kabeltester
    // ------------------------------------------------------------

    wiremap() {
        const map = {};
        for (const t of LSA_TERMINALS) map[t.pin] = CORES[this.assign[t.key]].pinA;
        return map;
    }

    diagnose(map) {
        const bad = Object.keys(map).map(Number).filter(p => map[p] !== p);
        if (!bad.length) return { pass: true, text: 'PASS – alle 8 Adern 1:1 durchverbunden.' };
        const isCross = map[1] === 3 && map[3] === 1 && map[2] === 6 && map[6] === 2 && [4, 5, 7, 8].every(p => map[p] === p);
        if (isCross) {
            return { pass: false, kind: 'cross', text: 'Crossover (1↔3, 2↔6): Du hast nach <strong>T568B</strong> aufgelegt – die Gegenseite am Patchpanel ist aber T568A. Achte auf den <strong>A-Aufdruck</strong>!' };
        }
        const pairs = [[1, 2], [3, 6], [4, 5], [7, 8]];
        const reversed = pairs.filter(([a, b]) => map[a] === b && map[b] === a);
        const parts = [];
        if (reversed.length) parts.push(`Vertauschtes Adernpaar (Reversed Pair) an Pin ${reversed.map(r => r.join('/')).join(', ')}: Die beiden Adern eines Paares sind vertauscht.`);
        const others = bad.filter(p => !reversed.some(r => r.includes(p)));
        if (others.length) parts.push(`Vertauschte Adern an Pin ${others.join(', ')} – Paare sind durcheinandergeraten (Split-Pair-Gefahr).`);
        return { pass: false, kind: 'mixed', text: parts.join(' ') };
    }

    wiremapHtml(map, diag) {
        const rows = [1, 2, 3, 4, 5, 6, 7, 8].map(p => {
            const q = map[p];
            const core = CORES[Object.entries(this.assign).find(([k]) => LSA_TERMINALS.find(t => t.key === k).pin === p)[1]];
            return `<span class="pin"><span class="pn">${p}</span><span class="swatch" data-core="${core.id}"></span>${core.name}</span>
                    <span class="ln ${q === p ? '' : 'bad'}" data-to="→ ${q}"></span>
                    <span class="pin r"><span class="pn">${q}</span></span>`;
        }).join('');
        return `<div class="wiremap"><span class="hdr">Dose DD1-1</span><span></span><span class="hdr" style="text-align:right">Patchpanel</span>${rows}</div>
                <div class="wiremap-verdict ${diag.pass ? '' : 'bad'}">${diag.pass ? 'Wiremap: PASS' : 'Wiremap: FAIL'}</div>`;
    }

    async onCheck() {
        if (this.busy || this.success || Object.keys(this.assign).length < 8) return;
        const e = this.engine;
        this.finishPunch?.();
        this.parkTool();
        this.busy = true;
        e.interactive = false;
        this.refresh();
        const map = this.wiremap();
        const diag = this.diagnose(map);
        const view = { pos: e.camera.position.clone(), target: e.controls.target.clone() };
        await e.flyTo(V(10.5, 16, 14), V(11.5, 1.5, 2.5), { duration: 1.0 });
        if (!this.alive) return;
        for (let i = 1; i <= 8; i++) {
            this.drawTester({ phase: 'test', map, upto: i });
            if (!(await e.wait(0.16))) return;
        }
        this.drawTester({ phase: 'test', map, upto: 8, verdict: diag.pass ? 'PASS' : 'FAIL' });
        if (!(await e.wait(0.6))) return;
        this.busy = false;
        if (diag.pass) {
            this.success = true;
            if (!(await this.assembleCover())) return;
            this.finishSuccess(map, diag);
        } else {
            this.checks++;
            const wrongKeys = LSA_TERMINALS.filter(t => map[t.pin] !== t.pin).map(t => t.key);
            this.finishFail(map, diag, wrongKeys, view);
        }
    }

    async assembleCover() {
        const e = this.engine;
        e.flyTo(V(-3, 12, 9.5), V(-1.2, 3.8, 0), { duration: 1.1 });
        const c = this.coverA;
        const p0 = c.position.clone();
        const p1 = V(BLOCK_X.A, BLOCK_TOP, 0);
        const r0 = c.rotation.clone();
        const ok = await e.tween({
            duration: 1.1, ease: Ease.inOutCubic,
            onUpdate: k => {
                c.position.lerpVectors(p0, p1, k);
                c.position.y += Math.sin(k * Math.PI) * 4;
                c.rotation.set(r0.x * (1 - k), r0.y * (1 - k), r0.z * (1 - k));
            }
        }).done;
        if (!ok || !this.alive) return false;
        this.toast('Klick – LSA-Deckel aufgesetzt. Die Adern sind jetzt gegen Herausrutschen gesichert.', 'success', 2600);
        return (await e.wait(0.8)) && this.alive;
    }

    breakdownFor(t) {
        const timePen = -this.timePenalty(t, [[90, 0], [150, 5], [240, 10], [360, 15], [99999, 20]]);
        const helpPen = -this.ctx.helpPenalty();
        return [
            { label: 'Belegung korrekt (Wiremap PASS)', points: 0, value: '100' },
            { label: `Zeit (${formatTime(t)})`, points: timePen, value: fmtPts(timePen), kind: timePen ? 'minus' : '' },
            { label: `Fehlgeschlagene Prüfungen (${this.checks}×)`, points: -10 * this.checks, value: fmtPts(-10 * this.checks), kind: this.checks ? 'minus' : '' },
            { label: `Hilfen (${this.ctx.helpCount()} Stufen)`, points: helpPen, value: fmtPts(helpPen), kind: helpPen ? 'minus' : '' }
        ];
    }

    finishSuccess(map, diag) {
        const t = this.ctx.elapsed();
        const breakdown = this.breakdownFor(t);
        const score = this.scoreResult({ breakdown });
        this.ctx.finish({
            success: true, score, time: t,
            title: 'DD1-1 korrekt aufgelegt!',
            subtitle: 'Der Kabeltester meldet PASS: alle 8 Adern sind 1 : 1 nach T568A durchverbunden.',
            stats: [
                { label: 'Punkte', value: score },
                { label: 'Zeit', value: formatTime(t) },
                { label: 'Prüfungen', value: this.checks + 1 }
            ],
            sections: [{ title: 'Kabeltester · Wiremap', icon: 'check', html: this.wiremapHtml(map, diag) }],
            breakdown,
            actions: [
                { label: 'Nochmal', action: 'retry', icon: 'restart' },
                { label: 'Weiter zu Station 3', action: 'next', icon: 'arrowRight', primary: true }
            ]
        });
    }

    finishFail(map, diag, wrongKeys, view) {
        const t = this.ctx.elapsed();
        const wrongList = LSA_TERMINALS.filter(x => wrongKeys.includes(x.key)).map(x => {
            const placed = CORES[this.assign[x.key]];
            const expected = coreForPin(x.pin, 'A');
            return `<li>${x.row === 'top' ? 'Obere' : 'Untere'} Reihe, Pos. ${x.col + 1} (Pin ${x.pin}): <span class="swatch" data-core="${placed.id}"></span>${placed.name} liegt dort</li>`;
        }).join('');
        this.ctx.finish({
            success: false, score: 0, time: t,
            title: 'Der Kabeltester meldet Fehler',
            subtitle: diag.text,
            sections: [
                { title: 'Kabeltester · Wiremap', icon: 'warn', html: this.wiremapHtml(map, diag) },
                { title: `Falsch belegt (${wrongKeys.length} Klemmen)`, icon: 'error', cls: 'errors', html: `<ul>${wrongList}</ul><p class="small muted" style="margin-top:0.6rem">Die fehlerhaften Klemmen sind in der Szene rot markiert. ${this.ctx.tap()} eine belegte Klemme, um die Ader wieder herauszunehmen. Jede weitere Prüfung kostet 10 Punkte.</p>` }
            ],
            actions: [
                { label: 'Neu beginnen', action: 'retry', icon: 'restart' },
                {
                    label: 'Fehler korrigieren', action: 'continue', icon: 'tool', primary: true,
                    onContinue: () => {
                        this.engine.interactive = true;
                        this.drawTester({ phase: 'idle' });
                        wrongKeys.forEach(k => { this.badTerminals.add(k); this.engine.setGlow(this.terminals.A[k], '#ef4444', 0.75); });
                        this.engine.flyTo(view.pos, view.target, { duration: 0.9 });
                    }
                }
            ]
        });
    }

    // ------------------------------------------------------------
    // UI
    // ------------------------------------------------------------

    steps() {
        const n = Object.keys(this.assign).length;
        return [
            { text: 'Ader auswählen', meta: 'Seitenleiste oder direkt am Kabelende', done: n > 0 || !!this.selected },
            { text: 'Alle 8 Adern auf die LSA-Klemmen von <strong>DD1-1</strong> auflegen', meta: `${n}/8 aufgelegt`, done: n === 8 },
            { text: 'Belegung mit dem Kabeltester prüfen', done: this.success }
        ];
    }

    objective() {
        const n = Object.keys(this.assign).length;
        if (this.success) return 'Geschafft!';
        if (this.badTerminals.size) return `Korrigiere die <strong>rot markierten</strong> Klemmen: Ader herausnehmen und richtig auflegen.`;
        if (n === 8) return 'Alle Adern aufgelegt – prüfe jetzt die Belegung mit dem Kabeltester.';
        if (this.selected) return `${this.ctx.tap()} die LSA-Klemme für <strong>${CORES[this.selected].name}</strong> an DD1-1.`;
        return 'Wähle eine Ader – in der Seitenleiste oder direkt an den Kabelenden.';
    }

    hints() {
        if (this.success || this.busy) return [];
        if (!this.selected && Object.keys(this.assign).length === 0) return Object.values(this.tails);
        return [];
    }

    renderControls(el) {
        const used = new Set(Object.values(this.assign));
        const pairsHtml = PAIR_ORDER.map(p => {
            const pair = PAIRS[p];
            return `<div class="pair-label">${pair.name}</div>` + pair.cores.map(id => {
                const c = CORES[id];
                return `<button class="core-btn ${this.selected === id ? 'selected' : ''}" type="button" data-core="${id}" ${used.has(id) || this.success ? 'disabled' : ''}>
                    <span class="wire-swatch" style="background:${coreSwatchCss(c)}"></span>${c.name}
                    ${used.has(id) ? `<span class="pin">${icon('check')}</span>` : ''}
                </button>`;
            }).join('');
        }).join('');
        const cell = (row, col) => {
            const t = LSA_TERMINALS.find(x => x.row === row && x.col === col);
            const id = this.assign[t.key];
            const bg = id ? `style="background:${coreSwatchCss(CORES[id])}"` : '';
            return `<span class="${this.badTerminals.has(t.key) ? 'bad' : ''}" ${bg} title="${id ? CORES[id].name : 'frei'}"></span>`;
        };
        const sel = this.selected ? CORES[this.selected] : null;
        el.innerHTML = `
            <h3 class="card-title">Adern des Verlegekabels <span class="count">${used.size}/8</span></h3>
            <div class="core-grid">${pairsHtml}</div>
            <div class="selected-core ${sel ? 'on' : ''}">
                ${sel ? `<span class="wire-swatch" style="background:${coreSwatchCss(sel)}"></span><span><strong>${sel.name}</strong> gewählt – jetzt die Klemme ${this.ctx.tap(true)}</span>`
                      : `${icon('info')}<span class="muted">Keine Ader gewählt</span>`}
            </div>
            <h3 class="card-title" style="margin-top:0.95rem">Klemmen DD1-1 <span class="count">Draufsicht</span></h3>
            <div class="lsa-mini">${[0, 1, 2, 3].map(c => cell('top', c)).join('')}</div>
            <div class="lsa-mini">${[0, 1, 2, 3].map(c => cell('bottom', c)).join('')}</div>
            <p class="lsa-mini-label">Obere Reihe · untere Reihe (wie in der 3D-Ansicht)</p>`;
        el.querySelectorAll('.core-btn').forEach(b => b.addEventListener('click', () => { if (this.ctx.playing) this.selectCore(b.dataset.core); }));
    }

    actions() {
        const n = Object.keys(this.assign).length;
        return {
            undo: { label: 'Rückgängig', enabled: this.history.length > 0 && !this.success && !this.busy },
            check: { label: 'Belegung prüfen', icon: 'check', enabled: n === 8 && !this.success && !this.busy, pulse: true }
        };
    }
}
