import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Modale Ebene mit den Selbstverständlichkeiten, die vorher fehlten:
 * Escape schließt, Klick auf den Hintergrund schließt, der Fokus landet beim
 * Öffnen im Dialog und kehrt beim Schließen zurück.
 */
export default function Modal({
  title, onClose, children, width = 560, footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={box}
        className="glass pad modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ width: `min(${width}px, 100%)` }}
      >
        <div className="panel-head">
          <span className="panel-title">{title}</span>
          <button className="icon ghost" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {children}
        {footer && <><hr className="hr" />{footer}</>}
      </div>
    </div>
  );
}
