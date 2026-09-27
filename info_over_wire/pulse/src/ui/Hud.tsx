import { useUI, useTick } from '../core/store';
import { sim, activityLed, nextPacketIn, stretchFactor } from '../core/sim';
import { sampleScale, fmtTime } from '../core/scales';
import { TRAFFIC, frameWireTime, LED_STRETCH } from '../core/net';
import type { Panel } from '../core/store';
import { Term } from './Glossary';

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0');
const clock = (t: number) => `${pad(t / 60)}:${pad(t % 60)}.${pad((t % 1) * 1000, 3)}`;
const de = (n: number) => Math.floor(n).toLocaleString('de-DE');

/** Nur-Anzeige-Baustein. Eckig, kein Hover — nie mit einem Knopf zu verwechseln. */
function Stat({ k, v, note, tone = '' }: { k: string; v: string; note?: string; tone?: string }) {
  return (
    <div className={`stat ${tone}`}>
      <span className="stat-k">{k}</span>
      <span className="stat-v">{v}</span>
      {note && <span className="stat-n">{note}</span>}
    </div>
  );
}

/* ------------------------------------------------------------ Verbindung --- */
export function LinkStatus() {
  useTick(10);
  const up = sim.linkState === 'up';
  const neg = sim.linkState === 'negotiating';

  return (
    <section className="glass pad" aria-label="Verbindungsstatus">
      <div className="panel-head" style={{ marginBottom: 8 }}>
        <span className="panel-title">Verbindung</span>
        <span className={`tag ${up ? 'em' : neg ? 'am' : 'ru'}`}>
          ● {up ? '1000BASE-T' : neg ? 'wird ausgehandelt' : 'kein Link'}
        </span>
      </div>

      {up && (
        <>
          <p className="prose" style={{ marginBottom: 9 }}>
            Beide Seiten haben sich auf 1 Gbit/s und <Term id="duplex">Vollduplex</Term> geeinigt.
            Es wird gleichzeitig in beide Richtungen gesendet.
          </p>
          <div className="stat-grid">
            <Stat k="Pinbelegung"
                  v={sim.mdix.length > 1 ? `MDI-X (${sim.mdix.length}. Wurf)` : 'MDI-X'}
                  note="wer auf welchem Paar sendet" />
            <Stat k="Taktgeber" tone="b-vi"
                  v={sim.master === 'rpi' ? 'Raspberry Pi' : 'Laptop'}
                  note="gibt den Symboltakt vor" />
          </div>
        </>
      )}

      {neg && (
        <p className="prose">
          <Term id="autoneg">Auto-Negotiation</Term> läuft: beide Seiten senden alle 16 ms{' '}
          <Term id="flp">FLP-Bursts</Term> und teilen sich mit, was sie können. Das dauert real
          1–3 Sekunden — unabhängig davon, wie tief du gerade hineingezoomt hast.
        </p>
      )}

      {!up && !neg && (
        <p className="prose">Kein Signal auf der Leitung. Kabel neu stecken, um neu auszuhandeln.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Uhren --- */
export function Clocks() {
  useTick(20);
  const s = sampleScale(useUI((st) => st.scale));
  return (
    <section className="glass pad" aria-label="Zeitanzeige">
      <div className="panel-head" style={{ marginBottom: 8 }}>
        <span className="panel-title">Zeit</span>
        <span className="tag vi">Zeitlupe</span>
      </div>
      <div className="stat-grid">
        <Stat k="in der Simulation" v={clock(sim.t)} tone="b-bl" />
        <Stat k="bei dir im Raum" v={clock(sim.realT)} />
      </div>
      <div className="stat b-vi" style={{ marginTop: 9 }}>
        <span className="stat-k"><Term id="dilation">Dehnung</Term></span>
        <span className="stat-v">1 s ≙ {fmtTime(s.dilation)}</span>
        <span className="stat-n">
          Eine Sekunde bei dir entspricht dieser Zeitspanne in der Simulation.
        </span>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- LED-Panel --- */
export function LedPanel() {
  useTick(30);
  const led = activityLed();
  const up = sim.linkState === 'up';

  return (
    <section className="glass pad" aria-label="Aktivitäts-LED">
      <div className="panel-head" style={{ marginBottom: 10 }}>
        <span className="panel-title">Aktivitäts-LED</span>
        <span className="tag am">Pulse Stretching</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div className={led.on ? 'pop' : ''} aria-hidden="true" style={{
          width: 22, height: 22, borderRadius: '50%', flex: 'none',
          background: led.on ? 'var(--amber)' : '#1B2027',
          boxShadow: led.on ? `0 0 ${16 + led.stretch * 22}px var(--amber)` : 'none',
          transition: 'background .04s',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: 4, background: 'var(--stroke)', borderRadius: 2 }}>
            <div style={{
              height: '100%', width: `${led.stretch * 100}%`,
              background: 'var(--amber)', borderRadius: 2,
            }} />
          </div>
          <div className="stat-k" style={{ marginTop: 5 }}>Nachleuchten · 20 ms</div>
        </div>
      </div>

      <div className="stat-grid">
        <Stat k="Paket auf dem Draht" v={fmtTime(frameWireTime(64))}
              note="so lange dauert es wirklich" />
        <Stat k="LED leuchtet" v={fmtTime(LED_STRETCH)} tone="b-am"
              note="so lange wird es angezeigt" />
      </div>

      <div className="stat b-ru" style={{ marginTop: 9 }}>
        <span className="stat-k">Verhältnis</span>
        <span className="stat-v">{de(stretchFactor())} ×</span>
        <span className="stat-n">
          So viel länger leuchtet die LED, als das Ereignis dauert, das sie anzeigt.
        </span>
      </div>

      {sim.saturated ? (
        <p className="prose" style={{ marginTop: 10 }}>
          82.400 Pakete/s: die 20-ms-Blitze überlappen sich rund 1.650-fach. Die LED zeigt
          Dauerlicht — und verrät über die Datenmenge nichts mehr.
        </p>
      ) : up && (
        <div className="stat" style={{ marginTop: 9 }}>
          <span className="stat-k">Nächstes Paket in</span>
          <span className="stat-v">{nextPacketIn().toFixed(1)} s</span>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------- Schichten und Zähler --- */
export function LayerBar() {
  useTick(10);
  const s = sampleScale(useUI((st) => st.scale));
  const c = sim.counters;
  const items: [string, string, string][] = [
    ['L2', 'L2 · MAC', 'Frames und Adressen'],
    ['L1', 'L1 · PHY', 'Bits und Spannungen'],
    ['MEDIUM', 'Medium', 'Kupfer und Physik'],
  ];

  return (
    // flexWrap ist hier nicht Kosmetik: ohne es wird die Leiste breiter als
    // die Mittelspalte und schiebt sich unter die Steuerung links.
    <section className="glass pad" aria-label="Schicht und Zähler"
             style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '8px 18px', padding: '10px 16px', flexWrap: 'wrap' }}>
      <div className="ribbon" role="img"
           aria-label={`Aktuelle Schicht: ${items.find((i) => i[0] === s.layer)?.[1]}`}>
        {items.map(([id, label, title]) => (
          <span key={id} className={s.layer === id ? 'on' : ''} title={title}>{label}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Stat k="Frames" v={de(c.frames)} tone="b-bl" />
        <Stat k="Prüfsummenfehler" v={de(c.fcsErrors)} tone={c.fcsErrors ? 'b-ru' : 'b-em'} />
        <Stat k="Wiederholungen" v={de(c.retransmits)} tone={c.retransmits ? 'b-am' : ''} />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Steuerung --- */
export function Controls() {
  useTick(6);
  const { panel, setPanel, setTraffic, replug, toggleRun, resetView, setOverlay } = useUI();

  const labs: [NonNullable<Panel>, string][] = [
    ['mdix', 'Auto-MDIX'],
    ['twist', 'Twist-Werkstatt'],
    ['pam5', 'PAM-5-Labor'],
    ['blink', 'Blink-Detektiv'],
  ];

  return (
    <section className="glass pad" aria-label="Steuerung"
             style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div>
        <div className="panel-title" style={{ marginBottom: 6 }}>Was läuft über die Leitung?</div>
        <div className="btn-row" role="group" aria-label="Verkehrsart">
          {(Object.keys(TRAFFIC) as (keyof typeof TRAFFIC)[]).map((m) => (
            <button key={m} className="toggle" aria-pressed={sim.mode === m}
                    onClick={() => setTraffic(m)} title={TRAFFIC[m].hint}>
              {TRAFFIC[m].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="panel-title" style={{ marginBottom: 6 }}>Labore zum Ausprobieren</div>
        <div className="btn-row" role="group" aria-label="Labore">
          {labs.map(([id, label]) => (
            <button key={id} className="toggle" aria-pressed={panel === id}
                    onClick={() => setPanel(panel === id ? null : id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button onClick={replug}>↻ Kabel neu stecken</button>
        <button onClick={toggleRun}>{sim.running ? '❚❚ Anhalten' : '▶ Weiter'}</button>
        <button onClick={resetView} title="Kamera in die Ausgangsansicht">↺ Ansicht</button>
        <button className="ghost" onClick={() => setOverlay('help')}>? Hilfe</button>
      </div>

      <div className="viewhint">
        <span><b>Ziehen</b> dreht</span>
        <span><b>Mausrad</b> zoomt</span>
        <span><b>Rechts-Ziehen</b> schiebt</span>
      </div>
    </section>
  );
}
