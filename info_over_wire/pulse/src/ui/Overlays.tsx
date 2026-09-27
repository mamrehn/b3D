import { useUI } from '../core/store';
import { TOUR } from '../core/lessons';
import Modal from './Modal';

const Key = ({ children }: { children: string }) => <kbd className="kbd">{children}</kbd>;

/** Erster Kontakt. Beantwortet: Was ist das, was lerne ich, wie bediene ich es. */
export function Welcome() {
  const { setOverlay, startTour } = useUI();
  return (
    <Modal title="Information über Kupfer" width={620} onClose={() => setOverlay(null)}>
      <p className="lead" style={{ maxWidth: '58ch' }}>
        Zwischen einem Laptop und einem Raspberry Pi liegt ein Meter Kabel. Was darin passiert,
        ist zu klein und zu schnell, um es zu sehen. Diese Anwendung macht es sichtbar — in fünf
        Stufen, von der Gerätefront bis zur einzelnen Spannung.
      </p>

      <div className="callout" style={{ marginTop: 14 }}>
        <div className="callout-h">Die eine Regel, die alles zusammenhält</div>
        <p className="prose">
          Maßstab und Zeit sind gekoppelt. Wer auf ein Millionstel Meter heranzoomt, sieht die
          Zeit im selben Verhältnis langsamer laufen. Sonst wäre unten nichts als Flimmern.
        </p>
      </div>

      <div className="panel-title" style={{ margin: '16px 0 8px' }}>Bedienung in 20 Sekunden</div>
      <ul className="bullets">
        <li><b>Maßstabsregler rechts</b> — ziehen oder auf eine Stufe klicken. Auch <Key>1</Key>–<Key>5</Key>.</li>
        <li><b>3D-Ansicht</b> — ziehen dreht, Mausrad zoomt, rechte Maustaste schiebt.</li>
        <li><b>Panel links</b> — erklärt jede Stufe: was zu sehen ist, worauf es ankommt, was zu tun ist.</li>
        <li><b>Unterstrichene Begriffe</b> sind anklickbar und öffnen das Lexikon.</li>
      </ul>

      <Affordance />

      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <button className="primary" onClick={startTour}>
          Geführte Tour starten ({TOUR.length} Schritte)
        </button>
        <button onClick={() => setOverlay(null)}>Selbst erkunden</button>
      </div>
    </Modal>
  );
}

/**
 * Die Legende zur Affordanz. Steht bewusst sowohl im Willkommensdialog als
 * auch in der Hilfe: die Verwechslung von Anzeige und Bedienelement war die
 * häufigste Fehlbedienung.
 */
function Affordance() {
  return (
    <>
      <div className="panel-title" style={{ margin: '16px 0 8px' }}>Anklickbar oder nur Anzeige?</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 210px' }}>
          <button style={{ pointerEvents: 'none' }}>Beispiel-Knopf</button>
          <p className="prose" style={{ marginTop: 7 }}>
            <b style={{ color: 'var(--text)' }}>Abgerundet, gefüllt, gerahmt</b> — das kannst du
            anklicken. Der Zeiger wird zur Hand, der Rahmen leuchtet blau auf.
          </p>
        </div>
        <div style={{ flex: '1 1 210px' }}>
          <div className="stat b-bl">
            <span className="stat-k">Beispiel-Anzeige</span>
            <span className="stat-v">672 ns</span>
          </div>
          <p className="prose" style={{ marginTop: 7 }}>
            <b style={{ color: 'var(--text)' }}>Eckig, nur ein Strich links</b> — das ist ein
            Messwert. Nichts passiert beim Klicken, und der Zeiger bleibt ein Pfeil.
          </p>
        </div>
      </div>
    </>
  );
}

export function Help() {
  const { setOverlay, startTour, uiScale, setUiScale, resetView } = useUI();
  const rows: [string, string][] = [
    ['1 … 5', 'Direkt zu einer Maßstabsstufe springen'],
    ['↑ ↓', 'Maßstab fein verstellen (wenn der Regler den Fokus hat)'],
    ['Leertaste', 'Simulation anhalten / fortsetzen'],
    ['R', 'Kameraansicht zurücksetzen'],
    ['G', 'Lexikon öffnen'],
    ['T', 'Geführte Tour starten'],
    ['?', 'Diese Hilfe'],
    ['Esc', 'Dialog oder Labor schließen'],
  ];

  return (
    <Modal title="Hilfe" width={640} onClose={() => setOverlay(null)}>
      <div className="panel-title" style={{ marginBottom: 8 }}>3D-Ansicht steuern</div>
      <ul className="bullets">
        <li><b>Ziehen mit der linken Maustaste</b> — Ansicht drehen. Beschriftungen drehen sich mit und bleiben lesbar.</li>
        <li><b>Mausrad</b> — näher heran oder weiter weg.</li>
        <li><b>Ziehen mit der rechten Maustaste</b> — Bildausschnitt verschieben.</li>
        <li><b>Maßstab wechseln</b> — holt die Kamera automatisch in die passende Ausgangsansicht zurück.</li>
      </ul>
      <button style={{ marginTop: 10 }} onClick={resetView}>↺ Ansicht zurücksetzen</button>

      <hr className="hr" />
      <div className="panel-title" style={{ marginBottom: 8 }}>Tastatur</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 14px', alignItems: 'center' }}>
        {rows.map(([k, d]) => (
          <div key={k} style={{ display: 'contents' }}>
            <Key>{k}</Key>
            <span className="prose" style={{ margin: 0 }}>{d}</span>
          </div>
        ))}
      </div>

      <Affordance />

      <hr className="hr" />
      <div className="panel-title" style={{ marginBottom: 8 }}>Schriftgröße</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => setUiScale(uiScale - 0.1)} aria-label="Schrift verkleinern">A −</button>
        <span className="mono" style={{ fontSize: '.85em', minWidth: 52, textAlign: 'center' }}>
          {Math.round(uiScale * 100)} %
        </span>
        <button onClick={() => setUiScale(uiScale + 0.1)} aria-label="Schrift vergrößern">A +</button>
        <span className="prose" style={{ margin: 0 }}>Für die hinteren Reihen im Raum.</span>
      </div>

      <hr className="hr" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="primary" onClick={startTour}>Geführte Tour starten</button>
        <button onClick={() => setOverlay('glossary')}>Lexikon öffnen</button>
      </div>
    </Modal>
  );
}
