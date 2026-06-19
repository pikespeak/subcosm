# Subcosm — Requirements

> Ein Reddit-Spiel, in dem eine Community aus ihrer eigenen Aktivität ein Universum wachsen lässt.
> Eintrag für die Reddit „Games with a Hook"-Challenge (Devvit). Stand: Juni 2026.

---

## 1. Überblick & Vision

**Subcosm** ist ein kollektives, persistentes Devvit-Spiel. Jede Community züchtet *einen* gemeinsamen Organismus — gerendert als wachsendes **Universum**. Der erste Post ist der **Urknall** im Zentrum; jeder Tag legt außen eine neue **Schale** an, gebaut aus der realen Aktivität dieses Tages (Posts werden Sterne, große Threads leuchtende Cluster, Beitragende Dichte, Konflikt rote Turbulenz). Die äußerste Schale ist die heutige, noch glühende **Front**, in der den Tag über neue Sterne zünden; nachts erstarrt sie für immer. Weiter draußen = weiter in der Vergangenheit; zoomt man hinein, reist man durch die Geschichte der Community zurück zum Ursprung.

**Der Hook:** „Was ist unser Universum über Nacht geworden?" — plus ein einzigartiges, lesbares Artefakt, das die Kultur der Community über Wochen verkörpert. r/place-Energie, aber biografisch statt räumlich.

**Das Framework:** Verhalten und Optik sind *Config*, nicht Code. Jede Community stimmt über ein **Genom** ihr Universum ab (Gewichte, Volatilität, erlaubte Formen) und wählt einen **Stil-Skin** (z.B. Techno, Comic, Pixel). Dieselbe Engine erzeugt dadurch sichtbar verschiedene Welten.

---

## 2. Kontext & Ziele

- **Plattform:** Devvit Web (Reddit Interactive Posts), läuft im Feed, mobile-first.
- **Deadline:** 15. Juli 2026.
- **Ziel-Preise:** Best App with a Hook ($15k), Best Use of Phaser ($5k), Best Retention ($3k), Best User Contributions ($3k); dazu Honorable Mentions, Devvit Helper, Feedback Award.
- **Erfolgskriterien:**
  - Ein *vollständiger* Bogen ist im Wertungsfenster sichtbar (Urknall → reife Schalen).
  - Läuft flüssig im Reddit-Handy-Viewport.
  - Sieht eigenständig aus (kein KI-Slop, kein generisches Neon-Fraktal).
  - Mindestens ein polierter Stil-Skin; das Framework trägt mehrere.

---

## 3. Kernkonzept & Design-Invarianten

### 3.1 Modell
- **Tiefe = Zeit.** Radius kodiert das Alter (Lichtlaufzeit-Logik: weiter draußen = älter ist hier umgekehrt — siehe Entscheidung D-1). Zentrum = Genesis, äußerster Rand = heute.
- **Eine Schale = ein Wachtag** der Community.
- **Aktivität ist die Textur**, nicht bloß ein Parameter: ein Tag *besteht aus* hunderten Elementen.
- **Front-und-Freeze:** Die heutige Schale ist flüssig und füllt sich live; beim Tages-Tick erstarrt sie unwiderruflich.
- **Reine Funktion:** Ein Ring ist deterministisch aus `DayVector + Seed + Genome` erzeugt — nichts wird als Bild gespeichert.

### 3.2 Invarianten (dürfen nicht verloren gehen)
- **I-1** Der Über-Nacht-Reveal (braucht die Tagesgrenze).
- **I-2** Lesbare Zeitachse (jede Schale getaggt, Tiefe → Datum ablesbar).
- **I-3** Die Fossil-/Organismus-Identität (kein frei wuselndes Activity-Dashboard).
- **I-4** Ein geteilter Organismus pro Community (nicht pro Spieler).
- **I-5** Steuerung biegt Wahrscheinlichkeit, diktiert nie das Ergebnis (echter Zufall bleibt).

---

## 4. Funktionale Anforderungen

### 4.1 Täglicher Zyklus
- **FR-D1** Das System führt pro Community einen Tages-Tick aus, der die Front einfriert, einen neuen Ring-Record schreibt, Zähler zurücksetzt und die nächste Front öffnet.
- **FR-D2** Der Tick liegt an der **lokalen Vor-Morgengrauen-Grenze** der Community (Default ~04:00 Audience-Zeitzone) plus deterministischem **Jitter** `hash(subId) % 60` Minuten.
- **FR-D3** Ein **stündlicher Sweeper** prüft gegen die IANA-Zeitzone, welche Communities ihre Grenze überschreiten, und arbeitet sie der Reihe nach ab (DST-sicher, keine eingefrorenen UTC-Crons).
- **FR-D4** Beim Tick wird ein gepinnter **Reveal-/Update-Post** erstellt.
- **FR-D5** Beitragende eines Tages erhalten Flair / werden für Streak-Zwecke vermerkt.

### 4.2 Spieler-Aktionen & Agency
- **FR-A1** Jeder Spieler hat pro Tag eine begrenzte Zahl Aktionen (Cap).
- **FR-A2** Aktionen sind **Nudges** an die heutige Front: mindestens *Streuung* (Wildheit), *Arme/Symmetrie* (Struktur), *Farbton*.
- **FR-A3** Nudges verschieben den **Mittelwert** der betroffenen Parameter, nicht das konkrete Resultat; das Ergebnis wird drumherum gewürfelt.
- **FR-A4** Die Front zeigt Eingaben **live** (re-synthetisiert sichtbar) und einen Live-Feed der Aktivität.
- **FR-A5** Steuer-Reaktivität ist pro Community konfigurierbar (`steerGain`).

### 4.3 Visualisierung & Navigation
- **FR-V1** Rendert das Universum aus den Ring-Records: Genesis-Kern, konzentrische Schalen, Sterne pro Schale = Aktivität des Tages.
- **FR-V2** Sichtbare Differenzierung: stiller Tag = karg, belebter Tag = dicht; große Threads = helle Cluster mit Bloom; Konflikt = rote Funken/Klumpen.
- **FR-V3** **Tiefen-Navigation** (Scrub/Zoom): durch die Zeit fliegen; Fokus auf eine Schale zoomt sie heran.
- **FR-V4** **Level-of-Detail:** beim Reinzoomen lösen sich Schalen in einzelne Sterne auf. *(Stretch: Stern antippen → realer Post.)*
- **FR-V5** **Lesbarkeit (Pflicht):** Readout zeigt für die fokussierte Schale Tag/Datum/Ära/Thema **und** Aktivitätsstatistik (Sterne, Kommentare, Beitragende, Konflikt-Balken). Tiefe → Datum ablesbar.
- **FR-V6** Nur die heutige Front rendert live animiert; erstarrte Schalen werden gecacht (Bake-on-Freeze).

### 4.4 Genom & Framework
- **FR-G1** Beim Installieren konfiguriert eine Mod das **Genom**: Farbraum, Signal→Parameter-Gewichtsmatrix, Wertebereiche, Volatilität, Vererbungsstärke, `steerGain`, Rare-Event-Tabelle, erlaubte Gene, Stil, Tagesgrenze.
- **FR-G2** **Presets** bündeln sinnvolle Genome für nicht-technische Mods (z.B. „Calm", „Chaotic", „Crystalline"), mit Advanced-Override.
- **FR-G3** Die Gewichtsmatrix ist das Herz der Individualität: dasselbe Signal treibt in verschiedenen Communities verschiedene Parameter.
- **FR-G4** Zufalls-**Streuung ist selbst parametrisiert**: Konflikt erhöht Chaos, stiller Tag erhöht Unberechenbarkeit, hohe Volatilität streut breiter.
- **FR-G5** Eine **Rare-Event-Tabelle** erzeugt seltene Über-Nacht-Mutationen (Palette kippt, Ausbruch, „toter" Ring).
- **FR-G6** Genesis = Install-Tag. *(Stretch: Best-Effort-Backfill aus „Top of all time"-Posts seedet uralte Schalen.)*

### 4.5 Stil-System
- **FR-S1** Ein **StyleTemplate** ist Daten, kein Code: Substrat, Palette, Linie, Füllung, Textur, Gen-Darstellung, PostFX, Motion, Type.
- **FR-S2** Ein Stil **pro Community**, beim Install gesetzt (Teil des Genoms). Normale Spieler stylen *nicht* um.
- **FR-S3** Drei polierte Flaggschiff-Stile zum Launch: **Techno, Comic, Pixel**. Weitere (Metal, Steampunk, Banksy, Coral, Geode, …) sind dieselbe Mechanik.
- **FR-S4** Derselbe Parameter, stil-eigener Ausdruck (z.B. Konflikt → Neon-Glitch / Tusche-Zacken / Pixel-Rauschen).
- **FR-S5** *(Stretch)* Community-Vote auf den nächsten Stil als seltenes Event; *(Stretch)* von Communities beigesteuerte Style-Templates (→ UGC).

### 4.6 Datenpipeline
- **FR-P1** **Sammeln (laufend):** Devvit-Event-Trigger (Post/Kommentar erstellt, Vote) inkrementieren Redis-Tageszähler.
- **FR-P2** Eindeutige Beitragende via Redis-SET; größte Threads via Sorted-Set (Kommentarzahl pro Post).
- **FR-P3** **Verfestigen (Tick):** Tagesbucket lesen → abgeleitete Metriken berechnen → Genom-Transform → Ring-Record (DayVector + Seed) einfrieren.
- **FR-P4** **Konflikt** wird aus Proxys als Komposit abgeleitet (Kommentar-zu-Upvote-Verhältnis, Antwort-Tiefe / Hin-und-Her, kontroverse Sortierung, Lösch-/Melderate, Velocity-Spikes).
- **FR-P5** **Themen-Quelle:** Modus A (kuratierte Tagesabstimmung im Spiel-Sub) ODER Modus B (echter Top-Post/Kommentare der Host-Community), über einen austauschbaren Adapter.

---

## 5. Nicht-funktionale Anforderungen

- **NFR-1 Performance:** flüssig (~60fps Ziel) im Reddit-Handy-Viewport; nur die Front animiert live, Rest gecacht; Schalen-LOD statt unendlicher Mathematik.
- **NFR-2 Determinismus:** jeder Ring ist reproduzierbar aus `DayVector + Seed + GenomeVersion`; identisches Rendering client- und serverseitig.
- **NFR-3 Speichereffizienz:** pro Ring nur ~25 Skalare + Seed; keine gespeicherten Bilder.
- **NFR-4 Lesbarkeit:** Zeit-Tagging und Scrubber in *jedem* Stil vorhanden (verkleidet, nie entfernt).
- **NFR-5 Eigenständigkeit:** kohärentes generatives System; explizit *nicht* nach KI-Slop oder generischem Neon-Fraktal aussehend.
- **NFR-6 Barrierefreiheit:** `prefers-reduced-motion` respektiert (Ambient/Strobe aus, statische Frames); sichtbarer Tastatur-Fokus; responsive bis Mobile.
- **NFR-7 Moderation/Sicherheit (v.a. Modus B):** Filter gegen toxische Themen, die den Organismus verunstalten würden.
- **NFR-8 Cold Start:** Genom-Basiswerte + Varianz lassen auch karge Tage *gewollt* aussehen, nicht kaputt-leer.
- **NFR-9 Skalierung:** Tick-Arbeit pro Community ist klein (einmalige Vektor-Berechnung); Sweeper batcht.

---

## 6. Daten-Verträge & Modell

### 6.1 DayVector — Vertrag *Daten → Synthese*
```ts
interface DayVector {
  day: number;            // 1 = Genesis
  date: string;           // ISO
  // gezählt
  posts: number;
  comments: number;
  contributors: number;   // eindeutige Autoren
  scoreSum: number;       // aggregierte Upvotes
  topThreads: number[];   // größte Thread-Kommentarzahlen → Cluster
  // abgeleitet
  conflict: number;       // 0..1 (Komposit-Proxy)
  momentum: number;       // -1..1 (vs. Vortag)
  diversity: number;      // 0..1 (Themen-/Nudge-Streuung)
  dominantTheme: string;  // Modus A: Vote · Modus B: Top-Post
  // Steuerung (aggregierte Nudges an der Front)
  steering: { branch: number; symmetry: number; hue: number };
  seed: number;           // hash(subId, day, genomeVersion)
}
```

### 6.2 Scene — Vertrag *Synthese → Paint* (stil-agnostisch)
```ts
interface Scene { core: CoreNode; shells: Shell[]; }
interface Shell {
  day: number; radius: number;
  meta: { date: string; era: string; theme: string;
          posts: number; comments: number; contributors: number; conflict: number };
  elements: Element[];
}
interface Element {
  kind: 'star' | 'cluster' | 'filament';
  angle: number; r: number; size: number;
  energy: number; hue: number; conflict: number; big: boolean;
}
```

### 6.3 Genome — Community-Config (das Framework)
```ts
interface Genome {
  version: number;
  style: StyleId;                                   // ein Stil pro Community
  palette: { space: string; ramp: string[] };
  weights: Record<Param, Partial<Record<Signal, number>>>; // Signal→Parameter
  ranges: Record<Param, [number, number]>;
  baseVar: Record<Param, number>;
  volatility: number;
  inheritance: number;                              // Kontinuität zwischen Ringen
  steerGain: Record<Param, number>;
  rareTable: { prob: number; mutation: string }[];
  allowedGenes: Gene[];                             // spike|bloom|aura|facet|…
  dayBoundary: { tz: string; hour: number; jitterMin: number };
}
```

### 6.4 StyleTemplate — Skin als Daten
```ts
interface StyleTemplate {
  id: StyleId;                                      // 'techno' | 'comic' | 'pixel' | …
  substrate: string; palette: PaletteSpec;
  line: LineSpec; fill: FillSpec; texture: TextureSpec;
  genes: Record<Gene, PrimitiveRef>;                // Gen → wie es gemalt wird
  postFX: FXSpec; motion: MotionSpec; type: TypeSpec;
}
```

### 6.5 Redis-Schema
```
agg:{sub}:{day}              HASH   laufende Tageszähler (posts, comments, score…)
agg:{sub}:{day}:authors      SET    eindeutige Beitragende
agg:{sub}:{day}:threads      ZSET   Kommentarzahl pro Post (Top-Cluster)
steer:{sub}:{day}            HASH   aggregierte Nudges (Front, live)
themeVote:{sub}:{day}:{opt}  INT    Modus A
ring:{sub}:{i}               HASH   eingefrorener DayVector + Seed
organism:{sub}               HASH   genesisAt, ringCount, genomeVersion
genome:{sub}                 JSON   die Config
streak:{userId}              INT
```

---

## 7. Architektur

### 7.1 Die reine Engine
```
render(DayVector[], Genome, StyleTemplate) → frames
```
Drei entkoppelte Schichten mit zwei symmetrischen Verträgen (DayVector, Scene):
1. **Synthese** — `DayVector + Seed + Genome → Scene` (deterministisch, stil-agnostisch).
2. **Paint** — `Scene + StyleTemplate → Pixel` (die Skin-Schicht).
3. **Kamera** — unabhängiger View-State (Zoom / Scrub / Fokus) über der Scene.

**Primitive** (wie man Stern/Filament/Tusche-Kante malt) sind eine kleine feste Code-Bibliothek; *welche* Primitive mit welchen Parametern, getrieben von welchem Signal, ist Config (StyleTemplate + Genom).

### 7.2 Drei Einsatzorte, eine Engine
- **Echtes Spiel** (Reddit-Daten) · **Simulator** (erzeugte Daten) · **serverseitig** (statische Vorschau / Ring-Validierung).

### 7.3 Devvit-Komponenten
- **webroot:** die Engine (Render im Post).
- **scheduler:** Tages-Tick + stündlicher Sweeper.
- **redis:** Zustand, Tageszähler, Bestenlisten.
- **realtime:** Live-Front + Aktivitäts-Feed.
- **reddit API + Trigger:** Posts/Kommentare/Flair, Event-Sammlung, Modus-B-Lesen.
- **settings:** Genom-Konfiguration beim Install.
- **payments:** Post-Hackathon (Monetarisierung), nicht im Scope.

---

## 8. Stil-System (Detail)

### 8.1 Parameter-Grammatik (Salienz-gestaffelt)
Damit ~15 Parameter sichtbar werden, ohne Matsch — wichtige Signale auf auffällige Kanäle:

| Ebene | Visueller Kanal | Treibendes Signal |
|---|---|---|
| **Leit** | Schalendichte/-breite · Primär-Farbton · Symmetrie-Ordnung | Aktivität · Thema/Ära · Form-Signatur |
| **Sekundär** | Verzweigung/Rauheit · Twist/Chiralität · Sättigung · Leuchtkraft | **Konflikt vs. Konsens** · Momentum · Intensität · Aktualität |
| **Textur & selten** | Filament-Dichte · Porosität · Paletten-Spreizung · Akzent-Farbton · Gene | Beitragende · stille Tage · Nudge-Vielfalt · dominanter Nudge · Rare-Events |

Zentrales Signal: **Konflikt → Verzweigung/Rauheit/rote Turbulenz.**

### 8.2 Flaggschiff-Stile
- **Techno** — schwarzer Void, additives Neon (Cyan↔Magenta), Grid + Scanlines, strobende Front, Mono-Type. Lebt von der Glow-Ebene; nativster/leichtester Pfad.
- **Comic** — Crème-Grund, flache Tinten, dicke Tusche-Outlines, Ben-Day-Halftone, roter Front-Akzent, Genesis als Pow-Stern. Flach, kein Glow.
- **Pixel** — Low-Res-Buffer + Nearest-Neighbor-Upscale, Retro-Palette, CRT-Scanlines/Vignette, Pixel-Type, blockige Chrome.

### 8.3 Zielgruppen-Fit (Reddit)
Verbreitung erfolgt Install-für-Install → priorisieren nach Install-Chance × Stil-Fit. Comic deckt Memes + Anime/Manga; Techno deckt Gaming + Electronic/Tech; Pixel verdoppelt auf Gaming (zahlreichster, spielnativster Cluster). Sport ist ein hochaktives Install-Ziel mit „Bold Graphic" + Team-Palette via Genom.

---

## 9. Theme-Quelle: Modus A / Modus B

- **Modus A (Default, shippt):** Spiel im eigenen Subreddit, Tagesthema aus kuratierter Abstimmung. Kontrollierbar, sicher.
- **Modus B (Stretch):** in Host-Community installiert, liest deren echten Top-Post/Kommentare → Parameter. Magischer, aber Theme-Extraktion ist hart und braucht Moderation (NFR-7).
- Beide teilen dieselbe Engine; nur ein **Adapter** wechselt die Quelle.

---

## 10. Scope

| Bereich | MVP (4 Wochen) | Stretch | Out of Scope |
|---|---|---|---|
| Universum-Render | Schalen aus Aktivität, Genesis, Front, Zoom + Scrubber, Lesbarkeit | Spiralarm-Textur, Post-Level-Zoom (Stern→realer Post) | echtes Mandelbrot-Deep-Zoom |
| Daten | Live-Sammlung + Tick-Verfestigung, DayVector, Konflikt-Komposit | Backfill aus „Top of all time" | volle historische Rekonstruktion |
| Stil | 1–3 Flaggschiffe (Techno zuerst), Skin-als-Daten | Metal/Steampunk/Banksy, Community-Styles | — |
| Genom | Presets + Kern-Gewichte + Tagesgrenze | voller Advanced-Editor, Rare-Table-UI | — |
| Theme | Modus A | Modus B (echter Sub) | — |
| Front-Engine | Synthese→Scene→Paint→Kamera, Simulator | serverseitiges Preview-Render | Payments/Monetarisierung |

**Leitprinzip:** Politur über Ambition — die Jury belohnt „fertig & getestet" ausdrücklich höher.

---

## 11. Offene Entscheidungen

| ID | Entscheidung | Empfehlung |
|---|---|---|
| D-1 | Tiefe nach innen = älter (Urknall im Kern) vs. nach außen = älter | Kern = Genesis (innen = älter); deckt sich mit dem Mock |
| D-2 | Konzentrische Schalen vs. freie Spiralarme | Schalen als Fundament (Lesbarkeit), Spirale nur als Textur |
| D-3 | Ein Element = Post, Thread oder User | Thread/Post (greifbarster Deep-Zoom) |
| D-4 | Default-Flaggschiff-Stil | Techno/Bioluminescent (lebendigste Optik, leichtester Pfad) |
| D-5 | Modus A only vs. A+B | A garantiert fertig, B architektonisch vorbereiten |
| D-6 | Konflikt-Metrik-Zusammensetzung | als Komposit starten, an echten Daten tunen |
| D-7 | Zeitzone der Tagesgrenze | Mod setzt sie beim Install, Fallback UTC+4 |
| D-8 | Canvas2D-Basis vs. fbm-Shader-Basis | Canvas2D shippt, Shader als Woche-3-Upgrade für Phaser-Preis |

**Plattform zu verifizieren:** exakte Devvit-Trigger-Namen, Verfügbarkeit von Vote-Deltas in Echtzeit, Handler-Rate-Limits, Redis-Größen — gegen die offizielle devvit-docs, validiert durch das Scaffold.

---

## 12. Meilensteine (4 Wochen, ~10–15 h/Woche)

| Woche | Ziel |
|---|---|
| 1 | Engine refaktoriert (Synthese→Scene→Paint→Kamera) + **Daten-Simulator** füttert sie. Daten→Optik-Mapping tunen, ohne Plattform-Risiko. |
| 2 | Devvit-Web-Scaffold: Scheduler-Tick + Sweeper + Redis-Datenschicht + Genom-Transform. Engine als `webroot`. End-to-end mit echten/simulierten DayVectors. |
| 3 | Live-Front (Sammeln + Nudges + Freeze), Reveal-Post, Lesbarkeit/Scrubber, zweiter+dritter Stil. Optional fbm-Shader-Basis. |
| 4 | Politur: Front-Moment, Genesis, Onboarding, Mobile-Test, Bugfix. Einreichen mit Puffer. (Modus B / Post-Zoom nur falls Zeit.) |

---

## 13. Risiken

- **R-1 Kunst/Optik kippt in KI-Slop** → Naturreferenzen (Achat, Baumring, Koralle) + kohärentes generatives System; Stil früh festnageln.
- **R-2 Lesbarkeit stirbt unter Deko** → Tagging/Scrubber sind Pflicht in jedem Stil (NFR-4).
- **R-3 Mobile-Performance** → nur Front live, Rest gecacht, Schalen-LOD.
- **R-4 Konflikt-Proxy unzuverlässig** → Komposit + Tuning an echten Daten; Fallback auf einfachere Signale.
- **R-5 Devvit-API anders als angenommen** → früh gegen Doku validieren; Simulator entkoppelt Visualisierungs-Fortschritt von Plattform-Unsicherheit.
- **R-6 Scope für Solo + Vollzeitjob** → MVP-Disziplin, Stretch klar getrennt.
- **R-7 Cold Start / leere Subs** → Genom-Basiswerte machen karge Tage gewollt (NFR-8).
- **R-8 Modus-B-Moderation** → toxische Themen filtern; B als Stretch.

---

## 14. Preis-Zuordnung (Jury)

| Preis | Wie Subcosm trifft |
|---|---|
| Best App with a Hook ($15k) | Das einprägsame, eigenständige Artefakt + „was wurde es über Nacht" |
| Best Use of Phaser ($5k) | Prozeduraler Render / fbm-Shader-Basis als Showcase |
| Best Retention ($3k) | Tägliche Akkumulation, Front-und-Freeze, Reveal, persistenter geteilter Organismus |
| Best User Contributions ($3k) | Aktivität formt das Universum wörtlich; (Stretch) Community-Styles |
| Honorable Mentions | Politur-Sicherheitsnetz |
| Devvit Helper / Feedback | Discord-Hilfe + Survey (unabhängig vom Spiel mitnehmen) |

---

## 15. Glossar

- **Organismus / Universum** — das eine geteilte, persistente Artefakt einer Community.
- **Schale (Ring)** — die Darstellung eines Tages; ein Wachtag der Community.
- **Front (molten)** — die heutige, noch flüssige äußerste Schale, die sich live füllt und nachts erstarrt.
- **Genesis / Urknall** — der erste Post / Tag 1 im Zentrum; der Boden der Geschichte.
- **DayVector** — die ~25 Skalare, die einen Tag beschreiben; Vertrag Daten→Synthese.
- **Scene** — der stil-agnostische Szenengraph; Vertrag Synthese→Paint.
- **Genome** — die Config einer Community; das Framework.
- **StyleTemplate / Skin** — die Art-Direction als Daten; ein Stil pro Community.
- **Nudge** — eine Spieler-Aktion, die den *Mittelwert* eines Parameters der Front verschiebt.
- **Signal** — eine harte Tagesgröße (Aktivität, Konflikt, Momentum …), die über Gewichte Parameter treibt.
- **Tick** — der tägliche Lauf, der die Front einfriert und die nächste öffnet.
- **Sweeper** — der stündliche Job, der fällige Communities findet (zeitzonensicher).
