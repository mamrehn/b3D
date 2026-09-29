// ============================================================
// Fachliche Daten & Lerninhalte
// ============================================================

// Aderfarben (realistische, aber gut unterscheidbare Töne)
export const COLORS = {
    white: '#f1f0ea',
    green: '#1f9148',
    orange: '#ee7a16',
    blue: '#2a5fd0',
    brown: '#7a4a26'
};

// Die 8 Adern eines Twisted-Pair-Kabels.
// pinA / pinB = RJ45-Pin nach T568A bzw. T568B
export const CORES = {
    wg:  { id: 'wg',  name: 'Weiß-Grün',   base: COLORS.white,  stripe: COLORS.green,  pair: 3, pinA: 1, pinB: 3 },
    g:   { id: 'g',   name: 'Grün',        base: COLORS.green,  stripe: null,          pair: 3, pinA: 2, pinB: 6 },
    wo:  { id: 'wo',  name: 'Weiß-Orange', base: COLORS.white,  stripe: COLORS.orange, pair: 2, pinA: 3, pinB: 1 },
    bl:  { id: 'bl',  name: 'Blau',        base: COLORS.blue,   stripe: null,          pair: 1, pinA: 4, pinB: 4 },
    wbl: { id: 'wbl', name: 'Weiß-Blau',   base: COLORS.white,  stripe: COLORS.blue,   pair: 1, pinA: 5, pinB: 5 },
    o:   { id: 'o',   name: 'Orange',      base: COLORS.orange, stripe: null,          pair: 2, pinA: 6, pinB: 2 },
    wbr: { id: 'wbr', name: 'Weiß-Braun',  base: COLORS.white,  stripe: COLORS.brown,  pair: 4, pinA: 7, pinB: 7 },
    br:  { id: 'br',  name: 'Braun',       base: COLORS.brown,  stripe: null,          pair: 4, pinA: 8, pinB: 8 }
};

// Reihenfolge nach T568A (Pin 1 … 8)
export const T568A_ORDER = ['wg', 'g', 'wo', 'bl', 'wbl', 'o', 'wbr', 'br'];

export const PAIRS = {
    1: { name: 'Paar 1 – Blau',   cores: ['bl', 'wbl'], color: COLORS.blue },
    2: { name: 'Paar 2 – Orange', cores: ['wo', 'o'],   color: COLORS.orange },
    3: { name: 'Paar 3 – Grün',   cores: ['wg', 'g'],   color: COLORS.green },
    4: { name: 'Paar 4 – Braun',  cores: ['wbr', 'br'], color: COLORS.brown }
};

// LSA-Klemmleiste einer Buchse: 2 Reihen × 4 Klemmen.
// Jede Klemme ist fest mit einem RJ45-Pin verbunden.
export const LSA_TERMINALS = [
    { key: 'top-0', row: 'top', col: 0, pin: 3 },
    { key: 'top-1', row: 'top', col: 1, pin: 6 },
    { key: 'top-2', row: 'top', col: 2, pin: 4 },
    { key: 'top-3', row: 'top', col: 3, pin: 5 },
    { key: 'bottom-0', row: 'bottom', col: 0, pin: 1 },
    { key: 'bottom-1', row: 'bottom', col: 1, pin: 2 },
    { key: 'bottom-2', row: 'bottom', col: 2, pin: 7 },
    { key: 'bottom-3', row: 'bottom', col: 3, pin: 8 }
];

export function coreForPin(pin, standard = 'A') {
    const key = standard === 'A' ? 'pinA' : 'pinB';
    return Object.values(CORES).find(c => c[key] === pin);
}

// CSS-Hintergrund für ein Farbfeld (gestreift = weiß mit Farbringeln)
export function coreSwatchCss(core) {
    if (!core.stripe) return core.base;
    return `repeating-linear-gradient(135deg, ${core.base} 0 5px, ${core.stripe} 5px 9px)`;
}

// ------------------------------------------------------------
// Level-Metadaten & Texte
// ------------------------------------------------------------

export const LEVELS = [
    {
        id: 1,
        key: 'duct',
        title: 'Kabelkanal',
        subtitle: 'Verlegekabel im Brüstungskanal verlegen',
        icon: 'duct',
        place: 'Büro 1 · Arbeitsplatz',
        story: 'Im Büro 1 wird ein neuer Arbeitsplatz ans Netzwerk angeschlossen. Das <strong>Verlegekabel (S/FTP Cat.7)</strong> wurde bereits vom Technikraum durch den Wanddurchbruch gezogen. Verlege es jetzt im <strong>Brüstungskanal</strong> bis zur Position der Netzwerkdose <strong>DD1</strong>.',
        goals: [
            'Daten- und Starkstromleitungen getrennt führen (Trennsteg)',
            'Kabel knickfrei in die Halteklammern einlegen',
            'Servicereserve an der Dose einplanen'
        ],
        howto: [
            '{tap} den <strong>Kabelring</strong> am Wanddurchbruch, um das Kabel aufzunehmen.',
            'Wähle die <strong>richtige Kammer</strong> – in der oberen liegt bereits die 230-V-Leitung!',
            'Drücke das Kabel der Reihe nach in die <strong>Halteklammern 1 → 6</strong>.',
            'Setze zum Schluss das <strong>Kanal-Oberteil</strong> (Deckel) auf.'
        ],
        tip: 'Arbeite vom Wanddurchbruch (links) zur Dose (rechts) – ohne eine Klammer auszulassen.',
        knowledge: [
            ['Trennsteg', 'Daten- und Energieleitungen werden im Brüstungskanal durch einen Trennsteg getrennt geführt (DIN EN 50174-2). So werden elektromagnetische Störungen vermieden.'],
            ['Biegeradius', 'Verlegekabel niemals knicken. Richtwert für den Mindestbiegeradius: 8 × Kabeldurchmesser.'],
            ['Servicereserve', 'An der Dose ca. 20–30 cm Kabel als Reserve lassen – falls die Dose später neu aufgelegt werden muss.'],
            ['Verlege- vs. Patchkabel', 'Verlegekabel haben starre Adern für die feste Installation. Patchkabel haben flexible Litzen für Geräteanschlüsse.']
        ]
    },
    {
        id: 2,
        key: 'socket',
        title: 'Netzwerkdose',
        subtitle: 'LSA-Klemmen nach T568A auflegen',
        icon: 'socket',
        place: 'Werkbank · Doppeldose DD1',
        story: 'Das Kabel liegt im Kanal. Jetzt legst du die <strong>8 Adern</strong> auf die <strong>LSA-Klemmen</strong> der Doppeldose auf – nach <strong>T568A</strong>. Port <strong>DD1-2</strong> hat dein Kollege schon fertig aufgelegt: Nutze ihn als Vorlage.',
        goals: [
            'Den Farbcode T568A sicher anwenden',
            'LSA-Technik: löt-, schraub- und abisolierfrei anschließen',
            'Belegung mit dem Kabeltester (Wiremap) prüfen'
        ],
        howto: [
            'Wähle eine <strong>Ader</strong> – in der Seitenleiste oder direkt am Kabelende.',
            '{tap} die passende <strong>LSA-Klemme von Port DD1-1</strong>. Das Anlegewerkzeug drückt die Ader ein.',
            'Lege alle <strong>8 Adern</strong> auf und {tapLower} <strong>„Belegung prüfen“</strong>.'
        ],
        tip: 'Auf der Dose sind beide Farbcodes aufgedruckt: Die Farbe <strong>direkt an der Klemme = A (T568A)</strong>, die äußere = B (T568B). Die Reihen sind am Rand mit A und B beschriftet.',
        knowledge: [
            ['LSA', 'LSA steht für <em>löt-, schraub- und abisolierfrei</em>. Die Schneidklemme durchtrennt beim Eindrücken die Isolierung und kontaktiert den Leiter.'],
            ['Merkregel', 'Ungerade Pins (1, 3, 5, 7) sind immer die <strong>weiß-gestreiften</strong> Adern, gerade Pins (2, 4, 6, 8) die <strong>einfarbigen</strong>.'],
            ['T568A vs. T568B', 'Die beiden Normen unterscheiden sich nur durch das Vertauschen von Grün- und Orange-Paar. Wichtig: im ganzen Gebäude einheitlich bleiben!'],
            ['Verdrillung', 'Die Adernpaare bis kurz vor die Klemme verdrillt lassen (max. ca. 13 mm aufgedreht) – sonst steigt das Nebensprechen (NEXT).']
        ]
    },
    {
        id: 3,
        key: 'rack',
        title: 'Patchpanel & Switch',
        subtitle: '24 Ports im Netzwerkschrank patchen',
        icon: 'rack',
        place: 'Technikraum · 19"-Netzwerkschrank',
        timeLimit: 180,
        story: 'Im Technikraum kommen alle <strong>24 Verlegekabel</strong> der Büros am Patchpanel an – dein Kabel ist das orangefarbene an <strong>Port 1</strong>. Patche jetzt alle Ports auf die Switches. Du hast <strong>3 Minuten</strong>!',
        goals: [
            'Aufbau eines 19"-Netzwerkschranks kennen',
            'Passive (Patchpanel) und aktive Komponenten (Switch) unterscheiden',
            'Die Link-LED zur ersten Fehlerdiagnose nutzen'
        ],
        howto: [
            'Patchpanel-Ports <strong>1–12 → Switch Büro 1</strong> (blaue Patchkabel).',
            'Patchpanel-Ports <strong>13–24 → Switch Büro 2</strong> (grüne Patchkabel).',
            '{tap} zuerst einen Patchpanel-Port und dann einen freien Port am richtigen Switch.'
        ],
        tip: 'Profis patchen <strong>1 : 1</strong> – PP-Port 5 auf Switch-Port 5, PP-Port 17 auf Switch-Port 17. Dann laufen die Kabel senkrecht und es gibt Ordnungs-Bonuspunkte!',
        knowledge: [
            ['Patchpanel', 'Das Patchpanel ist <strong>passiv</strong>: Es verbindet die festen Verlegekabel (hinten, LSA) mit den flexiblen Patchkabeln (vorne, RJ45).'],
            ['Switch', 'Der Switch ist <strong>aktiv</strong>: Er leitet Ethernet-Frames anhand der MAC-Adressen gezielt an den richtigen Port weiter.'],
            ['Link-LED', 'Leuchtet die Link-LED, besteht eine physikalische Verbindung (Schicht 1). Blinken bedeutet Datenverkehr.'],
            ['19 Zoll', '1 HE (Höheneinheit) = 44,45 mm. Die Frontblende eines 19"-Geräts ist 48,26 cm breit.']
        ]
    },
    {
        id: 4,
        key: 'office',
        title: 'PC-Vernetzung',
        subtitle: 'PCs anschließen & mit ping testen',
        icon: 'network',
        place: 'Büro 1 · Zwei Arbeitsplätze',
        story: 'Letzter Schritt: Schließe die beiden Arbeitsplatz-PCs mit <strong>Patchkabeln</strong> an ihre Netzwerkdosen an und teste die Verbindung in der Eingabeaufforderung mit <strong>ping</strong>.',
        goals: [
            'Anschlusskabel laut Dokumentation stecken',
            'Den Link-Status an PC und Switch erkennen',
            'Die komplette Strecke vom PC bis zum Switch verstehen',
            'ping zur Fehlersuche einsetzen'
        ],
        howto: [
            '{tap} ein <strong>Patchkabel</strong> auf dem Schreibtisch.',
            '{tap} den <strong>LAN-Port</strong> auf der Rückseite des PCs – die Kamera zeigt ihn dir.',
            'Stecke das andere Ende in die richtige Dose: <strong>PC 1 → DD1-1</strong>, <strong>PC 2 → DD2-1</strong>.',
            'Öffne auf PC 1 die <strong>Eingabeaufforderung</strong> und tippe <code>ping 192.168.1.2</code>.',
            'Mit <strong>„Gesamte Strecke zeigen“</strong> blickst du durch die Wand in den Technikraum – dort kommt dein Kabel am Patchpanel an. Mit <strong>„Technikraum ansehen“</strong> – oder indem du die Ansicht ganz herumdrehst – gehst du hinein und siehst dir den Schrank aus der Nähe an.'
        ],
        tip: 'Probiere ruhig schon vorher einen ping – an den Fehlermeldungen erkennst du, was noch fehlt. Beim erfolgreichen ping siehst du die Pakete über die ganze Strecke laufen.',
        knowledge: [
            ['ping', 'ping sendet ICMP-Echo-Requests. Kommen Echo-Replies zurück, ist das Ziel auf Vermittlungsschicht (Schicht 3) erreichbar.'],
            ['Gleiches Netz', 'Beide PCs liegen im Netz 192.168.1.0/24 und hängen am selben Switch – ein Router (Gateway) wird nicht benötigt.'],
            ['100-m-Regel', 'Die gesamte Übertragungsstrecke (Channel) darf max. 100 m lang sein: 90 m Verlegekabel + 10 m Patchkabel.'],
            ['Fehlerbilder', '„Allgemeiner Fehler“ = eigene Netzwerkkarte ohne Verbindung. „Zielhost nicht erreichbar“ = Gegenstelle antwortet nicht.']
        ]
    }
];

// ------------------------------------------------------------
// Hilfen (gestuft). penalty > 0 → Punktabzug beim Aufdecken
// ------------------------------------------------------------

const sw = (id) => `<span class="swatch" data-core="${id}"></span>`;

export const HELP = {
    1: {
        penalty: 0,
        tiers: [
            ['Worum geht es?', '<p>Ein <strong>Brüstungskanal</strong> führt Kabel sauber entlang der Wand. Er hat zwei Kammern, getrennt durch einen <strong>Trennsteg</strong>.</p>'],
            ['Welche Kammer?', '<p>In der <strong>oberen Kammer</strong> liegt bereits die graue 230-V-Leitung (NYM-J). Das Datenkabel gehört in die <strong>untere Kammer</strong>.</p>'],
            ['Reihenfolge', '<p>Beginne am Wanddurchbruch (links) mit <strong>Klammer 1</strong> und arbeite dich ohne Lücke bis <strong>Klammer 6</strong> vor. Danach den Deckel aufsetzen.</p>']
        ]
    },
    2: {
        penalty: 5,
        tiers: [
            ['Stufe 1 · Grundlagen', `<p>Ein Netzwerkkabel besteht aus <strong>8 Adern</strong>, die paarweise verdrillt sind (4 Paare). Aufgelegt wird nach <strong>T568A</strong>.</p>
                <p>Port <strong>DD1-2</strong> (rechts) ist schon fertig – schau dir dort ab, welche Farbe auf welcher Klemme liegt.</p>`],
            ['Stufe 2 · Farbpaare', `<ul class="swatch-list">
                <li>${sw('bl')}${sw('wbl')} Paar 1: Blau / Weiß-Blau</li>
                <li>${sw('wo')}${sw('o')} Paar 2: Weiß-Orange / Orange</li>
                <li>${sw('wg')}${sw('g')} Paar 3: Weiß-Grün / Grün</li>
                <li>${sw('wbr')}${sw('br')} Paar 4: Weiß-Braun / Braun</li></ul>`],
            ['Stufe 3 · Merkregel', `<p><strong>Ungerade Pins (1, 3, 5, 7) = weiß-gestreift, gerade Pins (2, 4, 6, 8) = einfarbig.</strong></p>
                <p class="mnemonic">„<strong>G</strong>rüne <strong>O</strong>mas <strong>b</strong>ringen <strong>b</strong>raune Kuchen“</p>
                <p>So tauchen die Paare bei T568A von Pin 1 an auf: Grün (1–2), Orange (3), Blau (4–5), Orange (6), Braun (7–8).
                Achtung beim blauen Paar: <strong>Blau (Pin 4) kommt vor Weiß-Blau (Pin 5)</strong>!</p>`],
            ['Stufe 4 · Anordnung der Klemmen', `<p><strong>Obere Reihe</strong> (links → rechts):</p>
                <ul class="swatch-list"><li>${sw('wo')} Weiß-Orange · ${sw('o')} Orange · ${sw('bl')} Blau · ${sw('wbl')} Weiß-Blau</li></ul>
                <p><strong>Untere Reihe</strong> (links → rechts):</p>
                <ul class="swatch-list"><li>${sw('wg')} Weiß-Grün · ${sw('g')} Grün · ${sw('wbr')} Weiß-Braun · ${sw('br')} Braun</li></ul>`],
            ['Stufe 5 · Komplette Lösung', `<table class="solution-table">
                <thead><tr><th>Reihe</th><th>Pos.</th><th>Ader</th><th>RJ45-Pin</th></tr></thead>
                <tbody>
                <tr><td>oben</td><td>1</td><td>${sw('wo')} Weiß-Orange</td><td>3</td></tr>
                <tr><td>oben</td><td>2</td><td>${sw('o')} Orange</td><td>6</td></tr>
                <tr><td>oben</td><td>3</td><td>${sw('bl')} Blau</td><td>4</td></tr>
                <tr><td>oben</td><td>4</td><td>${sw('wbl')} Weiß-Blau</td><td>5</td></tr>
                <tr><td>unten</td><td>1</td><td>${sw('wg')} Weiß-Grün</td><td>1</td></tr>
                <tr><td>unten</td><td>2</td><td>${sw('g')} Grün</td><td>2</td></tr>
                <tr><td>unten</td><td>3</td><td>${sw('wbr')} Weiß-Braun</td><td>7</td></tr>
                <tr><td>unten</td><td>4</td><td>${sw('br')} Braun</td><td>8</td></tr>
                </tbody></table>`]
        ]
    },
    3: {
        penalty: 0,
        tiers: [
            ['Zuordnung', '<p><strong>PP-Ports 1–12 → Switch Büro 1</strong> (oberer Switch)<br><strong>PP-Ports 13–24 → Switch Büro 2</strong> (unterer Switch)</p>'],
            ['Bedienung', '<p>Erst einen <strong>Patchpanel-Port</strong> anklicken, dann einen freien Port am <strong>passenden Switch</strong> (oder umgekehrt). Ein erneuter Klick auf den gewählten Port hebt die Auswahl auf.</p>'],
            ['Ordnungs-Bonus', '<p>Patche 1 : 1 – PP-Port <em>n</em> auf Switch-Port <em>n</em> (z. B. PP 14 → Port 14 von Switch Büro 2). Die Switch-Ports liegen genau unter den Patchpanel-Ports – die Kabel laufen dann senkrecht. Sauber dokumentierte Schränke sparen später viel Zeit.</p>']
        ]
    },
    4: {
        penalty: 0,
        tiers: [
            ['Welche Dose?', '<p>Laut Dokumentation: <strong>PC 1 → DD1-1</strong> und <strong>PC 2 → DD2-1</strong>. Die Dosen sitzen im Brüstungskanal an der Wand.</p>'],
            ['Wo ist der LAN-Port?', '<p>Der Netzwerkanschluss (RJ45) sitzt auf der <strong>Rückseite</strong> des PCs im I/O-Bereich. Nach dem Aufnehmen des Kabels fährt die Kamera automatisch dorthin.</p>'],
            ['Der ping-Befehl', '<p>Öffne auf PC 1 die Eingabeaufforderung und tippe <code>ping 192.168.1.2</code>. Mit <code>ipconfig</code> siehst du die eigene IP-Adresse.</p>']
        ]
    }
};

// Punkte → Sterne
export function starsFor(score, success) {
    if (!success) return 0;
    if (score >= 90) return 3;
    if (score >= 70) return 2;
    return 1;
}
