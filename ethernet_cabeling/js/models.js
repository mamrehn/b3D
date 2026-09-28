// ============================================================
// Wiederverwendbare 3D-Modelle (Maßeinheit: Meter)
// ============================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
    MAT, std, jacketMaterial, paintTexture, woodTexture, keyboardTexture,
    canvasTexture, makeCanvas
} from './materials.js';
import { makeTextPlane } from './labels.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------
// Grundformen
// ------------------------------------------------------------

export function rbox(w, h, d, r, mat, seg = 2) {
    const rr = Math.max(1e-5, Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5));
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, rr), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function box(w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function cyl(rt, rb, h, mat, seg = 24) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function at(obj, x, y, z, parent) {
    obj.position.set(x, y, z);
    if (parent) parent.add(obj);
    return obj;
}

/** Unsichtbare, aber anklickbare Trefferfläche */
export function hitbox(w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
    m.material.visible = false;
    return m;
}

export function texRepeat(tex, rx, ry) {
    const t = tex.clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    return t;
}

// ------------------------------------------------------------
// Kabel
// ------------------------------------------------------------

export function cableCurve(points, tension = 0.5) {
    return new THREE.CatmullRomCurve3(points.map(p => (p.isVector3 ? p : V(p[0], p[1], p[2]))), false, 'centripetal', tension);
}

export function cableMesh(curveOrPoints, radius, mat, { radial = 12, segments = null, maxSegments = 420 } = {}) {
    const curve = Array.isArray(curveOrPoints) ? cableCurve(curveOrPoints) : curveOrPoints;
    const len = curve.getLength();
    const seg = segments ?? THREE.MathUtils.clamp(Math.ceil(len / (radius * 2.2)), 16, maxSegments);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, radius, radial, false), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.curve = curve;
    m.userData.segments = seg;
    m.userData.radial = radial;
    m.userData.length = len;
    return m;
}

/** Zeigt nur die ersten t·100 % eines Rohrs (für "Einziehen"-Animationen). */
export function setTubeProgress(mesh, t) {
    const { segments, radial } = mesh.userData;
    const n = Math.max(0, Math.min(segments, Math.ceil(t * segments)));
    mesh.geometry.setDrawRange(0, n * radial * 6);
}

/** Zwei Adern, die entlang einer Kurve miteinander verdrillt sind. */
export function twistedPairPoints(curve, { separation, twistsPerUnit, samples = 120, phase = 0 }) {
    const frames = curve.computeFrenetFrames(samples, false);
    const len = curve.getLength();
    const a = [], b = [];
    for (let i = 0; i <= samples; i++) {
        const u = i / samples;
        const p = curve.getPointAt(u);
        const n = frames.normals[i], bn = frames.binormals[i];
        const ang = phase + u * len * twistsPerUnit * Math.PI * 2;
        const off = n.clone().multiplyScalar(Math.cos(ang) * separation / 2).add(bn.clone().multiplyScalar(Math.sin(ang) * separation / 2));
        a.push(p.clone().add(off));
        b.push(p.clone().sub(off));
    }
    return [a, b];
}

// ------------------------------------------------------------
// RJ45-Stecker (Ursprung = Kontaktspitze, +Z zeigt in die Buchse)
// ------------------------------------------------------------

export function rj45Plug({ bootColor = '#2f6fe0', cableRadius = 0.0029 } = {}) {
    const g = new THREE.Group();
    const w = 0.0117, h = 0.0081, L = 0.021;
    const body = rbox(w, h, L, 0.0010, MAT.clearPlastic());
    body.position.z = -L / 2;
    body.castShadow = false;
    g.add(body);
    const core = box(w * 0.78, h * 0.42, L * 0.55, std('#8f98a6', 0.4));
    core.position.set(0, -h * 0.05, -L * 0.62);
    g.add(core);
    const gold = MAT.gold();
    for (let i = 0; i < 8; i++) {
        at(box(0.0006, 0.0011, 0.0042, gold), -w / 2 + 0.0014 + i * (w - 0.0028) / 7, h / 2 - 0.0011, -0.003, g);
    }
    const latch = box(0.0062, 0.0007, 0.013, MAT.clearPlastic());
    latch.position.set(0, -h / 2 - 0.0011, -0.009);
    latch.rotation.x = -0.16;
    g.add(latch);
    const bootMat = std(bootColor, 0.55);
    at(rbox(w + 0.0014, h + 0.0022, 0.016, 0.0028, bootMat), 0, -0.0003, -L - 0.006, g);
    const relief = cyl(cableRadius * 1.25, cableRadius * 1.6, 0.012, bootMat, 16);
    relief.rotation.x = Math.PI / 2;
    relief.position.z = -L - 0.019;
    g.add(relief);
    g.userData.cableAnchor = V(0, 0, -L - 0.024);
    return g;
}

/** Richtet einen Stecker so aus, dass er in eine Buchse zeigt. */
export function orientPlug(plug, portPos, outward, insertion = 0) {
    const pos = portPos.clone().add(outward.clone().multiplyScalar(-insertion));
    plug.position.copy(pos);
    const up = Math.abs(outward.y) > 0.95 ? V(0, 0, 1) : V(0, 1, 0);
    const m = new THREE.Matrix4().lookAt(pos, pos.clone().sub(outward), up);
    plug.quaternion.setFromRotationMatrix(m);
    plug.rotateY(Math.PI); // Matrix4.lookAt richtet -Z aus → umdrehen
    return plug;
}

export function plugAnchorWorld(plug) {
    plug.updateMatrixWorld(true);
    return plug.localToWorld(plug.userData.cableAnchor.clone());
}

// ------------------------------------------------------------
// Raum
// ------------------------------------------------------------

export function buildRoom({
    width = 6, depth = 5, height = 2.8,
    floorMap = null, floorRepeat = [3, 3], floorColor = '#ffffff', floorRough = 0.6,
    wallColor = '#ebe7de', ceiling = true, skirting = '#f4f2ec', walls = ['back', 'left', 'right']
} = {}) {
    const g = new THREE.Group();
    const floorMat = std(floorColor, floorRough, 0, floorMap ? { map: texRepeat(floorMap, floorRepeat[0], floorRepeat[1]) } : {});
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, depth / 2);
    floor.receiveShadow = true;
    g.add(floor);

    const wallTex = paintTexture(wallColor);
    const mkWall = (w, h) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std('#ffffff', 0.92, 0, { map: texRepeat(wallTex, w / 1.5, h / 1.5) }));
        m.receiveShadow = true;
        return m;
    };
    if (walls.includes('back')) at(mkWall(width, height), 0, height / 2, 0, g);
    if (walls.includes('left')) {
        const lw = at(mkWall(depth, height), -width / 2, height / 2, depth / 2, g);
        lw.rotation.y = Math.PI / 2;
    }
    if (walls.includes('right')) {
        const rw = at(mkWall(depth, height), width / 2, height / 2, depth / 2, g);
        rw.rotation.y = -Math.PI / 2;
    }
    if (ceiling) {
        const c = at(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), std('#f7f7f4', 0.95)), 0, height, depth / 2, g);
        c.rotation.x = Math.PI / 2;
    }
    if (skirting) {
        const sm = std(skirting, 0.5);
        if (walls.includes('back')) at(box(width, 0.06, 0.014, sm), 0, 0.03, 0.007, g);
        if (walls.includes('left')) at(box(0.014, 0.06, depth, sm), -width / 2 + 0.007, 0.03, depth / 2, g);
        if (walls.includes('right')) at(box(0.014, 0.06, depth, sm), width / 2 - 0.007, 0.03, depth / 2, g);
    }
    return g;
}

function skyTexture() {
    const [c, ctx] = makeCanvas(512, 512);
    const grd = ctx.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#8fc3ec');
    grd.addColorStop(0.6, '#d6ebf7');
    grd.addColorStop(1, '#eef6fb');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const [x, y, s] of [[90, 110, 50], [140, 95, 38], [360, 160, 44], [400, 150, 30]]) {
        ctx.beginPath(); ctx.ellipse(x, y, s * 1.7, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
    const bld = [[0, 380, 70], [60, 330, 60], [130, 400, 90], [230, 350, 55], [290, 300, 80], [380, 370, 70], [440, 340, 80]];
    for (const [x, y, w] of bld) {
        ctx.fillStyle = '#b6c3cf';
        ctx.fillRect(x, y, w, 512 - y);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let yy = y + 12; yy < 500; yy += 22) for (let xx = x + 8; xx < x + w - 8; xx += 16) ctx.fillRect(xx, yy, 8, 10);
    }
    return canvasTexture(c, { wrap: false });
}

/** Fenster (zeigt nach +Z), Ursprung = Mitte der Glasfläche */
export function windowPanel({ w = 1.2, h = 1.35 } = {}) {
    const g = new THREE.Group();
    const frameMat = std('#f5f5f2', 0.4);
    const f = 0.06;
    at(rbox(w + f * 2, f, 0.08, 0.008, frameMat), 0, h / 2 + f / 2, 0.02, g);
    at(rbox(w + f * 2, f, 0.08, 0.008, frameMat), 0, -h / 2 - f / 2, 0.02, g);
    at(rbox(f, h, 0.08, 0.008, frameMat), -w / 2 - f / 2, 0, 0.02, g);
    at(rbox(f, h, 0.08, 0.008, frameMat), w / 2 + f / 2, 0, 0.02, g);
    at(rbox(0.04, h, 0.06, 0.006, frameMat), 0, 0, 0.02, g);
    at(rbox(w + 0.3, 0.03, 0.2, 0.008, std('#e9e7e1', 0.35)), 0, -h / 2 - f - 0.015, 0.1, g);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: skyTexture(), toneMapped: false }));
    sky.position.z = -0.01;
    g.add(sky);
    return g;
}

export function ceilingLight(w = 0.62, d = 0.62) {
    const g = new THREE.Group();
    at(box(w, 0.03, d, std('#e8e8e6', 0.5)), 0, 0, 0, g);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, d - 0.04), new THREE.MeshBasicMaterial({ color: '#fffdf6', toneMapped: false }));
    panel.rotation.x = Math.PI / 2;
    panel.position.y = -0.0152;
    g.add(panel);
    return g;
}

// ------------------------------------------------------------
// Möbel & Deko
// ------------------------------------------------------------

export function desk({ w = 1.6, d = 0.8, h = 0.74, wood = '#d9bf95' } = {}) {
    const g = new THREE.Group();
    const top = rbox(w, 0.026, d, 0.005, std('#ffffff', 0.55, 0, { map: texRepeat(woodTexture(wood), 1, 1) }));
    top.position.y = h - 0.013;
    g.add(top);
    const metal = std('#3a3f47', 0.45, 0.7);
    for (const sx of [-1, 1]) {
        const x = sx * (w / 2 - 0.09);
        at(box(0.06, h - 0.07, 0.06, metal), x, (h - 0.07) / 2 + 0.03, 0, g);
        at(rbox(0.07, 0.03, d - 0.06, 0.01, metal), x, 0.015, 0, g);
        at(box(0.05, 0.03, d - 0.12, metal), x, h - 0.04, 0, g);
    }
    at(box(w - 0.24, 0.05, 0.02, metal), 0, h - 0.06, -d / 2 + 0.1, g);
    return g;
}

export function officeChair(color = '#2a3140') {
    const g = new THREE.Group();
    const fabric = std(color, 0.9);
    const dark = std('#1a1c20', 0.5, 0.4);
    at(rbox(0.5, 0.08, 0.48, 0.03, fabric), 0, 0.47, 0, g);
    const back = at(rbox(0.46, 0.55, 0.07, 0.035, fabric), 0, 0.82, -0.24, g);
    back.rotation.x = -0.1;
    at(box(0.05, 0.3, 0.03, dark), 0, 0.6, -0.27, g);
    at(cyl(0.025, 0.025, 0.28, std('#9aa1ab', 0.3, 1)), 0, 0.3, 0, g);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spoke = at(box(0.3, 0.03, 0.045, dark), Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15, g);
        spoke.rotation.y = -a;
        at(new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), dark), Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3, g);
    }
    return g;
}

export function plant(height = 0.9) {
    const g = new THREE.Group();
    at(cyl(0.16, 0.12, 0.34, std('#e9e6df', 0.4)), 0, 0.17, 0, g);
    at(cyl(0.15, 0.15, 0.02, std('#3b2a1c', 0.95)), 0, 0.33, 0, g);
    const leaf = std('#2f7d3b', 0.55);
    const leaf2 = std('#3f9a4b', 0.55);
    for (let i = 0; i < 14; i++) {
        const a = i * 2.39;
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), i % 2 ? leaf : leaf2);
        l.scale.set(0.5, 3.2 + (i % 3) * 0.6, 1.2);
        const tilt = 0.25 + (i % 4) * 0.12;
        l.position.set(Math.cos(a) * 0.07, 0.33 + height * 0.3 + (i % 3) * 0.06, Math.sin(a) * 0.07);
        l.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
        l.castShadow = true;
        g.add(l);
    }
    return g;
}

export function whiteboard(w = 1.4, h = 0.9) {
    const g = new THREE.Group();
    at(rbox(w, h, 0.02, 0.006, std('#b8bec6', 0.3, 0.8)), 0, 0, 0.01, g);
    const [c, ctx] = makeCanvas(1024, 660);
    ctx.fillStyle = '#fbfbf9';
    ctx.fillRect(0, 0, 1024, 660);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 5;
    ctx.font = '600 44px "Segoe Print", "Comic Sans MS", cursive';
    ctx.fillStyle = '#1d4ed8';
    ctx.fillText('Netzwerkplan Büro 1', 60, 80);
    const node = (x, y, t) => { ctx.strokeRect(x, y, 170, 80); ctx.font = '600 30px "Segoe Print", cursive'; ctx.fillText(t, x + 18, y + 50); };
    node(60, 220, 'PC 1'); node(60, 420, 'PC 2'); node(420, 320, 'Switch'); node(760, 320, 'Router');
    ctx.beginPath(); ctx.moveTo(230, 260); ctx.lineTo(420, 350); ctx.moveTo(230, 460); ctx.lineTo(420, 370); ctx.moveTo(590, 360); ctx.lineTo(760, 360); ctx.stroke();
    ctx.fillStyle = '#b91c1c';
    ctx.font = '600 28px "Segoe Print", cursive';
    ctx.fillText('192.168.1.0/24', 380, 470);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.04), std('#ffffff', 0.25, 0, { map: canvasTexture(c, { wrap: false }) }));
    board.position.z = 0.021;
    g.add(board);
    return g;
}

// ------------------------------------------------------------
// Brüstungskanal (Ursprung: linkes Ende, Mitte der Höhe, an der Wand)
// ------------------------------------------------------------

export function buildDuct({ length = 2, height = 0.13, depth = 0.065, divider = true, capLeft = false, capRight = true } = {}) {
    const g = new THREE.Group();
    const mat = MAT.ductWhite();
    const inner = std('#e8e5dd', 0.55);
    const t = 0.0024;
    at(box(length, height, t, inner), length / 2, 0, t / 2, g);
    at(box(length, t, depth - 0.002, mat), length / 2, height / 2 - t / 2, (depth - 0.002) / 2, g);
    at(box(length, t, depth - 0.002, mat), length / 2, -height / 2 + t / 2, (depth - 0.002) / 2, g);
    at(rbox(length, 0.007, 0.005, 0.002, mat), length / 2, height / 2 - 0.0045, depth - 0.0035, g);
    at(rbox(length, 0.007, 0.005, 0.002, mat), length / 2, -height / 2 + 0.0045, depth - 0.0035, g);
    if (divider) {
        at(box(length, 0.0018, depth * 0.8, mat), length / 2, 0, depth * 0.4 + t, g);
        at(rbox(length, 0.005, 0.004, 0.0015, mat), length / 2, 0, depth * 0.8 + t, g);
    }
    const screwMat = std('#b5bac2', 0.3, 1);
    for (let x = 0.15; x < length - 0.05; x += 0.5) {
        for (const y of [height * 0.25, -height * 0.25]) {
            const s = cyl(0.0045, 0.0045, 0.002, screwMat, 16);
            s.rotation.x = Math.PI / 2;
            at(s, x, y, t + 0.001, g);
        }
    }
    const cap = () => rbox(0.008, height + 0.006, depth + 0.008, 0.003, mat);
    if (capLeft) at(cap(), 0, 0, depth / 2, g);
    if (capRight) at(cap(), length, 0, depth / 2, g);
    return { group: g, length, height, depth };
}

/** Gewölbtes Kanal-Oberteil, Ursprung wie beim Kanal (linkes Ende, Mitte, Innenseite) */
export function ductCover({ length = 2, height = 0.13, bulge = 0.005, thickness = 0.0024 } = {}) {
    const h = height / 2;
    const s = new THREE.Shape();
    s.moveTo(0, -h);
    s.quadraticCurveTo(bulge * 2, 0, 0, h);
    s.lineTo(-thickness, h);
    s.quadraticCurveTo(bulge * 2 - thickness, 0, -thickness, -h);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 18 });
    const mesh = new THREE.Mesh(geo, MAT.ductWhite());
    mesh.rotation.y = -Math.PI / 2;
    mesh.position.x = length;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const g = new THREE.Group();
    g.add(mesh);
    return g;
}

// ------------------------------------------------------------
// Datendose & Steckdose für den Kanaleinbau (zeigt nach +Z)
// ------------------------------------------------------------

export function dataOutlet({ title = 'DD1', ports = ['DD1-1', 'DD1-2'] } = {}) {
    const g = new THREE.Group();
    const white = MAT.plasticWhite();
    at(rbox(0.084, 0.084, 0.012, 0.007, white), 0, 0, 0.006, g);
    at(rbox(0.058, 0.058, 0.006, 0.004, std('#f7f6f2', 0.35)), 0, 0, 0.014, g);
    const field = makeTextPlane(title, { width: 0.03, height: 0.009, fg: '#1f2937', bg: '#ffffff', fontScale: 0.8 });
    at(field, 0, 0.034, 0.0125, g);
    const jacks = [];
    ports.forEach((name, i) => {
        const jg = new THREE.Group();
        jg.position.set(i === 0 ? -0.0135 : 0.0135, 0.004, 0.017);
        jg.rotation.x = 0.42;                                   // Schrägauslass nach unten
        at(rbox(0.021, 0.022, 0.01, 0.002, std('#eceae4', 0.4)), 0, 0, 0, jg);
        at(box(0.0118, 0.0086, 0.006, std('#0b0c0e', 0.9)), 0, -0.001, 0.0024, jg);
        const gold = MAT.gold();
        for (let k = 0; k < 8; k++) at(box(0.0006, 0.0006, 0.004, gold), -0.0042 + k * 0.0012, 0.0025, 0.0018, jg);
        const shutterPivot = new THREE.Group();
        shutterPivot.position.set(0, 0.0055, 0.0056);
        const shutter = at(rbox(0.0142, 0.0108, 0.0012, 0.0008, std('#f4f3ef', 0.35)), 0, -0.0054, 0, shutterPivot);
        shutter.castShadow = false;
        jg.add(shutterPivot);
        const hit = hitbox(0.022, 0.024, 0.02);
        hit.position.z = 0.004;
        jg.add(hit);
        const label = makeTextPlane(name, { width: 0.022, height: 0.006, fg: '#111827', fontScale: 0.85 });
        at(label, i === 0 ? -0.0135 : 0.0135, -0.019, 0.0172, g);
        g.add(jg);
        jacks.push({
            name, group: jg, hit, shutter: shutterPivot,
            localPos: V(0, -0.001, 0.0056),
            localOut: V(0, 0, 1)
        });
    });
    return { group: g, jacks };
}

export function schukoOutlet() {
    const g = new THREE.Group();
    at(rbox(0.084, 0.084, 0.012, 0.007, MAT.plasticWhite()), 0, 0, 0.006, g);
    const insert = cyl(0.026, 0.026, 0.006, std('#f7f6f2', 0.35), 40);
    insert.rotation.x = Math.PI / 2;
    at(insert, 0, 0, 0.014, g);
    const recess = cyl(0.0195, 0.0195, 0.003, std('#d9d7d0', 0.6), 40);
    recess.rotation.x = Math.PI / 2;
    at(recess, 0, 0, 0.0158, g);
    for (const x of [-0.0095, 0.0095]) {
        const hole = cyl(0.0024, 0.0024, 0.002, std('#1b1b1b', 0.9), 16);
        hole.rotation.x = Math.PI / 2;
        at(hole, x, 0, 0.0171, g);
    }
    const metal = std('#c7ccd3', 0.3, 1);
    at(box(0.008, 0.003, 0.004, metal), 0, 0.0175, 0.017, g);
    at(box(0.008, 0.003, 0.004, metal), 0, -0.0175, 0.017, g);
    return g;
}

// ------------------------------------------------------------
// PC, Monitor, Peripherie
// ------------------------------------------------------------

/** PC-Tower: Ursprung unten Mitte, Front = +Z, Rückseite = −Z */
export function pcTower({ accent = '#3b82f6' } = {}) {
    const g = new THREE.Group();
    const W = 0.2, H = 0.44, D = 0.43;
    const body = rbox(W, H, D, 0.012, std('#1c1f25', 0.42, 0.45));
    body.position.y = H / 2;
    g.add(body);
    at(rbox(W - 0.008, H - 0.02, 0.012, 0.006, std('#121418', 0.6)), 0, H / 2, D / 2 + 0.002, g);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.004, H - 0.08, 0.002), new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }));
    at(strip, W * 0.33, H / 2, D / 2 + 0.009, g);
    const btn = cyl(0.009, 0.009, 0.004, std('#2a2e35', 0.3, 0.6), 24);
    btn.rotation.x = Math.PI / 2;
    at(btn, 0, H - 0.04, D / 2 + 0.009, g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.0012, 8, 32), new THREE.MeshBasicMaterial({ color: '#60a5fa', toneMapped: false }));
    at(ring, 0, H - 0.04, D / 2 + 0.011, g);
    for (const [x, z] of [[-0.07, -0.17], [0.07, -0.17], [-0.07, 0.17], [0.07, 0.17]]) at(cyl(0.012, 0.012, 0.01, MAT.rubber()), x, -0.004, z, g);

    // --- Rückseite ---
    const back = -D / 2 - 0.002;
    const panel = std('#2a2e35', 0.5, 0.7);
    at(box(W - 0.01, H - 0.01, 0.003, panel), 0, H / 2, back, g);
    // Netzteil unten
    const psu = at(box(0.15, 0.086, 0.004, std('#3b4048', 0.45, 0.8)), 0.01, 0.06, back - 0.002, g);
    psu.castShadow = false;
    const grille = std('#15171b', 0.6, 0.5);
    for (const r of [0.008, 0.016, 0.024, 0.032]) {
        at(new THREE.Mesh(new THREE.TorusGeometry(r, 0.0011, 6, 36), grille), 0.035, 0.06, back - 0.004, g);
    }
    at(box(0.028, 0.02, 0.004, std('#0e0f11', 0.8)), -0.045, 0.07, back - 0.005, g);
    at(box(0.012, 0.016, 0.004, std('#b91c1c', 0.5)), -0.045, 0.042, back - 0.005, g);
    // Lüfter oben
    for (const r of [0.012, 0.024, 0.036, 0.048]) {
        at(new THREE.Mesh(new THREE.TorusGeometry(r, 0.0011, 6, 40), grille), 0.035, H - 0.1, back - 0.003, g);
    }
    at(cyl(0.01, 0.01, 0.004, grille, 20), 0.035, H - 0.1, back - 0.003, g).rotation.x = Math.PI / 2;
    // I/O-Blende
    const ioX = -0.058;
    at(box(0.05, 0.17, 0.003, MAT.steel()), ioX, H - 0.12, back - 0.003, g);
    const usb = (y, c) => at(box(0.014, 0.006, 0.004, std(c, 0.5)), ioX, y, back - 0.005, g);
    usb(H - 0.05, '#1f4fd1'); usb(H - 0.06, '#1f4fd1'); usb(H - 0.075, '#111');
    usb(H - 0.085, '#111');
    // LAN-Buchse mit LEDs (eigene Gruppe → anklickbar & hervorhebbar)
    const lanY = H - 0.115;
    const lan = new THREE.Group();
    g.add(lan);
    at(box(0.019, 0.017, 0.006, std('#b8bec7', 0.35, 1)), ioX, lanY, back - 0.004, lan);
    at(box(0.0125, 0.0105, 0.004, std('#060708', 0.9)), ioX, lanY - 0.0005, back - 0.0065, lan);
    const ledGreen = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.002), new THREE.MeshBasicMaterial({ color: '#1f2a22', toneMapped: false }));
    const ledOrange = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.002), new THREE.MeshBasicMaterial({ color: '#2a2418', toneMapped: false }));
    at(ledGreen, ioX - 0.0055, lanY + 0.0063, back - 0.0075, g);
    at(ledOrange, ioX + 0.0055, lanY + 0.0063, back - 0.0075, g);
    usb(H - 0.14, '#1f4fd1'); usb(H - 0.15, '#1f4fd1');
    ['#65a30d', '#ec4899', '#38bdf8'].forEach((c, i) => {
        const a = cyl(0.0035, 0.0035, 0.004, std(c, 0.4), 16);
        a.rotation.x = Math.PI / 2;
        at(a, ioX, H - 0.17 - i * 0.011, back - 0.005, g);
    });
    // Slotblenden
    for (let i = 0; i < 6; i++) at(box(0.12, 0.006, 0.003, std('#50565f', 0.4, 0.8)), 0.02, 0.23 - i * 0.018, back - 0.003, g);
    // Grafikkarte mit Monitoranschluss
    at(box(0.12, 0.012, 0.004, std('#111318', 0.5)), 0.02, 0.23, back - 0.005, g);
    at(box(0.014, 0.006, 0.004, std('#060708', 0.9)), -0.01, 0.23, back - 0.007, g);
    at(box(0.014, 0.006, 0.004, std('#060708', 0.9)), 0.015, 0.23, back - 0.007, g);

    const lanHit = hitbox(0.034, 0.03, 0.03);
    lanHit.position.set(ioX, lanY, back - 0.004);
    lan.add(lanHit);

    return {
        group: g, body,
        lan,
        lanLocal: V(ioX, lanY - 0.0005, back - 0.0085),
        lanOutLocal: V(0, 0, -1),
        psuInletLocal: V(-0.045, 0.07, back - 0.007),
        leds: { link: ledGreen, act: ledOrange },
        size: { W, H, D }
    };
}

/** Monitor: Ursprung = Standfuß auf der Tischplatte, Bildschirm zeigt nach +Z */
export function monitor({ w = 0.6, h = 0.35, canvasW = 1280, canvasH = 760 } = {}) {
    const g = new THREE.Group();
    const dark = std('#16181d', 0.45, 0.3);
    const standH = 0.12;
    at(rbox(0.24, 0.012, 0.18, 0.005, std('#2c3038', 0.35, 0.8)), 0, 0.006, 0, g);
    at(rbox(0.05, 0.22, 0.022, 0.008, std('#2c3038', 0.35, 0.8)), 0, standH + 0.02, -0.04, g);
    const cy = standH + h / 2 + 0.03;
    at(rbox(w, h, 0.024, 0.006, dark), 0, cy, -0.01, g);
    at(rbox(w * 0.55, h * 0.55, 0.04, 0.02, dark), 0, cy - 0.02, -0.035, g);
    const [canvas, ctx] = makeCanvas(canvasW, canvasH);
    const tex = canvasTexture(canvas, { wrap: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.018, h - 0.018), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.position.set(0, cy + 0.001, 0.0025);
    g.add(screen);
    return { group: g, screen, canvas, ctx, texture: tex, center: V(0, cy, 0.003) };
}

export function keyboard() {
    const g = new THREE.Group();
    at(rbox(0.44, 0.02, 0.14, 0.006, std('#1f2228', 0.5)), 0, 0.01, 0, g);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.13), std('#ffffff', 0.6, 0, { map: keyboardTexture() }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.0205;
    g.add(top);
    return g;
}

export function mouse() {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), std('#1f2228', 0.35));
    m.scale.set(0.62, 0.42, 1);
    m.position.y = 0.012;
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m);
    return g;
}

/** Aufgerolltes Patchkabel mit zwei Steckern (liegt auf dem Tisch) */
export function patchCoil({ color = '#9aa3ad', bootColor = '#9aa3ad' } = {}) {
    const g = new THREE.Group();
    const r = 0.068, loops = 3, rad = 0.0029;
    const pts = [];
    for (let i = 0; i <= 90; i++) {
        const t = (i / 90) * loops * Math.PI * 2;
        pts.push(V(Math.cos(t) * r * (1 + 0.05 * Math.sin(t * 2.3)), rad + 0.0015 + (i / 90) * 0.012 + Math.sin(t) * 0.002, Math.sin(t) * r * 0.82));
    }
    const mat = jacketMaterial(color, 0.5);
    const coil = cableMesh(pts, rad, mat);
    g.add(coil);
    const start = pts[0], end = pts[pts.length - 1];
    const plugA = rj45Plug({ bootColor, cableRadius: rad });
    plugA.position.set(r + 0.07, 0.0048, 0.03);
    plugA.rotation.y = Math.PI / 2 + 0.3;
    g.add(plugA);
    const plugB = rj45Plug({ bootColor, cableRadius: rad });
    plugB.position.set(r + 0.05, 0.0048, -0.07);
    plugB.rotation.y = Math.PI / 2 - 0.5;
    g.add(plugB);
    g.updateMatrixWorld(true);
    const aA = plugA.localToWorld(plugA.userData.cableAnchor.clone());
    const aB = plugB.localToWorld(plugB.userData.cableAnchor.clone());
    g.add(cableMesh([start, V(start.x + 0.02, rad + 0.002, start.z + 0.02), aA], rad, mat));
    g.add(cableMesh([end, V(end.x + 0.02, rad + 0.004, end.z - 0.03), aB], rad, mat));
    const hit = hitbox(0.26, 0.05, 0.2);
    hit.position.set(0.03, 0.02, -0.01);
    g.add(hit);
    return g;
}
