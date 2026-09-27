/* ============ Timing-Konstanten 1000BASE-T ============ */
export const BIT_RATE      = 1e9;
export const BYTE_TIME     = 8e-9;    // 1 Byte = 8 ns
export const SYMBOL_TIME   = 8e-9;    // 125 MBaud
export const PREAMBLE_TIME = 64e-9;   // 8 Byte Preamble + SFD
export const IFG_TIME      = 96e-9;   // 12 Byte Inter-Frame Gap
export const PROP_VELOCITY = 2.0e8;   // ~0.65c im UTP
export const LED_STRETCH   = 0.020;   // 20 ms

export const symbolLengthM = () => SYMBOL_TIME * PROP_VELOCITY;          // 1.6 m
export const frameLengthM  = (bytes: number) => bytes * BYTE_TIME * PROP_VELOCITY;

export function frameWireTime(bytes: number) {
  return PREAMBLE_TIME + bytes * BYTE_TIME + IFG_TIME;                    // 64 B -> 672 ns
}

/* ============ CRC32 (Ethernet FCS) ============ */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ============ Frame-Builder ============ */
class Buf {
  a: number[] = [];
  u8(...v: number[]) { this.a.push(...v.map(x => x & 0xff)); return this; }
  u16(v: number)     { return this.u8(v >> 8, v); }
  u32(v: number)     { return this.u8(v >>> 24, v >>> 16, v >>> 8, v); }
  mac(s: string)     { return this.u8(...s.split(':').map(h => parseInt(h, 16))); }
  ip(s: string)      { return this.u8(...s.split('.').map(Number)); }
  pad(n: number)     { while (this.a.length < n) this.a.push(0); return this; }
  out()              { return Uint8Array.from(this.a); }
}

export interface Frame {
  name: string; bytes: Uint8Array; fcs: number;
  fields: { at: number; len: number; label: string; color: string }[];
}

const C = { dst:'#4C9AFF', src:'#7DD3FC', type:'#A78BFA', pay:'#94A3B8', fcs:'#34D399' };

export const LAPTOP_MAC = '3c:22:fb:4a:19:e0';
export const PI_MAC     = 'dc:a6:32:1f:4b:90';

/** ARP-Probe: exakt 60 Byte + 4 Byte FCS = 64 Byte = 512 ns auf dem Draht. */
export function buildArpProbe(): Frame {
  const b = new Buf()
    .mac('ff:ff:ff:ff:ff:ff').mac(PI_MAC).u16(0x0806)   // Ethernet
    .u16(1).u16(0x0800).u8(6, 4).u16(1)                  // ARP header
    .mac(PI_MAC).ip('192.168.1.10')
    .mac('00:00:00:00:00:00').ip('192.168.1.20')
    .pad(60);
  const bytes = b.out();
  return {
    name: 'ARP Request · who-has 192.168.1.20',
    bytes, fcs: crc32(bytes),
    fields: [
      { at:0,  len:6,  label:'Dst MAC (Broadcast)', color:C.dst },
      { at:6,  len:6,  label:'Src MAC (rpi)',       color:C.src },
      { at:12, len:2,  label:'EtherType 0x0806',    color:C.type },
      { at:14, len:28, label:'ARP Payload',         color:C.pay },
      { at:42, len:18, label:'Padding',             color:'#3F4854' },
    ],
  };
}

/** mDNS Query — der typische Idle-Verkehr im Ad-hoc-Netz. */
export function buildMdnsQuery(): Frame {
  const b = new Buf()
    .mac('01:00:5e:00:00:fb').mac(PI_MAC).u16(0x0800)
    .u8(0x45, 0x00).u16(50).u16(0).u16(0).u8(255, 17).u16(0)
    .ip('192.168.1.10').ip('224.0.0.251')
    .u16(5353).u16(5353).u16(30).u16(0)
    .u16(0).u16(1).u16(0).u16(0).u16(0)
    .u8(9).u8(...[..._s('_services')]).u8(7).u8(...[..._s('_dns-sd')])
    .u8(4).u8(...[..._s('_udp')]).u8(5).u8(...[..._s('local')]).u8(0)
    .u16(12).u16(1)
    .pad(60);
  const bytes = b.out();
  return {
    name: 'mDNS Query · _services._dns-sd._udp.local',
    bytes, fcs: crc32(bytes),
    fields: [
      { at:0,  len:6,  label:'Dst MAC (Multicast)', color:C.dst },
      { at:6,  len:6,  label:'Src MAC (rpi)',       color:C.src },
      { at:12, len:2,  label:'EtherType 0x0800',    color:C.type },
      { at:14, len:20, label:'IPv4 Header',         color:C.pay },
      { at:34, len:8,  label:'UDP Header',          color:'#67E8F9' },
      { at:42, len:44, label:'DNS Question',        color:C.fcs },
    ],
  };
}
const _s = (s: string) => Uint8Array.from([...s].map(c => c.charCodeAt(0)));

/* ============ PAM-5 ============
 * DIDAKTISCHE VEREINFACHUNG (bewusst, siehe GDD §9.3):
 * Echtes 1000BASE-T nutzt 4D-PAM5 mit 8-Zustands-Trellis über alle 4 Paare
 * gemeinsam. Hier: 2 Bit -> 1 Datensymbol aus 4 Leveln, Level 0 bleibt frei
 * und trägt die Redundanz. Bitrate stimmt exakt (4 Paare x 125 MBaud x 2 bit
 * = 1 Gbit/s), die Aussage "das 5. Level ist kein Datenlevel" stimmt auch.
 */
export const PAM5_LEVELS = [-1, -0.5, 0, 0.5, 1] as const;
export const DATA_LEVELS = [-1, -0.5, 0.5, 1] as const;   // ohne die 0

/** 1 Byte -> 4 Symbole, eines pro Twisted Pair. */
export function encodeByte(byte: number, trellis: boolean): number[] {
  const out: number[] = [];
  for (let p = 0; p < 4; p++) {
    const twoBits = (byte >> (6 - p * 2)) & 0b11;
    out.push(DATA_LEVELS[twoBits]);
  }
  if (trellis) {
    // Parität als 5. Level: bei ungerader Bitparität wird Pair 3 auf 0 gezogen
    // und der Wert über die Trellis-Metrik rekonstruiert.
    const parity = [...Array(8)].reduce((a, _, i) => a ^ ((byte >> i) & 1), 0);
    if (parity) out[3] = 0;
  }
  return out;
}

/** Slicer: nächstgelegenes gültiges Level. */
export function slice(v: number, trellis: boolean): number {
  const set: readonly number[] = trellis ? PAM5_LEVELS : DATA_LEVELS;
  let best = set[0];
  for (const l of set) if (Math.abs(v - l) < Math.abs(v - best)) best = l;
  return best;
}

/** Gauß-Rauschen (Box-Muller). */
export function gauss(rng: () => number = Math.random): number {
  const u = 1 - rng(), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Rauschamplitude aus SNR in dB, bezogen auf 1 V Vollausschlag. */
export const noiseFromSnr = (snrDb: number) => Math.pow(10, -snrDb / 20);

/* ============ Auto-MDIX: 11-Bit-LFSR ============
 * Auto-MDIX erkennt KEINE Kollision. Jede Seite würfelt pseudo-zufällig,
 * ob sie MDI oder MDI-X fährt. Link entsteht nur bei XOR = 1.
 */
export class Lfsr11 {
  private state: number;
  constructor(seed = 0x2ab) { this.state = seed; }
  next(): number {
    const bit = ((this.state >> 10) ^ (this.state >> 8)) & 1;
    this.state = ((this.state << 1) | bit) & 0x7ff;
    return bit;
  }
}

export interface MdixAttempt { n: number; a: boolean; b: boolean; ok: boolean }

export function runAutoMdix(seedA: number, seedB: number, max = 12): MdixAttempt[] {
  const A = new Lfsr11(seedA), B = new Lfsr11(seedB);
  const log: MdixAttempt[] = [];
  for (let n = 1; n <= max; n++) {
    const a = !!A.next(), b = !!B.next();
    const ok = a !== b;
    log.push({ n, a, b, ok });
    if (ok) break;
  }
  return log;
}

/* ============ Traffic-Profile ============ */
export type TrafficMode = 'idle' | 'ssh' | 'scp';

export const TRAFFIC: Record<TrafficMode, {
  label: string; hint: string; ppsMin: number; ppsMax: number; frame: () => Frame;
}> = {
  idle: {
    label: 'Ruhendes Netz',
    hint: 'Niemand arbeitet. Nur alle 15–30 s eine mDNS-Anfrage — die LED blitzt fast nie.',
    ppsMin: 1 / 30, ppsMax: 1 / 15, frame: buildMdnsQuery,
  },
  ssh:  {
    label: 'Fernwartung (SSH)',
    hint: 'Jemand tippt in einer Konsole: 2–60 Pakete/s, die LED flackert unregelmäßig.',
    ppsMin: 2, ppsMax: 60, frame: buildArpProbe,
  },
  scp:  {
    label: 'Dateitransfer',
    hint: 'Volle Leitung: 82.400 Pakete/s. Die LED zeigt Dauerlicht und sagt nichts mehr aus.',
    ppsMin: 82000, ppsMax: 82800, frame: buildArpProbe,
  },
};