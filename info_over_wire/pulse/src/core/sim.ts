import * as N from './net';
import { sampleScale } from './scales';

/**
 * Mutable Simulationszustand. Bewusst KEIN React-State:
 * 3D liest hier bei 60 fps direkt, die UI pollt bei 20 Hz.
 */
export const sim = {
  t: 0,                  // Simulationszeit in Sekunden
  realT: 0,
  running: true,
  dilation: 1,
  scale: 0,

  // Startet mit sichtbarem Verkehr: ein totes Netz ist als erster Eindruck
  // didaktisch wertlos. "Idle" ist eine bewusste Wahl, kein Ausgangszustand.
  mode: 'ssh' as N.TrafficMode,
  packets: [] as number[],   // Zeitstempel, Ringpuffer
  nextPacketAt: 2,
  saturated: false,          // zu viele Pakete zum Einzeln-Zählen
  lastPacket: -999,
  frameStart: -999,
  frame: N.buildArpProbe(),

  counters: { frames: 0, fcsErrors: 0, retransmits: 0, bytes: 0 },

  linkState: 'down' as 'down' | 'negotiating' | 'up',
  linkT: 0,
  master: 'rpi' as 'rpi' | 'laptop',
  mdix: [] as N.MdixAttempt[],

  snrDb: 31.2,
  twistRate: 1.8,
  trellis: true,
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function resetLink() {
  sim.linkState = 'negotiating';
  sim.linkT = 0;
  sim.mdix = N.runAutoMdix((Math.random() * 0x7ff) | 0 || 1, (Math.random() * 0x7ff) | 0 || 3);
  sim.master = Math.random() < 0.5 ? 'rpi' : 'laptop';   // echter Münzwurf
}

export function setMode(m: N.TrafficMode) {
  sim.mode = m;
  sim.frame = N.TRAFFIC[m].frame();
  sim.nextPacketAt = sim.t + 1 / N.TRAFFIC[m].ppsMax;
  sim.saturated = N.TRAFFIC[m].ppsMin > 500;
}

/** Ein Tick. dtReal in Sekunden Echtzeit. */
export function tick(dtReal: number, scale: number) {
  const { dilation } = sampleScale(scale);
  sim.scale = scale;
  sim.dilation = dilation;
  sim.realT += dtReal;
  if (!sim.running) return;

  const dtSim = dtReal * dilation;
  sim.t += dtSim;

  if (sim.linkState === 'negotiating') {
    // Bewusst dtReal statt dtSim: Auto-Negotiation ist ein Vorgang der realen
    // Welt und darf nicht einfrieren, nur weil die Betrachterin gerade tief
    // hineingezoomt hat. Sonst hängt der Link auf Symbolebene für immer.
    sim.linkT += dtReal;
    // FLP-Bursts alle ~16 ms, plus PHY-Training.
    // Realistisch 1-3 s, abhängig von der Anzahl der MDIX-Versuche.
    if (sim.linkT > 0.9 + sim.mdix.length * 0.12) {
      sim.linkState = 'up';
      setMode(sim.mode);
    }
    return;
  }
  if (sim.linkState !== 'up') return;

  const p = N.TRAFFIC[sim.mode];
  if (sim.saturated) {
    sim.lastPacket = sim.t;
    sim.counters.frames += dtSim * p.ppsMin;
    sim.counters.bytes  += dtSim * p.ppsMin * 1518;
    if (sim.frameStart < sim.t - N.frameWireTime(64)) sim.frameStart = sim.t;
  } else {
    let guard = 0;
    while (sim.nextPacketAt <= sim.t && guard++ < 512) {
      sim.packets.push(sim.nextPacketAt);
      sim.lastPacket = sim.nextPacketAt;
      sim.frameStart = sim.nextPacketAt;
      sim.counters.frames++;
      sim.counters.bytes += sim.frame.bytes.length + 4;
      // Bitfehler-Wahrscheinlichkeit steigt mit sinkendem SNR
      const noise = N.noiseFromSnr(sim.snrDb);
      const margin = sim.trellis ? 0.25 : 0.16;
      if (noise > margin * (0.9 + Math.random() * 0.2)) {
        sim.counters.fcsErrors++;
        sim.counters.retransmits++;
      }
      sim.nextPacketAt += 1 / rnd(p.ppsMin, p.ppsMax);
    }
    if (sim.packets.length > 200) sim.packets.splice(0, sim.packets.length - 200);
  }
}

/* ---------- Abgeleitete Größen (keine Simulation, reine Ableitung aus sim.t) ---------- */

/** Activity-LED: leuchtet, wenn im 20-ms-Fenster ein Paket lag. */
export function activityLed(): { on: boolean; stretch: number } {
  if (sim.linkState !== 'up') return { on: false, stretch: 0 };
  if (sim.saturated) return { on: true, stretch: 1 };
  const age = sim.t - sim.lastPacket;
  const on = age >= 0 && age < N.LED_STRETCH;
  return { on, stretch: on ? 1 - age / N.LED_STRETCH : 0 };
}

/** Sekunden bis zum nächsten Paket (für den Idle-Ticker). */
export const nextPacketIn = () => Math.max(0, sim.nextPacketAt - sim.t);

/** Welches Byte liegt gerade physisch unter der Kamera? -1 = Leitung idle. */
export function currentByteIndex(): number {
  const off = sim.t - sim.frameStart - N.PREAMBLE_TIME;
  if (off < 0) return -1;
  const i = Math.floor(off / N.BYTE_TIME);
  return i < sim.frame.bytes.length ? i : -1;
}

/** Die 4 Symbole, die gerade auf den 4 Paaren liegen. */
export function currentSymbols(): number[] {
  const i = currentByteIndex();
  if (i < 0) return [0, 0, 0, 0];   // Idle-Symbole
  return N.encodeByte(sim.frame.bytes[i], sim.trellis);
}

/** LED-Blitze pro Paket vs. tatsächliche Pakete — die Illusion in Zahlen. */
export function stretchFactor(): number {
  return N.LED_STRETCH / N.frameWireTime(64);   // ~29.762x
}