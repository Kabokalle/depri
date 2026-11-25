# Depri – mein Tagebuch

Eine kleine, private App für schwere Tage. Sie hält fest, wie der Tag war, ohne Druck, ohne Streaks und ohne Server.

- **Bewegung**: Schritte (automatisch aus Apple Health / Health Connect oder von Hand), Aktivitäten mit Freude- und Erfolgs-Bewertung
- **Essen**: was, wann, wie viel (kein Kalorienzählen)
- **Getränke**: Art, Menge, Koffein; Wasser und Kaffee mit einem Tipp
- **Check-in**: Stimmung, Energie, optional Angst, Antrieb, Konzentration, Grübeln, Appetit
- **Schlaf**: Zeiten, Dauer, Einschlafdauer, Aufwachen, Qualität, Mittagsschlaf
- **Medikamente**: Einnahme abhaken, Dosis-Historie, Nebenwirkungen
- **Substanzen** und **Tagesrückblick** (Licht, Kontakte, Ereignisse, Gewicht)
- **PHQ-9-Fragebogen** mit Verlauf und Krisenhilfe
- **Arzt**: Termine, Fragen für den nächsten Termin, **Verlaufsbericht als PDF**, CSV-Export
- **Woche**: Diagramme und „Kleine Erfolge“
- Sicherung und Wiederherstellung als JSON-Datei (zwischen iPhone und Android austauschbar)

Alle Daten bleiben auf dem Gerät (IndexedDB).

## iPhone

Web-App auf dem Home-Bildschirm (dauerhaft, kostenlos):

1. `https://kabokalle.github.io/depri/` in **Safari** öffnen
2. **Teilen → Zum Home-Bildschirm**
3. Depri immer über das Icon öffnen. Die Daten der Home-Bildschirm-App sind von Safari getrennt.
4. Optional: [Kurzbefehle für Apple Health und Erinnerungen](docs/kurzbefehle.md)

## Android

Folgt: native App (APK) mit Health Connect und echten Erinnerungen. Der Code dafür (`src/platform/`) ist schon vorbereitet.

## Entwicklung

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # Web-Version für GitHub Pages (dist/)
```

Im Entwicklungsmodus gibt es in der Browser-Konsole `depriSeed()` für Testdaten und `depriClear()` zum Löschen.

Icons neu erzeugen (ImageMagick): `./scripts/make-icons.sh`

## Hilfe in Krisen

TelefonSeelsorge 0800 111 0 111 · 0800 111 0 222 · 116 123 (kostenlos, rund um die Uhr) · Notruf 112
