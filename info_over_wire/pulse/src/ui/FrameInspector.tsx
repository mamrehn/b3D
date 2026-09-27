import type { ReactElement } from 'react';
import { useTick } from '../core/store';
import { sim, currentByteIndex } from '../core/sim';
import { frameLengthM } from '../core/net';
import { Term } from './Glossary';

const hx = (n: number) => n.toString(16).padStart(2, '0');

/**
 * Hexdump des Frames, der gerade auf der Leitung liegt.
 *
 * Ein Hexdump ist für Einsteigerinnen erst einmal eine Wand aus Zahlen. Drei
 * Dinge machen ihn lesbar: die Farbcodierung nach Feldern, eine Legende, die
 * die Farben benennt, und ein Satz, der erklärt, was man hier überhaupt sieht.
 */
export default function FrameInspector() {
  useTick(30);
  const f = sim.frame;
  const cur = currentByteIndex();
  const rows: ReactElement[] = [];

  for (let off = 0; off < f.bytes.length; off += 16) {
    const cells: ReactElement[] = [];
    for (let i = 0; i < 16 && off + i < f.bytes.length; i++) {
      const idx = off + i;
      const field = f.fields.find((fl) => idx >= fl.at && idx < fl.at + fl.len);
      const b = <span style={{ color: field?.color ?? 'var(--muted)' }}>{hx(f.bytes[idx])}</span>;
      cells.push(
        <span key={i}>
          {idx === cur ? <mark>{b}</mark> : b}
          {i === 7 ? '  ' : ' '}
        </span>
      );
    }
    rows.push(
      <div key={off}>
        <span style={{ color: 'var(--stroke)' }}>{off.toString(16).padStart(4, '0')}</span>{'  '}
        {cells}
      </div>
    );
  }

  const field = cur >= 0 ? f.fields.find((fl) => cur >= fl.at && cur < fl.at + fl.len) : null;
  const meters = frameLengthM(f.bytes.length + 4);

  return (
    <section className="glass pad" aria-label="Frame-Inspektor">
      <div className="panel-head">
        <span className="panel-title">Frame-Inspektor</span>
        <span className="tag bl">{f.name}</span>
      </div>

      <p className="prose" style={{ marginBottom: 10 }}>
        Derselbe <Term id="frame">Frame</Term>, den du im Kupfer siehst — hier von der digitalen
        Seite. Jedes Zahlenpaar ist ein Byte in Hexadezimalschreibweise, die Farbe sagt, zu
        welchem Feld es gehört.
      </p>

      <div className="hex">{rows}</div>
      <div className="hex" style={{ marginTop: 4, color: 'var(--emerald)' }}>
        {`FCS  ${hx(f.fcs >>> 24)} ${hx(f.fcs >>> 16)} ${hx(f.fcs >>> 8)} ${hx(f.fcs)}`}
      </div>

      <div className="legend" style={{ marginTop: 10 }}>
        {f.fields.map((fl) => (
          <span key={fl.at} className="legend-item">
            <i style={{ background: fl.color }} />{fl.label}
          </span>
        ))}
        <span className="legend-item"><i style={{ background: '#34D399' }} />
          <Term id="fcs">FCS (Prüfsumme)</Term>
        </span>
      </div>

      <hr className="hr" />

      <div className="stat-grid">
        <div className="stat b-bl">
          <span className="stat-k">Byte unter der Kamera</span>
          <span className="stat-v">{cur >= 0 ? `#${cur}` : '—'}</span>
          <span className="stat-n">{cur >= 0 ? field?.label ?? 'unbenannt' : 'Leitung ist gerade still'}</span>
        </div>
        <div className="stat b-am">
          <span className="stat-k">Länge im Kupfer</span>
          <span className="stat-v">{meters.toFixed(0)} m</span>
          <span className="stat-n">{f.bytes.length + 4} Byte × 8 ns × 200.000 km/s</span>
        </div>
      </div>

      <p className="prose" style={{ marginTop: 10 }}>
        Dieser Frame ist rund {meters.toFixed(0)} m lang und passt damit nicht ins 1-m-Kabel.
        Er liegt auch nie am Stück darin, sondern wird hindurchgeschoben: während das Ende noch
        gesendet wird, ist der Anfang längst angekommen.
      </p>
    </section>
  );
}
