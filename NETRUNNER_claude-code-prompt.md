# NETRUNNER — Cyberpunk Python Learning RPG

## Projektübersicht

Baue eine **mobile-first Web-App** namens **NETRUNNER** — ein Cyberpunk-RPG, in dem der Spieler ein Hacker/Netrunner ist, der sich durch eine dystopische Stadt hackt. **Python-Code ist das Gameplay.** Jede Aktion, jedes Rätsel, jeder Kampf wird durch echtes Python gelöst. Der Spieler tippt echten Code in ein Terminal, der Code wird serverseitig ausgeführt und das Ergebnis bestimmt den Fortschritt.

**Zielgruppe:** Absoluter Programmier-Anfänger. Null Vorkenntnisse. Der Spieler weiß nicht was eine Variable ist.  
**Zielgerät:** Smartphone (Mobile-First, Touch-optimiert)  
**Einzelspieler, ein User, passwortgeschützt.**  
**Deployment:** Linux VPS (Ubuntu)

-----

## Tech Stack

- **Backend:** Python 3.12+, FastAPI, SQLite (via aiosqlite), uvicorn
- **Frontend:** React (Vite), TailwindCSS, CodeMirror 6 (Code-Editor mit Syntax-Highlighting)
- **Code-Ausführung:** Sandboxed Python via `subprocess.run()` in isoliertem Prozess mit:
  - Timeout: max 5 Sekunden
  - Memory-Limit
  - Kein Filesystem-Zugriff, kein Network-Zugriff
  - Nur erlaubte builtins (print, input, len, range, int, float, str, list, dict, type, etc.)
- **Auth:** Einfacher Passwort-Login (Passwort als env variable `NETRUNNER_PASSWORD`), JWT-Session
- **Deployment:** systemd service + nginx reverse proxy, HTTPS via Let’s Encrypt

-----

## Projektstruktur

```
/netrunner
├── backend/
│   ├── main.py              # FastAPI app, CORS, routes
│   ├── auth.py              # Login/JWT
│   ├── sandbox.py           # Python code execution sandbox
│   ├── models.py            # SQLite models (player, progress, spaced_rep)
│   ├── database.py          # DB init & connection
│   ├── game_engine.py       # Story-Logik, Quest-State, RPG-Mechaniken
│   ├── spaced_rep.py        # SM-2 Spaced Repetition Algorithmus
│   ├── content/
│   │   └── story.json       # Komplette Story, Kapitel, Missionen, Challenges
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Terminal.jsx       # CodeMirror Editor + Output-Bereich
│   │   │   ├── StoryPanel.jsx     # Narrative Text mit Typewriter-Effekt
│   │   │   ├── CharacterPanel.jsx # Stats, HP, XP, Level
│   │   │   ├── MapView.jsx        # District-Karte
│   │   │   ├── Inventory.jsx      # Gesammelte Scripts/Tools
│   │   │   ├── HUD.jsx            # Top-Bar: HP, XP, Level, Streak
│   │   │   ├── PythonKeybar.jsx   # Sonderzeichen-Leiste über Tastatur
│   │   │   ├── MissionBrief.jsx   # Aufgabe + erwartetes Ergebnis
│   │   │   ├── Dialogue.jsx       # ECHO-Kommunikation (Tutorial/Hints)
│   │   │   └── Login.jsx
│   │   ├── hooks/
│   │   │   └── useGame.js         # Game-State-Management
│   │   └── utils/
│   │       └── api.js             # Backend-API-Calls
│   └── index.html
└── deploy/
    ├── nginx.conf
    └── netrunner.service
```

-----

## UI/UX Design — Cyberpunk-Ästhetik

### Farbpalette und Fonts

- **Hintergrund:** #0a0a0f (fast schwarz)
- **Primär (Neon-Cyan):** #00fff2 — für Highlights, ECHO-Text, erfolgreiche Outputs
- **Akzent (Neon-Magenta):** #ff00aa — für Warnungen, XP-Gains, Level-Ups
- **Fehler (Neon-Rot):** #ff0040 — für Error-Output, HP-Verlust
- **Panels:** #1a1a2e mit 1px Neon-Border + subtle glow (box-shadow)
- **Story-Text:** #c0c0d0 (helles Grau)
- **Fonts:**
  - Code/Terminal: `"Share Tech Mono"` (Google Fonts)
  - Headlines/HUD: `"Orbitron"` (Google Fonts)
  - Story-Text/Dialog: `"Rajdhani"` (Google Fonts)
- **Effekte:** Subtiler Scanline-Overlay (CSS), Glow auf Neon-Elementen (text-shadow/box-shadow), Glitch-Animation bei Errors

### Mobile Layout (Portrait-Modus)

```
┌─────────────────────────────┐
│ [≡]  ♥︎████░░  ★████████░  │  ← HUD: Menu | HP | XP | Lv.7 | 🔥5
├─────────────────────────────┤
│                             │
│  ECHO: "Siehst du das      │  ← Story-Panel (~35% Höhe)
│  Terminal? Tipp ein:        │     Typewriter-Effekt
│  print("Hallo Welt")       │     Scrollbar
│  Das ist dein erstes        │
│  Signal ins Netz..."        │
│                             │
├─────────────────────────────┤
│ ▸ Sende "Hallo Welt" ins   │  ← Mission-Brief (collapsible)
│   Netzwerk                  │
├─────────────────────────────┤
│                             │
│  print("Hallo Welt")       │  ← CodeMirror Editor (~35% Höhe)
│  _                          │     Cyberpunk-Syntax-Theme
│                             │
├─────────────────────────────┤
│ > Hallo Welt                │  ← Output-Bereich
│ ✓ Signal gesendet! +50 XP  │     Grün bei Erfolg, Rot bei Error
├─────────────────────────────┤
│ ( ) [ ] { } : = " . _ # ⏎  │  ← Python-Keybar (fixed, min 44px Buttons)
└─────────────────────────────┘
```

### Interaktionsflow

1. Story-Text erscheint mit Typewriter-Effekt (Skip-Button zum Sofort-Anzeigen)
1. Mission-Brief zeigt die Aufgabe
1. Spieler tippt Code im Terminal
1. “RUN”-Button (oder ⏎ in Keybar) führt aus
1. Output erscheint — bei Erfolg: XP-Animation, Story geht weiter. Bei Fehler: Hint von ECHO, erneut versuchen.

### Python-Keybar

Eine fixierte Leiste direkt über der Systemtastatur mit großen Touch-Buttons (min. 44×44px):
`(  )  [  ]  {  }  :  =  "  .  _  #  ⇥  ⏎`
Diese Zeichen sind auf der Handy-Tastatur schwer zu finden — die Keybar macht Code-Tippen am Phone praktikabel.

### Navigation

- **Hamburger-Menü** oben links öffnet Sidebar mit: Character Sheet, Inventory, Stadtkarte, Streak/Stats, Settings
- Hauptflow braucht keine Navigation — alles passiert im Story→Code→Run-Loop

-----

## Spielmechaniken

### Charakter

- **Handle:** Wählt der Spieler beim Start
- **Level:** 1–30
- **HP (Health Points):** Startet bei 100
  - Falscher Code: -10 HP (erst ab dem 3. Fehlversuch pro Challenge, vorher nur Hints)
  - Richtige Lösung: +20 HP (max 100)
  - 0 HP = “System Crash”: Kurze Recovery-Sequenz (2-3 einfache Wiederholungsaufgaben), danach weiter mit vollem HP
  - **KEIN permanenter Verlust, KEIN Game Over, KEIN Frust**
- **Stats (steigen mit Level):**
  - `LOGIC` → Mehr Hints pro Challenge verfügbar
  - `MEMORY` → Spaced-Repetition-Intervalle wachsen schneller
  - `STEALTH` → Mehr Fehlversuche bevor HP-Abzug
- **Titel je nach Level:**
  1–3: “Script Kiddie” | 4–7: “Byte Punk” | 8–12: “Code Runner” | 13–17: “Net Ghost” | 18–23: “Zero Day” | 24–30: “Daemon Lord”

### XP und Leveling

- Einfache Challenge: 50 XP
- Mittlere Challenge: 100 XP
- Boss-Challenge: 250 XP
- Streak-Bonus: Aufeinanderfolgende Tage × 10 XP extra
- Level-Up: `xp_needed = level * 200`
- Level-Up-Animation: Glitch-Effekt + neuer Titel-Reveal

### Streak-System

- Tägliches Einloggen + min. 1 Challenge = Streak +1
- Streak wird im HUD als Flamme angezeigt
- Streak-Reset bei verpasstem Tag (kein Strafsystem, einfach Reset auf 0)

### Inventar

- Jede abgeschlossene Mission gibt ein “Script” fürs Inventar
- Z.B.: “Signal Sender v1.0” (= dein erstes print-Programm)
- Rein narrativ in v1, motivierend als Sammlung

### Hint-System

- Jede Challenge hat 3 gestufte Hints:
  - **Hint 1:** Allgemeiner Tipp (“Denk an den print-Befehl”)
  - **Hint 2:** Konkreter (“Die Syntax ist: print(‘text’)”)
  - **Hint 3:** Fast die Lösung (“Schreib: print(‘Ich bin noch da’)”)
- Hints kosten nichts, kein Nachteil — Lernen steht im Vordergrund
- ECHO liefert die Hints als Dialog

-----

## Spaced Repetition (SM-2 Algorithmus)

### Datenmodell pro Challenge

```python
{
    "challenge_id": "0.1.1",
    "concept": "print_basic",
    "ease_factor": 2.5,
    "interval": 1,
    "repetitions": 0,
    "next_review": "2025-03-30",
    "last_quality": 0
}
```

### SM-2 Update-Logik

```python
def update_sm2(card, quality):  # quality: 0-5
    if quality >= 3:  # Richtig
        if card.repetitions == 0:
            card.interval = 1
        elif card.repetitions == 1:
            card.interval = 3
        else:
            card.interval = round(card.interval * card.ease_factor)
        card.repetitions += 1
    else:  # Falsch
        card.repetitions = 0
        card.interval = 1
    
    card.ease_factor = max(1.3, card.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
    card.next_review = today + timedelta(days=card.interval)
```

### Gameplay-Integration

- Fällige Reviews erscheinen als **“Intrusion Alerts”**: “WARNUNG: Feindlicher Scan erkannt! Neutralisiere den Angriff!” → Dann kommt die Review-Challenge, verpackt als Abwehr
- **Max. 5 neue Missionen pro Tag.** Der Rest der Session sind Reviews. Das erzwingt Wiederholung.
- Reviews haben leicht variierten Story-Text (nicht 1:1 identisch), aber die gleiche Code-Aufgabe

-----

## Story und Curriculum

### Prämisse

Du wachst auf. Ein flackerndes Terminal. Du weißt nichts — nicht mal deinen Namen. Ein Cursor blinkt, dann erscheint eine Nachricht:

```
> ECHO: Kannst du mich lesen? Gut. Hör zu.
> Du warst mal einer der Besten. Netrunner. Top-Tier.
> Aber jemand hat dich gelöscht. Dein Gedächtnis. Dein Wissen. Alles.
> Ich bin ECHO. Ich kenne dich von früher.
> Ich bringe dir alles zurück. Aber du musst mir vertrauen.
> Fangen wir an. Tippe genau das hier ein:
> print("Ich bin noch da")
```

### ECHO — Der Guide

- ECHO ist eine KI, die den Spieler durch alles führt
- Spricht in kurzen, direkten Sätzen. Cyberpunk-Slang, aber erklärt alles verständlich
- Gibt Kontext zu jedem neuen Konzept IN DER STORY
- ECHO erklärt NIE wie ein Lehrer, sondern wie ein Mentor/Partner der dich re-trainiert
- ECHOs Ton: trocken, direkt, manchmal sarkastisch, aber immer loyal

### Nebencharaktere

- **SHADE** — Mysteriöse Hackerin, taucht ab Kapitel 2 auf. Hilft manchmal, sabotiert manchmal. Loyalität unklar. War die Partnerin des Spielers vor der Löschung.
- **CIPHER** — Feindlicher Netrunner der NEXUS Corporation. Wiederkehrender Antagonist. Boss-Fights gegen ihn.
- **THE ARCHITECT** — Wird nur erwähnt, nie gesehen. Schöpfer von NEXUS Citys System. Freund oder Feind?

### Story-Twists (NICHT dem Spieler verraten, in der Story schrittweise aufbauen)

1. **ECHO ist der Spieler selbst.** Er hat sein Bewusstsein in eine KI kopiert, bevor er sich selbst gelöscht hat. ECHO trainiert sich quasi selbst neu. Enthüllung in Kapitel 7.
1. **Die Löschung war selbstgewählt.** Der Spieler hat sich SELBST gelöscht, weil er etwas in der NEXUS Corporation entdeckt hat, das so gefährlich war, dass Vergessen die einzige Überlebenschance war.
1. Foreshadowing ab Kapitel 1 einbauen — ECHO weiß manchmal Dinge, die eine normale KI nicht wissen sollte. Kleine Versprecher, emotionale Reaktionen.

### Story-Richtlinien

- **Jede Mission hat einen narrativen Grund** warum der Spieler diesen Code schreiben muss
- **Cliffhanger** am Ende jedes Kapitels
- **Foreshadowing** — frühe Hinweise auf die Twists
- **Dialoge** — Charaktere haben Persönlichkeit
- **Die Story belohnt das Lesen** — wer skippt, verpasst Hinweise

-----

### KAPITEL 0: “BOOT SEQUENCE” (Das Erwachen)

**Thema:** Was ist Code? Was ist Python? print(), Zahlen, Variablen.  
**Story:** Du wachst auf. ECHO kontaktiert dich. Du musst dein System hochfahren.  
**Dauer:** ~15-20 Challenges, aufgeteilt in 4-5 Missionen.

**Missionen:**

**0.1 — “Erstes Signal”**

- ECHO erklärt: “Code ist eine Sprache, die Maschinen verstehen. Python ist eine davon. Elegant. Mächtig. Alles was du brauchst.”
- Challenge A (abtippen): `print("Ich bin noch da")` — ECHO zeigt genau was zu tippen ist
- Challenge B (abtippen): `print("ECHO, ich höre dich")` — Variation
- Challenge C (Lücke): `print("___")` — Spieler wählt eigenen Text
- Konzept: print() = “So sendest du eine Nachricht ins Netz.” Alles in Anführungszeichen = Text.

**0.2 — “System Diagnostics”**

- ECHO: “Dein Deck kann rechnen. Teste es.”
- Challenge A: `print(2 + 3)` → 5
- Challenge B: `print(100 - 42)` → 58
- Challenge C: `print(7 * 8)` → 56
- Challenge D: `print(10 / 2)` → 5.0
- Challenge E (selbst): “ECHO gibt dir eine Rechenaufgabe” → Spieler schreibt den print-Befehl selbst
- Konzept: Python kann rechnen. + - * / sind die Grundrechenarten. Kein Anführungszeichen bei Zahlen.

**0.3 — “Deck benennen”**

- ECHO: “Dein Deck braucht einen Namen. Dafür nutzen wir eine Variable. Stell dir eine Schublade vor: du klebst ein Etikett drauf und legst was rein. Das Etikett = der Variablenname. Der Inhalt = der Wert.”
- Challenge A: `deck_name = "Shadow"` dann `print(deck_name)`
- Challenge B: Spieler wählt eigenen Namen für sein Deck
- Challenge C: Zweite Variable: `version = 1` dann `print(version)`
- Challenge D: Beide printen: `print(deck_name)` und `print(version)`
- Konzept: Variable = Name + Wert. `=` bedeutet “speichere”. Kein Anführungszeichen bei Zahlen, mit bei Text.

**0.4 — “Profil aufbauen”**

- ECHO: “Wir bauen dein Profil. Je mehr dein Deck über dich weiß, desto besser.”
- Challenge A: `handle = "..."` (Spieler wählt Namen)
- Challenge B: `level = 1`
- Challenge C: `stadt = "Nexus City"`
- Challenge D: Alles zusammen printen — mehrere print-Zeilen

**0.5 — BOSS: “Boot Complete”**

- Kombination: Variablen erstellen, Rechnung, alles printen. ~5-7 Zeilen Code.
- Story: Das Deck fährt komplett hoch. Ein kleines Erfolgserlebnis. Stadtkarte blinkt auf.

-----

### KAPITEL 1: “LOWER GRID” (Die Unterstadt)

**Thema:** Datentypen, String-Operationen, f-Strings, input(), len(), Slicing  
**Story:** ECHO führt dich in den Lower Grid — das digitale Untergrundnetzwerk. Hier musst du Nachrichten abfangen und eine gefälschte Identität bauen. Erster Kontakt mit SHADE (sie schickt eine anonyme verschlüsselte Nachricht).  
**Dauer:** ~20-25 Challenges

**Missionen:**

**1.1 — “Datentypen scannen”**

- Konzept: int (Ganzzahl), float (Kommazahl), str (Text), bool (Wahr/Falsch)
- ECHO: “Im Netz gibt es verschiedene Datenarten. Wie verschiedene Frequenzen.”
- Challenges: type() nutzen, verschiedene Werte prüfen, Unterschiede erkennen

**1.2 — “Identität fälschen”**

- String-Concatenation: `"Agent" + " " + name`
- f-Strings: `f"Agent {name}, Level {level}"`
- Story: Du musst eine gefälschte ID für den Schwarzmarkt-Zugang bauen

**1.3 — “Abhörstation”**

- `input()` — “Du fängst Übertragungen ab. Aber du musst den Kanal wählen.”
- `kanal = input("Welcher Kanal? ")`
- Story: Abgefangene Transmission enthält ersten Hinweis auf SHADEs Identität

**1.4 — “Verschlüsselungslänge”**

- `len()` und String-Slicing `text[0:5]`
- Story: Verschlüsselte Nachricht analysieren, Fragmentteile extrahieren

**BOSS: “Grid Intercept”**

- Input abfragen, String zusammenbauen, Länge prüfen, Slice extrahieren
- Story-Cliffhanger: Die entschlüsselte Nachricht lautet: “Trau ECHO nicht blind.”

-----

### KAPITEL 2: “NEON BAZAAR” (Der Schwarzmarkt)

**Thema:** if/elif/else, Vergleichsoperatoren, Logische Operatoren (and, or, not)  
**Story:** Der Neon Bazaar ist ein Schwarzmarkt für Daten. SHADE taucht auf. CIPHER wird zum ersten Mal erwähnt.  
**Dauer:** ~20-25 Challenges

**Missionen:**

- 2.1 “Zugangskontrolle” — if, Vergleichsoperatoren
- 2.2 “Identitäts-Check” — if/else
- 2.3 “Handelslogik” — if/elif/else mit mehreren Bedingungen
- 2.4 “Sicherheitsmatrix” — and, or, not — kombinierte Bedingungen

**BOSS: “Bazaar Heist”**

- Programm mit input(), if/elif/else, logischen Operatoren
- Story: Erster direkter Kontakt mit SHADE. Sie sagt: “Ich kannte dich. Vorher.”

-----

### KAPITEL 3: “THE LOOP” (Industriedistrikt)

**Thema:** for-Schleifen, while-Schleifen, range(), break, continue  
**Story:** Im Industriedistrikt laufen Maschinen in Endlosschleifen. CIPHER hackt eine Fabrik. Du musst sie zurückhacken.  
**Dauer:** ~20-25 Challenges

**Missionen:**

- 3.1 “Maschinenrhythmus” — for + range()
- 3.2 “Überwachungsscan” — for über Listen iterieren
- 3.3 “Brute Force” — while-Schleife (Passwort-Cracking-Szenario)
- 3.4 “Mustererkennung” — Loop + if kombiniert, break/continue

**BOSS: “Factory Override”**

- Story: Erster Kampf gegen CIPHER. ECHO reagiert emotional — “Diesen Code… den kannte ich schon.” (Foreshadowing)

-----

### KAPITEL 4: “DATA HAVEN” (Datenbunker)

**Thema:** Listen, Dictionaries, Tupel, List Comprehensions  
**Story:** Der Data Haven speichert die Geheimnisse der Stadt. Du suchst nach deiner eigenen gelöschten Akte.  
**Dauer:** ~25-30 Challenges

**Missionen:**

- 4.1 “Datenbank anlegen” — Listen, append, Index-Zugriff
- 4.2 “Kontakt-Netzwerk” — Dictionaries: Key-Value, Zugriff, Ändern
- 4.3 “Daten filtern” — for + if über Listen, Einführung List Comprehensions
- 4.4 “Inventur” — Sortieren, Durchsuchen, Slicing

**BOSS: “Data Extraction”**

- Verschachtelte Datenstrukturen (Liste von Dicts) durchsuchen
- Story: Du findest ein Fragment deiner gelöschten Akte. Darin steht: “Projekt GENESIS — Zugriff: Nur [DEIN HANDLE]”

-----

### KAPITEL 5: “FUNCTION FORGE” (Die Schmiede)

**Thema:** Funktionen, Parameter, Return, Default-Werte, Scope  
**Story:** In der Function Forge werden Tools geschmiedet. SHADE hilft dir — aber ihr Preis ist, dass du ein Tool für SIE baust.  
**Dauer:** ~20-25 Challenges

**Missionen:**

- 5.1 “Erstes Tool” — def, Funktion aufrufen
- 5.2 “Verschlüsselungsmodul” — Return-Werte
- 5.3 “Multi-Tool” — Mehrere Parameter, Default-Werte
- 5.4 “Systeme verbinden” — Funktionen die andere Funktionen aufrufen, Scope

**BOSS: “Forge Master”**

- 2-3 Funktionen die zusammenarbeiten
- Story: Das Tool das du für SHADE baust — sie nutzt es um etwas zu entschlüsseln. “Da steht… dein Name. Und meiner. Zusammen.”

-----

### KAPITEL 6: “GHOST SECTOR” (Geisterzone)

**Thema:** Error Handling, try/except, Debugging  
**Story:** Der Ghost Sector ist instabil. Voller Bugs. CIPHER hat eine Falle gestellt.  
**Dauer:** ~20 Challenges

**Missionen:**

- 6.1 “Crash Analysis” — Errors lesen und verstehen
- 6.2 “Firewall” — try/except
- 6.3 “Stabilisierung” — try/except/finally, mehrere except
- 6.4 “Bug Hunt” — Fehlerhaften Code fixen

**BOSS: “System Stabilizer”**

- Robustes Programm mit Error Handling
- Story: Du stabilisierst den Sektor und findest eine versteckte Nachricht — von dir selbst. “Wenn du das liest, hat es funktioniert. Vergiss nicht: ECHO ist…”  — die Nachricht bricht ab.

-----

### KAPITEL 7: “TOWER” (Der Konzernturm)

**Thema:** File I/O, Module, OOP Grundlagen  
**Story:** Einbruch in den NEXUS-Turm. DIE GROSSE ENTHÜLLUNG.  
**Dauer:** ~25-30 Challenges

**Missionen:**

- 7.1 “Datenleck” — Dateien lesen/schreiben
- 7.2 “Werkzeugkasten” — import, Module (random, math, datetime)
- 7.3 “Baupläne” — Klassen: Klasse = Bauplan, Objekt = gebautes Ding
- 7.4 “Evolution” — Vererbung

**BOSS: “Tower Breach”**

- Klassen + File I/O + Module kombiniert
- **STORY-TWIST:** Du findest das Projekt GENESIS. Darin: ECHO’s Quellcode. ECHO ist eine Kopie von DIR. Du hast dich selbst kopiert, bevor du dich gelöscht hast. ECHO wusste es die ganze Zeit. Dialog:
  - ECHO: “…Ja. Ich bin du. Oder war es. Ich wollte es dir sagen. Aber du musstest erst bereit sein.”
  - ECHO: “Du hast dich gelöscht, weil du NEXUS’ Geheimnis entdeckt hast. Die Stadt — die Menschen — alles wird kontrolliert. Und der Schlüssel zur Befreiung… ist Code.”

-----

### KAPITEL 8: “CORE” (Das Finale)

**Thema:** Alles zusammen. Abschlussprojekt.  
**Story:** Die Konfrontation mit CIPHER und THE ARCHITECT. Du musst alles Gelernte einsetzen.

- Finaler Boss: Ein vollständiges Mini-Programm (~30-50 Zeilen) das alle Konzepte kombiniert
- Story-Abschluss: Du befreist NEXUS City. ECHO und du — ihr seid eins. Der Kreis schließt sich.
- **Nach dem Finale:** Spaced Repetition läuft weiter. Bonus-Missionen. Side-Quests. Aber die Hauptstory ist erzählt.

-----

## Didaktisches Konzept

### Absolute Anfänger — Regeln

1. **KEIN Fachbegriff ohne Erklärung.** Jeder neue Begriff wird IN DER STORY erklärt, mit einer Cyberpunk-Metapher:
- Variable = “Datenspeicher in deinem Deck — du gibst ihm einen Namen”
- Funktion = “Ein Tool das du schmiedest — einmal bauen, immer wieder nutzen”
- Schleife = “Wie eine Maschine die den gleichen Schritt wiederholt”
- Liste = “Ein Regal mit nummerierten Fächern”
- Dictionary = “Ein Adressbuch — du suchst nach dem Namen, kriegst die Daten”
- if/else = “Eine Weggabelung — je nach Bedingung geht es links oder rechts”
1. **Jedes Konzept wird MINDESTENS 5-8 mal geübt** bevor es als “gelernt” gilt — in verschiedenen Varianten, immer im Story-Kontext. Plus Spaced Repetition danach.
1. **Progression ist LANGSAM.** Lieber zu langsam als zu schnell. Die ersten 3 Kapitel decken nur absolute Basics ab.
1. **Jede Challenge zeigt:**
- Was der Spieler tun soll (Ziel oder exakter Code bei Stufe A)
- Den erwarteten Output
- Bei neuen Konzepten: ein Beispiel BEVOR der Spieler tippt
1. **Fehler werden von ECHO übersetzt:**
- `SyntaxError` → “Da stimmt was mit der Schreibweise nicht. Check Klammern und Anführungszeichen.”
- `NameError` → “Diesen Namen kennt dein System nicht. Tippfehler?”
- `TypeError` → “Du versuchst zwei Dinge zu kombinieren die nicht zusammenpassen.”
1. **Schwierigkeitskurve pro Konzept:**
- **Stufe A:** ECHO zeigt genau was zu tippen ist → abtippen (Muskelgedächtnis)
- **Stufe B:** ECHO zeigt das Muster, Spieler füllt Lücken
- **Stufe C:** ECHO beschreibt nur das Ziel, Spieler schreibt selbst
- Jedes Konzept durchläuft alle 3 Stufen

-----

## Validierung von Lösungen

Jede Challenge definiert eine Validierungs-Methode:

```json
{
    "challenge_id": "0.1.1",
    "type": "exact_output",
    "expected_output": "Ich bin noch da",
    "starter_code": "",
    "solution": "print('Ich bin noch da')",
    "hints": [
        "Nutze den print() Befehl.",
        "Schreibe den Text in Anführungszeichen: print('...')",
        "Die Lösung ist: print('Ich bin noch da')"
    ]
}
```

Validierungs-Typen:

- `exact_output` — Ausgabe muss exakt matchen (Whitespace-tolerant)
- `contains_output` — Ausgabe muss bestimmte Strings enthalten
- `regex_output` — Ausgabe muss Regex matchen (für dynamische Outputs)
- `function_test` — Funktion wird mit Testfällen aufgerufen
- `code_check` — Prüft ob bestimmte Konstrukte im Code vorkommen (z.B. “muss eine for-Schleife enthalten”)

-----

## API-Endpunkte (Backend)

```
POST   /api/login              # Passwort → JWT Token
GET    /api/player              # Spieler-Daten (Stats, Level, XP, HP, Streak)
GET    /api/session             # Tägliche Session: Mix aus neuen Missionen + Reviews
GET    /api/mission/{id}        # Mission-Daten (Story, Challenges)
POST   /api/run                 # Code ausführen → {output, success, error}
POST   /api/submit/{id}         # Challenge-Lösung einreichen → Validierung + XP/HP Update
GET    /api/map                 # Freigeschaltete Distrikte
GET    /api/inventory           # Gesammelte Scripts
POST   /api/hint/{id}           # Nächsten Hint anfordern
GET    /api/stats               # Streak, Gesamt-Stats, Review-Queue-Größe
```

-----

## Deployment

### Backend

```bash
# requirements.txt
fastapi
uvicorn[standard]
aiosqlite
pyjwt
python-dotenv
```

### Frontend Build

```bash
cd frontend && npm run build
# Statische Files werden von nginx served
```

### Nginx Config

```nginx
server {
    listen 443 ssl;
    server_name netrunner.DOMAIN.de;

    ssl_certificate /etc/letsencrypt/live/netrunner.DOMAIN.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/netrunner.DOMAIN.de/privkey.pem;

    location / {
        root /var/www/netrunner/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }
}
```

### Systemd Service

```ini
[Unit]
Description=NETRUNNER Backend
After=network.target

[Service]
User=netrunner
WorkingDirectory=/opt/netrunner/backend
Environment=NETRUNNER_PASSWORD=DEIN_PASSWORT_HIER
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

-----

## Umsetzungsreihenfolge

Baue das Projekt in dieser Reihenfolge:

1. **Backend-Grundgerüst:** FastAPI + Auth + SQLite-Schema + Sandbox
1. **Frontend-Grundgerüst:** React + Vite + Login + Basis-Layout mit Cyberpunk-Theme
1. **Terminal-Komponente:** CodeMirror + Python-Keybar + Code-Execution-Flow
1. **Game Engine:** Session-Logik, XP/HP/Level, Streak
1. **Story-Content:** Kapitel 0 KOMPLETT mit allen Challenges, Story-Texten, Hints, Validierung
1. **Spaced Repetition:** SM-2 Implementierung + Intrusion-Alert-System
1. **UI-Polish:** Animationen, Typewriter, Glitch-Effekte, HUD
1. **Weitere Kapitel:** Content schrittweise erweitern (1, 2, 3…)
1. **Deployment:** nginx + systemd + HTTPS

**WICHTIG:** Kapitel 0 muss KOMPLETT spielbar sein (Story, Challenges, Hints, Validierung, XP, HP, Spaced Repetition) bevor weitere Kapitel gebaut werden. Qualität vor Quantität.

-----

## Kern-Prinzipien

- **Code IST das Gameplay.** Kein Code, kein Fortschritt.
- **Story IST der Lehrer.** Keine trockenen Erklärungen, alles narrativ verpackt.
- **Wiederholung IST das System.** Spaced Repetition ist der Kern, nicht optional.
- **Absolute Anfänger.** Erkläre ALLES. Setze NICHTS voraus.
- **Mobile-First.** Jedes UI-Element muss am Smartphone funktionieren.
- **Kein Frust.** Fehler sind OK, HP kommt zurück, Hints sind kostenlos, kein Game Over.
- **Die Story muss fesseln.** Wenn der Spieler die Story skippt, haben wir versagt.
