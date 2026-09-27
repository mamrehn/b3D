import { useState } from 'react';
import { GLOSSARY, GLOSSARY_LIST } from '../core/glossary';
import { useUI } from '../core/store';
import Modal from './Modal';

/**
 * Inline-Fachbegriff. Sieht aus wie ein Link (gepunktet unterstrichen), nicht
 * wie ein Knopf — die Affordanzregel der Oberfläche verlangt das: Knöpfe sind
 * abgerundete Flächen, Verweise sind unterstrichener Text.
 */
export function Term({ id, children }: { id: string; children?: string }) {
  const openTerm = useUI((s) => s.openTerm);
  const entry = GLOSSARY[id];
  if (!entry) return <>{children ?? id}</>;
  return (
    <button
      type="button"
      className="term"
      title={`${entry.term} — ${entry.short}`}
      onClick={() => openTerm(id)}
    >
      {children ?? entry.term}
    </button>
  );
}

/** Begriffsleiste unter einem Lernabschnitt. */
export function TermRow({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className="prose" style={{ marginTop: 10 }}>
      <span style={{ color: 'var(--muted)' }}>Begriffe: </span>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && <span style={{ color: 'var(--stroke)' }}> · </span>}
          <Term id={id} />
        </span>
      ))}
    </div>
  );
}

export function GlossaryModal() {
  const { term, setOverlay, openTerm } = useUI();
  const [q, setQ] = useState('');
  const entry = term ? GLOSSARY[term] : null;

  const needle = q.trim().toLowerCase();
  const hits = needle
    ? GLOSSARY_LIST.filter((e) =>
        e.term.toLowerCase().includes(needle) || e.short.toLowerCase().includes(needle))
    : GLOSSARY_LIST;

  return (
    <Modal title="Lexikon" width={620} onClose={() => setOverlay(null)}>
      {entry ? (
        <>
          <button className="ghost" onClick={() => openTerm('')} style={{ marginBottom: 10 }}>
            ← Alle Begriffe
          </button>
          <h2 style={{ fontSize: '1.25em', letterSpacing: '-.02em', marginBottom: 4 }}>
            {entry.term}
          </h2>
          <p className="lead" style={{ color: 'var(--cyan)', marginBottom: 10 }}>{entry.short}</p>
          <p className="prose">{entry.long}</p>
          {entry.see && entry.see.length > 0 && (
            <p className="prose" style={{ marginTop: 12 }}>
              <span style={{ color: 'var(--muted)' }}>Siehe auch: </span>
              {entry.see.map((s, i) => (
                <span key={s}>
                  {i > 0 && <span style={{ color: 'var(--stroke)' }}> · </span>}
                  <Term id={s} />
                </span>
              ))}
            </p>
          )}
        </>
      ) : (
        <>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Begriff suchen…"
            aria-label="Begriff suchen"
            style={{
              width: '100%', padding: '8px 11px', borderRadius: 9, marginBottom: 12,
              background: 'var(--surface-2)', border: '1px solid var(--stroke)',
              color: 'var(--text)', font: 'inherit', fontSize: '.85em',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {hits.map((e) => (
              <button
                key={e.id}
                className="ghost"
                onClick={() => openTerm(e.id)}
                style={{ textAlign: 'left', display: 'block', width: '100%', padding: '8px 10px' }}
              >
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{e.term}</span>
                <span style={{ color: 'var(--muted)' }}> — {e.short}</span>
              </button>
            ))}
            {!hits.length && <p className="prose">Kein Treffer für „{q}“.</p>}
          </div>
        </>
      )}
    </Modal>
  );
}
