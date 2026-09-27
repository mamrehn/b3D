import { create } from 'zustand';
import { sim, resetLink, setMode } from './sim';
import type { TrafficMode } from './net';
import { TOUR, type ActionId, type PanelId } from './lessons';

export type Panel = null | PanelId;

/** Modale Ebenen, die sich gegenseitig ausschließen. */
export type Overlay = null | 'welcome' | 'help' | 'glossary';

const SEEN_KEY = 'iow.seen.v1';
const hasSeen = () => {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
};
const markSeen = () => {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* Privatmodus — egal */ }
};

interface UI {
  scale: number;
  panel: Panel;
  overlay: Overlay;
  /** Angeschlagener Lexikoneintrag; null = Übersichtsliste. */
  term: string | null;
  /** Aktiver Tour-Schritt, null = keine Tour. */
  tour: number | null;
  reducedMotion: boolean;
  uiScale: number;
  /** Hochzählen holt die Kamera in die Standardansicht zurück. */
  viewNonce: number;

  setScale: (s: number) => void;
  snapTo: (s: number) => void;
  setPanel: (p: Panel) => void;
  setOverlay: (o: Overlay) => void;
  openTerm: (id: string) => void;
  setTraffic: (m: TrafficMode) => void;
  replug: () => void;
  toggleRun: () => void;
  resetView: () => void;
  setUiScale: (s: number) => void;
  run: (a: ActionId) => void;

  startTour: () => void;
  tourGo: (delta: number) => void;
  endTour: () => void;
}

const clamp01 = (s: number) => Math.min(1, Math.max(0, s));

export const useUI = create<UI>((set, get) => {
  /** Wendet die Effekte eines Tour-Schritts an. */
  const applyTour = (i: number) => {
    const step = TOUR[i];
    if (!step) return;
    if (step.scale !== undefined) set({ scale: step.scale });
    if (step.traffic !== undefined) setMode(step.traffic);
    if (step.panel !== undefined) set({ panel: step.panel });
    set({ tour: i, overlay: null });
  };

  return {
    scale: 0,
    panel: null,
    overlay: hasSeen() ? null : 'welcome',
    term: null,
    tour: null,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    uiScale: 1,
    viewNonce: 0,

    setScale: (s) => set({ scale: clamp01(s) }),
    snapTo: (s) => set({ scale: clamp01(s) }),
    setPanel: (panel) => set({ panel }),
    setOverlay: (overlay) => {
      if (overlay === null) markSeen();
      set({ overlay, term: overlay === 'glossary' ? get().term : null });
    },
    openTerm: (term) => set({ overlay: 'glossary', term }),
    setTraffic: (m) => { setMode(m); set({}); },
    replug: () => { resetLink(); set({}); },
    toggleRun: () => { sim.running = !sim.running; set({}); },
    resetView: () => set({ viewNonce: get().viewNonce + 1 }),
    setUiScale: (s) => set({ uiScale: Math.min(1.5, Math.max(0.8, s)) }),

    /** Ein Lernschritt darf die Anwendung fernsteuern — hier die erlaubten Aktionen. */
    run: (a) => {
      const [kind, arg] = a.split(':');
      if (kind === 'traffic') { setMode(arg as TrafficMode); set({}); }
      else if (kind === 'panel') set({ panel: arg as PanelId });
      else if (kind === 'scale') set({ scale: clamp01(Number(arg)) });
      else if (kind === 'replug') { resetLink(); set({}); }
      else if (kind === 'resetview') set({ viewNonce: get().viewNonce + 1 });
    },

    startTour: () => { markSeen(); applyTour(0); },
    tourGo: (delta) => {
      const cur = get().tour;
      if (cur === null) return;
      const next = cur + delta;
      if (next < 0) return;
      if (next >= TOUR.length) { set({ tour: null }); return; }
      applyTour(next);
    },
    endTour: () => set({ tour: null }),
  };
});

/** 20-Hz-Poll für UI-Readouts — verhindert 60 Re-Renders pro Sekunde. */
import { useEffect, useState } from 'react';
export function useTick(hz = 20) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
}
