// Gemeinsame Grundlage aller Stationen

import * as THREE from 'three';

export class BaseLevel {
    constructor(ctx, meta) {
        this.ctx = ctx;
        this.meta = meta;
        this.engine = ctx.engine;
        this.disposed = false;
    }

    build() {}
    start() { this.engine.intro(); }
    steps() { return []; }
    objective() { return ''; }
    renderControls(el) { el.innerHTML = ''; }
    actions() { return {}; }
    hints() { return []; }
    onPick() {}
    onTick() {}
    dispose() { this.disposed = true; }

    /** false, sobald das Level verlassen wurde (nach jedem await prüfen) */
    get alive() { return !this.disposed && this.ctx.alive; }

    add(...objs) { return this.engine.add(...objs); }
    toast(msg, type = 'info', ms) { this.ctx.toast(msg, type, ms); }
    refresh() { this.ctx.refresh(); }

    /** Grundbeleuchtung: Himmel/Boden-Licht + Sonne mit Schatten */
    lights({ hemi = 0.55, sky = '#e8f0ff', ground = '#6b5a48', sun = null, env = 0.6, exposure = 1.0 } = {}) {
        this.engine.scene.environmentIntensity = env;
        this.engine.renderer.toneMappingExposure = exposure;
        this.add(new THREE.HemisphereLight(sky, ground, hemi));
        if (sun) this.engine.addSun(sun);
    }

    /** Zeitabzug in Punkten nach Schwellen [[sek, abzug], …] */
    timePenalty(sec, table) {
        for (const [limit, pen] of table) if (sec <= limit) return pen;
        return table[table.length - 1][1];
    }

    scoreResult({ breakdown, base = 100, min = 10 }) {
        const total = breakdown.reduce((s, b) => s + (b.points || 0), base);
        return Math.max(min, Math.min(100, Math.round(total)));
    }
}

export const fmtPts = (p) => (p > 0 ? `+${p}` : p === 0 ? '±0' : `${p}`);
