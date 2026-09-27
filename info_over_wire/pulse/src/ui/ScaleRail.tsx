import { useCallback, useRef } from 'react';
import { useUI, useTick } from '../core/store';
import { STOPS, sampleScale, fmtTime, fmtLength, fmtRatio, HUMAN_EYE_S } from '../core/scales';

/**
 * Der Maßstabsregler — das zentrale Bedienelement.
 *
 * Gegenüber der ersten Fassung geändert:
 *   - Klick auf die Schiene springt sofort dorthin. Vorher musste man ziehen,
 *     ohne dass irgendetwas das verraten hätte.
 *   - Vollständig per Tastatur bedienbar, mit korrekten ARIA-Rollen.
 *   - Die Höhe folgt dem Fenster statt fester 340 px.
 *   - Der Augen-Marker ist beschriftet; vorher war es ein rätselhafter Strich.
 */
export default function ScaleRail() {
  useTick(20);
  const { scale, setScale, snapTo } = useUI();
  const track = useRef<HTMLDivElement>(null);
  const s = sampleScale(scale);

  const valueFromEvent = useCallback((clientY: number) => {
    const r = track.current!.getBoundingClientRect();
    let v = 1 - (clientY - r.top) / r.height;
    for (const st of STOPS) if (Math.abs(v - st.s) < 0.028) v = st.s;  // Magnet-Snap
    return v;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    track.current?.focus();
    setScale(valueFromEvent(e.clientY));
    const move = (ev: PointerEvent) => setScale(valueFromEvent(ev.clientY));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [setScale, valueFromEvent]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const i = STOPS.findIndex((st) => st.s === scale);
    const step = e.shiftKey ? 0.01 : 0.05;
    const map: Record<string, () => void> = {
      ArrowUp:    () => setScale(scale + step),
      ArrowRight: () => setScale(scale + step),
      ArrowDown:  () => setScale(scale - step),
      ArrowLeft:  () => setScale(scale - step),
      PageUp:     () => snapTo(STOPS[Math.min(STOPS.length - 1, (i < 0 ? 0 : i) + 1)].s),
      PageDown:   () => snapTo(STOPS[Math.max(0, (i < 0 ? STOPS.length - 1 : i) - 1)].s),
      Home:       () => snapTo(0),
      End:        () => snapTo(1),
    };
    const fn = map[e.key];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(); }
  }, [scale, setScale, snapTo]);

  return (
    <aside className="glass rail" aria-label="Maßstab">
      <div className="panel-title" style={{ textAlign: 'center' }}>Maßstab</div>

      <div className="rail-body">
        {STOPS.map((st) => (
          <button
            key={st.id}
            className="rail-stop"
            style={{ bottom: `${st.s * 100}%` }}
            aria-current={Math.abs(scale - st.s) < 0.04}
            onClick={() => snapTo(st.s)}
            title={st.hint}
          >
            {st.label}
          </button>
        ))}

        <span className="rail-eye" style={{ bottom: `${HUMAN_EYE_S * 100}%` }} aria-hidden="true">
          Auge
        </span>

        <div
          ref={track}
          className="rail-track"
          role="slider"
          tabIndex={0}
          aria-label="Maßstab und Zeitlupe"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scale * 100)}
          aria-valuetext={
            `${s.stop.label} — Bildbreite ${fmtLength(s.meters)}, ` +
            `eine Sekunde entspricht ${fmtTime(s.dilation)}`
          }
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        >
          <div className="rail-fill" style={{ height: `${scale * 100}%` }} />
          <div className="rail-thumb" style={{ bottom: `${scale * 100}%` }} />
        </div>
      </div>

      <div className="stat b-bl">
        <span className="stat-k">Bildbreite</span>
        <span className="stat-v">{fmtLength(s.meters)}</span>
      </div>
      <div className="stat b-vi">
        <span className="stat-k">1 Sekunde ≙</span>
        <span className="stat-v">{fmtTime(s.dilation)}</span>
        <span className="stat-n">Zeitlupe {fmtRatio(s.dilation)}</span>
      </div>
      <p className="prose" style={{ fontSize: '.7em', lineHeight: 1.45 }}>
        Der orange Strich markiert die Grenze des menschlichen Auges. Alles darüber ist zu
        schnell, um es direkt zu sehen.
      </p>
    </aside>
  );
}
