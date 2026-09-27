/**
 * Didaktische Ebene: Was soll die Lernende auf jeder Maßstabsstufe verstehen?
 *
 * Getrennt vom Simulationskern gehalten, damit sich Inhalt ohne Codeänderung
 * überarbeiten lässt. Reihenfolge der Felder = Reihenfolge im Explainer-Panel:
 * erst was man sieht, dann warum es zählt, dann der Aha-Moment, dann eine
 * konkrete Handlung, zuletzt eine Verständnisfrage.
 */
import type { TrafficMode } from './net';

export type PanelId = 'mdix' | 'twist' | 'pam5' | 'blink';

/** Handlungen, die ein Lernschritt auslösen darf. */
export type ActionId =
  | `traffic:${TrafficMode}`
  | `panel:${PanelId}`
  | `scale:${number}`
  | 'replug'
  | 'resetview';

export interface Lesson {
  stopId: string;
  eyebrow: string;
  title: string;
  /** Ein Satz, der die Ebene für sich allein erklärt. */
  lead: string;
  /** Was ist auf dem Bildschirm zu sehen? */
  see: string[];
  /** Der Kern — die eine Erkenntnis dieser Stufe. */
  insight: { headline: string; body: string };
  /** Konkrete Handlungsaufforderung, optional mit Knopf. */
  tryThis: { text: string; action?: ActionId; actionLabel?: string };
  /** Verständnisfrage mit aufklappbarer Antwort. */
  check: { q: string; a: string };
  terms: string[];
}

export const LESSONS: Lesson[] = [
  {
    stopId: 'chassis',
    eyebrow: 'Stufe 1 von 5 · Menschliche Zeit',
    title: 'Zwei Geräte, ein Kabel',
    lead: 'Das ist Netzwerk, wie du es kennst: Stecker rein, grüne LED an, es funktioniert.',
    see: [
      'Links ein Laptop, rechts ein Raspberry Pi, dazwischen ein Patchkabel.',
      'Am Pi leuchtet grün die LINK-LED — es besteht eine ausgehandelte Verbindung.',
      'Die orange ACT-LED blitzt, sobald Daten fließen.',
    ],
    insight: {
      headline: 'Auf dieser Ebene ist die LED dein einziger Zeuge.',
      body:
        'Du kannst nicht sehen, was im Kabel passiert — du siehst nur eine Leuchtdiode. ' +
        'Und die erzählt dir, wie sich gleich zeigen wird, eine ziemlich verzerrte Geschichte. ' +
        'Alles auf dieser Stufe dauert Sekunden. Alles, was interessant ist, dauert Nanosekunden.',
    },
    tryThis: {
      text:
        'Stell den Verkehr auf »Ad-hoc Idle« und warte. Ein ruhiges Netz ist die meiste Zeit ' +
        'wirklich still — der Zähler unten sagt dir, wann das nächste Paket kommt.',
      action: 'traffic:idle',
      actionLabel: 'Verkehr auf Idle stellen',
    },
    check: {
      q: 'Warum siehst du auf dieser Stufe keine einzelnen Datenpakete?',
      a:
        'Weil ein Paket rund 672 Nanosekunden dauert. Das menschliche Auge löst etwa 20 ' +
        'Millisekunden auf — rund 30.000-mal gröber. Selbst wenn du direkt auf das Kupfer ' +
        'schauen könntest, wäre nichts zu erkennen.',
    },
    terms: ['frame', 'autoneg', 'dilation'],
  },
  {
    stopId: 'led',
    eyebrow: 'Stufe 2 von 5 · 1 Sekunde ≙ 20 Millisekunden',
    title: 'Die LED lügt',
    lead: 'Nah an der Buchse: zwei LEDs, acht vergoldete Kontaktfedern, ein Übertrager.',
    see: [
      'Der Magjack — die Netzwerkbuchse mit eingebauten Übertragern.',
      'Acht Kontaktfedern: vier Adernpaare, jedes sendet und empfängt gleichzeitig.',
      'LINK (grün) zeigt eine bestehende Verbindung, ACT (orange) zeigt Verkehr.',
    ],
    insight: {
      headline: 'Ein LED-Blitz ist rund 30.000-mal länger als das Ereignis, das er anzeigt.',
      body:
        'Ein Mindest-Frame belegt die Leitung 672 ns. Der PHY-Chip streckt jeden dieser Blitze ' +
        'künstlich auf 20 ms, damit ein Auge ihn überhaupt wahrnehmen kann. Du siehst also nie ' +
        'ein Paket — du siehst eine Anzeige, die eigens für dich verlangsamt wurde. Bei voller ' +
        'Last überlappen sich rund 1.650 Pakete in einem einzigen Blitz, und die LED leuchtet ' +
        'einfach durchgehend.',
    },
    tryThis: {
      text:
        'Schalte auf »scp Transfer«. Die LED zeigt Dauerlicht — und verrät dir damit über die ' +
        'tatsächliche Datenmenge exakt gar nichts mehr.',
      action: 'traffic:scp',
      actionLabel: 'Dateitransfer starten',
    },
    check: {
      q: 'Die LED leuchtet durchgehend. Wie viele Pakete pro Sekunde sind das?',
      a:
        'Das lässt sich aus der LED grundsätzlich nicht ablesen. Alles ab etwa 50 Paketen pro ' +
        'Sekunde sieht identisch aus, weil sich die 20-ms-Blitze lückenlos überlappen. Hier ' +
        'sind es 82.400 Pakete/s — es könnten aber auch 500 sein.',
    },
    terms: ['ledstretch', 'phy', 'magnetics', 'duplex'],
  },
  {
    stopId: 'frame',
    eyebrow: 'Stufe 3 von 5 · 1 Sekunde ≙ 672 Nanosekunden',
    title: 'Wo aus Bytes Physik wird',
    lead: 'Die Platine unter der Buchse: drei Bausteine, zwei völlig verschiedene Welten.',
    see: [
      'MAC — baut Frames zusammen, denkt in Bytes und Adressen.',
      'PHY — der Dolmetscher: Bytes hinein, Spannungen hinaus.',
      'Magnetics — trennt Gerät und Kabel galvanisch.',
      'Links vom PHY laufen harte digitale Blöcke, rechts eine weiche analoge Welle.',
    ],
    insight: {
      headline: 'Der PHY ist die Grenze zwischen Information und Physik.',
      body:
        'Links davon existieren nur Nullen und Einsen — sauber, diskret, fehlerfrei kopierbar. ' +
        'Rechts davon gibt es nur noch Spannungen auf Kupfer, mit Rauschen, Dämpfung und Echo. ' +
        'Der Frame-Inspektor zeigt dir dieselben Daten von der digitalen Seite: jedes Byte, ' +
        'nach Feldern eingefärbt, mit der Prüfsumme am Ende.',
    },
    tryThis: {
      text:
        'Sieh dir im Frame-Inspektor die ersten zwölf Bytes an: sechs Byte Zieladresse, sechs ' +
        'Byte Absender. Jeder Frame im Ethernet beginnt so.',
    },
    check: {
      q: 'Der Frame ist 144 m lang, das Kabel nur 1 m. Wie passt das?',
      a:
        'Gar nicht — und das muss es auch nicht. Der Frame liegt nie als Ganzes im Kabel, ' +
        'sondern wird hindurchgeschoben. Während das Ende noch gesendet wird, ist der Anfang ' +
        'längst angekommen und verarbeitet.',
    },
    terms: ['mac', 'phy', 'mii', 'frame', 'fcs', 'preamble'],
  },
  {
    stopId: 'symbol',
    eyebrow: 'Stufe 4 von 5 · 1 Sekunde ≙ 8 Nanosekunden',
    title: 'Warum Kabel verdrillt sind',
    lead: 'Im Inneren des Kabels: vier Adernpaare, jedes mit einer eigenen Schlaglänge.',
    see: [
      'Vier Paare, jeweils zwei umeinander gewickelte Adern.',
      'Jedes Paar hat eine andere Schlaglänge: 12,7 / 14,6 / 16,5 / 19,1 mm.',
      'Auf jedem Paar laufen gleichzeitig Impulse in beide Richtungen.',
    ],
    insight: {
      headline: 'Die Verdrillung löscht keine Störung aus. Sie macht sie nur gleichmäßig.',
      body:
        'Eine Störung von außen koppelt in beide eng benachbarten Adern praktisch gleich stark ' +
        'ein. Der Empfänger wertet aber nur die Differenz A − B aus — und was auf beiden Adern ' +
        'gleich liegt, fällt dabei heraus. Die Verdrillung sorgt dafür, dass die Einkopplung ' +
        'wirklich symmetrisch bleibt. Dass die vier Paare unterschiedlich stark verdrillt sind, ' +
        'ist ebenfalls Absicht: gleiche Schlaglängen würden sich gegenseitig einkoppeln.',
    },
    tryThis: {
      text:
        'Öffne die Twist-Werkstatt und dreh die Schlaglänge von 0 hoch. Beobachte, wie der ' +
        'Differenzanteil zusammenbricht, während der Gleichtakt gleich bleibt.',
      action: 'panel:twist',
      actionLabel: 'Twist-Werkstatt öffnen',
    },
    check: {
      q: 'Warum haben die vier Paare unterschiedliche Schlaglängen?',
      a:
        'Bei gleicher Schlaglänge lägen die Leiterschleifen zweier Nachbarpaare dauerhaft ' +
        'parallel, und das starke Sendesignal des einen würde sich im schwachen Empfangssignal ' +
        'des anderen aufsummieren (NEXT). Unterschiedliche Schlaglängen sorgen dafür, dass sich ' +
        'diese Einkopplung über die Kabellänge herausmittelt.',
    },
    terms: ['twist', 'commonmode', 'next', 'emi', 'duplex'],
  },
  {
    stopId: 'bit',
    eyebrow: 'Stufe 5 von 5 · 1 Sekunde ≙ 1 Nanosekunde',
    title: 'Fünf Spannungen, vier davon zählen',
    lead: 'Ganz unten: das tatsächliche Signal auf einer einzelnen Ader.',
    see: [
      'Die Kupferoberfläche und darüber der reale Spannungsverlauf.',
      'Fünf gestrichelte Hilfslinien: −1 V, −0,5 V, 0 V, +0,5 V, +1 V.',
      'Das Signal ist keine saubere Treppe, sondern bandbegrenzt und verrauscht.',
      'Rechts das Augendiagramm: hunderte Übergänge übereinandergelegt.',
    ],
    insight: {
      headline: 'Das mittlere Level trägt keine Daten. Es ist das Sicherheitsnetz.',
      body:
        'Vier Spannungsstufen würden für 2 Bit pro Symbol reichen. Die fünfte ist Redundanz für ' +
        'die Trellis-Fehlerkorrektur: der Empfänger sucht nicht den nächstliegenden Pegel, ' +
        'sondern die wahrscheinlichste zulässige Folge. Das kostet Datenrate und bringt rund ' +
        '6 dB Störabstand zurück. Die Rechnung geht trotzdem exakt auf: ' +
        '125 MBaud × 2 Bit × 4 Paare = 1 Gbit/s.',
    },
    tryThis: {
      text:
        'Öffne das PAM-5-Labor, dreh das Rauschen hoch und schalte dann das fünfte Level frei. ' +
        'Die Bitfehlerrate fällt um Größenordnungen.',
      action: 'panel:pam5',
      actionLabel: 'PAM-5-Labor öffnen',
    },
    check: {
      q: 'Ein Symbol ist 1,6 m lang im Kupfer — länger als das Patchkabel. Ist das ein Problem?',
      a:
        'Nein. Die Länge eines Symbols sagt nur, wie weit sich die Signalflanke in 8 ns ' +
        'ausbreitet. Sender und Empfänger arbeiten dieselbe Symbolfolge nacheinander ab; es ' +
        'muss nie ein ganzes Symbol gleichzeitig ins Kabel passen.',
    },
    terms: ['pam5', 'symbol', 'baud', 'trellis', 'eye', 'snr'],
  },
];

export const lessonFor = (stopId: string): Lesson =>
  LESSONS.find((l) => l.stopId === stopId) ?? LESSONS[0];

/* ============ Geführte Tour ============ */

export interface TourStep {
  title: string;
  body: string;
  scale?: number;
  traffic?: TrafficMode;
  panel?: PanelId | null;
}

export const TOUR: TourStep[] = [
  {
    title: 'Worum es geht',
    body:
      'Zwischen diesen beiden Geräten fließen Daten. Du wirst gleich in fünf Stufen bis auf die ' +
      'Ebene einzelner Spannungen hineinzoomen. Wichtig dabei: Je tiefer du zoomst, desto ' +
      'langsamer läuft die Zeit — sonst wäre unten nichts als Flimmern zu sehen.',
    scale: 0,
    traffic: 'ssh',
    panel: null,
  },
  {
    title: 'Die Anzeige, der du nicht trauen darfst',
    body:
      'Die orange LED blitzt bei Datenverkehr. Sie wirkt wie ein ehrlicher Bote — ist aber ' +
      'einer der größten Taschenspielertricks der Netzwerktechnik. Zoome eine Stufe tiefer.',
    scale: 0.25,
  },
  {
    title: '30.000-fache Zeitlupe, eingebaut',
    body:
      'Ein Frame dauert 672 ns. Die LED leuchtet 20 ms. Das Verhältnis steht rechts unten als ' +
      'Streckfaktor. Schalte jetzt auf »scp Transfer«: die LED sagt nur noch "irgendwas läuft".',
    traffic: 'scp',
  },
  {
    title: 'Wie die Verbindung überhaupt zustande kam',
    body:
      'Bevor ein Byte fließt, müssen sich beide Seiten einigen — unter anderem darüber, wer auf ' +
      'welchem Adernpaar sendet. Das läuft nicht per Verhandlung, sondern per Würfel.',
    panel: 'mdix',
  },
  {
    title: 'Der Dolmetscher',
    body:
      'Eine Stufe tiefer liegt die Platine. Links der MAC-Chip: er denkt in Bytes. Rechts die ' +
      'Magnetics. Dazwischen der PHY — er ist die Grenze zwischen Information und Physik.',
    scale: 0.5,
    panel: null,
    traffic: 'ssh',
  },
  {
    title: 'Ein Frame, Byte für Byte',
    body:
      'Der Inspektor links zeigt denselben Frame aus digitaler Sicht: Zieladresse, Absender, ' +
      'Typ, Nutzdaten, Prüfsumme. Beachte die Länge im Kupfer — der Frame ist länger als das ' +
      'Kabel und wird einfach hindurchgeschoben.',
  },
  {
    title: 'Warum das Kabel verdrillt ist',
    body:
      'Noch eine Stufe tiefer: vier Adernpaare, jedes anders stark verdrillt. Das ist keine ' +
      'Fertigungslaune, sondern die Lösung für zwei getrennte Probleme gleichzeitig.',
    scale: 0.75,
  },
  {
    title: 'Selbst ausprobieren',
    body:
      'Dreh in der Twist-Werkstatt die Schlaglänge von 0 nach oben. Achte darauf, dass der ' +
      'Gleichtakt konstant bleibt, während der Differenzanteil einbricht — genau darin liegt ' +
      'der Trick.',
    panel: 'twist',
  },
  {
    title: 'Das nackte Signal',
    body:
      'Unterste Stufe: die tatsächliche Spannung auf einer Ader, fünf erlaubte Pegel. Rechts ' +
      'das Augendiagramm — je weiter es offen ist, desto sicherer die Entscheidung des ' +
      'Empfängers.',
    scale: 1,
    panel: null,
  },
  {
    title: 'Das fünfte Level',
    body:
      'Im PAM-5-Labor: Rauschen hochdrehen, Bitfehler beobachten, dann das fünfte Level ' +
      'freischalten. Es trägt keine Nutzdaten — und rettet trotzdem die Übertragung.',
    panel: 'pam5',
  },
  {
    title: 'Geschafft',
    body:
      'Du hast den Weg vom Gehäuse bis zum einzelnen Spannungspegel zurückgelegt. Erkunde jetzt ' +
      'frei: Maßstabsregler rechts, Labore unten links, Fachbegriffe sind unterstrichen und ' +
      'anklickbar. Der Blink-Detektiv testet, ob du LED-Muster deuten kannst.',
    panel: null,
  },
];
