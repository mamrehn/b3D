import { useUI } from '../core/store';
import { TOUR } from '../core/lessons';

/**
 * Geführte Tour. Ohne sie steht die Lernende vor fünf Maßstabsstufen und
 * vier Laboren, ohne zu wissen, wo sie anfangen soll. Die Tour ist die
 * Standardantwort auf "was mache ich hier eigentlich?".
 */
export default function Tour() {
  const { tour, tourGo, endTour } = useUI();
  if (tour === null) return null;

  const step = TOUR[tour];
  const last = tour === TOUR.length - 1;

  return (
    <section className="glass tour" aria-label={`Tour, Schritt ${tour + 1} von ${TOUR.length}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="tour-dots" aria-hidden="true">
          {TOUR.map((_, i) => (
            <i key={i} className={i === tour ? 'on' : i < tour ? 'done' : ''} />
          ))}
        </div>
        <span className="eyebrow" style={{ marginLeft: 'auto' }}>
          Schritt {tour + 1} / {TOUR.length}
        </span>
      </div>

      <div>
        <h2 style={{ fontSize: '1em', fontWeight: 600, letterSpacing: '-.01em', marginBottom: 5 }}>
          {step.title}
        </h2>
        <p className="prose" style={{ maxWidth: 'none' }}>{step.body}</p>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => tourGo(-1)} disabled={tour === 0}>← Zurück</button>
        <button className="primary" onClick={() => tourGo(1)}>
          {last ? 'Tour beenden' : 'Weiter →'}
        </button>
        <button className="ghost" style={{ marginLeft: 'auto' }} onClick={endTour}>
          Überspringen
        </button>
      </div>
    </section>
  );
}
