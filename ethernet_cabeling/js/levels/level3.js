// ============================================================
// Station 3: Patchpanel → Switches patchen (Technikraum, Meter)
// ============================================================

import * as THREE from 'three';
import { BaseLevel, fmtPts } from './base.js';
import {
    V, at, box, rbox, cyl, hitbox, buildRoom, cableMesh, cableCurve, setTubeProgress,
    rj45Plug, orientPlug, plugAnchorWorld, ceilingLight, texRepeat
} from '../models.js';
import { std, MAT, raisedFloorTexture, perforatedAlpha, makeCanvas, canvasTexture, jacketMaterial } from '../materials.js';
import { makeLabel } from '../labels.js';
import { Ease } from '../engine.js';
import { icon } from '../icons.js';
import { formatTime } from '../ui.js';

const U = 0.04445;
const uBottom = u => 0.1 + (u - 1) * U;
const uCenter = (u, n = 1) => uBottom(u) + (n * U) / 2;
const PANEL_W = 0.4826;
const PP_U = 33, M1_U = 32, SW1_U = 31, M2_U = 30, SW2_U = 29;
const SW_COLOR = { 1: '#2f6fe0', 2: '#1f9d55' };
const SW_NAME = { 1: 'Switch Büro 1', 2: 'Switch Büro 2' };
const LIMIT = 180;
const ORANGE_ACCENT = '#ee7a16';

function portX(n) {
    const i = n - 1;
    const g = Math.floor(i / 6), k = i % 6;
    return -0.2076 + g * (6 * 0.0158 + 0.012) + k * 0.0158 + 0.0079;
}

function instancedBoxes(w, h, d, mat, positions) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), mat, positions.length);
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, m); });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
}

export class Level3 extends BaseLevel {
    build() {
        const e = this.engine;
        this.connections = [];          // { pp, sw, swPort, meshes:[], plugs:[] }
        this.selected = null;           // { type:'pp'|'sw', n, sw }
        this.mistakes = 0;
        this.done = false;
        this.ppPorts = {};
        this.swPorts = { 1: {}, 2: {} };
        this.leds = { 1: null, 2: null };
        this.ledState = { 1: new Array(24).fill(0), 2: new Array(24).fill(0) };

        this.lights({
            hemi: 0.75, env: 0.65, sky: '#e8f0ff', ground: '#3b4250',
            sun: { position: [0.9, 2.9, 2.4], target: [0, 1.3, 0], intensity: 2.5, size: 1.3, color: '#f4f8ff' }
        });
        this.buildRoom();
        this.buildRack();
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

    // ------------------------------------------------------------
    // Netzwerkschrank
    // ------------------------------------------------------------

    buildRack() {
        const rack = new THREE.Group();
        const black = MAT.rackBlack();
        const W = 0.8, D = 1.0, H = 2.05;
        for (const x of [-W / 2 + 0.02, W / 2 - 0.02]) {
            for (const z of [-0.01, -D + 0.02]) at(box(0.04, H, 0.04, black), x, H / 2, z, rack);
        }
        at(box(W, 0.04, D, black), 0, H - 0.02, -D / 2, rack);
        at(box(W, 0.1, D, std('#15171b', 0.6, 0.5)), 0, 0.05, -D / 2, rack);
        for (const x of [-W / 2, W / 2]) at(box(0.01, H - 0.12, D - 0.04, std('#1e2127', 0.55, 0.6)), x, H / 2, -D / 2, rack);
        at(box(W - 0.02, H - 0.12, 0.01, std('#16181c', 0.7, 0.4)), 0, H / 2, -D + 0.01, rack);
        // Kabeleinführung oben (Bürstenleiste)
        at(box(0.5, 0.02, 0.18, std('#0c0d0f', 0.9)), 0, H - 0.005, -0.55, rack);

        // 19"-Profilschienen mit Vierkantlöchern
        const [c, ctx] = makeCanvas(32, 256);
        ctx.fillStyle = '#2d3138'; ctx.fillRect(0, 0, 32, 256);
        ctx.fillStyle = '#07080a';
        for (let i = 0; i < 12; i++) { const y = i * 21.33; ctx.fillRect(10, y + 3, 12, 6); ctx.fillRect(10, y + 12, 12, 6); }
        const railMat = std('#ffffff', 0.45, 0.8, { map: texRepeat(canvasTexture(c), 1, 42 / 12) });
        for (const x of [-0.2413 + 0.0085, 0.2413 - 0.0085]) at(box(0.017, 42 * U, 0.02, railMat), x, 0.1 + 21 * U, -0.012, rack);
        // vertikale Kabelführungen mit Fingern
        for (const sx of [-1, 1]) {
            const x = sx * 0.315;
            at(box(0.1, 42 * U, 0.01, std('#16181c', 0.6, 0.4)), x, 0.1 + 21 * U, -0.06, rack);
            const fingers = [];
            for (let u = 1; u <= 42; u++) fingers.push(V(x, uCenter(u), -0.025));
            rack.add(instancedBoxes(0.08, 0.008, 0.06, black, fingers));
        }
        this.add(rack);

        // Geöffnete Fronttür (perforiert)
        const door = new THREE.Group();
        const perf = std('#1d2026', 0.5, 0.6, { alphaMap: texRepeat(perforatedAlpha(), 8, 20), alphaTest: 0.5, side: THREE.DoubleSide });
        at(box(0.76, 1.9, 0.004, perf), 0.38, 0, 0, door);
        const frameMat = std('#1a1c21', 0.5, 0.6);
        at(box(0.76, 0.05, 0.02, frameMat), 0.38, 0.95, 0, door);
        at(box(0.76, 0.05, 0.02, frameMat), 0.38, -0.95, 0, door);
        at(box(0.04, 1.9, 0.02, frameMat), 0.02, 0, 0, door);
        at(box(0.04, 1.9, 0.02, frameMat), 0.74, 0, 0, door);
        at(box(0.02, 0.2, 0.03, std('#9aa1ab', 0.3, 1)), 0.7, 0, 0.02, door);
        door.position.set(-0.4, 1.05, 0.02);
        door.rotation.y = 1.95;
        this.add(door);

        this.buildPatchPanel();
        this.buildManager(M1_U);
        this.buildManager(M2_U);
        this.buildSwitch(1, SW1_U);
        this.buildSwitch(2, SW2_U);
        // Blindplatten & weitere Geräte
        const blank = std('#1b1d22', 0.6, 0.5);
        for (const [u, n] of [[34, 1], [36, 2], [28, 1], [24, 1], [20, 2], [12, 3]]) {
            this.add(at(rbox(PANEL_W, n * U - 0.001, 0.004, 0.001, blank), 0, uCenter(u, n), -0.002));
        }
        this.buildServer(25);
        this.buildUps(3);
    }

    frontPlate(u, n, color = '#1d2026') {
        const g = new THREE.Group();
        const plate = rbox(PANEL_W, n * U - 0.0015, 0.004, 0.0012, std(color, 0.5, 0.55));
        plate.position.z = -0.002;
        g.add(plate);
        const screwMat = std('#b8bec7', 0.3, 1);
        for (const sx of [-1, 1]) for (const dy of n === 1 ? [0] : [-U / 2 + 0.008, U / 2 - 0.008]) {
            const s = cyl(0.003, 0.003, 0.002, screwMat, 12);
            s.rotation.x = Math.PI / 2;
            at(s, sx * (PANEL_W / 2 - 0.0085), dy, 0.001, g);
        }
        g.position.y = uCenter(u, n);
        this.add(g);
        return g;
    }

    printPlane(g, w, h, draw, z = 0.0006) {
        const pxW = 2048, pxH = Math.round(2048 * h / w);
        const [c, ctx] = makeCanvas(pxW, pxH);
        draw(ctx, pxW / w, pxW, pxH);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std('#ffffff', 0.55, 0, {
            map: canvasTexture(c, { wrap: false }), transparent: true, polygonOffset: true, polygonOffsetFactor: -2
        }));
        m.position.z = z;
        g.add(m);
        return m;
    }

    portJacks(g, y, list) {
        const holes = list.map(n => V(portX(n), y, -0.0016));
        g.add(instancedBoxes(0.0117, 0.0085, 0.004, std('#040506', 0.95), holes));
        const contacts = [];
        list.forEach(n => { for (let k = 0; k < 8; k++) contacts.push(V(portX(n) - 0.0042 + k * 0.0012, y + 0.003, 0.0)); });
        g.add(instancedBoxes(0.0005, 0.0011, 0.0006, MAT.gold(), contacts));
    }

    buildPatchPanel() {
        const g = this.frontPlate(PP_U, 1);
        const y = -0.0035;
        const all = Array.from({ length: 24 }, (_, i) => i + 1);
        this.portJacks(g, y, all);
        this.printPlane(g, PANEL_W, U, (ctx, s, W, H) => {
            const cx = x => (x + PANEL_W / 2) * s;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let gi = 0; gi < 4; gi++) {
                const x0 = portX(gi * 6 + 1) - 0.0079, x1 = portX(gi * 6 + 6) + 0.0079;
                ctx.fillStyle = '#f5f5f0';
                ctx.fillRect(cx(x0), H * 0.07, (x1 - x0) * s, H * 0.2);
            }
            ctx.font = `700 ${Math.round(H * 0.15)}px Arial`;
            ctx.fillStyle = '#111827';
            all.forEach(n => ctx.fillText(String(n), cx(portX(n)), H * 0.175));
            ctx.fillStyle = '#9ca3af';
            ctx.font = `600 ${Math.round(H * 0.12)}px Arial`;
            ctx.fillText('CAT.6A', cx(-0.226), H * 0.5);
            ctx.fillText('24P', cx(0.226), H * 0.5);
            // oranger Punkt: DD1-1
            ctx.fillStyle = '#ee7a16';
            ctx.beginPath(); ctx.arc(cx(portX(1)), H * 0.9, H * 0.06, 0, Math.PI * 2); ctx.fill();
        });
        all.forEach(n => {
            const port = new THREE.Group();
            const frame = box(0.0148, 0.0165, 0.003, std('#2a2e35', 0.5, 0.3));
            port.add(frame);
            const hit = hitbox(0.0158, 0.022, 0.02);
            port.add(hit);
            port.position.set(portX(n), uCenter(PP_U) + y, -0.0012);
            port.userData = { kind: 'pp', n };
            this.add(port);
            this.engine.addPickable(port, { tooltip: () => this.ppTooltip(n) });
            this.ppPorts[n] = port;
        });
    }

    buildManager(u) {
        const g = this.frontPlate(u, 1, '#16181c');
        const ringMat = std('#1f2228', 0.5, 0.4);
        for (const x of [-0.17, -0.085, 0, 0.085, 0.17]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0028, 8, 20, Math.PI), ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(x, 0, 0);
            ring.scale.set(1, 1, 0.9);
            g.add(ring);
        }
    }

    buildSwitch(sw, u) {
        const g = this.frontPlate(u, 1, '#2b2f37');
        at(box(0.43, U - 0.004, 0.24, std('#23262d', 0.5, 0.6)), 0, 0, -0.125, g);
        const y = -0.004;
        const all = Array.from({ length: 24 }, (_, i) => i + 1);
        this.portJacks(g, y, all);
        this.printPlane(g, PANEL_W, U, (ctx, s, W, H) => {
            const cx = x => (x + PANEL_W / 2) * s;
            ctx.fillStyle = SW_COLOR[sw];
            ctx.fillRect(cx(-0.2413), 0, cx(-0.2213) - cx(-0.2413), H);
            ctx.fillStyle = '#d1d5db';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `700 ${Math.round(H * 0.1)}px Arial`;
            all.forEach(n => ctx.fillText(String(n), cx(portX(n)), H * 0.93));
            ctx.font = `600 ${Math.round(H * 0.1)}px Arial`;
            ctx.fillText('PWR', cx(0.2255), H * 0.2);
            ctx.fillText('SYS', cx(0.2255), H * 0.52);
        });
        // Status-LEDs rechts
        const pwr = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.001), new THREE.MeshBasicMaterial({ color: '#3cff7a', toneMapped: false }));
        at(pwr, 0.2255, 0.0085, 0.0008, g);
        this.sysLed = this.sysLed || {};
        const sys = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.001), new THREE.MeshBasicMaterial({ color: '#3cff7a', toneMapped: false }));
        at(sys, 0.2255, -0.0055, 0.0008, g);
        this.sysLed[sw] = sys;
        // Port-LEDs (Link grün / Aktivität gelb) als Instanzen
        const ledGeo = new THREE.BoxGeometry(0.0032, 0.0018, 0.001);
        const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), 48);
        const m = new THREE.Matrix4();
        const off = new THREE.Color('#232a26');
        all.forEach((n, i) => {
            m.makeTranslation(portX(n) - 0.0035, y + 0.0078, 0.0008); leds.setMatrixAt(i * 2, m); leds.setColorAt(i * 2, off);
            m.makeTranslation(portX(n) + 0.0035, y + 0.0078, 0.0008); leds.setMatrixAt(i * 2 + 1, m); leds.setColorAt(i * 2 + 1, off);
        });
        g.add(leds);
        this.leds[sw] = leds;
        all.forEach(n => {
            const port = new THREE.Group();
            port.add(box(0.0146, 0.0112, 0.0026, std('#3b4049', 0.45, 0.6)));
            const hit = hitbox(0.0158, 0.022, 0.02);
            port.add(hit);
            port.position.set(portX(n), uCenter(u) + y, -0.0011);
            port.userData = { kind: 'sw', n, sw };
            this.add(port);
            this.engine.addPickable(port, { tooltip: () => this.swTooltip(sw, n) });
            this.swPorts[sw][n] = port;
        });
    }

    buildServer(u) {
        const g = this.frontPlate(u, 2, '#20232a');
        const bay = std('#2e323a', 0.5, 0.5);
        for (let i = 0; i < 8; i++) at(rbox(0.036, 0.022, 0.004, 0.001, bay), -0.16 + i * 0.042, -0.012, 0.002, g);
        this.serverLeds = [];
        for (let i = 0; i < 8; i++) {
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.001), new THREE.MeshBasicMaterial({ color: '#38bdf8', toneMapped: false }));
            at(led, -0.172 + i * 0.042, -0.012, 0.0045, g);
            this.serverLeds.push(led);
        }
        this.printPlane(g, PANEL_W, 2 * U, (ctx, s, W, H) => {
            ctx.fillStyle = '#cbd5e1'; ctx.font = `700 ${Math.round(H * 0.12)}px Arial`;
            ctx.fillText('FILESERVER · FS-01', W * 0.12, H * 0.28);
        }, 0.0045);
    }

    buildUps(u) {
        const g = this.frontPlate(u, 2, '#e5e7eb');
        this.printPlane(g, PANEL_W, 2 * U, (ctx, s, W, H) => {
            ctx.fillStyle = '#0f3d2e'; ctx.fillRect(W * 0.62, H * 0.22, W * 0.22, H * 0.46);
            ctx.fillStyle = '#7dffb2'; ctx.font = `700 ${Math.round(H * 0.14)}px "Courier New"`;
            ctx.fillText('230V  42%', W * 0.635, H * 0.4); ctx.fillText('ONLINE', W * 0.635, H * 0.58);
            ctx.fillStyle = '#374151'; ctx.font = `800 ${Math.round(H * 0.16)}px Arial`; ctx.fillText('USV 3000', W * 0.1, H * 0.5);
        }, 0.0045);
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
        const on = new THREE.Color('#3cff7a'), act = new THREE.Color('#ffb13b'), off = new THREE.Color('#232a26');
        for (const sw of [1, 2]) {
            const leds = this.leds[sw];
            const state = this.ledState[sw];
            for (let i = 0; i < 24; i++) {
                const s = state[i];
                leds.setColorAt(i * 2, s ? on : off);
                const blink = s === 2 && Math.sin(t * (9 + i * 1.7) + i * 3.1) > 0.35;
                leds.setColorAt(i * 2 + 1, blink ? act : off);
            }
            leds.instanceColor.needsUpdate = true;
            if (this.sysLed?.[sw]) this.sysLed[sw].visible = Math.sin(t * 2.2) > -0.3;
        }
        if (this.serverLeds) this.serverLeds.forEach((l, i) => { l.visible = Math.sin(t * (6 + i) + i) > -0.2; });
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
        const color = SW_COLOR[sw];
        const ppPos = V(portX(pp), uCenter(PP_U) - 0.0035, 0);
        const swPos = V(portX(swPort), uCenter(sw === 1 ? SW1_U : SW2_U) - 0.004, 0);
        const out = V(0, 0, 1);
        const plugA = orientPlug(rj45Plug({ bootColor: color, cableRadius: 0.0028 }), ppPos, out, 0.012);
        const plugB = orientPlug(rj45Plug({ bootColor: color, cableRadius: 0.0028 }), swPos, out, 0.012);
        this.add(plugA, plugB);
        const a = plugAnchorWorld(plugA), b = plugAnchorWorld(plugB);
        const straight = Math.abs(ppPos.x - swPos.x) < 0.001;
        const loopZ = (sw === 1 ? 0.058 : 0.078) + (pp % 3) * 0.003;
        const midY = (a.y + b.y) / 2;
        const pts = [
            a, V(a.x, a.y - 0.004, a.z + 0.012),
            V(a.x + (b.x - a.x) * 0.25, a.y - 0.03, loopZ),
            V((a.x + b.x) / 2, midY - (straight ? 0.004 : 0.012), loopZ + (straight ? 0 : 0.012)),
            V(b.x - (b.x - a.x) * 0.25, b.y + 0.03, loopZ),
            V(b.x, b.y + 0.004, b.z + 0.012), b
        ];
        const cable = cableMesh(pts, 0.0028, jacketMaterial(color, 0.5), { radial: 10, maxSegments: 90 });
        this.add(cable);
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

