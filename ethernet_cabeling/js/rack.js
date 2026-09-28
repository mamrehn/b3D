// ============================================================
// 19"-Netzwerkschrank: Patchpanel, Rangierpanel, Switches, Server, USV
// Gemeinsam genutzt von Station 3 (interaktiv) und Station 4 (Technikraum).
// Rack-lokale Koordinaten: Frontebene z = 0, Boden y = 0, Mitte x = 0.
// ============================================================

import * as THREE from 'three';
import {
    V, at, box, rbox, cyl, hitbox, cableMesh, rj45Plug, orientPlug, texRepeat
} from './models.js';
import { std, MAT, perforatedAlpha, makeCanvas, canvasTexture, jacketMaterial } from './materials.js';

export const U = 0.04445;
export const uBottom = u => 0.1 + (u - 1) * U;
export const uCenter = (u, n = 1) => uBottom(u) + (n * U) / 2;
export const PANEL_W = 0.4826;
export const PP_U = 33, M1_U = 32, SW1_U = 31, M2_U = 30, SW2_U = 29;
export const SW_COLOR = { 1: '#2f6fe0', 2: '#1f9d55' };
export const SW_NAME = { 1: 'Switch Büro 1', 2: 'Switch Büro 2' };

export function portX(n) {
    const i = n - 1;
    const g = Math.floor(i / 6), k = i % 6;
    return -0.2076 + g * (6 * 0.0158 + 0.012) + k * 0.0158 + 0.0079;
}

export const ppPortPos = n => V(portX(n), uCenter(PP_U) - 0.0035, 0);
export const swPortPos = (sw, n) => V(portX(n), uCenter(sw === 1 ? SW1_U : SW2_U) - 0.004, 0);

export function instancedBoxes(w, h, d, mat, positions) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, d), mat, positions.length);
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, m); });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
}

// ------------------------------------------------------------
// Schrank
// ------------------------------------------------------------

export function buildCabinet({ door = true } = {}) {
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

    if (door) {
        const d = new THREE.Group();
        const perf = std('#1d2026', 0.5, 0.6, { alphaMap: texRepeat(perforatedAlpha(), 8, 20), alphaTest: 0.5, side: THREE.DoubleSide });
        at(box(0.76, 1.9, 0.004, perf), 0.38, 0, 0, d);
        const frameMat = std('#1a1c21', 0.5, 0.6);
        at(box(0.76, 0.05, 0.02, frameMat), 0.38, 0.95, 0, d);
        at(box(0.76, 0.05, 0.02, frameMat), 0.38, -0.95, 0, d);
        at(box(0.04, 1.9, 0.02, frameMat), 0.02, 0, 0, d);
        at(box(0.04, 1.9, 0.02, frameMat), 0.74, 0, 0, d);
        at(box(0.02, 0.2, 0.03, std('#9aa1ab', 0.3, 1)), 0.7, 0, 0.02, d);
        d.position.set(-0.4, 1.05, 0.02);
        d.rotation.y = 1.95;
        rack.add(d);
    }
    return rack;
}

// ------------------------------------------------------------
// Geräte
// ------------------------------------------------------------

function frontPlate(parent, u, n, color = '#1d2026') {
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
    parent.add(g);
    return g;
}

function printPlane(g, w, h, draw, z = 0.0006) {
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

function portJacks(g, y) {
    const all = Array.from({ length: 24 }, (_, i) => i + 1);
    g.add(instancedBoxes(0.0117, 0.0085, 0.004, std('#040506', 0.95), all.map(n => V(portX(n), y, -0.0016))));
    const contacts = [];
    all.forEach(n => { for (let k = 0; k < 8; k++) contacts.push(V(portX(n) - 0.0042 + k * 0.0012, y + 0.003, 0.0)); });
    g.add(instancedBoxes(0.0005, 0.0011, 0.0006, MAT.gold(), contacts));
}

/** Patchpanel 24 Ports. Liefert die Port-Gruppen (sichtbarer Rahmen + Trefferfläche). */
export function buildPatchPanel(parent) {
    const g = frontPlate(parent, PP_U, 1);
    const y = -0.0035;
    const all = Array.from({ length: 24 }, (_, i) => i + 1);
    portJacks(g, y);
    printPlane(g, PANEL_W, U, (ctx, s, W, H) => {
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
        ctx.fillStyle = '#ee7a16';                      // oranger Punkt: DD1-1
        ctx.beginPath(); ctx.arc(cx(portX(1)), H * 0.9, H * 0.06, 0, Math.PI * 2); ctx.fill();
    });
    const ports = {};
    all.forEach(n => {
        const port = new THREE.Group();
        port.add(box(0.0148, 0.0165, 0.003, std('#2a2e35', 0.5, 0.3)));
        port.add(hitbox(0.0158, 0.022, 0.02));
        port.position.set(portX(n), uCenter(PP_U) + y, -0.0012);
        port.userData = { kind: 'pp', n };
        parent.add(port);
        ports[n] = port;
    });
    return { group: g, ports };
}

export function buildManager(parent, u) {
    const g = frontPlate(parent, u, 1, '#16181c');
    const ringMat = std('#1f2228', 0.5, 0.4);
    for (const x of [-0.17, -0.085, 0, 0.085, 0.17]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0028, 8, 20, Math.PI), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, 0, 0);
        ring.scale.set(1, 1, 0.9);
        g.add(ring);
    }
    return g;
}

/** 24-Port-Switch, Ports exakt unter den Patchpanel-Ports. */
export function buildSwitch(parent, sw, u) {
    const g = frontPlate(parent, u, 1, '#2b2f37');
    at(box(0.43, U - 0.004, 0.24, std('#23262d', 0.5, 0.6)), 0, 0, -0.125, g);
    const y = -0.004;
    const all = Array.from({ length: 24 }, (_, i) => i + 1);
    portJacks(g, y);
    printPlane(g, PANEL_W, U, (ctx, s, W, H) => {
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
    const ledMat = () => new THREE.MeshBasicMaterial({ color: '#3cff7a', toneMapped: false });
    at(new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.001), ledMat()), 0.2255, 0.0085, 0.0008, g);
    const sysLed = at(new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.001), ledMat()), 0.2255, -0.0055, 0.0008, g);
    // Port-LEDs (Link grün / Aktivität gelb) als Instanzen
    const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0032, 0.0018, 0.001), new THREE.MeshBasicMaterial({ toneMapped: false }), 48);
    const m = new THREE.Matrix4();
    const off = new THREE.Color('#232a26');
    all.forEach((n, i) => {
        m.makeTranslation(portX(n) - 0.0035, y + 0.0078, 0.0008); leds.setMatrixAt(i * 2, m); leds.setColorAt(i * 2, off);
        m.makeTranslation(portX(n) + 0.0035, y + 0.0078, 0.0008); leds.setMatrixAt(i * 2 + 1, m); leds.setColorAt(i * 2 + 1, off);
    });
    g.add(leds);
    const ports = {};
    all.forEach(n => {
        const port = new THREE.Group();
        port.add(box(0.0146, 0.0112, 0.0026, std('#3b4049', 0.45, 0.6)));
        port.add(hitbox(0.0158, 0.022, 0.02));
        port.position.set(portX(n), uCenter(u) + y, -0.0011);
        port.userData = { kind: 'sw', n, sw };
        parent.add(port);
        ports[n] = port;
    });
    return { group: g, ports, leds, sysLed };
}

export function buildBlanks(parent) {
    const blank = std('#1b1d22', 0.6, 0.5);
    for (const [u, n] of [[34, 1], [36, 2], [28, 1], [24, 1], [20, 2], [12, 3]]) {
        parent.add(at(rbox(PANEL_W, n * U - 0.001, 0.004, 0.001, blank), 0, uCenter(u, n), -0.002));
    }
}

export function buildServer(parent, u) {
    const g = frontPlate(parent, u, 2, '#20232a');
    const bay = std('#2e323a', 0.5, 0.5);
    for (let i = 0; i < 8; i++) at(rbox(0.036, 0.022, 0.004, 0.001, bay), -0.16 + i * 0.042, -0.012, 0.002, g);
    const leds = [];
    for (let i = 0; i < 8; i++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.001), new THREE.MeshBasicMaterial({ color: '#38bdf8', toneMapped: false }));
        at(led, -0.172 + i * 0.042, -0.012, 0.0045, g);
        leds.push(led);
    }
    printPlane(g, PANEL_W, 2 * U, (ctx, s, W, H) => {
        ctx.fillStyle = '#cbd5e1'; ctx.font = `700 ${Math.round(H * 0.12)}px Arial`;
        ctx.fillText('FILESERVER · FS-01', W * 0.12, H * 0.28);
    }, 0.0045);
    return { leds };
}

export function buildUps(parent, u) {
    const g = frontPlate(parent, u, 2, '#e5e7eb');
    printPlane(g, PANEL_W, 2 * U, (ctx, s, W, H) => {
        ctx.fillStyle = '#0f3d2e'; ctx.fillRect(W * 0.62, H * 0.22, W * 0.22, H * 0.46);
        ctx.fillStyle = '#7dffb2'; ctx.font = `700 ${Math.round(H * 0.14)}px "Courier New"`;
        ctx.fillText('230V  42%', W * 0.635, H * 0.4); ctx.fillText('ONLINE', W * 0.635, H * 0.58);
        ctx.fillStyle = '#374151'; ctx.font = `800 ${Math.round(H * 0.16)}px Arial`; ctx.fillText('USV 3000', W * 0.1, H * 0.5);
    }, 0.0045);
}

/** Kompletter Schrank mit allen Geräten. */
export function buildFullRack(parent, { door = true } = {}) {
    parent.add(buildCabinet({ door }));
    const pp = buildPatchPanel(parent);
    buildManager(parent, M1_U);
    buildManager(parent, M2_U);
    const sw1 = buildSwitch(parent, 1, SW1_U);
    const sw2 = buildSwitch(parent, 2, SW2_U);
    buildBlanks(parent);
    const server = buildServer(parent, 25);
    buildUps(parent, 3);
    return { pp, sw: { 1: sw1, 2: sw2 }, serverLeds: server.leds };
}

// ------------------------------------------------------------
// Patchkabel (rack-lokal)
// ------------------------------------------------------------

function plugAnchorLocal(plug) {
    plug.updateMatrix();
    return plug.userData.cableAnchor.clone().applyMatrix4(plug.matrix);
}

/** Patchkabel PP-Port → Switch-Port inkl. Stecker, in rack-lokalen Koordinaten. */
export function makePatch(pp, sw, swPort, { simple = false } = {}) {
    const color = SW_COLOR[sw];
    const out = V(0, 0, 1);
    const plugA = orientPlug(rj45Plug({ bootColor: color, cableRadius: 0.0028, simple }), ppPortPos(pp), out, 0.012);
    const plugB = orientPlug(rj45Plug({ bootColor: color, cableRadius: 0.0028, simple }), swPortPos(sw, swPort), out, 0.012);
    const a = plugAnchorLocal(plugA), b = plugAnchorLocal(plugB);
    const straight = Math.abs(a.x - b.x) < 0.001;
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
    return { cable, plugA, plugB, curve: cable.userData.curve };
}

// ------------------------------------------------------------
// LEDs: state 0 = aus, 1 = Link, 2 = Link + Aktivität
// ------------------------------------------------------------

const C_ON = new THREE.Color('#3cff7a'), C_ACT = new THREE.Color('#ffb13b'), C_OFF = new THREE.Color('#232a26');

export function updateSwitchLeds(sw, state, t, busy = null) {
    for (let i = 0; i < 24; i++) {
        const s = state[i];
        sw.leds.setColorAt(i * 2, s ? C_ON : C_OFF);
        const rate = busy?.has(i + 1) ? 34 : 9 + i * 1.7;
        const blink = s === 2 && Math.sin(t * rate + i * 3.1) > (busy?.has(i + 1) ? -0.2 : 0.35);
        sw.leds.setColorAt(i * 2 + 1, blink ? C_ACT : C_OFF);
    }
    sw.leds.instanceColor.needsUpdate = true;
    sw.sysLed.visible = Math.sin(t * 2.2) > -0.3;
}
