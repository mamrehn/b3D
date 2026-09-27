import { PAIRS } from '../scene/Cable';
import { Term } from './Glossary';

/**
 * Legende zu den vier Adernpaaren.
 *
 * Stand vorher als Schrift im 3D-Raum neben dem Kabel — und damit unter den
 * rechten Panels. Farbe und Schlaglänge gehören zusammen und müssen ablesbar
 * sein, sonst bleibt "vier verschiedene Schlaglängen" eine Behauptung.
 */
export default function PairLegend() {
  return (
    <section className="glass pad" aria-label="Adernpaare">
      <div className="panel-head">
        <span className="panel-title">Die vier Adernpaare</span>
        <span className="tag am">CAT 6</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {PAIRS.map((p) => (
          <div key={p.name} className="stat" style={{ borderLeftColor: p.color }}>
            <span className="stat-k">{p.name}</span>
            <span className="stat-v" style={{ color: p.color }}>
              {p.pitchMm.toFixed(1).replace('.', ',')} mm pro Windung
            </span>
          </div>
        ))}
      </div>

      <p className="prose" style={{ marginTop: 10 }}>
        Die Schlaglängen unterscheiden sich um bis zu 50 %. Wären sie gleich, lägen die
        Leiterschleifen benachbarter Paare dauerhaft parallel und das starke Sendesignal des
        einen würde sich im schwachen Empfangssignal des anderen aufsummieren
        (<Term id="next">NEXT</Term>).
      </p>
    </section>
  );
}
