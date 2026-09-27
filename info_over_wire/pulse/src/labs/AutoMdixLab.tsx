import { useState } from 'react';
import { runAutoMdix, type MdixAttempt } from '../core/net';
import { sim } from '../core/sim';
import Modal from '../ui/Modal';
import { Term } from '../ui/Glossary';

/**
 * Nur-Anzeige-Feld für eine Pinbelegung.
 * War vorher ein abgerundeter, gerahmter Kasten und damit von einem Knopf
 * nicht zu unterscheiden — genau die Verwechslung, die es zu vermeiden gilt.
 * Jetzt eckig mit linkem Akzentstrich wie jeder andere Messwert.
 */
const Pin = ({ label, role, bad }: { label: string; role: string; bad: boolean }) => (
  <div className={`stat ${bad ? 'b-ru' : 'b-em'}`}>
    <span className="stat-k">{label}</span>
    <span className="stat-v">{role}</span>
  </div>
);

export default function AutoMdixLab({ onClose }: { onClose: () => void }) {
  const [log, setLog] = useState<MdixAttempt[]>(
    sim.mdix.length ? sim.mdix : runAutoMdix(0x2ab, 0x1f5));
  const [step, setStep] = useState(log.length);

  const shown = log.slice(0, step);
  const cur = shown[shown.length - 1];
  const linked = !!cur?.ok;

  const roll = () => {
    const fresh = runAutoMdix((Math.random() * 0x7ff) | 1, (Math.random() * 0x7ff) | 3);
    setLog(fresh);
    setStep(1);
  };

  return (
    <Modal title="Auto-MDIX · das Würfelspiel" width={600} onClose={onClose}>
      <div className="callout">
        <div className="callout-h">Worum es hier geht</div>
        <p className="prose">
          Damit eine Verbindung entsteht, muss der Sender der einen Seite auf dem Adernpaar
          liegen, auf dem die andere empfängt. Früher brauchte man dafür ein Crossover-Kabel.
          Heute entscheidet <Term id="automdix">Auto-MDIX</Term> das selbst — allerdings nicht
          durch Absprache, sondern durch Würfeln.
        </p>
      </div>

      <div className={linked ? 'ok' : ''}
           style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
          <div className="panel-title">Laptop</div>
          <Pin label="Pin 1/2" role={cur?.a ? 'empfängt' : 'sendet'} bad={!linked} />
          <Pin label="Pin 3/6" role={cur?.a ? 'sendet' : 'empfängt'} bad={!linked} />
        </div>

        <div style={{ textAlign: 'center', flex: '0 0 100px' }}>
          <div aria-hidden="true" style={{
            fontSize: '2em', lineHeight: 1,
            color: linked ? 'var(--emerald)' : 'var(--rust)',
            filter: `drop-shadow(0 0 14px ${linked ? 'rgba(52,211,153,.6)' : 'rgba(229,72,77,.5)'})`,
          }}>
            {linked ? '⟷' : '⤫'}
          </div>
          <div className={`tag ${linked ? 'em' : 'ru'}`} style={{ marginTop: 8 }}>
            {linked ? 'Link steht' : 'passt nicht'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
          <div className="panel-title">Raspberry Pi</div>
          <Pin label="Pin 1/2" role={cur?.b ? 'empfängt' : 'sendet'} bad={!linked} />
          <Pin label="Pin 3/6" role={cur?.b ? 'sendet' : 'empfängt'} bad={!linked} />
        </div>
      </div>

      <p className="prose">
        {linked
          ? 'Genau eine Seite hat getauscht. Sender trifft Empfänger — die Verbindung steht.'
          : 'Beide Seiten haben gleich entschieden. Zwei Sender liegen auf demselben Paar, '
            + 'niemand hört zu. Nach etwa 62 ms wird neu gewürfelt.'}
      </p>

      <hr className="hr" />
      <div className="panel-title" style={{ marginBottom: 8 }}>
        Protokoll der Würfe · Quelle ist ein <Term id="lfsr">LFSR</Term>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {shown.map((a) => (
          <div key={a.n} className="mono" style={{
            display: 'flex', gap: 10, fontSize: '.72em', flexWrap: 'wrap',
            color: a.ok ? 'var(--emerald)' : 'var(--muted)',
          }}>
            <span style={{ width: 30 }}>#{a.n}</span>
            <span style={{ width: 110 }}>Laptop: {a.a ? 'tauscht' : 'tauscht nicht'}</span>
            <span style={{ width: 100 }}>Pi: {a.b ? 'tauscht' : 'tauscht nicht'}</span>
            <span>{a.ok ? '→ genau einer · Link' : '→ beide gleich · neuer Versuch'}</span>
          </div>
        ))}
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button onClick={() => setStep(Math.min(log.length, step + 1))} disabled={step >= log.length}>
          Nächster Wurf
        </button>
        <button className="primary" onClick={roll}>↻ Neu würfeln</button>
      </div>

      <details className="check">
        <summary>Warum dauert Link-Up mal 1 und mal 3 Sekunden?</summary>
        <p className="prose">
          Weil beide Seiten unabhängig voneinander würfeln. Die Chance, dass es beim ersten Wurf
          passt, liegt bei 50 %. Jeder Fehlversuch kostet rund 62 ms. Dieser Durchlauf brauchte
          {' '}{log.length} {log.length === 1 ? 'Wurf' : 'Würfe'}.
        </p>
      </details>
    </Modal>
  );
}
