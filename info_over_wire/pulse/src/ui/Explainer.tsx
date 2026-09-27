import { useUI, useTick } from '../core/store';
import { sampleScale } from '../core/scales';
import { lessonFor } from '../core/lessons';
import { TermRow } from './Glossary';

/**
 * Das "Du bist hier"-Panel — der wichtigste Baustein der Anwendung.
 *
 * Vorher stand auf jeder Maßstabsstufe nur eine Zahl. Wer 1000BASE-T nicht
 * schon kennt, konnte daraus nichts ableiten. Der Aufbau folgt bewusst der
 * Reihenfolge, in der man etwas Fremdes begreift:
 *   1. Wo bin ich?          (Stufe + Maßstab)
 *   2. Was sehe ich?        (Aufzählung der Dinge im Bild)
 *   3. Warum ist das so?    (der eine Aha-Satz)
 *   4. Was soll ich tun?    (eine konkrete Handlung, per Knopf ausführbar)
 *   5. Habe ich's?          (Selbstkontrollfrage, Antwort verdeckt)
 */
export default function Explainer() {
  useTick(6);
  const { scale, run } = useUI();
  const s = sampleScale(scale);
  const lesson = lessonFor(s.stop.id);

  return (
    <section className="glass pad" aria-label="Lernhinweise zur aktuellen Stufe">
      <div className="eyebrow">{lesson.eyebrow}</div>
      <h2 className="h-lesson">{lesson.title}</h2>
      <p className="prose lead">{lesson.lead}</p>

      <hr className="hr" />

      {/* Maßstab und Zeitdehnung stehen bereits auf der Schiene rechts —
          hier nicht noch einmal, der Platz gehört dem Lehrtext. */}
      <div className="panel-title" style={{ marginBottom: 7 }}>Was du siehst</div>
      <ul className="bullets">
        {lesson.see.map((line) => <li key={line}>{line}</li>)}
      </ul>

      <div className="callout">
        <div className="callout-h">{lesson.insight.headline}</div>
        <p className="prose" style={{ color: 'var(--text-2)' }}>{lesson.insight.body}</p>
      </div>

      <div className="callout do">
        <div className="callout-h">Probier das aus</div>
        <p className="prose">{lesson.tryThis.text}</p>
        {lesson.tryThis.action && (
          <button
            className="primary"
            style={{ marginTop: 9 }}
            onClick={() => run(lesson.tryThis.action!)}
          >
            {lesson.tryThis.actionLabel ?? 'Ausführen'}
          </button>
        )}
      </div>

      <details className="check">
        <summary>{lesson.check.q}</summary>
        <p className="prose">{lesson.check.a}</p>
      </details>

      <TermRow ids={lesson.terms} />
    </section>
  );
}
