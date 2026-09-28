# NetzWerk-Lab – Strukturierte Verkabelung

Interaktives 3D-Lernspiel für den IT-Unterricht (Fachinformatik, IT-Systemelektronik).
Die Lernenden begleiten ein Netzwerkkabel vom Brüstungskanal bis zum erfolgreichen `ping`.

| Station | Inhalt | Lernschwerpunkt |
|---|---|---|
| 1 · Kabelkanal | Verlegekabel in den Brüstungskanal einlegen, Deckel aufsetzen | Trennsteg (Daten ↔ 230 V), Biegeradius, Servicereserve |
| 2 · Netzwerkdose | 8 Adern auf die LSA-Klemmen auflegen, mit Kabeltester prüfen | Farbcode T568A (Dose zeigt A- *und* B-Code), Wiremap-Fehlerbilder |
| 3 · Patchpanel & Switch | 24 Ports im 19"-Schrank patchen (3-Minuten-Limit) | passiv/aktiv, Link-LED, 1 : 1-Patchen |
| 4 · PC-Vernetzung | PCs per Patchkabel anschließen, `ping` in der Eingabeaufforderung | Dokumentation, `ipconfig`, `ping`, Fehlermeldungen deuten |

## Starten

Das Spiel nutzt ES-Module und muss daher über einen Webserver geöffnet werden
(ein Doppelklick auf `index.html` funktioniert nicht):

```bash
cd ethernet_cabeling
python3 -m http.server 8000
# dann im Browser: http://localhost:8000
```

Benötigt wird ein aktueller Browser mit WebGL 2 (Chrome, Edge, Firefox, Safari) und
Internetzugang zu `cdn.jsdelivr.net` (Three.js r186 und die Schrift Inter werden von dort geladen,
abgesichert per Subresource Integrity).

## Bedienung

- **Klicken/Tippen** wählt Objekte aus, **Ziehen** dreht die Ansicht, **Mausrad/2 Finger** zoomt.
- Tastatur: `H` Hilfe · `Strg+Z` Rückgängig · `Esc` Dialog bzw. Eingabeaufforderung schließen.
- Bestwerte (Punkte, Sterne, Zeit) werden im Browser gespeichert (`localStorage`) und lassen
  sich in der Stationsübersicht zurücksetzen.
- Station 2 hat gestufte Hilfen mit Punktabzug (−5 P je Stufe), die übrigen Hilfen sind kostenlos.
- In Station 4 versteht die Eingabeaufforderung `ping [-n Anzahl] <IP>`, `ipconfig [/all]`,
  `arp -a`, `hostname`, `cls`, `help` und `exit` – inklusive der originalen Windows-Fehlermeldungen
  („Allgemeiner Fehler“, „Zielhost nicht erreichbar“), wenn Kabel fehlen.

## Aufbau des Codes

```
index.html          Seitengerüst, Import-Map (Three.js r186 + SRI)
styles.css          Oberfläche (Design-Tokens, responsive Layout)
js/main.js          Ablaufsteuerung: Levelwechsel, Timer, Fortschritt, Tastatur
js/engine.js        Renderer, Kamera, Picking/Hover/Hinweise, Tweens (an das Level gebunden)
js/ui.js            DOM: Stationsübersicht, Briefing, Hilfe, Ergebnis, Toasts
js/data.js          Farbcodes, LSA-Belegung, alle Texte & Hilfen
js/models.js        3D-Modelle (Kabel, RJ45-Stecker, Kanal, Dosen, PC, Möbel …)
js/materials.js     Prozedurale Texturen & Materialien (keine Bilddateien nötig)
js/labels.js        3D-Beschriftungen
js/levels/level1–4  Die vier Stationen
```

Für Tests steht in der Browser-Konsole `window.__lab` zur Verfügung
(z. B. `__lab.loadLevel(3); __lab.startLevel()`).
