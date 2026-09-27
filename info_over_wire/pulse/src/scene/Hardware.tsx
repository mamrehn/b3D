import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sim, activityLed } from '../core/sim';
import Label from './Label';

function Led({ x, color, getOn }: { x: number; color: string; getOn: () => number }) {
  const m = useRef<THREE.MeshStandardMaterial>(null!);
  const l = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const v = getOn();
    m.current.emissiveIntensity = 0.05 + v * 5.5;
    l.current.intensity = v * 0.35;
  });
  return (
    <group position={[x, 0.016, 0.021]}>
      <mesh>
        <boxGeometry args={[0.008, 0.005, 0.002]} />
        <meshStandardMaterial ref={m} color="#0A0C0E" emissive={color}
          emissiveIntensity={0.05} roughness={0.25} />
      </mesh>
      <pointLight ref={l} color={color} distance={0.09} intensity={0} />
    </group>
  );
}

/** Der Magjack: Buchse, 8 Kontaktfedern, 2 LEDs. */
function Magjack({ detail }: { detail: boolean }) {
  const pins = useMemo(() => [...Array(8)].map((_, i) => (i - 3.5) * 0.0035), []);
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.038, 0.032, 0.042]} />
        <meshStandardMaterial color="#15191E" roughness={0.62} metalness={0.35} />
      </mesh>
      <mesh position={[0, -0.002, 0.0215]}>
        <boxGeometry args={[0.026, 0.020, 0.002]} />
        <meshStandardMaterial color="#05070A" roughness={0.9} />
      </mesh>
      {detail && pins.map((x, i) => (
        <mesh key={i} position={[x, 0.004, 0.019]} rotation-x={-0.35}>
          <boxGeometry args={[0.0012, 0.0008, 0.010]} />
          <meshStandardMaterial color="#C9A227" metalness={1} roughness={0.28}
            emissive="#B87333" emissiveIntensity={0.12} />
        </mesh>
      ))}
      <Led x={-0.013} color="#34D399"
           getOn={() => (sim.linkState === 'up' ? 1 : sim.linkState === 'negotiating' ? 0 : 0)} />
      <Led x={0.013} color="#F5A524" getOn={() => activityLed().stretch * 0.6 + (activityLed().on ? 0.4 : 0)} />
      {/* Achtung: diese Gruppe wird von außen 5,5-fach skaliert — die
          Schriftgrößen sind entsprechend klein angesetzt, sonst stehen hier
          über 100 px hohe Lettern im Bild. */}
      {detail && (
        <>
          <Label position={[-0.013, 0.026, 0.021]} size={0.0018} color="#34D399">LINK</Label>
          <Label position={[0.013, 0.026, 0.021]} size={0.0018} color="#F5A524">ACT</Label>
          <Label position={[0, -0.021, 0.023]} size={0.0014} color="#98A3B1">
            8 Kontaktfedern = 4 Adernpaare
          </Label>
        </>
      )}
    </group>
  );
}

/** Kabelbogen zwischen Laptop und Pi. */
function Patch({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const geo = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, -0.06, 0.12));
    const curve = new THREE.CatmullRomCurve3([from, mid, to]);
    return new THREE.TubeGeometry(curve, 64, 0.0028, 10, false);
  }, [from, to]);
  const m = useRef<THREE.MeshStandardMaterial>(null!);
  useFrame(() => {
    const on = sim.linkState === 'up';
    m.current.emissiveIntensity = THREE.MathUtils.lerp(
      m.current.emissiveIntensity, on ? 0.22 : 0.0, 0.08);
  });
  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial ref={m} color="#1E242B" roughness={0.55} metalness={0.15}
        emissive="#4C9AFF" emissiveIntensity={0} />
    </mesh>
  );
}

export default function Hardware({ magjack = false }: { magjack?: boolean }) {
  const A = useMemo(() => new THREE.Vector3(-0.20, -0.05, 0.02), []);
  const B = useMemo(() => new THREE.Vector3(0.20, -0.09, 0.02), []);
  return (
    <group>
      {/*
        In der Detailansicht bleiben Laptop, Pi und Kabel weg. Die Buchse ist
        dort 5,5-fach vergrößert; zusammen im Bild stünde ein Stecker, der
        größer ist als der Rechner, in den er gehört.
      */}
      {!magjack && (
        <>
          {/* Laptop */}
          <group position={[-0.24, -0.10, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.22, 0.012, 0.16]} />
              <meshStandardMaterial color="#2B3138" roughness={0.4} metalness={0.85} />
            </mesh>
            <mesh position={[0, 0.075, -0.075]} rotation-x={-0.12} castShadow>
              <boxGeometry args={[0.22, 0.14, 0.008]} />
              <meshStandardMaterial color="#22282E" roughness={0.35} metalness={0.8} />
            </mesh>
          </group>

          {/* Raspberry Pi */}
          <group position={[0.24, -0.115, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.085, 0.004, 0.056]} />
              <meshStandardMaterial color="#0F3D2E" roughness={0.72} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.006, -0.012]}>
              <boxGeometry args={[0.022, 0.006, 0.022]} />
              <meshStandardMaterial color="#111418" roughness={0.3} metalness={0.6} />
            </mesh>
          </group>

          <Patch from={A} to={B} />
        </>
      )}

      <group position={magjack ? [0.06, 0, 0.02] : [0.20, -0.075, 0.02]}
             scale={magjack ? 5.5 : 1}>
        <Magjack detail={magjack} />
      </group>

      {/* Ohne Beschriftung ist die Übersichtsstufe für Einsteigerinnen wertlos. */}
      {!magjack && (
        <>
          <Label position={[-0.24, 0.075, 0.02]} size={0.014}>Laptop</Label>
          <Label position={[0.24, -0.055, 0.02]} size={0.014}>Raspberry Pi</Label>
          <Label position={[0.0, -0.155, 0.10]} size={0.011} color="#4C9AFF">
            Patchkabel · 1 m
          </Label>
        </>
      )}
    </group>
  );
}