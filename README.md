# 🌱 EcoTrack — Personal Carbon Footprint Assistant

> Understand, track, and reduce your carbon footprint through simple actions and
> personalized, **interactive** insights.

EcoTrack is a smart, dynamic assistant that turns a few everyday inputs about how
you travel, power your home, eat, and shop into an estimated yearly carbon
footprint — then reasons about **your** situation to build an interactive plan
that helps you hit a climate goal.

**Challenge vertical:** Challenge 3 — *Carbon Footprint*.

> 🧭 New here? Click a **Quick-start** chip (🚗 / ✈️ / 🌿) to see the whole
> experience in one click, then tweak the numbers to match your life.

---

## ✨ What makes it a true *assistant* (not just a calculator)

1. **Estimates** your annual CO₂e across five categories — transport, home
   energy, food, shopping, and waste.
2. **Explains** it in plain language. A rule-based coaching note tells you your
   single biggest lever and the highest-impact first step — adapting to your data.
3. **Plans interactively.** Pick a goal (2030 target, "halve it", fully
   sustainable, or a custom number) and EcoTrack automatically selects the
   fewest, highest-impact actions to get you there.
4. **Simulates "what-if" live.** Tick or untick any action and a progress gauge
   instantly re-projects your footprint against your goal — so you can see the
   trade-offs and build a plan you'll actually follow.
5. **Tracks progress** with on-device snapshots and an SVG trend chart, plus
   motivational feedback on each change.
6. **Works anywhere.** Installable PWA, fully offline, zero dependencies, and
   100% private — your data never leaves your device.

The assistant is genuinely context-driven: an EV owner is never told to "switch
to an EV," a vegan is never told to eat less meat, someone who already recycles
won't see "start recycling," and the action plan **re-plans itself** the moment
you change your goal.

---

## 🚀 Run it

No build step and **zero runtime dependencies**.

```bash
# Start the bundled static server (Node 18+) — or just open index.html
npm start          # → http://localhost:4173

# Run the test suite (55 unit + integration tests, Node's built-in runner)
npm test
```

---

## 🧠 Architecture

The codebase is deliberately split into **pure logic** (no DOM, fully testable)
and a **thin UI layer**.

```
src/
  data/emissionFactors.js   Documented, sourced emission factors & benchmarks
  core/
    calculator.js           Profile -> annualized CO₂e breakdown (pure)
    benchmarks.js           Footprint -> rating, target gap, comparisons (pure)
    recommendations.js      Context-aware action engine (pure) — the "brain"
    planner.js              Goal planning + live what-if projection (pure)
    insights.js             Natural-language coaching, rule-based (pure)
    storage.js              Defensive localStorage wrapper (privacy-first)
    format.js               Shared number/text formatting (pure)
  presets.js                Quick-start example lifestyles
  chart.js                  Tiny accessible SVG trend chart (pure geometry)
  app.js                    Wires the form to the engines, renders safely
  styles.css                Accessible, responsive styling
index.html                  Semantic, labelled, keyboard-friendly UI
manifest.webmanifest, sw.js, icon.svg   PWA: installable + offline
tests/                      55 unit + integration tests
scripts/serve.js            Minimal static server with path-traversal guard
.github/workflows/ci.yml    CI: syntax-check + test on Node 18/20/22
```

### How the recommendation engine decides (the smart part)

[`src/core/recommendations.js`](src/core/recommendations.js) holds a library of
candidate actions. Each action is self-describing:

- **`applies(context)`** — is this relevant to *this* user? (e.g. "only if the
  car isn't already electric and its emissions are significant")
- **`saving(context)`** — kg CO₂e/year saved, computed from the user's own
  activity, not a generic number.
- **`detail(context)`** — a personalized explanation.

The engine filters to applicable actions, scores each by **impact ÷ effort**, and
returns a ranked plan. Adding a behaviour is just appending one object.

### How the planner powers the interactive goal (the dynamic part)

[`src/core/planner.js`](src/core/planner.js) is what makes it feel alive:

- **`projectFootprint(...)`** computes the footprint for *any subset* of chosen
  actions, capping savings per category so projections stay physically real.
- **`autoSelectForTarget(...)`** greedily picks the fewest high-impact actions
  that reach a goal, re-checking the true projection after each pick.
- **`goalStatus(...)`** reports whether a plan reaches the target and by how much.

The UI calls these on every toggle to update the gauge with no page reload.

---

## 📐 How the numbers work

Each input is converted to an **annual** figure and multiplied by a published
average emission factor (kg CO₂e), all documented in one place:
[`src/data/emissionFactors.js`](src/data/emissionFactors.js).

- **Transport** — per-km factors by mode and car fuel; flights entered as annual
  trip counts.
- **Home energy** — electricity by regional grid intensity + natural gas, split
  across the household.
- **Food** — dietary archetypes (meat-heavy → vegan).
- **Shopping & waste** — lifestyle-level proxies, with a recycling discount.

Primary references: UK DEFRA/DESNZ conversion factors, IEA grid intensities,
Poore & Nemecek (2018) on food, and Our World in Data per-capita figures.

---

## 🤔 Assumptions

- **Estimates, not accounting.** Results use population averages and guide
  decisions rather than certify exact emissions. The UI says so openly.
- **Household energy is shared**, so home energy is divided by household size.
- **Flights are annual events**, entered as trip counts with typical round-trip
  distances — easier and more realistic than per-month kilometres.
- **Shopping & waste** use spending / volume levels as sensible proxies.
- **Climate targets:** ~2.3 t CO₂e/person/yr (2030, 1.5 °C-aligned) and ~2.0 t
  long-term sustainable.

---

## ✅ Evaluation focus

- **Code quality** — small, pure, single-responsibility modules; one source of
  truth for data and for projection logic (shared by the engine and the UI);
  declarative, comment-documented rendering.
- **Security** — no backend, no network calls, no `eval`/`innerHTML`; all
  dynamic content set via `textContent`; user input sanitized at the boundary;
  the dev server and service worker both reject cross-origin/traversal requests;
  data never leaves the device.
- **Efficiency** — zero dependencies, no build, instant load, offline-capable;
  bounded on-device history; pure functions trivial to memoize or offload.
- **Testing** — 55 unit + integration tests covering calculation, benchmarks,
  the context-driven recommendation logic, the planner/what-if invariants,
  chart geometry, presets, NL coaching, and the full UI data pipeline. CI runs
  them on Node 18/20/22.
- **Accessibility** — semantic landmarks, a skip link, labelled `fieldset`/
  `legend` groups, real `<label>`s on every control, visible focus styles,
  `aria-live` result/gauge announcements, text-not-just-color charts, and
  `prefers-reduced-motion` / `forced-colors` support.

---

## 🔒 Privacy

EcoTrack is fully client-side. There is no account, no server, and no analytics.
Your inputs and saved history live only in your browser's `localStorage`, and you
can export or clear them at any time. Nothing is ever transmitted.

---

## 📄 License

[MIT](LICENSE).
