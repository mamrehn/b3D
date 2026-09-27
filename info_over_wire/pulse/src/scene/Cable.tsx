import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sim } from '../core/sim';

/** Reale Schlaglängen CAT6 in mm — bewusst unterschiedlich (NEXT-Vermeidung). */
export const PAIRS = [
  { name: 'Pair 1 · blau/weiß',   pitchMm: 12.7, color: '#4C9AFF', phase: 0 },
  { name: 'Pair 2 · orange/weiß', pitchMm: 14.6, color: '#F5A524', phase: 1.6 },
  { name: 'Pair 3 · grün/weiß',   pitchMm: 16.5, color: '#34D399', phase: 3.1 },
  { name: 'Pair 4 · braun/weiß',  pitchMm: 19.1, color: '#B87333', phase: 4.7 },
];
const LEN = 0.34;          // sichtbare Kabellänge in Weltmetern
const REAL_MM = 60;        // was sie real darstellt

function helix(radius: number, orbit: number, orbitPhase: number, pitchMm: number, wirePhase: number) {
  const pts: THREE.Vector3[] = [];
  const turns = REAL_MM / pitchMm;
  for (let i = 0; i <= 200; i++) {
    const u = i / 200;
    const a = u * turns * Math.PI * 2 + wirePhase;
    pts.push(new THREE.Vector3(
      -LEN / 2 + u * LEN,
      Math.sin(orbitPhase) * orbit + Math.cos(a) * radius,
      Math.cos(orbitPhase) * orbit + Math.sin(a) * radius,
    ));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/*
 * Die Szene hat keine Umgebungsspiegelung. Ein fast reines Metall (metalness
 * 0.95) hat darin nichts zu reflektieren und wird schlicht schwarz — die
 * Adern waren dadurch auf dieser Stufe praktisch unsichtbar. Weniger Metall,
 * mehr Eigenleuchten und ein etwas dickerer Schlauch machen sie sichtbar,
 * ohne dass eine HDRI nachgeladen werden müsste.
 */
function Wire({ curve, color, emissive }: {
  curve: THREE.Curve<THREE.Vector3>; color: string; emissive: () => number;
}) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 220, 0.0024, 8, false), [curve]);
  const m = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => { m.current.emissiveIntensity = emissive(); });
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial ref={m} color={color} metalness={0.35} roughness={0.42}
        emissive={color} emissiveIntensity={0.1} />
    </mesh>
  );
}

/** Pulse: instanziert, Richtung und Tempo aus der Zeitdilatation abgeleitet. */
function Pulses({ curve, color, dir }: { curve: THREE.Curve<THREE.Vector3>; color: string; dir: 1 | -1 }) {
  const N = 10;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const speed = 0.22;
    for (let i = 0; i < N; i++) {
      let u = (sim.realT * speed + i / N) % 1;
      if (dir < 0) u = 1 - u;
      const p = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      dummy.position.copy(p);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      // Puls wird bei starker Zeitlupe sichtbar länger — GDD §6
      const stretch = 1 + (1 - sim.scale) * 2.2;
      dummy.scale.set(1, stretch, 1);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <capsuleGeometry args={[0.0022, 0.010, 3, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.85}
        blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

export default function Cable() {
  const curves = useMemo(
    () => PAIRS.flatMap((p, i) => {
      const orbitPhase = (i / 4) * Math.PI * 2;
      return [
        { ...p, curve: helix(0.006, 0.016, orbitPhase, p.pitchMm, 0), dir: 1 as const, tip: true },
        { ...p, curve: helix(0.006, 0.016, orbitPhase, p.pitchMm, Math.PI), dir: -1 as const, tip: false },
      ];
    }),
    []
  );

  return (
    <group>
      {/*
        Mantel: Fresnel-Reveal statt hartem Clipping.
        depthWrite MUSS aus bleiben. Der Mantel umschließt die Adern; schreibt
        er Tiefe, verdeckt seine Vorderseite alles, was darin liegt — die
        Adern verschwanden dadurch vollständig hinter einer fast schwarzen
        Hülle, sobald die Kamera außerhalb des Zylinders steht.
      */}
      <mesh renderOrder={2}>
        <cylinderGeometry args={[0.028, 0.028, LEN, 36, 1, true]} />
        <meshPhysicalMaterial color="#1A1F26" roughness={0.7} metalness={0.1}
          transparent opacity={0.12} side={THREE.DoubleSide} transmission={0.4}
          depthWrite={false} />
      </mesh>
      <group rotation-z={Math.PI / 2}>
        {curves.map((c, i) => (
          <group key={i}>
            <Wire curve={c.curve} color={c.tip ? c.color : '#E8EDF3'}
                  emissive={() => (sim.linkState === 'up' ? 0.85 : 0.15)} />
            <Pulses curve={c.curve} color={c.tip ? '#4C9AFF' : '#67E8F9'} dir={c.dir} />
          </group>
        ))}
      </group>

      {/*
        Hier steht bewusst keine Schrift mehr im Raum. Die Paarlegende lag
        seitlich neben dem Kabel und damit unter den rechten Panels, die
        Bildunterschrift lag quer über den Adern. Beschriftet wird diese Stufe
        jetzt in 2D — siehe <PairLegend>, dort ist sie auch lesbar.
      */}
    </group>
  );
}