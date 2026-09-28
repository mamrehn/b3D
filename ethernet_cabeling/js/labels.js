// ============================================================
// Beschriftungen: schwebende Labels (Sprites) & aufgedruckter Text
// ============================================================

import * as THREE from 'three';
import { makeCanvas, canvasTexture } from './materials.js';

export const FONT = '"Inter Variable", Inter, "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

/**
 * Schwebendes Label (zeigt immer zur Kamera).
 * height = Höhe in Welteinheiten.
 */
export function makeLabel(text, {
    height = 0.05,
    bg = 'rgba(11, 17, 32, 0.88)',
    fg = '#f5f8ff',
    accent = null,
    border = 'rgba(255,255,255,0.16)',
    weight = 650,
    size = 44,
    padX = 24,
    padY = 13,
    radius = 16,
    depthTest = true,
    anchor = 'center',
    sub = null
} = {}) {
    const lines = String(text).split('\n');
    const font = `${weight} ${size}px ${FONT}`;
    const subFont = `500 ${Math.round(size * 0.62)}px ${FONT}`;
    const [, mctx] = makeCanvas(8, 8);
    mctx.font = font;
    let textW = Math.max(...lines.map(l => mctx.measureText(l).width));
    if (sub) { mctx.font = subFont; textW = Math.max(textW, mctx.measureText(sub).width); }
    const accentW = accent ? 12 : 0;
    const lineH = size * 1.2;
    const subH = sub ? size * 0.8 : 0;
    const w = Math.ceil(textW + padX * 2 + accentW);
    const h = Math.ceil(lines.length * lineH + subH + padY * 2);
    const [canvas, ctx] = makeCanvas(w + 8, h + 8);

    ctx.translate(4, 4);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, radius);
    ctx.fill();
    if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }
    if (accent) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, radius);
        ctx.clip();
        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, accentW, h);
        ctx.restore();
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    const cx = accentW + (w - accentW) / 2;
    lines.forEach((line, i) => ctx.fillText(line, cx, padY + lineH * (i + 0.5)));
    if (sub) {
        ctx.font = subFont;
        ctx.globalAlpha = 0.72;
        ctx.fillText(sub, cx, padY + lineH * lines.length + subH * 0.5);
    }

    const tex = canvasTexture(canvas, { wrap: false });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest, depthWrite: false, toneMapped: false });
    const sprite = new THREE.Sprite(mat);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(height * aspect, height, 1);
    sprite.renderOrder = depthTest ? 6 : 60;
    if (anchor === 'bottom') sprite.center.set(0.5, 0);
    else if (anchor === 'top') sprite.center.set(0.5, 1);
    else if (anchor === 'left') sprite.center.set(0, 0.5);
    else if (anchor === 'right') sprite.center.set(1, 0.5);
    return sprite;
}

/**
 * Text, der auf eine Fläche gedruckt ist (Plane, beleuchtet).
 */
export function makeTextPlane(text, {
    width = 0.1,
    height = 0.02,
    fg = '#ffffff',
    bg = null,
    weight = 700,
    align = 'center',
    fontScale = 0.7,
    lit = true,
    pxPerUnitHeight = 128,
    radius = 0,
    letterSpacing = 0
} = {}) {
    const ch = pxPerUnitHeight;
    const cw = Math.max(8, Math.round(ch * width / height));
    const [canvas, ctx] = makeCanvas(cw, ch);
    if (bg) {
        ctx.fillStyle = bg;
        if (radius) { ctx.beginPath(); ctx.roundRect(0, 0, cw, ch, radius * ch); ctx.fill(); }
        else ctx.fillRect(0, 0, cw, ch);
    }
    const lines = String(text).split('\n');
    let size = ch * fontScale / lines.length;
    ctx.font = `${weight} ${size}px ${FONT}`;
    if ('letterSpacing' in ctx && letterSpacing) ctx.letterSpacing = `${letterSpacing}px`;
    const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
    if (maxW > cw * 0.94) {
        size *= (cw * 0.94) / maxW;
        ctx.font = `${weight} ${size}px ${FONT}`;
    }
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    const x = align === 'left' ? cw * 0.04 : align === 'right' ? cw * 0.96 : cw / 2;
    lines.forEach((line, i) => ctx.fillText(line, x, ch * (i + 0.5) / lines.length));

    const tex = canvasTexture(canvas, { wrap: false });
    const common = { map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false };
    const mat = lit
        ? new THREE.MeshStandardMaterial({ ...common, roughness: 0.6 })
        : new THREE.MeshBasicMaterial({ ...common, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    mesh.renderOrder = 2;
    return mesh;
}
