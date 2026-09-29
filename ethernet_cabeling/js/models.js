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

export function rj45Plug({ bootColor = '#2f6fe0', cableRadius = 0.0029, simple = false } = {}) {
    const g = new THREE.Group();
    const w = 0.0117, h = 0.0081, L = 0.021;
    const bootMatS = std(bootColor, 0.55);
    if (simple) {
        at(box(w, h, L, std('#d9e2ea', 0.3)), 0, 0, -L / 2, g);
        at(rbox(w + 0.0014, h + 0.0022, 0.02, 0.0028, bootMatS), 0, -0.0003, -L - 0.008, g);
        g.userData.cableAnchor = V(0, 0, -L - 0.02);
        return g;
    }
    const body = rbox(w, h, L, 0.0010, MAT.clearPlastic());
    body.position.z = -L / 2;
    body.castShadow = false;
    g.add(body);
    const core = box(w * 0.78, h * 0.42, L * 0.55, std('#8f98a6', 0.4));
    core.position.set(0, -h * 0.05, -L * 0.62);
    g.add(core);
    at(box(w - 0.0024, 0.0011, 0.0042, MAT.gold()), 0, h / 2 - 0.0011, -0.003, g);
    const latch = box(0.0062, 0.0007, 0.013, MAT.clearPlastic());
    latch.position.set(0, -h / 2 - 0.0011, -0.009);
    latch.rotation.x = -0.16;
    g.add(latch);
    const bootMat = bootMatS;
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
    if (walls.includes('front')) at(mkWall(width, height), 0, height / 2, depth, g).rotation.y = Math.PI;
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
        if (walls.includes('front')) at(box(width, 0.06, 0.014, sm), 0, 0.03, depth - 0.007, g);
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
    sky.position.z = 0.004;   // knapp vor der Wand, hinter dem Rahmen
    g.add(sky);
    return g;
}

/** Deckenleuchte (nur das Gehäuse – sie wirft keinen Schatten; Licht spendet das Level selbst) */
export function ceilingLight(w = 0.62, d = 0.62) {
    const g = new THREE.Group();
    at(box(w, 0.03, d, std('#e8e8e6', 0.5)), 0, 0, 0, g).castShadow = false;
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
    const potMat = std('#e9e6df', 0.4, 0, { side: THREE.DoubleSide });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.34, 40, 1, true), potMat);
    pot.castShadow = pot.receiveShadow = true;
    at(pot, 0, 0.17, 0, g);
    at(cyl(0.12, 0.12, 0.01, potMat, 40), 0, 0.005, 0, g);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.009, 10, 48), std('#e4e1d9', 0.4));
    rim.rotation.x = Math.PI / 2;
    at(rim, 0, 0.34, 0, g);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.154, 40), std('#3b2a1c', 0.95));
    soil.rotation.x = -Math.PI / 2;
    at(soil, 0, 0.318, 0, g);
    const leaf = std('#2f7d3b', 0.55);
    const leaf2 = std('#3f9a4b', 0.55);
    const stemMat = std('#3d6b2c', 0.7);
    const up = V(0, 1, 0);
    for (let i = 0; i < 14; i++) {
        const a = i * 2.39;
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), i % 2 ? leaf : leaf2);
        l.scale.set(0.5, 3.2 + (i % 3) * 0.6, 1.2);
        const tilt = 0.25 + (i % 4) * 0.12;
        l.position.set(Math.cos(a) * 0.07, 0.33 + height * 0.3 + (i % 3) * 0.06, Math.sin(a) * 0.07);
        l.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
        l.castShadow = true;
        g.add(l);
        // Stiel: von der Erde bis in den Blattansatz
        const axis = up.clone().applyEuler(l.rotation);
        const top = l.position.clone().addScaledVector(axis, -0.06 * l.scale.y * 0.8);
        const foot = V(top.x * 0.25, 0.31, top.z * 0.25);
        const dir = top.clone().sub(foot);
        const stem = cyl(0.005, 0.008, dir.length(), stemMat, 8);
        stem.position.copy(foot).addScaledVector(dir, 0.5);
        stem.quaternion.setFromUnitVectors(up, dir.normalize());
        g.add(stem);
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

/** openings: runde Durchbrüche in der Rückwand [{ x, y, r }] (x ab linkem Ende, y ab Mitte) */
export function buildDuct({ length = 2, height = 0.13, depth = 0.065, divider = true, capLeft = false, capRight = true, openings = [] } = {}) {
    const g = new THREE.Group();
    const mat = MAT.ductWhite();
    const inner = std('#e8e5dd', 0.55);
    const t = 0.0024;
    if (openings.length) {
        const s = new THREE.Shape();
        s.moveTo(0, -height / 2);
        s.lineTo(length, -height / 2);
        s.lineTo(length, height / 2);
        s.lineTo(0, height / 2);
        s.closePath();
        for (const o of openings) s.holes.push(new THREE.Path().absarc(o.x, o.y, o.r, 0, Math.PI * 2, true));
        const back = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 24 }), inner);
        back.castShadow = back.receiveShadow = true;
        g.add(back);
    } else {
        at(box(length, height, t, inner), length / 2, 0, t / 2, g);
    }
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

// Abgerundetes Rechteck als Pfad (Mitte cx/cy)
function roundedRectPath(w, h, r, cx = 0, cy = 0, path = new THREE.Shape()) {
    const x = cx - w / 2, y = cy - h / 2;
    path.moveTo(x + r, y);
    path.lineTo(x + w - r, y);
    path.quadraticCurveTo(x + w, y, x + w, y + r);
    path.lineTo(x + w, y + h - r);
    path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    path.lineTo(x + r, y + h);
    path.quadraticCurveTo(x, y + h, x, y + h - r);
    path.lineTo(x, y + r);
    path.quadraticCurveTo(x, y, x + r, y);
    return path;
}

/** Fläche mit Löchern extrudieren; Ergebnis liegt zwischen z = 0 und der Gesamtdicke. */
function extrudeZ(shape, depth, bevel = 0) {
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12
    });
    geo.computeBoundingBox();
    geo.translate(0, 0, -geo.boundingBox.min.z);
    geo.computeVertexNormals();
    return geo;
}

const PURE_WHITE = '#f4f3ee';        // reinweiß (RAL 9010), glänzend

/** Abdeckrahmen 80,8 × 80,8 mm mit 55er-Öffnung (Schalterprogramm-Optik) */
function coverFrame(g) {
    const shape = roundedRectPath(0.0808, 0.0808, 0.0075);
    shape.holes.push(roundedRectPath(0.055, 0.055, 0.0022, 0, 0, new THREE.Path()));
    const frame = new THREE.Mesh(extrudeZ(shape, 0.0072, 0.0011), std(PURE_WHITE, 0.3));
    frame.castShadow = frame.receiveShadow = true;
    g.add(frame);
    // dunkle Fuge zwischen Rahmen und Zentralplatte (nur als Ring, damit Aussparungen frei bleiben)
    const gap = roundedRectPath(0.0552, 0.0552, 0.0022);
    gap.holes.push(roundedRectPath(0.0488, 0.0488, 0.0014, 0, 0, new THREE.Path()));
    const ring = new THREE.Mesh(extrudeZ(gap, 0.002), std('#aeb2b8', 0.6, 0.3));
    ring.position.z = 0.003;
    g.add(ring);
}

/** Zentralplatte 50 × 50 mm (Vorderseite bei z = 0,0105) mit optionalen Löchern */
function centralPlate(g, holes = []) {
    const shape = roundedRectPath(0.05, 0.05, 0.0016);
    holes.forEach(h => shape.holes.push(h));
    const plate = new THREE.Mesh(extrudeZ(shape, 0.002, 0.0005), std(PURE_WHITE, 0.3));
    plate.position.z = 0.0075;
    plate.castShadow = plate.receiveShadow = true;
    g.add(plate);
}

/**
 * Netzwerk-Doppeldose, wie in Deutschland üblich: Abdeckrahmen + Zentralplatte 50 × 50
 * mit zwei RJ45-Buchsen im Schrägauslass, Staubschutzklappen und Beschriftungsfeld.
 * Zeigt nach +Z, Ursprung = Rückseite Mitte.
 */
export function dataOutlet({ ports = ['DD1-1', 'DD1-2'] } = {}) {
    const g = new THREE.Group();
    const ZF = 0.0105;                           // Vorderkante Zentralplatte
    const TILT = 0.5;                            // Schrägauslass ≈ 29°
    const BAY_W = 0.016, BAY_H = 0.018, BAY_Y = -0.012;
    const depth = BAY_H * Math.tan(TILT);
    coverFrame(g);
    centralPlate(g, [-1, 1].map(sx => roundedRectPath(BAY_W, BAY_H, 0.0008, sx * 0.0125, BAY_Y, new THREE.Path())));

    // Beschriftungsfeld mit Klarsichtabdeckung
    const [c, ctx] = makeCanvas(640, 170);
    ctx.fillStyle = '#d7d5ce'; ctx.beginPath(); ctx.roundRect(0, 0, 640, 170, 22); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(16, 16, 608, 138);
    ctx.fillStyle = '#c9c7c0'; ctx.fillRect(318, 28, 4, 114);
    ctx.fillStyle = '#111827'; ctx.font = '700 64px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ports[0], 168, 88); ctx.fillText(ports[1], 472, 88);
    const field = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.0101), std('#ffffff', 0.12, 0, {
        map: canvasTexture(c, { wrap: false }), polygonOffset: true, polygonOffsetFactor: -2
    }));
    at(field, 0, 0.0135, ZF + 0.0002, g);

    const bayMat = std('#e7e5df', 0.45);
    const jacks = [];
    ports.forEach((name, i) => {
        const bx = (i === 0 ? -1 : 1) * 0.0125;
        // Schacht: Boden und Seitenwände
        at(box(BAY_W, 0.0012, depth, bayMat), bx, BAY_Y - BAY_H / 2 + 0.0006, ZF - depth / 2, g).castShadow = false;
        for (const sx of [-1, 1]) at(box(0.0008, BAY_H, depth, bayMat), bx + sx * (BAY_W / 2 - 0.0004), BAY_Y, ZF - depth / 2, g).castShadow = false;
        // schräge Buchsenfläche (Normale zeigt nach vorne unten)
        const jf = new THREE.Group();
        jf.position.set(bx, BAY_Y, ZF - depth / 2);
        jf.rotation.x = TILT;
        const faceH = BAY_H / Math.cos(TILT);
        at(box(BAY_W - 0.0016, faceH, 0.001, bayMat), 0, 0, -0.0005, jf).castShadow = false;
        at(box(0.0118, 0.0086, 0.0012, std('#050608', 0.9)), 0, -0.0005, 0.0001, jf);
        const gold = MAT.gold();
        for (let k = 0; k < 8; k++) at(box(0.0006, 0.0006, 0.0004, gold), -0.0042 + k * 0.0012, 0.0028, 0.0008, jf);
        // Staubschutzklappe, oben angeschlagen – klappt beim Stecken nach innen
        const shutter = new THREE.Group();
        shutter.position.set(0, 0.0052, 0.0011);
        const flap = at(rbox(0.0136, 0.0106, 0.0008, 0.0006, std('#f7f6f2', 0.32)), 0, -0.0053, 0, shutter);
        flap.castShadow = false;
        at(box(0.006, 0.0007, 0.0009, std('#dcdad3', 0.4)), 0, -0.0098, 0.0005, shutter);
        jf.add(shutter);
        const hit = hitbox(0.02, 0.026, 0.022);
        jf.add(hit);
        g.add(jf);
        jacks.push({ name, group: jf, hit, shutter, localPos: V(0, -0.0005, 0.0007), localOut: V(0, 0, 1) });
    });
    return { group: g, jacks };
}

/** Schutzkontakt-Steckdose (Schuko) im selben Schalterprogramm */
export function schukoOutlet() {
    const g = new THREE.Group();
    const ZF = 0.0105, R = 0.0195, DEPTH = 0.009;
    coverFrame(g);
    const hole = new THREE.Path();
    hole.absarc(0, 0, R, 0, Math.PI * 2, true);
    centralPlate(g, [hole]);
    const inner = std('#ecebe6', 0.5, 0, { side: THREE.BackSide });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(R, R, DEPTH, 48, 1, true), inner);
    cup.rotation.x = Math.PI / 2;
    at(cup, 0, 0, ZF - DEPTH / 2, g);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 48), std('#e4e2dc', 0.55));
    at(floor, 0, 0, ZF - DEPTH, g);
    for (const x of [-0.0095, 0.0095]) {
        const pin = new THREE.Mesh(new THREE.CircleGeometry(0.0025, 20), std('#121315', 0.9));
        at(pin, x, 0, ZF - DEPTH + 0.0002, g);
    }
    const metal = std('#c7ccd3', 0.3, 1);
    for (const y of [R - 0.0012, -R + 0.0012]) at(box(0.009, 0.0022, DEPTH * 0.85, metal), 0, y, ZF - DEPTH / 2, g);
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
