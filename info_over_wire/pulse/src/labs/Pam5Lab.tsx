import { useState, useMemo } from 'react';
import { encodeByte, slice, gauss, noiseFromSnr } from '../core/net';
import { sim } from '../core/sim';
import Modal from '../ui/Modal';
import { Term } from '../ui/Glossary';

function simulateErrors(snrDb: number, trellis: boolean, n = 4000) {
  const noise = noiseFromSnr(snrDb);
  let err = 0, corrected = 0;
  for (let i = 0; i < n; i++) {
    const byte = (Math.random() * 256) | 0;
    const sent = encodeByte(byte, trellis);
    for (const s of sent) {
      const rx = s + gauss() * noise;
      const dec = slice(rx, trellis);
      if (dec !== s) {
        // Trellis korrigiert Einzelfehler mit ~3 dB Coding Gain
        if (trellis && Math.abs(rx - s) < noise * 2.2) corrected++;
        else err++;
      }
    }
  }
  return { ber: err / (n * 4), corrected: corrected / (n * 4) };
}

export default function Pam5Lab({ onClose }: { onClose: () => void }) {
  const [byte, setByte] = useState(0xa7);
  const [snr, setSnr] = useState(24);
  const [trellis, setTrellis] = useState(false);
  const [applied, setApplied] = useState(false);

  const syms = encodeByte(byte, trellis);
  const stats = useMemo(() => simulateErrors(snr, trellis), [snr, trellis]);
  const bad = stats.ber > 1e-3;

  // Wie in der Twist-Werkstatt: Sandkasten. Die echte Verbindung ändert sich
  // erst, wenn jemand ausdrücklich übernimmt.
  const apply = () => {
    setApplied(true);
    sim.snrDb = snr;
    sim.trellis = trellis;
  };

  return (
    <Modal title="PAM-5-Labor · fünf Pegel, vier davon zählen" width={560} onClose={onClose}>
      <div className="callout">
        <div className="callout-h">Worum es hier geht</div>
        <p className="prose">
          Ein Byte wird in vier <Term id="symbol">Symbole</Term> zerlegt, eines pro Adernpaar.
          Jedes Symbol ist eine von vier Spannungen und trägt damit 2 Bit. Der fünfte Pegel
          (0 V) trägt keine Daten — schalte ihn unten frei und sieh, wofür er trotzdem gut ist.
        </p>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="field-label" htmlFor="p5-byte">
          <span className="k">Eingangsbyte</span>
          <span className="v" style={{ color: 'var(--blue)' }}>
            0x{byte.toString(16).padStart(2, '0').toUpperCase()} · {byte.toString(2).padStart(8, '0')}
          </span>
        </label>
        <input id="p5-byte" type="range" min={0} max={255} value={byte}
               onChange={(e) => setByte(+e.target.value)} />
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 12 }}>
        {syms.map((v, i) => (
          <div key={i} className={`stat ${v === 0 ? 'b-am' : 'b-bl'}`}>
            <span className="stat-k">Paar {i + 1}</span>
            <span className="stat-v">{v > 0 ? '+' : ''}{v.toFixed(1)} V</span>
            <span className="stat-n">
              {v === 0 ? 'Prüfpegel' : `Bits ${((byte >> (6 - i * 2)) & 3).toString(2).padStart(2, '0')}`}
            </span>
          </div>
        ))}
      </div>

      <p className="prose mono" style={{ fontSize: '.74em', marginTop: 12 }}>
        8 Bit → 4 Symbole × 125 MBaud × 4 Paare ={' '}
        <span style={{ color: 'var(--emerald)' }}>1 Gbit/s</span>
      </p>

      <hr className="hr" />

      <div>
        <label className="field-label" htmlFor="p5-snr">
          <span className="k">Störabstand</span>
          <span className="v">{snr.toFixed(0)} dB</span>
        </label>
        <input id="p5-snr" type="range" min={8} max={38} step={1} value={snr}
               onChange={(e) => setSnr(+e.target.value)} />
        <div className="scale-ends"><span>Bohrmaschine daneben</span><span>Serverraum</span></div>
      </div>

      <label className="switch" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={trellis} onChange={(e) => setTrellis(e.target.checked)} />
        <span>
          Fünften Pegel freischalten (<Term id="trellis">Trellis-Korrektur</Term>)
        </span>
      </label>

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <div className={`stat ${bad ? 'b-ru' : 'b-em'}`}>
          <span className="stat-k"><Term id="ber">Bitfehlerrate</Term></span>
          <span className="stat-v">{stats.ber < 1e-6 ? '< 1e-6' : stats.ber.toExponential(1)}</span>
          <span className="stat-n">{bad ? 'Frames gehen verloren' : 'Übertragung ist sauber'}</span>
        </div>
        {trellis && (
          <div className="stat b-am">
            <span className="stat-k">davon repariert</span>
            <span className="stat-v">{(stats.corrected * 100).toFixed(2)} %</span>
            <span className="stat-n">durch den fünften Pegel gerettet</span>
          </div>
        )}
      </div>

      <div className="callout" style={{ marginTop: 12 }}>
        <div className="callout-h">
          {trellis ? 'Redundanz statt Datenrate' : 'Vier Pegel reichen — bis es rauscht'}
        </div>
        <p className="prose">
          {trellis
            ? 'Der fünfte Pegel trägt keine Nutzdaten. Er schränkt ein, welche Symbolfolgen '
              + 'überhaupt erlaubt sind. Der Empfänger sucht deshalb nicht den nächstliegenden '
              + 'Pegel, sondern die wahrscheinlichste zulässige Folge — das bringt rund 6 dB '
              + 'Störabstand zurück.'
            : 'Rechnerisch genügen vier Pegel für 2 Bit pro Symbol. Zieh den Störabstand nach '
              + 'unten: die Bitfehler kommen sofort, und jeder einzelne zerstört einen ganzen '
              + 'Frame.'}
        </p>
      </div>

      <div className="btn-row" style={{ marginTop: 12, alignItems: 'center' }}>
        <button className="primary" onClick={apply}>→ Auf die echte Verbindung anwenden</button>
        {applied && <span className="tag em">übernommen</span>}
      </div>

      <p className="prose" style={{ fontSize: '.71em', marginTop: 10, color: 'var(--dim)' }}>
        Didaktisch vereinfacht: Echtes 4D-PAM5 codiert über alle vier Paare gemeinsam mit einem
        8-Zustands-Trellis. Bitrate und Kernaussage stimmen, die Zuordnung Byte → Symbol ist
        hier absichtlich einfacher gehalten.
      </p>
    </Modal>
  );
}
