import { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';

/**
 * Das einzige echte Übungsformat der Anwendung: LED-Muster deuten.
 *
 * Wichtig für die Lernwirkung ist nicht das Raten, sondern die Rückmeldung.
 * Deshalb erklärt jede Antwort, woran das Muster zu erkennen gewesen wäre —
 * vorher gab es nur "richtig" oder "falsch".
 */
interface Pattern {
  id: string;
  label: string;
  tell: string;
  render: (t: number) => boolean;
}

const PATTERNS: Pattern[] = [
  {
    id: 'idle',
    label: 'Ruhendes Netz',
    tell: 'Sekundenlang dunkel, dann ein einzelner kurzer Blitz. Das ist die '
        + 'Namensauflösung im Hintergrund — sonst arbeitet niemand.',
    render: (t) => (t % 4) < 0.05,
  },
  {
    id: 'ssh',
    label: 'Fernwartung (SSH)',
    tell: 'Unregelmäßiges Flackern mit Pausen. Jemand tippt, denkt nach, tippt weiter — '
        + 'der Rhythmus ist menschlich, nicht maschinell.',
    render: (t) => (t * 7 % 1) < 0.30 && Math.sin(t * 1.3) > -0.2,
  },
  {
    id: 'scp',
    label: 'Dateitransfer',
    tell: 'Dauerlicht ohne erkennbare Lücke. Die Blitze überlappen sich so dicht, dass '
        + 'die LED gar nicht mehr ausgeht.',
    render: () => true,
  },
  {
    id: 'flap',
    label: 'Wackelkontakt',
    tell: 'Regelmäßige Blöcke aus schnellem Blinken, dann längere Stille. Der Link bricht '
        + 'zusammen und wird jedes Mal neu ausgehandelt.',
    render: (t) => (t % 3) < 1.4 && (t * 11 % 1) < 0.5,
  },
];

export default function BlinkDetective({ onClose }: { onClose: () => void }) {
  const [target, setTarget] = useState(() => PATTERNS[(Math.random() * PATTERNS.length) | 0]);
  const [picked, setPicked] = useState<Pattern | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const led = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      const on = target.render((t - t0) / 1000);
      if (led.current) {
        led.current.style.background = on ? 'var(--amber)' : '#1B2027';
        led.current.style.boxShadow = on ? '0 0 28px var(--amber)' : 'none';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const correct = picked?.id === target.id;

  const guess = (p: Pattern) => {
    if (picked) return;
    setPicked(p);
    setScore((s) => ({ ok: s.ok + (p.id === target.id ? 1 : 0), total: s.total + 1 }));
  };

  const next = () => {
    setPicked(null);
    setTarget(PATTERNS[(Math.random() * PATTERNS.length) | 0]);
  };

  return (
    <Modal title="Blink-Detektiv" width={430} onClose={onClose}>
      <p className="prose">
        Ein Techniker steht vor einem Switch und sieht nur diese eine LED. Was läuft über den
        Link? Genau diese Einschätzung ist die tägliche Anwendung des Gelernten.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '22px 0' }}>
        <div ref={led} role="img" aria-label="Blinkende Aktivitäts-LED"
             style={{ width: 44, height: 44, borderRadius: '50%', background: '#1B2027' }} />
      </div>

      <div className="panel-title" style={{ marginBottom: 8, textAlign: 'center' }}>
        Was läuft auf diesem Link?
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PATTERNS.map((p) => {
          const isAnswer = picked && p.id === target.id;
          const isWrongPick = picked && p.id === picked.id && !correct;
          return (
            <button
              key={p.id}
              onClick={() => guess(p)}
              disabled={!!picked}
              style={{
                justifyContent: 'space-between',
                borderColor: isAnswer ? 'var(--emerald)' : isWrongPick ? 'var(--rust)' : undefined,
                color: isAnswer ? 'var(--emerald)' : isWrongPick ? 'var(--rust)' : undefined,
              }}
            >
              {p.label}
              {isAnswer && <span aria-hidden="true">✓</span>}
              {isWrongPick && <span aria-hidden="true">✕</span>}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className={`callout ${correct ? 'do' : ''} ${correct ? 'ok' : 'err'}`}
             style={{ marginTop: 14 }}>
          <div className="callout-h">
            {correct ? '✓ Richtig erkannt' : `✕ Es war: ${target.label}`}
          </div>
          <p className="prose">{target.tell}</p>
          {!correct && (
            <p className="prose" style={{ marginTop: 7 }}>
              <b style={{ color: 'var(--text)' }}>{picked.label}</b> hätte so ausgesehen:{' '}
              {picked.tell}
            </p>
          )}
        </div>
      )}

      <hr className="hr" />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div className="stat b-em" style={{ flex: 1 }}>
          <span className="stat-k">Treffer</span>
          <span className="stat-v">{score.ok} / {score.total}</span>
        </div>
        <button className="primary" onClick={next} disabled={!picked}>Nächstes Muster →</button>
      </div>
    </Modal>
  );
}
