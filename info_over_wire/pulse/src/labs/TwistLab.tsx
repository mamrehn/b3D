import { useEffect, useRef, useState } from 'react';
import { sim } from '../core/sim';
import Modal from '../ui/Modal';
import { Term } from '../ui/Glossary';

const SEG = 400;      // Segmente über die Kabellänge
const LEN_CM = 10;

/**
 * Physik-Kern: Die Störquelle induziert in jede Leiterschleife eine Spannung.
 * Bei jeder halben Windung kippt die Schleifenorientierung -> Vorzeichenwechsel.
 * Die Summe über alle Segmente ist der differentielle Störanteil.
 */
function computeNoise(twistPerCm: number, emiAmp: number, sourceLambdaCm: number) {
  let diff = 0, common = 0;
  for (let i = 0; i < SEG; i++) {
    const xCm = (i / SEG) * LEN_CM;
    const B = emiAmp * (1 + 0.35 * Math.sin((2 * Math.PI * xCm) / sourceLambdaCm));
    const orientation = Math.cos(2 * Math.PI * twistPerCm * xCm);   // Schleifennormale
    diff += B * orientation;
    common += B;
  }
  return { diff: Math.abs(diff) / SEG, common: common / SEG };
}

/** Crosstalk zwischen zwei Paaren: Korrelation ihrer Verdrillungsphasen. */
function computeNext(p1: number, p2: number) {
  let s = 0;
  for (let i = 0; i < SEG; i++) {
    const x = (i / SEG) * LEN_CM;
    s += Math.cos(2 * Math.PI * p1 * x) * Math.cos(2 * Math.PI * p2 * x);
  }
  return Math.abs(s) / SEG;
}

export default function TwistLab({ onClose }: { onClose: () => void }) {
  const [twist, setTwist] = useState(0);
  const [emi, setEmi] = useState(0.6);
  const [samePitch, setSamePitch] = useState(false);
  const [applied, setApplied] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);

  const { diff, common } = computeNoise(twist, emi, 3.7);
  const next = samePitch ? computeNext(twist, twist) : computeNext(twist, twist * 1.15 + 0.1);
  const snr = 20 * Math.log10(1 / (diff + next * 0.4 + 0.004));
  const solved = snr > 26;

  /*
   * Das Labor ist eine Werkbank, kein Fernsteuerpult. Vorher schrieb ein
   * useEffect den SNR bei jedem Reglerzupfen direkt in die laufende
   * Simulation — beim Öffnen sank der Störabstand sofort auf 4 dB und der
   * Link brach zusammen, ohne dass jemand etwas angeklickt hätte. Jetzt gilt
   * die Einstellung nur hier drin, bis sie ausdrücklich übernommen wird.
   */
  const original = useRef(sim.snrDb);
  const appliedRef = useRef(false);
  useEffect(() => () => {
    if (!appliedRef.current) sim.snrDb = original.current;
  }, []);

  const apply = () => {
    appliedRef.current = true;
    setApplied(true);
    sim.snrDb = Math.max(6, Math.min(38, snr));
    sim.twistRate = twist;
  };

  useEffect(() => {
    const ctx = cv.current!.getContext('2d')!;
    const W = 440, H = 170;
    ctx.clearRect(0, 0, W, H);

    // Störquelle
    ctx.fillStyle = `rgba(229,72,77,${0.05 + emi * 0.12})`;
    ctx.fillRect(0, 0, W, H);

    // Zwei Adern als Helix-Projektion
    for (const [phase, color] of [[0, '#4C9AFF'], [Math.PI, '#E8EDF3']] as const) {
      ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.beginPath();
      for (let i = 0; i <= 500; i++) {
        const u = i / 500, xCm = u * LEN_CM;
        const y = H / 2 + Math.sin(2 * Math.PI * twist * xCm + phase) * 26;
        i ? ctx.lineTo(u * W, y) : ctx.moveTo(u * W, y);
      }
      ctx.stroke();
    }

    // Magnetfeld-Tori: Farbe = Schleifenorientierung
    for (let i = 0; i < 46; i++) {
      const u = i / 46, xCm = u * LEN_CM;
      const o = Math.cos(2 * Math.PI * twist * xCm);
      ctx.beginPath();
      ctx.ellipse(u * W, H / 2, 7, 22, 0, 0, Math.PI * 2);
      ctx.strokeStyle = o > 0 ? `rgba(76,154,255,${0.10 + Math.abs(o) * 0.22})`
                              : `rgba(245,165,36,${0.10 + Math.abs(o) * 0.22})`;
      ctx.lineWidth = 1.4; ctx.stroke();
    }
  }, [twist, emi]);

  return (
    <Modal title="Twist-Werkstatt · Störungen ausblenden" width={560} onClose={onClose}>
      <div className="callout">
        <div className="callout-h">Dein Auftrag</div>
        <p className="prose">
          Neben dem Kabel läuft eine Störquelle — ein Motor, ein Netzteil, ein Funksender. Bring
          den <b>Differenzanteil</b> nach unten, ohne die Störquelle abzuschalten. Ab 26 dB
          Störabstand läuft die Übertragung wieder sauber.
        </p>
      </div>

      <canvas ref={cv} width={440} height={170} role="img"
              aria-label="Zwei verdrillte Adern in einem Störfeld"
              style={{ borderRadius: 8, background: '#0C0F13', width: '100%', height: 'auto',
                       marginTop: 12 }} />
      <p className="prose" style={{ fontSize: '.72em', marginTop: 6 }}>
        Blaue und orange Ringe zeigen die Orientierung der Leiterschleife. Kippt sie oft, wechselt
        die eingekoppelte Spannung ständig das Vorzeichen.
      </p>

      <div style={{ marginTop: 14 }}>
        <label className="field-label" htmlFor="tw-pitch">
          <span className="k">Verdrillung</span>
          <span className="v">{twist.toFixed(2)} Windungen/cm</span>
        </label>
        <input id="tw-pitch" type="range" min={0} max={2.5} step={0.01} value={twist}
               onChange={(e) => setTwist(+e.target.value)} />
        <div className="scale-ends"><span>glatt</span><span>eng verdrillt</span></div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label className="field-label" htmlFor="tw-emi">
          <span className="k">Störquelle</span>
          <span className="v">{(emi * 100).toFixed(0)} %</span>
        </label>
        <input id="tw-emi" type="range" min={0} max={1} step={0.01} value={emi}
               onChange={(e) => setEmi(+e.target.value)} />
        <div className="scale-ends"><span>ruhiges Büro</span><span>Werkhalle</span></div>
      </div>

      <hr className="hr" />

      <div className="stat-grid">
        <div className="stat b-am">
          <span className="stat-k">Gleichtakt</span>
          <span className="stat-v">{(common * 100).toFixed(1)} %</span>
          <span className="stat-n">liegt auf beiden Adern — stört nicht</span>
        </div>
        <div className={`stat ${diff > 0.1 ? 'b-ru' : 'b-em'}`}>
          <span className="stat-k">Differenzanteil</span>
          <span className="stat-v">{(diff * 100).toFixed(2)} %</span>
          <span className="stat-n">nur das sieht der Empfänger</span>
        </div>
        <div className={`stat ${next > 0.25 ? 'b-ru' : ''}`}>
          <span className="stat-k"><Term id="next">NEXT</Term></span>
          <span className="stat-v">{(next * 100).toFixed(1)} %</span>
          <span className="stat-n">Störung durch das Nachbarpaar</span>
        </div>
        <div className={`stat ${solved ? 'b-em' : 'b-am'}`}>
          <span className="stat-k"><Term id="snr">Störabstand</Term></span>
          <span className="stat-v">{snr.toFixed(1)} dB</span>
          <span className="stat-n">{solved ? 'Ziel erreicht' : 'Ziel: über 26 dB'}</span>
        </div>
      </div>

      <label className="switch" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={samePitch}
               onChange={(e) => setSamePitch(e.target.checked)} />
        <span>
          Alle 4 Paare mit derselben Schlaglänge fertigen
          <span style={{ color: 'var(--muted)' }}> — für Fortgeschrittene</span>
        </span>
      </label>

      <div className="callout" style={{ marginTop: 12 }}>
        <div className="callout-h">
          {twist < 0.2 ? 'Noch ist nichts gewonnen'
            : diff > 0.1 ? 'Es wird besser'
            : 'Das ist die Pointe'}
        </div>
        <p className="prose">
          {twist < 0.2
            ? 'Ohne Verdrillung koppelt die Störung ungleich in beide Adern ein. Der '
              + 'Differenzempfänger sieht sie in voller Höhe.'
            : diff > 0.1
              ? 'Die Schleifenorientierung kippt bereits, aber noch nicht oft genug über die '
                + 'Kabellänge. Dreh weiter.'
              : 'Die Störung koppelt jetzt in beide Adern gleich stark ein — sieh den '
                + 'Gleichtakt an, er ist unverändert hoch. Die Rechnung A − B zieht sie '
                + 'trotzdem heraus. Nicht Feldauslöschung rettet die Übertragung, sondern '}
          {twist >= 0.2 && diff <= 0.1 && <Term id="commonmode">Gleichtaktunterdrückung</Term>}
          {twist >= 0.2 && diff <= 0.1 && '.'}
          {samePitch && next > 0.25 && ' Und mit gleicher Schlaglänge bei allen Paaren '
            + 'explodiert das Nebensprechen — genau deshalb sind sie in echten Kabeln '
            + 'unterschiedlich.'}
        </p>
      </div>

      <div className="btn-row" style={{ marginTop: 12, alignItems: 'center' }}>
        <button className="primary" onClick={apply}>→ Auf die echte Verbindung anwenden</button>
        {applied && <span className="tag em">übernommen</span>}
      </div>
      <p className="prose" style={{ fontSize: '.72em', marginTop: 7 }}>
        Solange du nicht übernimmst, bleiben die Werte hier drin. Beim Schließen wird der
        ursprüngliche Störabstand wiederhergestellt.
      </p>
    </Modal>
  );
}
