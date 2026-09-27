
Zielgruppe: Azubis FiSi/FiAE, Technikerschule, IT-Weiterbildung (adult learners)
Session: 45 min geführt (Lehrer am Smartboard oder Projektor) oder 20 min Solo-Exploration
Spielerzahl: 1, mit „Presenter Mode" (Lehrer steuert, Klasse sieht)

Die Kernmechanik: Der Maßstabs-Regler

Ein einziger logarithmischer Slider koppelt Raum und Zeit. Das ist die zentrale Design-Idee des ganzen Spiels — der Spieler zoomt nie nur räumlich, sondern immer auch zeitlich.

```bash
Raum:  1 m ──── 10 mm ──── 100 µm ──── 10 µm ──── 1 µm
Zeit:  1 s ──── 20 ms ──── 672 ns ──── 8 ns ──── 1 ns
Ebene: Gehäuse  LED/Stretch  Frame     Symbol    Bit
```

Lernziele (messbar):

1. Ein LED-Blitz ≠ ein Paket. Der Spieler kann die Ratio ~40.000:1 erklären.
2. MAC baut Frames, PHY macht Physik. Klare Rollentrennung.
3. Twisting ≠ Ordnung, sondern Feldauslöschung + differentielles Signal.
4. Gigabit = 4 Pairs, bidirektional, PAM-5, 8 ns Symboltakt.
5. Der Link ist nie still — auch wenn die LED dunkel ist.

## Setup

```bash
npm create vite@latest pulse -- --template react-ts
cd pulse
npm i three @react-three/fiber @react-three/drei @react-three/postprocessing zustand
npm i -D @types/three
npm run dev
```

```bash
src/
├─ main.tsx  styles.css  App.tsx
├─ core/   scales.ts  net.ts  sim.ts  store.ts
├─ scene/  Stage.tsx  Hardware.tsx  Silicon.tsx  Cable.tsx  Signal.tsx
├─ ui/     ScaleRail.tsx  Hud.tsx  FrameInspector.tsx  Scope.tsx
└─ labs/   AutoMdixLab.tsx  TwistLab.tsx  Pam5Lab.tsx  BlinkDetective.tsx
```