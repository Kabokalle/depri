# iPhone: Kurzbefehle für Apple Health und Erinnerungen

Depri läuft am iPhone als Web-App auf dem Home-Bildschirm. Apple erlaubt Web-Apps keinen direkten Zugriff auf Apple Health und keine selbst geplanten Erinnerungen. Die **Kurzbefehle-App** schlägt die Brücke, ganz ohne Server.

Dieselbe Anleitung steht auch in der App unter **Mehr → Kurzbefehle & Apple Health**.

## So läuft der Health-Abgleich

1. In Depri auf **„Schritte & Schlaf aus Apple Health holen“** tippen.
2. Der Kurzbefehl **„Depri Health“** startet, liest die Werte aus Health und legt einen Text in die Zwischenablage.
3. Zurück zu Depri wechseln (oben links **‹ Depri** oder über den App-Umschalter) und auf **„Health-Werte einfügen“** tippen. Safari fragt kurz nach, dann auf **Einfügen** tippen.

> Warum über die Zwischenablage? Ein Link aus einem Kurzbefehl öffnet sich immer in Safari. Safari hat aber einen anderen Speicher als die Home-Bildschirm-App, die Daten kämen also nie in deiner App an.

## Kurzbefehl „Depri Health“ anlegen

1. Kurzbefehle-App → **+** → Namen genau **Depri Health** nennen.
2. **Schritte heute**
   - Aktion **Health-Samples suchen**: Typ **Schritte**, Filter *Startdatum ist heute*
   - Aktion **Statistik berechnen**: **Summe**
   - Aktion **Variable festlegen**: `Schritte`
3. *(optional)* **Schritte gestern**: dieselben Aktionen mit *Startdatum ist gestern*, Variable `Gestern`
4. *(optional, braucht Apple Watch, Schlaf-App oder Schlafmodus mit Zeitplan)* **Schlaf**
   - **Health-Samples suchen**: Typ **Schlafanalyse**, Filter *Enddatum ist heute* und *Wert ist nicht Wach*, sortiert nach Startdatum, älteste zuerst
   - **Objekt aus Liste abrufen**: erstes Objekt → **Details von Health-Samples abrufen**: Startdatum → **Datum formatieren**: eigenes Format `HH:mm` → Variable `Bett`
   - **Objekt aus Liste abrufen**: letztes Objekt (aus der Schlafanalyse) → Details: Enddatum → **Datum formatieren** `HH:mm` → Variable `Aufstehen`
5. Aktion **Text**:
   ```
   depri?steps=[Schritte]&stepsY=[Gestern]&bed=[Bett]&wake=[Aufstehen]
   ```
   Die eckigen Klammern durch die Variablen ersetzen. Was du nicht eingerichtet hast, lässt du weg.
6. Aktion **In Zwischenablage kopieren**.
7. Einmal ausführen und den Health-Zugriff **erlauben**.
8. In Depri unter **Mehr → Kurzbefehle & Apple Health** „Ich habe den Kurzbefehl eingerichtet“ einschalten.

### Unterstützte Werte

| Parameter | Bedeutung |
|---|---|
| `steps` | Schritte heute |
| `stepsY` | Schritte gestern |
| `bed`, `wake` | Zubettgeh- / Aufstehzeit `HH:mm`; daraus wird die Dauer berechnet |
| `sleepMin`, `sleepH`, `sleepSec` | Schlafdauer direkt (Minuten / Stunden / Sekunden) |
| `date` | Datum `YYYY-MM-DD` (Standard: heute) |

Zahlen dürfen deutsch formatiert sein (`6.432`, `6,9`). Von Hand eingetragene Schritte werden nur überschrieben, wenn Health mehr meldet.

## Erinnerungen

**Variante A – Erinnerungen-App:** neue Erinnerung, z. B. „Etwas trinken 💧“, mit Uhrzeit und *Wiederholen: Täglich*.

**Variante B – Kurzbefehle-Automation:** Kurzbefehle → Automation → **+** → **Tageszeit** → Uhrzeit, *Täglich*, *Sofort ausführen* → Aktion **Mitteilung anzeigen** mit freundlichem Text.

Vorschläge: 10:30 Trinken · 12:30 Mittagessen · 15:30 Trinken · 18:30 Abendessen · 20:00 Check-in · 21:30 Tagesrückblick, dazu deine Medikamenten-Zeiten.
