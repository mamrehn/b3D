import { useEffect, useState } from 'react';
import Stage from './scene/Stage';
import ScaleRail from './ui/ScaleRail';
import { LinkStatus, Clocks, LedPanel, LayerBar, Controls } from './ui/Hud';
import Explainer from './ui/Explainer';
import Tour from './ui/Tour';
import FrameInspector from './ui/FrameInspector';
import PairLegend from './ui/PairLegend';
import Scope from './ui/Scope';
import { GlossaryModal } from './ui/Glossary';
import { Welcome, Help } from './ui/Overlays';
import AutoMdixLab from './labs/AutoMdixLab';
import TwistLab from './labs/TwistLab';
import Pam5Lab from './labs/Pam5Lab';
import BlinkDetective from './labs/BlinkDetective';
import { useUI } from './core/store';
import { sim, resetLink } from './core/sim';
import './styles.css';

/** Tastenkürzel dürfen nicht losgehen, während jemand einen Regler bedient. */
function inFormField(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    || (el as HTMLElement).isContentEditable;
}

export default function App() {
  const {
    scale, panel, setPanel, overlay, setOverlay, uiScale,
    snapTo, resetView, startTour, tour, tourGo,
  } = useUI();
  const [errFlash, setErrFlash] = useState(false);

  useEffect(() => { resetLink(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const typing = inFormField(document.activeElement);

      if (e.key === 'Escape') {
        if (panel) { setPanel(null); return; }
        if (overlay) { setOverlay(null); return; }
        return;
      }
      if (typing) return;

      // Maßstabsstufen 1–5
      const i = '12345'.indexOf(e.key);
      if (i >= 0) { snapTo(i / 4); return; }

      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); sim.running = !sim.running; break;
        case 'r': resetView(); break;
        case 'g': setOverlay('glossary'); break;
        case 't': startTour(); break;
        case '?': case 'h': setOverlay('help'); break;
        case 'arrowright': if (tour !== null) tourGo(1); break;
        case 'arrowleft': if (tour !== null) tourGo(-1); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, setPanel, overlay, setOverlay, snapTo, resetView, startTour, tour, tourGo]);

  // Audio-Ersatz: FCS-Fehler -> rote Rand-Vignette
  useEffect(() => {
    let last = sim.counters.fcsErrors;
    const id = setInterval(() => {
      if (sim.counters.fcsErrors > last) {
        last = sim.counters.fcsErrors;
        setErrFlash(true);
        setTimeout(() => setErrFlash(false), 240);
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`app ${tour !== null ? 'tour-active' : ''}`}
         style={{ ['--ui-scale' as string]: String(uiScale) }}>
      <div className="canvas-wrap"><Stage /></div>
      <div className={`vignette-err ${errFlash ? 'on' : ''}`} />

      {/*
        Feste Rasterzonen statt absoluter Positionen. Vorher konnten sich die
        Panels je nach Fensterbreite gegenseitig verdecken — die Schichtleiste
        verschwand regelmäßig hinter der Steuerung.
      */}
      <div className="overlay">
        <div className="zone z-tl"><LinkStatus /></div>
        <div className="zone z-ml"><Explainer /></div>
        <div className="zone z-bl"><Controls /></div>

        <div className="zone z-tc"><Tour /></div>
        <div className="zone z-bc"><LayerBar /></div>

        <div className="zone z-tr"><Clocks /></div>
        <div className="zone z-mr">
          {/*
            Pro Raststufe genau ein Kontextpanel. Überlappende Fenster hatten
            auf der Symbolstufe drei Panels übereinander gestapelt — die
            Paarlegende brach mitten in der Liste ab und das Augendiagramm war
            nur noch durch Scrollen erreichbar.
          */}
          {scale > 0.42 && scale < 0.66 && <FrameInspector />}
          {scale > 0.62 && scale < 0.90 && <PairLegend />}
          {scale > 0.78 && <Scope />}
        </div>
        <div className="zone z-br">{scale < 0.46 && <LedPanel />}</div>

        <div className="zone z-rail"><ScaleRail /></div>
      </div>

      {panel === 'mdix' && <AutoMdixLab onClose={() => setPanel(null)} />}
      {panel === 'twist' && <TwistLab onClose={() => setPanel(null)} />}
      {panel === 'pam5' && <Pam5Lab onClose={() => setPanel(null)} />}
      {panel === 'blink' && <BlinkDetective onClose={() => setPanel(null)} />}

      {overlay === 'welcome' && <Welcome />}
      {overlay === 'help' && <Help />}
      {overlay === 'glossary' && <GlossaryModal />}
    </div>
  );
}
