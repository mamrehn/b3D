import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { sim } from '../core/sim';
import Label from './Label';

/** Iridescent-Die-Look: Dünnschicht-Interferenz als billiger, aber überzeugender Fake. */
function Die({ pos, size, label, sub, color }: {
  pos: [number, number, number];
  size: [number, number, number];
  label: string; sub: string; color: string;
}) {
  return (
    <group position={pos}>
      <mesh castShadow>
        <boxGeometry args={size} />
        {/* metalness deutlich unter 1: ohne Umgebungsspiegelung wird fast
            reines Metall in dieser Szene einfach schwarz. */}
        <meshPhysicalMaterial
          color="#1A2029" roughness={0.28} metalness={0.45}
          iridescence={1} iridescenceIOR={1.9} iridescenceThicknessRange={[120, 520]}
          clearcoat={1} clearcoatRoughness={0.12}
        />
      </mesh>
      <Label position={[0, size[1] / 2 + 0.020, 0]} size={0.011} color={color}>{label}</Label>
      <Label position={[0, size[1] / 2 + 0.009, 0]} size={0.0062} color="#98A3B1">{sub}</Label>
    </group>
  );
}

/** Digitaler Frame-Block: harte Kanten, diskret. */
function DigitalBlock({ x }: { x: number }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    const p = ((sim.realT * 0.35) % 1);
    g.current.position.x = x + p * 0.14;
    g.current.visible = p < 0.92;
    const m = (g.current.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = 1.6 - p * 1.2;
  });
  return (
    <group ref={g}>
      <mesh>
        <boxGeometry args={[0.020, 0.008, 0.008]} />
        <meshStandardMaterial color="#1A2430" emissive="#4C9AFF" emissiveIntensity={1.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Analoge Welle: weich, kontinuierlich. */
function AnalogWave({ x }: { x: number }) {
  const ref = useRef<THREE.Line>(null!);
  const N = 120;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return g;
  }, []);
  useFrame(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const ph = sim.realT * 6;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      p.setXYZ(i, x + u * 0.16, Math.sin(u * 26 + ph) * 0.006 * (1 - u * 0.3), 0);
    }
    p.needsUpdate = true;
  });
  // @ts-ignore
  return <line ref={ref} geometry={geo}>
    <lineBasicMaterial color="#4C9AFF" linewidth={2} transparent opacity={0.9} />
  </line>;
}

export default function Silicon() {
  return (
    <group position={[0, -0.02, 0]}>
      <mesh position={[0, -0.022, 0]} receiveShadow>
        <boxGeometry args={[0.44, 0.004, 0.13]} />
        <meshStandardMaterial color="#0F3D2E" roughness={0.75} metalness={0.15} />
      </mesh>

      <Die pos={[-0.15, 0, 0]} size={[0.05, 0.012, 0.05]}   color="#4C9AFF"
           label="MAC"       sub="denkt in Bytes" />
      <Die pos={[ 0.00, 0, 0]} size={[0.045, 0.010, 0.045]} color="#A78BFA"
           label="PHY"       sub="übersetzt Bytes ↔ Volt" />
      <Die pos={[ 0.15, 0, 0]} size={[0.055, 0.016, 0.04]}  color="#F5A524"
           label="MAGNETICS" sub="galvanische Trennung" />

      {/* MII/RGMII-Bus: MAC -> PHY, digital */}
      <DigitalBlock x={-0.12} />
      {[...Array(6)].map((_, i) => (
        <Line key={i} points={[[-0.125, -0.004, -0.02 + i * 0.008], [-0.025, -0.004, -0.02 + i * 0.008]]}
              color="#2A3038" lineWidth={1} />
      ))}

      {/* PHY -> Magnetics, analog */}
      <AnalogWave x={0.023} />

      {/* Über der Platine, nicht darunter: bei y = -0.036 lagen sie hinter dem
          Platinenkörper und waren schlicht nicht zu sehen. */}
      <Label position={[-0.075, 0.048, 0]} size={0.0072} color="#4C9AFF">
        {'MII-Bus\ndigital · 0 und 1'}
      </Label>
      <Label position={[0.075, 0.048, 0]} size={0.0072} color="#F5A524">
        {'MDI\nanalog · Spannungen'}
      </Label>
    </group>
  );
}