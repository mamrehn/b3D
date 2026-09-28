// ============================================================
// Engine: Renderer, Kamera, Picking, Hover/Hinweise, Tweens
// Alle Tweens/Timer gehören zur aktuellen "Welt" und werden beim
// Levelwechsel automatisch abgebrochen (keine verwaisten Timeouts).
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setAnisotropy } from './materials.js';

export const Ease = {
    linear: t => t,
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    outBack: t => {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    outQuint: t => 1 - Math.pow(1 - t, 5)
};

const HOVER_COLOR = new THREE.Color(0x4f9dff);
const HINT_COLOR = new THREE.Color(0xffb020);
const CLICK_SLOP = 7;            // px – darüber ist es ein Kamera-Drag, kein Klick

const DEFAULT_CONTROLS = {
    minDistance: 0.2, maxDistance: 8,
    minPolarAngle: 0, maxPolarAngle: Math.PI,
    minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity,
    enablePan: true
};

function toVec3(v) {
    return v instanceof THREE.Vector3 ? v.clone() : new THREE.Vector3(v[0], v[1], v[2]);
}

function isVisibleChain(obj) {
    for (let o = obj; o; o = o.parent) if (!o.visible) return false;
    return true;
}

export class Engine {
    constructor({ canvas, container, tooltip }) {
        this.canvas = canvas;
        this.container = container;
        this.tooltipEl = tooltip;

        const renderer = this.renderer = new THREE.WebGLRenderer({
            canvas, antialias: true, powerPreference: 'high-performance'
        });
        const mobile = window.matchMedia('(max-width: 820px)').matches;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NeutralToneMapping;   // farbtreu – wichtig für Aderfarben
        renderer.toneMappingExposure = 1.0;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

        this.scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();
        this.scene.environment = this.envMap;

        this.world = new THREE.Group();
        this.scene.add(this.world);

        this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.09;
        this.controls.screenSpacePanning = true;
        this.controls.zoomToCursor = true;

        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2();

        this.pickables = new Set();
        this.occluders = [];
        this._pickMeshes = null;
        this.hovered = null;
        this.hints = new Set();
        this.tweens = [];
        this.timers = new Set();
        this.frameCallbacks = new Set();
        this.onPick = null;
        this.interactive = false;
        this.home = null;
        this.time = 0;
        this._last = performance.now();
        this._pointer = null;
        this._down = null;
        this._activePointers = new Set();
        this._multiTouch = false;
        this._hoverDirty = false;
        this._flight = null;
        this._tooltipTimer = null;

        this._bindEvents();
        this.resize();
        new ResizeObserver(() => this.resize()).observe(container);
        renderer.setAnimationLoop(() => this._loop());
    }

    // --------------------------------------------------------
    // Lebenszyklus
    // --------------------------------------------------------

    clearWorld() {
        for (const tw of this.tweens) { tw.dead = true; tw.resolve(false); }
        this.tweens = [];
        for (const id of this.timers) clearTimeout(id);
        this.timers.clear();
        this.frameCallbacks.clear();
        this.pickables.clear();
        this.occluders = [];
        this._pickMeshes = null;
        this.hovered = null;
        this.hints.clear();
        this.onPick = null;
        this.interactive = false;
        this._flight = null;
        this.hideTooltip();
        this.canvas.style.cursor = '';

        const disposed = new Set();
        const disposeTex = (t) => { if (t && !disposed.has(t) && t !== this.envMap) { disposed.add(t); t.dispose(); } };
        this.world.traverse(obj => {
            if (obj.geometry && !disposed.has(obj.geometry)) { disposed.add(obj.geometry); obj.geometry.dispose(); }
            const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
            for (const m of mats) {
                if (disposed.has(m)) continue;
                disposed.add(m);
                for (const key of ['map', 'alphaMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'bumpMap', 'emissiveMap', 'aoMap']) disposeTex(m[key]);
                m.dispose();
            }
            if (obj.isLight && obj.shadow && obj.shadow.map) obj.shadow.map.dispose();
        });
        this.scene.remove(this.world);
        this.world = new THREE.Group();
        this.scene.add(this.world);
        this.scene.fog = null;
        this.scene.background = null;
        this.scene.environmentIntensity = 1;
        this.renderer.toneMappingExposure = 1.0;
        Object.assign(this.controls, DEFAULT_CONTROLS);
        this.controls.enabled = true;
        this.camera.near = 0.01;
        this.camera.far = 200;
        this.camera.fov = 45;
        this.camera.updateProjectionMatrix();
    }

    add(...objs) { this.world.add(...objs); return objs[0]; }

    /** Kleine Teile werfen keine Schatten (spart pro Teil einen Draw-Call im Schatten-Pass). */
    optimizeShadows(minRadius) {
        const s = new THREE.Vector3();
        this.world.updateMatrixWorld(true);
        this.world.traverse(o => {
            if (!o.isMesh || !o.castShadow || o.isInstancedMesh) return;
            if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
            o.getWorldScale(s);
            if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < minRadius) o.castShadow = false;
        });
    }

    // --------------------------------------------------------
    // Beleuchtung
    // --------------------------------------------------------

    addSun({ position, target = [0, 0, 0], color = 0xffffff, intensity = 2, size = 2, mapSize = 2048, bias = -0.0004, normalBias = 0.02 }) {
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.copy(toVec3(position));
        light.target.position.copy(toVec3(target));
        light.castShadow = true;
        const cam = light.shadow.camera;
        cam.left = -size; cam.right = size; cam.top = size; cam.bottom = -size;
        cam.near = 0.05;
        cam.far = light.position.distanceTo(light.target.position) + size * 3;
        light.shadow.mapSize.set(mapSize, mapSize);
        light.shadow.bias = bias;
        light.shadow.normalBias = normalBias;
        light.shadow.radius = 3;
        this.world.add(light, light.target);
        return light;
    }

    // --------------------------------------------------------
    // Kamera
    // --------------------------------------------------------

    configureControls(opts) {
        Object.assign(this.controls, DEFAULT_CONTROLS, opts);
    }

    setView({ position, target, fov }) {
        this.cancelFlight();
        this.camera.position.copy(toVec3(position));
        this.controls.target.copy(toVec3(target));
        if (fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
        this.controls.update();
    }

    setHome(view) { this.home = { position: toVec3(view.position), target: toVec3(view.target) }; }

    goHome(duration = 1.0) {
        if (this.home) return this.flyTo(this.home.position, this.home.target, { duration });
        return Promise.resolve(true);
    }

    flyTo(position, target, { duration = 1.2, ease = Ease.inOutCubic } = {}) {
        this.cancelFlight();
        const p0 = this.camera.position.clone();
        const t0 = this.controls.target.clone();
        const p1 = toVec3(position);
        const t1 = toVec3(target);
        this._flight = this.tween({
            duration, ease,
            onUpdate: k => {
                this.camera.position.lerpVectors(p0, p1, k);
                this.controls.target.lerpVectors(t0, t1, k);
            }
        });
        const flight = this._flight;
        return flight.done.finally(() => { if (this._flight === flight) this._flight = null; });
    }

    cancelFlight() {
        if (this._flight) { this._flight.cancel(); this._flight = null; }
    }

    // Kurzer "Hineingehen"-Flug zum Levelstart
    intro(duration = 2.2) {
        if (!this.home) return Promise.resolve(true);
        const { position, target } = this.home;
        const dir = position.clone().sub(target);
        const dist = dir.length();
        const start = position.clone().add(dir.normalize().multiplyScalar(dist * 0.9)).add(new THREE.Vector3(dist * 0.18, dist * 0.25, 0));
        this.camera.position.copy(start);
        this.controls.target.copy(target.clone().add(new THREE.Vector3(0, dist * 0.08, 0)));
        this.controls.update();
        return this.flyTo(position, target, { duration, ease: Ease.outQuint });
    }

    // --------------------------------------------------------
    // Tweens & Timer (an die aktuelle Welt gebunden)
    // --------------------------------------------------------

    tween({ duration = 1, delay = 0, ease = Ease.inOutCubic, onUpdate, onComplete } = {}) {
        let resolve;
        const done = new Promise(r => { resolve = r; });
        const tw = { t: -delay, duration: Math.max(1e-4, duration), ease, onUpdate, onComplete, resolve, dead: false };
        this.tweens.push(tw);
        return {
            done,
            cancel: () => { if (!tw.dead) { tw.dead = true; resolve(false); } }
        };
    }

    wait(seconds) { return this.tween({ duration: seconds }).done; }

    later(fn, ms) {
        const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
        this.timers.add(id);
        return id;
    }

    onFrame(cb) {
        this.frameCallbacks.add(cb);
        return () => this.frameCallbacks.delete(cb);
    }

    // --------------------------------------------------------
    // Picking, Hover, Hinweise
    // --------------------------------------------------------

    /**
     * Macht ein Objekt (Mesh oder Gruppe) anklickbar.
     * info: { tooltip: string|fn, enabled?: fn }
     */
    addPickable(obj, info = {}) {
        const meshes = [];
        obj.traverse(o => { if (o.isMesh) meshes.push(o); });
        for (const m of meshes) {
            if (!m.userData._ownMat) {
                m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone();
                m.userData._ownMat = true;
            }
            m.userData._pickRoot = obj;
            const mat = m.material;
            if (mat.emissive) m.userData._baseEmissive = { color: mat.emissive.clone(), intensity: mat.emissiveIntensity };
        }
        obj.userData.pick = { ...info, meshes };
        this.pickables.add(obj);
        this._pickMeshes = null;
        return obj;
    }

    removePickable(obj) {
        if (this.pickables.delete(obj)) {
            this._restoreGlow(obj);
            this._pickMeshes = null;
            if (this.hovered === obj) { this.hovered = null; this.hideTooltip(); }
        }
    }

    addOccluder(...meshes) {
        this.occluders.push(...meshes);
        this._pickMeshes = null;
    }

    /** Dauerhafter Leuchtzustand (z. B. "ausgewählt"), null = Original */
    setGlow(obj, color, intensity = 0.6) {
        obj.userData.glow = color == null ? null : { color: new THREE.Color(color), intensity };
    }

    setHints(list) { this.hints = new Set(list.filter(Boolean)); }

    _restoreGlow(obj) {
        const info = obj.userData.pick;
        if (!info) return;
        for (const m of info.meshes) {
            const base = m.userData._baseEmissive;
            if (base && m.material.emissive) {
                m.material.emissive.copy(base.color);
                m.material.emissiveIntensity = base.intensity;
            }
        }
    }

    _applyGlow() {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 5.2);
        for (const obj of this.pickables) {
            const info = obj.userData.pick;
            const hovered = obj === this.hovered;
            const hinted = !hovered && this.hints.has(obj) && isVisibleChain(obj);
            const glow = obj.userData.glow;
            for (const m of info.meshes) {
                const mat = m.material;
                if (!mat.emissive) continue;
                if (hovered) {
                    mat.emissive.copy(HOVER_COLOR);
                    mat.emissiveIntensity = 0.55 * (info.glowScale ?? 1);
                } else if (hinted) {
                    mat.emissive.copy(HINT_COLOR);
                    mat.emissiveIntensity = (0.12 + 0.5 * pulse) * (info.glowScale ?? 1);
                } else if (glow) {
                    mat.emissive.copy(glow.color);
                    mat.emissiveIntensity = glow.intensity;
                } else {
                    const base = m.userData._baseEmissive;
                    mat.emissive.copy(base.color);
                    mat.emissiveIntensity = base.intensity;
                }
            }
        }
    }

    pickAt(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        if (!this._pickMeshes) {
            this._pickMeshes = [];
            for (const obj of this.pickables) this._pickMeshes.push(...obj.userData.pick.meshes);
            this._pickMeshes.push(...this.occluders);
        }
        const hits = this.raycaster.intersectObjects(this._pickMeshes, false);
        for (const h of hits) {
            if (!isVisibleChain(h.object)) continue;
            const root = h.object.userData._pickRoot;
            if (!root) return null;                       // Verdeckt (z. B. PC-Gehäuse)
            if (!this.pickables.has(root)) continue;
            const info = root.userData.pick;
            if (info.enabled && !info.enabled()) continue;
            return { object: root, point: h.point, mesh: h.object };
        }
        return null;
    }

    _bindEvents() {
        const c = this.canvas;
        c.addEventListener('pointerdown', e => {
            this._activePointers.add(e.pointerId);
            if (this._activePointers.size > 1) this._multiTouch = true;
            this._down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button, dragging: false };
        });
        c.addEventListener('pointermove', e => {
            this._pointer = { x: e.clientX, y: e.clientY, type: e.pointerType };
            if (this._down && !this._down.dragging) {
                if (Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y) > CLICK_SLOP) {
                    this._down.dragging = true;
                    this.cancelFlight();                    // Nutzer übernimmt die Kamera
                }
            }
            this._hoverDirty = true;
        });
        const up = e => {
            this._activePointers.delete(e.pointerId);
            const d = this._down;
            const wasMulti = this._multiTouch;
            if (this._activePointers.size === 0) { this._multiTouch = false; this._down = null; }
            if (!d || wasMulti || d.dragging || d.button !== 0) return;
            if (performance.now() - d.t > 900) return;
            this._handleClick(e);
        };
        c.addEventListener('pointerup', up);
        c.addEventListener('pointercancel', e => { this._activePointers.delete(e.pointerId); this._down = null; this._multiTouch = false; });
        c.addEventListener('pointerleave', () => { this._pointer = null; this._hoverDirty = true; });
        c.addEventListener('wheel', () => this.cancelFlight(), { passive: true });
    }

    _handleClick(e) {
        if (!this.interactive || !this.onPick) return;
        const hit = this.pickAt(e.clientX, e.clientY);
        if (e.pointerType === 'touch' && hit) this._showTooltipFor(hit.object, e.clientX, e.clientY, 1600);
        this.onPick(hit ? hit.object : null, hit);
        this._hoverDirty = true;
    }

    _updateHover() {
        if (!this._hoverDirty) return;
        this._hoverDirty = false;
        const p = this._pointer;
        let next = null;
        if (p && p.type !== 'touch' && this.interactive && !(this._down && this._down.dragging)) {
            const hit = this.pickAt(p.x, p.y);
            next = hit ? hit.object : null;
        }
        if (next !== this.hovered) this.hovered = next;
        if (next) {
            this.canvas.style.cursor = 'pointer';
            this._showTooltipFor(next, p.x, p.y);
        } else {
            this.canvas.style.cursor = this._down && this._down.dragging ? 'grabbing' : '';
            if (!this._tooltipTimer) this.hideTooltip();
        }
    }

    _showTooltipFor(obj, x, y, autoHideMs = 0) {
        const info = obj.userData.pick;
        const text = typeof info.tooltip === 'function' ? info.tooltip() : info.tooltip;
        if (!text) { this.hideTooltip(); return; }
        const el = this.tooltipEl;
        if (el.dataset.html !== text) { el.innerHTML = text; el.dataset.html = text; }
        el.hidden = false;
        const rect = this.container.getBoundingClientRect();
        const w = el.offsetWidth, h = el.offsetHeight;
        let left = x - rect.left + 16;
        let top = y - rect.top + 18;
        if (left + w > rect.width - 8) left = x - rect.left - w - 12;
        if (top + h > rect.height - 8) top = y - rect.top - h - 12;
        el.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
        clearTimeout(this._tooltipTimer);
        this._tooltipTimer = null;
        if (autoHideMs) this._tooltipTimer = setTimeout(() => { this._tooltipTimer = null; this.hideTooltip(); }, autoHideMs);
    }

    hideTooltip() {
        this.tooltipEl.hidden = true;
        this.tooltipEl.dataset.html = '';
    }

    // --------------------------------------------------------
    // Render-Loop
    // --------------------------------------------------------

    resize() {
        const w = Math.max(1, this.container.clientWidth);
        const h = Math.max(1, this.container.clientHeight);
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    _loop() {
        const now = performance.now();
        const raw = (now - this._last) / 1000;
        const dt = Math.min(raw, 0.1);
        const tweenDt = Math.min(raw, 0.5);     // Animationen laufen auch bei niedriger FPS in Echtzeit
        this._last = now;
        this.time += dt;

        for (const tw of this.tweens) {
            if (tw.dead) continue;
            tw.t += tweenDt;
            if (tw.t < 0) continue;
            const k = Math.min(1, tw.t / tw.duration);
            if (tw.onUpdate) tw.onUpdate(tw.ease(k), k);
            if (k >= 1) {
                tw.dead = true;
                if (tw.onComplete) tw.onComplete();
                tw.resolve(true);
            }
        }
        if (this.tweens.some(t => t.dead)) this.tweens = this.tweens.filter(t => !t.dead);

        for (const cb of this.frameCallbacks) cb(dt, this.time);
        this._hoverDirty = true;          // Kamera kann sich bewegt haben
        this._updateHover();
        this._applyGlow();
        this.controls.update(dt);
        this.renderer.render(this.scene, this.camera);
    }
}
