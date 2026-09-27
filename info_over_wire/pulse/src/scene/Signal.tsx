import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { sim } from '../core/sim';
import { encodeByte, PAM5_LEVELS, noiseFromSnr, gauss, SYMBOL_TIME } from '../core/net';
import Label from './Label';

const SPAN = 0.42;        // Weltbreite
const SYMS = 16;          // sichtbare Symbole
const N = SYMS * 12;

/** Bandbegrenzte Realkurve statt idealer Treppe (Raised Cosine, roll-off 0.5). */
function shaped(prev: number, next: number, u: number) {
  const w = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, (u - 0.25) / 0.5)));
  return prev + (next - prev) * w;
}

export default function Signal() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return g;
  }, []);
  const idealMode = useRef(false);

  useFrame(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const base = Math.floor(sim.t / SYMBOL_TIME);
    const frac = (sim.t / SYMBOL_TIME) % 1;
    const noise = noiseFromSnr(sim.snrDb);

    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const symF = u * SYMS + frac;
      const k = Math.floor(symF);
      const byteA = sim.frame.bytes[(base + k) % sim.frame.bytes.length] ?? 0;
      const byteB = sim.frame.bytes[(base + k + 1) % sim.frame.bytes.length] ?? 0;
      const a = encodeByte(byteA, sim.trellis)[0];
      const b = encodeByte(byteB, sim.trellis)[0];
      const v = idealMode.current ? (symF % 1 < 0.5 ? a : b) : shaped(a, b, symF % 1);
      const withNoise = v + gauss() * noise * 0.5;
      p.setXYZ(i, -SPAN / 2 + u * SPAN, withNoise * 0.045, 0);
    }
    p.needsUpdate = true;
  });

  return (
    <group>
      {/* Kupferoberfläche */}
      <mesh position={[0, -0.075, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.012, 0.012, SPAN, 24]} />
        <meshStandardMaterial color="#B87333" metalness={1} roughness={0.24} />
      </mesh>

      {/* Die 5 Spannungs-Guides */}
      {PAM5_LEVELS.map((l) => (
        <group key={l}>
          <Line points={[[-SPAN / 2, l * 0.045, 0], [SPAN / 2, l * 0.045, 0]]}
                color={l === 0 ? '#F5A524' : '#2A3038'} lineWidth={1}
                dashed dashSize={0.006} gapSize={0.006} />
          {/*
            Die Pegelbeschriftung sitzt nicht mehr am linken Ende der Kurve.
            Dort lag sie am Bildrand und damit unter dem Lernpanel. Sie steht
            jetzt im freien Mittelband, direkt auf ihrer eigenen Hilfslinie —
            inhaltlich sogar die bessere Zuordnung.
          */}
          {/* Klein halten: die Kamera steht auf dieser Stufe sehr nah, eine
              Schrifthöhe von 0.0078 wurde zu 45 px hohen Lettern. */}
          <Label position={[-0.155, l * 0.045, 0]} size={0.0032}
                 color={l === 0 ? '#F5A524' : '#98A3B1'}>
            {`${l > 0 ? '+' : ''}${l.toFixed(1)} V`}
          </Label>
        </group>
      ))}

      {/* @ts-ignore */}
      <line geometry={geo}>
        <lineBasicMaterial color="#4C9AFF" transparent opacity={0.95} />
      </line>

      {/* Auf den Kamerablickpunkt zentriert, damit die Schrift im freien
          Mittelband landet und nicht unter den seitlichen Panels. "erlaubte
          Pegel" und "Kupferader" sind ersatzlos entfallen: beides steht schon
          im Lernpanel unter "Was du siehst", und im Raum kollidierten sie mit
          der Überschrift bzw. liefen unten aus dem Bild. */}
      <Label position={[-0.10, 0.072, 0]} size={0.0038}>
        {'PAM-5 · 125 MBaud\n1 Symbol = 8 ns'}
      </Label>
    </group>
  );
}