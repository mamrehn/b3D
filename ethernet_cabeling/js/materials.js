// ============================================================
// Materialien & prozedurale Texturen (keine externen Bilddateien)
// ============================================================

import * as THREE from 'three';

let ANISO = 4;
export function setAnisotropy(a) { ANISO = a; }

export function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')];
}

export function canvasTexture(canvas, { srgb = true, repeat = null, wrap = true } = {}) {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = ANISO;
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
}

// Deterministischer Zufall → Texturen sehen bei jedem Laden gleich aus
export function rng(seed = 1) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function noiseOverlay(ctx, w, h, { cells = 64, alpha = 0.08, seed = 7, mode = 'overlay' } = {}) {
    const [nc, nx] = makeCanvas(cells, cells);
    const img = nx.createImageData(cells, cells);
    const r = rng(seed);
    for (let i = 0; i < cells * cells; i++) {
        const v = Math.floor(r() * 255);
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
    }
    nx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = mode;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(nc, 0, 0, w, h);
    ctx.restore();
}

const cache = new Map();
function cached(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
}

// ------------------------------------------------------------
// Texturen
// ------------------------------------------------------------

export function paintTexture(base = '#ebe7de', seed = 3) {
    return cached(`paint${base}${seed}`, () => {
        const [c, ctx] = makeCanvas(512, 512);
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 512, 512);
        noiseOverlay(ctx, 512, 512, { cells: 256, alpha: 0.05, seed });
        noiseOverlay(ctx, 512, 512, { cells: 32, alpha: 0.05, seed: seed + 1 });
        return canvasTexture(c);
    });
}

function woodGrain(ctx, x, y, w, h, base, r, { lines = 26, dark = 0.22 } = {}) {
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let i = 0; i < lines; i++) {
        const yy = y + r() * h;
        const amp = 1 + r() * 4;
        const freq = 0.004 + r() * 0.012;
        const phase = r() * 10;
        ctx.strokeStyle = `rgba(60,30,10,${0.04 + r() * dark * 0.5})`;
        ctx.lineWidth = 0.6 + r() * 1.8;
        ctx.beginPath();
        for (let xx = x; xx <= x + w; xx += 8) {
            const off = Math.sin(xx * freq + phase) * amp;
            if (xx === x) ctx.moveTo(xx, yy + off); else ctx.lineTo(xx, yy + off);
        }
        ctx.stroke();
    }
    ctx.restore();
}

export function woodTexture(base = '#c89b6a', seed = 11) {
    return cached(`wood${base}${seed}`, () => {
        const [c, ctx] = makeCanvas(1024, 512);
        const r = rng(seed);
        woodGrain(ctx, 0, 0, 1024, 512, base, r, { lines: 70, dark: 0.3 });
        noiseOverlay(ctx, 1024, 512, { cells: 128, alpha: 0.06, seed });
        return canvasTexture(c);
    });
}

export function parquetTexture(seed = 21) {
    return cached(`parquet${seed}`, () => {
        const [c, ctx] = makeCanvas(1024, 1024);
        const r = rng(seed);
        const rows = 8, rowH = 1024 / rows;
        const tones = ['#b48656', '#a97a4b', '#bd915f', '#9f7244', '#b98b59', '#aa7d4e'];
        for (let row = 0; row < rows; row++) {
            let x = -r() * 300;
            while (x < 1024) {
                const len = 280 + r() * 260;
                const tone = tones[Math.floor(r() * tones.length)];
                woodGrain(ctx, x, row * rowH, len, rowH, tone, r, { lines: 9 });
                ctx.fillStyle = 'rgba(40,20,5,0.45)';
                ctx.fillRect(x, row * rowH, 2, rowH);
                x += len;
            }
            ctx.fillStyle = 'rgba(40,20,5,0.4)';
            ctx.fillRect(0, row * rowH, 1024, 2);
        }
        noiseOverlay(ctx, 1024, 1024, { cells: 256, alpha: 0.05, seed });
        return canvasTexture(c);
    });
}

export function raisedFloorTexture() {
    return cached('raised', () => {
        const [c, ctx] = makeCanvas(1024, 1024);
        const r = rng(5);
        const tile = 512;
        for (let ty = 0; ty < 2; ty++) {
            for (let tx = 0; tx < 2; tx++) {
                const x = tx * tile, y = ty * tile;
                const v = 196 + Math.floor(r() * 10);
                ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
                ctx.fillRect(x, y, tile, tile);
                if (tx === ty) {
                    // Lochplatte (Kaltluft)
                    ctx.fillStyle = 'rgba(40,46,56,0.55)';
                    for (let py = 40; py < tile - 30; py += 22) {
                        for (let px = 40; px < tile - 30; px += 22) {
                            ctx.beginPath();
                            ctx.arc(x + px, y + py, 5.5, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }
                ctx.strokeStyle = '#6b7280';
                ctx.lineWidth = 8;
                ctx.strokeRect(x + 4, y + 4, tile - 8, tile - 8);
                ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 10, y + 10, tile - 20, tile - 20);
            }
        }
        noiseOverlay(ctx, 1024, 1024, { cells: 256, alpha: 0.06, seed: 9 });
        return canvasTexture(c);
    });
}

export function cuttingMatTexture() {
    return cached('mat', () => {
        const [c, ctx] = makeCanvas(1024, 1024);
        ctx.fillStyle = '#23604b';
        ctx.fillRect(0, 0, 1024, 1024);
        noiseOverlay(ctx, 1024, 1024, { cells: 256, alpha: 0.05, seed: 4 });
        const step = 1024 / 20;   // 20 cm pro Kachel → 1 Linie pro cm
        for (let i = 0; i <= 20; i++) {
            const major = i % 5 === 0;
            ctx.strokeStyle = major ? 'rgba(170,230,200,0.55)' : 'rgba(170,230,200,0.22)';
            ctx.lineWidth = major ? 2.2 : 1.1;
            ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, 1024); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(1024, i * step); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(170,230,200,0.18)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1024, 1024); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1024, 0); ctx.lineTo(0, 1024); ctx.stroke();
        return canvasTexture(c);
    });
}

export function concreteTexture(base = '#9aa0a6') {
    return cached(`concrete${base}`, () => {
        const [c, ctx] = makeCanvas(512, 512);
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 512, 512);
        noiseOverlay(ctx, 512, 512, { cells: 256, alpha: 0.14, seed: 31 });
        noiseOverlay(ctx, 512, 512, { cells: 24, alpha: 0.12, seed: 32 });
        return canvasTexture(c);
    });
}

export function brushedTexture() {
    return cached('brushed', () => {
        const [c, ctx] = makeCanvas(256, 256);
        const r = rng(8);
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 900; i++) {
            const v = 100 + Math.floor(r() * 80);
            ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
            ctx.fillRect(0, r() * 256, 256, 0.6 + r());
        }
        return canvasTexture(c, { srgb: false });
    });
}

// Perforiertes Blech (Alpha-Map: weiß = sichtbar)
export function perforatedAlpha() {
    return cached('perf', () => {
        const [c, ctx] = makeCanvas(256, 256);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#000';
        for (let y = 0; y < 256; y += 16) {
            for (let x = (y / 16) % 2 ? 8 : 0; x < 256 + 8; x += 16) {
                ctx.beginPath();
                ctx.arc(x, y, 5.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        return canvasTexture(c, { srgb: false });
    });
}

// Tastatur-Draufsicht
export function keyboardTexture() {
    return cached('keyboard', () => {
        const [c, ctx] = makeCanvas(1024, 320);
        ctx.fillStyle = '#1d2026';
        ctx.fillRect(0, 0, 1024, 320);
        const rows = [15, 14, 14, 13, 12];
        rows.forEach((n, row) => {
            const kw = 1024 * 0.78 / 15;
            for (let i = 0; i < n; i++) {
                const x = 22 + i * kw + row * 6;
                const y = 22 + row * 56;
                ctx.fillStyle = '#2d313a';
                ctx.beginPath();
                ctx.roundRect(x, y, kw - 7, 48, 7);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                ctx.fillRect(x + 3, y + 3, kw - 13, 5);
            }
        });
        ctx.fillStyle = '#2d313a';
        ctx.beginPath(); ctx.roundRect(22 + 4 * 55, 22 + 5 * 56 - 6, 360, 30, 7); ctx.fill();
        for (let row = 0; row < 5; row++) {
            for (let i = 0; i < 4; i++) {
                ctx.fillStyle = '#2d313a';
                ctx.beginPath();
                ctx.roundRect(830 + i * 46, 22 + row * 56, 40, 48, 7);
                ctx.fill();
            }
        }
        return canvasTexture(c, { wrap: false });
    });
}

// ------------------------------------------------------------
// Material-Fabriken
// ------------------------------------------------------------

export function std(color, roughness = 0.5, metalness = 0, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

export const MAT = {
    ductWhite: () => std('#f4f2ec', 0.38),
    plasticWhite: () => std('#f2f1ed', 0.42),
    plasticGrey: () => std('#b9bec6', 0.5),
    plasticDark: () => std('#23262d', 0.55),
    plasticBlack: () => std('#121417', 0.6),
    rubber: () => std('#15171a', 0.85),
    steel: () => std('#c9ced6', 0.32, 1.0, { roughnessMap: brushedTexture() }),
    darkMetal: () => std('#2b2f36', 0.45, 0.85),
    rackBlack: () => std('#1b1e24', 0.55, 0.6),
    gold: () => std('#e5b44a', 0.25, 1.0),
    copper: () => std('#c9773f', 0.3, 1.0),
    clearPlastic: () => new THREE.MeshStandardMaterial({ color: '#e8f1f8', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.5, depthWrite: false }),
    glass: () => new THREE.MeshStandardMaterial({ color: '#cfe6f2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false })
};

export function jacketMaterial(color, roughness = 0.52) {
    return std(color, roughness, 0);
}

// Kabelmantel mit aufgedruckter Typbezeichnung (wie bei echten Verlegekabeln)
function printedJacketTexture(color, text) {
    return cached(`print${color}${text}`, () => {
        const [c, ctx] = makeCanvas(1024, 64);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1024, 64);
        noiseOverlay(ctx, 1024, 64, { cells: 64, alpha: 0.05, seed: 12 });
        ctx.fillStyle = 'rgba(25, 20, 15, 0.78)';
        ctx.font = '600 13px Arial, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 12, 32);
        return canvasTexture(c);
    });
}

/** Mantel-Material mit Aufdruck; length in Welteinheiten, period = Abstand der Aufdrucke */
export function printedJacket(color, text, length, period = 0.45) {
    const tex = printedJacketTexture(color, text).clone();
    tex.repeat.set(Math.max(1, length / period), 1);
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0 });
}

// Streifen-Textur für weiß-farbige Adern (helixförmige Farbringel)
function stripeTexture(base, stripe) {
    return cached(`stripe${base}${stripe}`, () => {
        const [c, ctx] = makeCanvas(64, 64);
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = stripe;
        for (const off of [-64, 0, 64]) {
            ctx.beginPath();
            ctx.moveTo(off, 0);
            ctx.lineTo(off + 26, 0);
            ctx.lineTo(off + 26 + 64, 64);
            ctx.lineTo(off + 64, 64);
            ctx.closePath();
            ctx.fill();
        }
        return canvasTexture(c);
    });
}

/** Material einer Ader. length/pitch steuern die Anzahl der Farbringel. */
export function wireMaterial(core, length = 1, pitch = 1) {
    if (!core.stripe) return std(core.base, 0.36, 0);
    const tex = stripeTexture(core.base, core.stripe).clone();
    tex.repeat.set(Math.max(1, Math.round(length / pitch)), 1);
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.36, metalness: 0 });
}
