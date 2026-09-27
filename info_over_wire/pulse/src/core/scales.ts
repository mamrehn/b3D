export type LayerId = 'L2' | 'L1' | 'MEDIUM';

export interface ScaleStop {
  id: string; label: string; s: number;
  meters: number;    // sichtbare Weltbreite
  dilation: number;  // Sim-Sekunden pro Real-Sekunde
  layer: LayerId;
  hint: string;
}

/** Die 5 Rastpunkte. Raum und Zeit sind fest gekoppelt — das ist die Kernmechanik. */
export const STOPS: ScaleStop[] = [
  { id:'chassis', label:'Gehäuse', s:0.00, meters:1,    dilation:1,       layer:'L2',     hint:'Menschliche Zeit' },
  { id:'led',     label:'LED',     s:0.25, meters:1e-2, dilation:2e-2,    layer:'L1',     hint:'Pulse Stretching · 20 ms' },
  { id:'frame',   label:'Frame',   s:0.50, meters:1e-4, dilation:6.72e-7, layer:'L1',     hint:'Ein Frame · 672 ns' },
  { id:'symbol',  label:'Symbol',  s:0.75, meters:1e-5, dilation:8e-9,    layer:'MEDIUM', hint:'Ein Symbol · 8 ns' },
  { id:'bit',     label:'Bit',     s:1.00, meters:1e-6, dilation:1e-9,    layer:'MEDIUM', hint:'Eine Nanosekunde' },
];

/** Der Ghost-Marker: hier steht das menschliche Auge. */
export const HUMAN_EYE_S = 0.25;

const logLerp = (a: number, b: number, t: number) => a * Math.pow(b / a, t);

export function sampleScale(s: number) {
  const c = Math.min(1, Math.max(0, s));
  let i = 0;
  while (i < STOPS.length - 2 && c > STOPS[i + 1].s) i++;
  const a = STOPS[i], b = STOPS[i + 1];
  const t = (c - a.s) / (b.s - a.s);
  return {
    meters:   logLerp(a.meters, b.meters, t),
    dilation: logLerp(a.dilation, b.dilation, t),
    stop: t < 0.5 ? a : b,
    layer: (t < 0.5 ? a : b).layer,
    index: i, t,
  };
}

/** Layer-Sichtbarkeitsfenster mit weichem Ein-/Ausblenden (der 200-ms-Blur-Wipe aus dem GDD). */
export const WINDOWS: Record<string, [number, number]> = {
  chassis: [-0.05, 0.20],
  led:     [ 0.13, 0.43],
  silicon: [ 0.35, 0.63],
  cable:   [ 0.55, 0.85],
  signal:  [ 0.77, 1.05],
};

export function layerAlpha(s: number, win: [number, number], fade = 0.07) {
  const [a, b] = win;
  if (s <= a - fade || s >= b + fade) return 0;
  const inA  = Math.min(1, Math.max(0, (s - (a - fade)) / (fade * 2)));
  const outB = Math.min(1, Math.max(0, ((b + fade) - s) / (fade * 2)));
  return Math.min(inA, outB);
}

/* ---------- Formatter ---------- */
const SI: [number, string][] = [
  [1, 's'], [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns'], [1e-12, 'ps'],
];
export function fmtTime(sec: number): string {
  const a = Math.abs(sec);
  for (const [f, u] of SI) if (a >= f || u === 'ps') {
    const v = sec / f;
    return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)} ${u}`;
  }
  return `${sec} s`;
}
export function fmtLength(m: number): string {
  const a = Math.abs(m);
  if (a >= 1)    return `${m.toFixed(2)} m`;
  if (a >= 1e-3) return `${(m * 1e3).toFixed(1)} mm`;
  if (a >= 1e-6) return `${(m * 1e6).toFixed(1)} µm`;
  return `${(m * 1e9).toFixed(0)} nm`;
}
export function fmtRatio(r: number): string {
  if (r >= 1) return '1:1';
  const n = 1 / r;
  if (n >= 1e6) return `1:${(n / 1e6).toFixed(1)} Mio.`;
  if (n >= 1e3) return `1:${(n / 1e3).toFixed(1)} Tsd.`;
  return `1:${n.toFixed(0)}`;
}