/**
 * Fachbegriffs-Lexikon. Jeder Begriff, den die Oberfläche verwendet, muss hier
 * stehen — die Zielgruppe kennt keinen davon.
 *
 * `short` erscheint im Hover-Tooltip, `long` im Lexikon-Panel.
 */
export interface GlossaryEntry {
  id: string;
  term: string;
  short: string;
  long: string;
  see?: string[];
}

const E = (
  id: string, term: string, short: string, long: string, see: string[] = []
): GlossaryEntry => ({ id, term, short, long, see });

export const GLOSSARY: Record<string, GlossaryEntry> = Object.fromEntries([
  E('frame', 'Frame',
    'Ein Datenpaket auf Ethernet-Ebene — Adressen, Nutzdaten und Prüfsumme in einem Stück.',
    'Ein Frame ist die kleinste Einheit, die Ethernet als Ganzes verschickt. Er beginnt mit der ' +
    'Ziel- und Quell-MAC-Adresse, sagt dann über den EtherType, was drin steckt, trägt die ' +
    'Nutzdaten und endet mit einer Prüfsumme (FCS). Ein Mindest-Frame ist 64 Byte groß — das ' +
    'sind bei Gigabit-Tempo 512 ns auf dem Draht.',
    ['mac', 'fcs', 'preamble']),

  E('mac', 'MAC',
    'Zwei Bedeutungen: die 6-Byte-Hardwareadresse und der Chip, der Frames baut.',
    'MAC steht für "Media Access Control". Gemeint ist einerseits die weltweit eindeutige ' +
    '6-Byte-Adresse jeder Netzwerkkarte (z. B. dc:a6:32:1f:4b:90), andererseits die Schaltung, ' +
    'die Frames zusammenbaut, die Prüfsumme anhängt und die Pausen zwischen Frames einhält. ' +
    'Der MAC denkt in Bytes und weiß nichts von Spannungen.',
    ['frame', 'phy', 'layer2']),

  E('phy', 'PHY',
    'Der Chip, der Bytes in Spannungen übersetzt — und zurück.',
    'Der PHY ("Physical Layer Transceiver") ist der Dolmetscher zwischen der digitalen und der ' +
    'analogen Welt. Auf der einen Seite spricht er über den MII-Bus mit dem MAC in Bytes. Auf ' +
    'der anderen Seite erzeugt er die tatsächlichen Spannungspegel auf dem Kupfer, filtert ' +
    'Rauschen heraus, gleicht Laufzeiten aus und rechnet das Echo seines eigenen Senders wieder ' +
    'heraus. Fast die gesamte Intelligenz von Gigabit-Ethernet steckt in diesem Chip.',
    ['mac', 'mii', 'pam5', 'magnetics']),

  E('mii', 'MII / RGMII',
    'Der digitale Parallelbus zwischen MAC und PHY.',
    'Über das Media Independent Interface schiebt der MAC dem PHY die fertigen Frame-Bytes zu — ' +
    'noch als saubere Nullen und Einsen auf mehreren parallelen Leitungen. Alles links vom PHY ' +
    'ist digital, alles rechts davon analog. Genau deshalb heißt der Bus "medienunabhängig": ' +
    'der MAC muss nicht wissen, ob dahinter Kupfer, Glasfaser oder Funk hängt.',
    ['phy', 'mac']),

  E('magnetics', 'Magnetics',
    'Kleine Übertrager, die Kabel und Gerät galvanisch trennen.',
    'In jeder Netzwerkbuchse sitzen Miniatur-Transformatoren. Das Signal wird magnetisch ' +
    'übertragen, es gibt keine durchgehende elektrische Verbindung. Das trennt die ' +
    'Massepotenziale zweier Geräte (die an unterschiedlichen Steckdosen hängen können) und ' +
    'hält Überspannungen bis etwa 1,5 kV vom Chip fern.',
    ['phy']),

  E('mdi', 'MDI / MDI-X',
    'Die zwei möglichen Pinbelegungen: wer sendet auf welchem Adernpaar.',
    'Damit eine Verbindung entsteht, muss der Sender der einen Seite auf dem Adernpaar liegen, ' +
    'auf dem die andere Seite empfängt. MDI und MDI-X sind die beiden zueinander vertauschten ' +
    'Belegungen. Früher brauchte man dafür ein Crossover-Kabel; heute erledigt Auto-MDIX das ' +
    'automatisch.',
    ['automdix', 'autoneg']),

  E('automdix', 'Auto-MDIX',
    'Beide Seiten würfeln, wer die Pins tauscht — bis genau eine es tut.',
    'Auto-MDIX erkennt keine Kollision und verhandelt auch nichts. Jede Seite zieht ein Bit aus ' +
    'einem rückgekoppelten Schieberegister (LFSR) und entscheidet damit, ob sie ihre Pinbelegung ' +
    'tauscht. Nur wenn genau eine der beiden Seiten tauscht, passen Sender und Empfänger ' +
    'zusammen. Klappt es nicht, wird nach rund 62 ms neu gewürfelt. Deshalb dauert Link-Up ' +
    'mal kürzer, mal länger.',
    ['mdi', 'lfsr', 'autoneg']),

  E('lfsr', 'LFSR',
    'Ein Schieberegister, das eine pseudozufällige Bitfolge erzeugt.',
    'Ein "Linear Feedback Shift Register" verknüpft einige seiner eigenen Bits per XOR und ' +
    'schiebt das Ergebnis vorne wieder hinein. Heraus kommt eine Folge, die zufällig aussieht, ' +
    'aber komplett vorhersagbar ist — perfekt für Hardware, die billig würfeln muss. Bei ' +
    'Auto-MDIX ist es 11 Bit breit.',
    ['automdix']),

  E('autoneg', 'Auto-Negotiation',
    'Der Handschlag, in dem sich beide Seiten auf Tempo und Duplex einigen.',
    'Bevor Daten fließen, senden beide Seiten alle 16 ms kurze Impulsfolgen (FLP-Bursts) und ' +
    'teilen sich darin mit, was sie können: 10/100/1000 Mbit/s, Halb- oder Vollduplex. Danach ' +
    'wird die höchste gemeinsame Betriebsart gewählt, der Clock Master bestimmt und der Kanal ' +
    'vermessen. Zusammen dauert das typisch 1–3 Sekunden.',
    ['flp', 'duplex', 'master', 'automdix']),

  E('flp', 'FLP-Burst',
    'Eine Folge von 33 Impulsen, mit der die Fähigkeiten übertragen werden.',
    'Fast Link Pulses sind kurze Nadelimpulse. In einem Burst stecken 17 Takt- und bis zu 16 ' +
    'Datenimpulse; ob zwischen zwei Taktimpulsen ein weiterer liegt, codiert eine 1 oder 0. So ' +
    'überträgt eine Leitung, die noch gar keine Verbindung hat, trotzdem 16 Bit.',
    ['autoneg']),

  E('master', 'Clock Master',
    'Wer von beiden den Takt vorgibt.',
    'Bei 1000BASE-T senden beide Seiten gleichzeitig. Damit die Empfänger die Symbolgrenzen ' +
    'finden, muss genau eine Seite den Takt vorgeben; die andere synchronisiert sich darauf. ' +
    'Wer Master wird, entscheidet die Auto-Negotiation — bei zwei gleichrangigen Geräten per ' +
    'Zufallszahl.',
    ['autoneg', 'duplex']),

  E('duplex', 'Vollduplex',
    'Beide Richtungen gleichzeitig, ohne sich zu stören.',
    'Bei Gigabit-Ethernet sendet jede Seite auf allen vier Adernpaaren und empfängt gleichzeitig ' +
    'auf denselben vier Paaren. Auf der Leitung liegt also die Summe aus eigenem Sendesignal und ' +
    'fremdem Empfangssignal. Der PHY kennt sein eigenes Signal und zieht es rechnerisch wieder ' +
    'ab — das nennt sich Echo Cancellation.',
    ['phy', 'next']),

  E('preamble', 'Präambel',
    '8 Byte Vorlauf, an denen sich der Empfänger einsynchronisiert.',
    'Vor jedem Frame liegen 7 Byte mit abwechselnden Bits und ein Startzeichen (SFD). Der ' +
    'Empfänger nutzt dieses regelmäßige Muster, um seinen Takt exakt auf den Sender einzurasten. ' +
    'Erst danach beginnt der eigentliche Frame. Kostet 64 ns — reine Synchronisation.',
    ['frame', 'ifg']),

  E('ifg', 'Inter-Frame Gap',
    'Die vorgeschriebene Sendepause von 96 ns zwischen zwei Frames.',
    'Nach jedem Frame muss die Leitung 12 Byte-Zeiten lang ruhen. Diese Pause gibt dem Empfänger ' +
    'Zeit, den Frame abzuschließen, und stellt sicher, dass niemand die Leitung dauerhaft ' +
    'blockiert.',
    ['frame', 'preamble']),

  E('fcs', 'FCS / CRC-32',
    'Die 4-Byte-Prüfsumme am Frame-Ende.',
    'Der Sender rechnet über alle Frame-Bytes eine CRC-32-Prüfsumme und hängt sie an. Der ' +
    'Empfänger rechnet dieselbe Summe nach. Stimmt sie nicht, war ein Bit kaputt und der ganze ' +
    'Frame wird kommentarlos verworfen — Ethernet repariert nichts. Für die Wiederholung ist ' +
    'eine höhere Schicht wie TCP zuständig.',
    ['frame', 'ber']),

  E('layer2', 'Schicht 2 (L2)',
    'Die Ebene, auf der in Frames und MAC-Adressen gedacht wird.',
    'Im OSI-Modell ist Schicht 2 die Sicherungsschicht: Sie adressiert Geräte im selben Netz ' +
    'über MAC-Adressen und bündelt Bits zu Frames. Darunter liegt Schicht 1, die reine Physik. ' +
    'Diese Anwendung fährt beim Hineinzoomen genau diese Grenze entlang.',
    ['mac', 'frame']),

  E('pam5', 'PAM-5',
    'Fünf Spannungsstufen statt nur an/aus.',
    'Pulse Amplitude Modulation mit 5 Stufen: −1 V, −0,5 V, 0 V, +0,5 V und +1 V. Vier davon ' +
    'tragen je 2 Bit an Daten, die fünfte ist Reserve für die Fehlerkorrektur. Bei 125 Millionen ' +
    'Symbolen pro Sekunde auf vier Paaren ergibt das exakt 1 Gbit/s: 125 MBaud × 2 Bit × 4 Paare.',
    ['symbol', 'baud', 'trellis']),

  E('symbol', 'Symbol',
    'Der kleinste Signalzustand auf der Leitung — hier 8 ns lang.',
    'Ein Symbol ist ein Spannungspegel, der eine feste Zeit lang anliegt. Nicht dasselbe wie ein ' +
    'Bit: bei PAM-5 trägt ein Symbol 2 Bit. Bei 8 ns Dauer und rund 200.000 km/s ' +
    'Ausbreitungsgeschwindigkeit ist ein Symbol im Kupfer etwa 1,6 m lang.',
    ['pam5', 'baud']),

  E('baud', 'Baud',
    'Symbole pro Sekunde — nicht Bits pro Sekunde.',
    'Die Symbolrate sagt, wie oft sich der Signalpegel ändern darf. 125 MBaud heißt 125 Millionen ' +
    'Pegelwechsel pro Sekunde. Wie viele Bits das sind, hängt davon ab, wie viele Stufen ein ' +
    'Symbol unterscheiden kann. Genau hier verdient PAM-5 sein Geld.',
    ['symbol', 'pam5']),

  E('trellis', 'Trellis-Codierung',
    'Fehlerkorrektur, die das fünfte Spannungslevel als Sicherheitsnetz nutzt.',
    'Nicht jede Symbolfolge ist erlaubt. Der Empfänger sucht sich mit dem Viterbi-Algorithmus ' +
    'die wahrscheinlichste zulässige Folge — auch wenn einzelne Pegel durch Rauschen verrutscht ' +
    'sind. Das kostet Datenrate (das 0-V-Level trägt keine Nutzdaten) und bringt dafür rund 6 dB ' +
    'Störabstand geschenkt.',
    ['pam5', 'snr', 'ber']),

  E('snr', 'SNR',
    'Störabstand: wie viel lauter das Nutzsignal ist als das Rauschen, in Dezibel.',
    'Signal-to-Noise Ratio. Je höher, desto klarer trennt der Empfänger die Spannungsstufen. ' +
    'Die Skala ist logarithmisch: +6 dB bedeutet doppelte Signalamplitude. Unter etwa 20 dB ' +
    'fängt Gigabit-Ethernet an, Frames zu verlieren.',
    ['ber', 'eye', 'emi']),

  E('ber', 'BER',
    'Bitfehlerrate — der Anteil falsch empfangener Bits.',
    'Bit Error Rate. 1e-6 heißt: eines von einer Million Bits kippt. Ethernet verlangt besser ' +
    'als 1e-10. Jedes gekippte Bit zerstört die Prüfsumme und damit den kompletten Frame.',
    ['fcs', 'snr']),

  E('eye', 'Augendiagramm',
    'Viele Signalübergänge übereinandergelegt — die Lücke in der Mitte ist die Reserve.',
    'Man legt hunderte Symbolübergänge deckungsgleich übereinander. Es entstehen augenförmige ' +
    'Öffnungen. Je weiter das Auge offen ist, desto sicherer trifft der Empfänger die ' +
    'Entscheidung. Schließt es sich, gibt es Bitfehler. Das ist das wichtigste Messbild der ' +
    'Übertragungstechnik.',
    ['snr', 'ber', 'symbol']),

  E('emi', 'EMI',
    'Elektromagnetische Störung von außen — Motoren, Netzteile, Funk.',
    'Jedes wechselnde Magnetfeld in der Umgebung induziert in einer Leiterschleife eine ' +
    'Spannung. Ein Bohrmaschinenmotor oder ein Schaltnetzteil neben dem Kabel kann Störungen ' +
    'einkoppeln, die größer sind als das Nutzsignal selbst.',
    ['twist', 'commonmode', 'snr']),

  E('twist', 'Verdrillung',
    'Die Adern eines Paares sind umeinander gewickelt — mit Absicht ungleichmäßig.',
    'Durch die Verdrillung kehrt sich die Orientierung der Leiterschleife bei jeder halben ' +
    'Windung um. Eine von außen eingekoppelte Störung wechselt dadurch ständig das Vorzeichen ' +
    'und mittelt sich weg. Die vier Paare eines Kabels haben unterschiedliche Schlaglängen ' +
    '(z. B. 12,7 / 14,6 / 16,5 / 19,1 mm), damit sie sich nicht gegenseitig stören.',
    ['commonmode', 'next', 'emi']),

  E('commonmode', 'Gleichtaktunterdrückung',
    'Der Empfänger wertet nur die Differenz beider Adern aus — was auf beiden liegt, fällt weg.',
    'Das ist der eigentliche Trick, nicht die Feldauslöschung. Eine Störung koppelt in beide ' +
    'eng beieinander liegenden Adern praktisch gleich stark ein (Gleichtakt). Der Empfänger ' +
    'rechnet A − B, und alles Gemeinsame verschwindet dabei. Die Verdrillung sorgt dafür, dass ' +
    'die Störung wirklich auf beide Adern gleich wirkt.',
    ['twist', 'emi']),

  E('next', 'NEXT',
    'Nahnebensprechen: ein Adernpaar stört seinen Nachbarn im selben Kabel.',
    'Near-End Crosstalk. Das starke Sendesignal eines Paares koppelt in das schwache ' +
    'Empfangssignal des Nachbarpaares. Wären alle vier Paare gleich verdrillt, lägen ihre ' +
    'Schleifen dauerhaft parallel und die Einkopplung würde sich aufsummieren. Die ' +
    'unterschiedlichen Schlaglängen sorgen dafür, dass sich der Effekt herausmittelt.',
    ['twist', 'duplex']),

  E('ledstretch', 'Pulse Stretching',
    'Der PHY verlängert jeden Datenblitz künstlich auf etwa 20 ms.',
    'Ein Frame ist nur Hunderte von Nanosekunden lang — millionenfach zu kurz, als dass ein Auge ' +
    'ihn sehen könnte. Deshalb hält der Chip die Aktivitäts-LED nach jedem Frame rund 20 ms an. ' +
    'Was du siehst, ist also nie ein Paket, sondern eine für dich verlangsamte Anzeige.',
    ['frame', 'dilation']),

  E('dilation', 'Zeitdilatation',
    'Die Zeitlupe dieser Anwendung: eine Sekunde bei dir sind hier Nanosekunden.',
    'Kein physikalischer Effekt, sondern das Bedienkonzept: Raum und Zeit sind fest gekoppelt. ' +
    'Je tiefer du hineinzoomst, desto langsamer läuft die Simulationszeit — sonst wäre auf ' +
    'Symbolebene nichts als ein Flimmern zu sehen. Die Anzeige oben rechts sagt dir immer, ' +
    'wie stark gerade gedehnt wird.',
    ['symbol', 'ledstretch']),

  E('mdns', 'mDNS',
    'Namensauflösung ohne Server — wie Geräte sich im lokalen Netz finden.',
    'Multicast DNS. Geräte fragen per Multicast in die Runde "wer bietet was an?" und antworten ' +
    'einander direkt. Genau dieser Verkehr läuft auch auf einem scheinbar unbenutzten Netz und ' +
    'sorgt für das gelegentliche Blinken.',
    ['frame']),

  E('arp', 'ARP',
    'Übersetzt eine IP-Adresse in die zugehörige MAC-Adresse.',
    'Address Resolution Protocol. Bevor ein Gerät ein IP-Paket abschicken kann, muss es wissen, ' +
    'an welche Hardwareadresse es geht. Also ruft es per Broadcast "wer hat 192.168.1.20?" und ' +
    'wartet auf die Antwort. Ein ARP-Frame ist mit 64 Byte genau ein Mindest-Frame.',
    ['mac', 'frame']),
].map((e) => [e.id, e]));

export const GLOSSARY_LIST = Object.values(GLOSSARY).sort((a, b) =>
  a.term.localeCompare(b.term, 'de'));
