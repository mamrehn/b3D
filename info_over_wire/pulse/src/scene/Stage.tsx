import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { useUI } from '../core/store';
import { tick } from '../core/sim';
import { layerAlpha, WINDOWS } from '../core/scales';
import Hardware from './Hardware';
import Silicon from './Silicon';
import Cable from './Cable';
import Signal from './Signal';

/** Kamerafahrt: eine gemeinsame Kurve über alle 5 Maßstabsstufen. */
const CAM_KEYS: [THREE.Vector3, THREE.Vector3][] = [
  [new THREE.Vector3(0,  0.28, 0.95), new THREE.Vector3(0, 0, 0)],       // Gehäuse
  // LED: die Buchse ist 5,5-fach vergrößert; aus 0.34 Abstand stand die Kamera
  // faktisch in ihr drin — sichtbar waren nur zwei riesige Leuchtflecken und
  // ein paar Kontaktfedern, die Beschriftungen lagen außerhalb des Bildes.
  [new THREE.Vector3(0.13, 0.20, 0.66), new THREE.Vector3(0.089, 0.03, 0.02)], // LED
  // Silizium: weiter weg und nach rechts versetzt. Die Panels links und rechts
  // belegen zusammen rund zwei Drittel der Breite; steht die Kamera zu nah,
  // rutschen "MAC" und "MAGNETICS" darunter und nur "PHY" bleibt lesbar.
  [new THREE.Vector3(0.10, 0.17, 0.74), new THREE.Vector3(0.08, 0, 0)],  // Silizium
  // Kupfer: weit genug weg, dass das ganze Kabelstück samt Paarlegende ins
  // Bild passt. Die alte Position stand faktisch im Mantel und zeigte nur eine
  // dunkle Wand — ausgerechnet auf der Stufe, auf der es um die vier
  // Adernpaare geht.
  [new THREE.Vector3(-0.04, 0.09, 0.45), new THREE.Vector3(0.06, 0, 0)],  // Kupfer
  [new THREE.Vector3(-0.30, 0.02, 0.16), new THREE.Vector3(-0.1, 0, 0)],  // Signal
];

/**
 * Führt die Kamera — gibt sie aber jederzeit frei.
 *
 * Zwei Betriebsarten:
 *   auto  Die Kamera fährt selbsttätig zum Blickpunkt der aktuellen Stufe.
 *   frei  Die Betrachterin hat gedreht/gezoomt und behält die Kontrolle.
 *
 * Umschaltung: jede Bedienung der OrbitControls schaltet auf "frei", jeder
 * Maßstabswechsel und die Schaltfläche "Ansicht zurücksetzen" auf "auto".
 * Ohne diese Trennung würde die Rig-Schleife jeden Drehversuch sofort
 * überschreiben — genau das war vorher der Fall.
 */
/** Nur das, was der Rig von den OrbitControls tatsächlich braucht. */
type ControlsLike = {
  target: THREE.Vector3;
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
};

function Rig() {
  const { camera, controls } = useThree();
  const auto = useRef(true);
  const lastScale = useRef(Number.NaN);
  const lastNonce = useRef(0);
  const tmpP = useMemo(() => new THREE.Vector3(), []);
  const tmpT = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const c = controls as unknown as ControlsLike | null;
    if (!c) return;
    const onStart = () => { auto.current = false; };
    c.addEventListener('start', onStart);
    return () => c.removeEventListener('start', onStart);
  }, [controls]);

  useFrame((_, dt) => {
    const st = useUI.getState();
    tick(Math.min(dt, 0.05), st.scale);

    if (st.scale !== lastScale.current) { lastScale.current = st.scale; auto.current = true; }
    if (st.viewNonce !== lastNonce.current) { lastNonce.current = st.viewNonce; auto.current = true; }
    if (!auto.current) return;

    const f = st.scale * (CAM_KEYS.length - 1);
    const i = Math.min(CAM_KEYS.length - 2, Math.floor(f));
    const t = THREE.MathUtils.smoothstep(f - i, 0, 1);
    tmpP.lerpVectors(CAM_KEYS[i][0], CAM_KEYS[i + 1][0], t);
    tmpT.lerpVectors(CAM_KEYS[i][1], CAM_KEYS[i + 1][1], t);

    const damp = st.reducedMotion ? 1 : 1 - Math.pow(0.0015, dt);
    camera.position.lerp(tmpP, damp);

    const c = controls as unknown as ControlsLike | null;
    if (c) c.target.lerp(tmpT, damp);
    else camera.lookAt(tmpT);
  });
  return null;
}

/**
 * Blendet eine Gruppe anhand des Maßstabsfensters ein/aus.
 *
 * Die Schwelle liegt bewusst bei 0.4 und nicht bei 0.01: Beschriftungen werden
 * von troika-three-text gezeichnet, das seine Deckkraft bei jedem Bild selbst
 * neu setzt und die Überblendung hier deshalb ignoriert. Mit der alten
 * Schwelle blieben auf jeder Raststufe Geisterschriften der Nachbarebene
 * stehen — auf der Platinenstufe etwa die Paarnamen aus dem Kabel. Die
 * Deckkraft der Geometrie wird auf den verbleibenden Bereich umgerechnet,
 * damit an der Schwelle trotzdem bei 0 begonnen wird.
 */
const LAYER_CUTOFF = 0.4;

export function Layer({ win, children }: { win: keyof typeof WINDOWS; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  /*
   * Ausgangsdeckkraft je Material merken und nur multiplizieren. Vorher setzte
   * die Überblendung jedes Material hart auf ihren eigenen Wert und überschrieb
   * damit die gestalterisch gewollte Transparenz — der Kabelmantel (0.12) wurde
   * zur blickdichten Wand und verdeckte genau die vier Adernpaare, um die es
   * auf dieser Stufe geht.
   */
  const base = useRef(new WeakMap<THREE.Material, number>());

  useFrame(() => {
    const a = layerAlpha(useUI.getState().scale, WINDOWS[win]);
    const shown = a > LAYER_CUTOFF;
    g.current.visible = shown;
    if (!shown) return;
    const o = Math.min(1, (a - LAYER_CUTOFF) / 0.35);
    g.current.scale.setScalar(0.94 + o * 0.06);
    g.current.traverse((c) => {
      const m = (c as THREE.Mesh).material as THREE.Material | undefined;
      if (!m || Array.isArray(m)) return;
      if (!base.current.has(m)) base.current.set(m, m.opacity);
      m.transparent = true;
      m.opacity = base.current.get(m)! * o;
    });
  });
  return <group ref={g}>{children}</group>;
}

export default function Stage() {
  const reducedMotion = useUI((s) => s.reducedMotion);
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.005, far: 50, position: [0, 0.28, 0.95] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.background = new THREE.Color('#0B0D10');
        scene.fog = new THREE.Fog('#0B0D10', 1.2, 3.5);
      }}
    >
      <Rig />
      <OrbitControls
        makeDefault
        enableDamping={!reducedMotion}
        dampingFactor={0.08}
        rotateSpeed={0.55}
        panSpeed={0.6}
        zoomSpeed={0.7}
        minDistance={0.02}
        maxDistance={2.4}
        maxPolarAngle={Math.PI * 0.52}
      />

      {/* 1 Key kalt oben links, 1 Rim warm hinten rechts — GDD §6 */}
      <ambientLight intensity={0.2} color="#8FA5C0" />
      <directionalLight position={[-2, 3, 2]} intensity={1.9} color="#CFE2FF" castShadow
                        shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[2.5, 1, -2]} intensity={0.8} color="#FFCE9A" />

      <mesh rotation-x={-Math.PI / 2} position-y={-0.13} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#0E1216" roughness={0.86} metalness={0.05} />
      </mesh>

      <Layer win="chassis"><Hardware /></Layer>
      <Layer win="led"><Hardware magjack /></Layer>
      <Layer win="silicon"><Silicon /></Layer>
      <Layer win="cable"><Cable /></Layer>
      <Layer win="signal"><Signal /></Layer>

      <EffectComposer multisampling={0}>
        <SMAA />
        <Bloom intensity={0.85} luminanceThreshold={0.62} luminanceSmoothing={0.28} mipmapBlur />
        <Vignette eskil={false} offset={0.22} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
