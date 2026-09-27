import { useEffect, useRef } from 'react';
import { sim, currentSymbols } from '../core/sim';
import { PAM5_LEVELS, DATA_LEVELS, noiseFromSnr, gauss } from '../core/net';
import { Term } from './Glossary';

const W = 300, H = 150, PAD = 22;

/** Zeichnet ein echtes Augendiagramm: N überlagerte Symbolübergänge mit Rauschen. */
function drawEye(ctx: CanvasRenderingContext2D, snrDb: number, trellis: boolean) {
  ctx.clearRect(0, 0, W, H);
  const yOf = (v: number) => H / 2 - v * (H / 2 - PAD);
  const set: readonly number[] = trellis ? PAM5_LEVELS : DATA_LEVELS;
  const noise = noiseFromSnr(snrDb);

  // Raster
  ctx.strokeStyle = '#20262E'; ctx.lineWidth = 1;
  set.forEach((l) => { ctx.beginPath(); ctx.moveTo(0, yOf(l)); ctx.lineTo(W, yOf(l)); ctx.stroke(); });

  // 220 Traces
  ctx.lineWidth = 1;
  for (let t = 0; t < 220; t++) {
    const a = set[(Math.random() * set.length) | 0];
    const b = set[(Math.random() * set.length) | 0];
    ctx.strokeStyle = `rgba(76,154,255,${0.10 + Math.random() * 0.10})`;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const w = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, (u - 0.22) / 0.56)));
      const v = a + (b - a) * w + gauss() * noise * 0.55;
      const x = u * W, y = yOf(v);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  // Augenöffnung messen (vertikaler Abstand der beiden mittleren Level minus 6σ)
  const gap = Math.abs(set[1] - set[0]);
  const open = Math.max(0, gap - noise * 6);
  ctx.strokeStyle = open > gap * 0.35 ? '#34D399' : '#E5484D';
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(W / 2 - 26, yOf(set[1]) + 3, 52, Math.max(1, yOf(set[0]) - yOf(set[1]) - 6));
  ctx.setLineDash([]);
  return open / gap;
}

export default function Scope() {
  const eye = useRef<HTMLCanvasElement>(null);
  const openRef = useRef<HTMLSpanElement>(null);
  const verdict = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0, last = 0;
    const loop = (t: number) => {
      if (t - last > 90) {                       // 11 Hz reicht, spart GPU
        last = t;
        const ctx = eye.current?.getContext('2d');
        if (ctx) {
          const o = drawEye(ctx, sim.snrDb, sim.trellis);
          if (openRef.current) {
            openRef.current.textContent = `${(o * 100).toFixed(0)} %`;
            openRef.current.style.color = o > 0.35 ? 'var(--emerald)' : 'var(--rust)';
          }
          // Zahl allein sagt Einsteigerinnen nichts — Einordnung in Worten dazu.
          if (verdict.current) {
            verdict.current.textContent = o > 0.6
              ? 'Weit offen — der Empfänger entscheidet mühelos richtig.'
              : o > 0.35
                ? 'Noch offen, aber die Reserve schrumpft.'
                : 'Fast geschlossen — hier entstehen Bitfehler.';
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const syms = currentSymbols();

  return (
    <section className="glass pad" aria-label="Augendiagramm">
      <div className="panel-head">
        <span className="panel-title">Augendiagramm</span>
        <span className="tag">Öffnung <span ref={openRef}>—</span></span>
      </div>

      <p className="prose" style={{ marginBottom: 9 }}>
        Hunderte <Term id="symbol">Symbolübergänge</Term> übereinandergelegt. Die Lücke in der
        Mitte ist die Entscheidungsreserve des Empfängers — je weiter offen, desto sicherer.
      </p>

      <canvas ref={eye} width={W} height={H} role="img"
              aria-label="Augendiagramm des Empfangssignals"
              style={{ borderRadius: 8, background: '#0C0F13', width: '100%', height: 'auto' }} />
      <p className="prose" style={{ marginTop: 7, fontSize: '.75em' }}>
        <span ref={verdict}>—</span>
      </p>

      <hr className="hr" />

      <div className="panel-title" style={{ marginBottom: 7 }}>
        Spannung auf den 4 Paaren · jetzt
      </div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {syms.map((v, i) => (
          <div key={i} className={`stat ${v === 0 ? 'b-am' : 'b-bl'}`}>
            <span className="stat-k">Paar {i + 1}</span>
            <span className="stat-v">{v > 0 ? '+' : ''}{v.toFixed(1)} V</span>
          </div>
        ))}
      </div>
      <p className="prose" style={{ marginTop: 7, fontSize: '.74em' }}>
        {sim.trellis
          ? '0 V trägt keine Daten — es ist die Reserve der Trellis-Korrektur.'
          : 'Vier Datenpegel, kein Schutz gegen Rauschen.'}
      </p>

      <div className="stat b-em" style={{ marginTop: 9 }}>
        <span className="stat-k"><Term id="snr">Störabstand</Term></span>
        <span className="stat-v">{sim.snrDb.toFixed(1)} dB</span>
      </div>
    </section>
  );
}
