# Voyage — Product Guide

## Product overview

Voyage is an AI-powered itinerary planner that turns structured trip preferences into a living day-by-day plan. You set cities, dates, pace, budget, and party size through a guided wizard; the app generates timed stops on a Google Calendar–style board where you can drag, swap, lock, and re-optimize while travel times, opening hours, weather, and spend stay in view. Guest trips save locally; optional Clerk sync and share links cover cloud and collaboration.

## Updated plan / principles

- **Structured first** — chips, sliders, and counters over free-text; notes remain optional.
- **Board as the product** — primary view is a timed calendar board (days as columns, stops as photo cards); Map and List are secondary.
- **Feasible by default** — real places (Google Places when keyed), mode-aware travel legs, pace caps, hours awareness, and route optimize when you move things.
- **You stay in control** — lock stops, swap alternatives, nudge day budgets, apply preference text, undo recent board changes.
- **Glass + brand accent** — soft glass surfaces, one accent (teal), place photos as card bases with soft overlays; Geist for UI, Fraunces for display.
- **Header scrolls with the page** — not sticky/floating.
- **Weather is a slim bottom footer** — not a mid-screen banner.
- **Map = Leaflet + OpenStreetMap** — interactive map needs no Google Maps JS key; Places/Routes keys are separate and server-side.
- **Money** — day budgets and estimates in GBP, with INR shown via daily forex; party size scales *estimated spend* only — the day budget limit stays fixed unless you move the slider.
- **Party-aware guidance** — glowing **i** opens a popover (pets / kids / notes / hours), not a title-only tooltip.

### What we deliberately don’t do

- Sticky floating chrome or mid-viewport weather chips.
- Jewel-tone multi-hue cards as the primary visual system.
- Treating Google Maps JS as the interactive map (OSM/Leaflet is the map).
- Rescaling the day budget cap when adults/children/pets change.

---

## Feature list

### Trip planning

- Home: saved trips grid, **Plan a trip**, dark/light toggle, guest mode (optional Clerk).
- **4-step wizard**: Cities → Style → Interests → Review.
- **Multi-city**: search places, arrival date/time, nights per city, transit to next (flexible max hours or booked departure + duration); transit days appear on the board.
- Party: adults / children / pets; daily exploring window (start–end).
- Pace (relaxed / moderate / packed), budget tier + default spend/day slider (GBP), travel styles, mobility (walk / mixed / car / accessible).
- Interests chips, must-include (up to 3), avoid chips, optional free-text notes.
- AI generation via OpenRouter + Places enrichment (mock fallback without keys).

### Calendar board

- **Calendar view** (default): shared time gutter, day columns, stop blocks positioned by schedule (Google Calendar–like).
- Drag-and-drop reorder within a day or between days; travel legs refresh after moves.
- Overpacked-day indicators from pace limits; optimize one day or all days.
- Add stop, regenerate/adjust via preferences bar (“Apply”), undo toast for recent edits.
- Views: **Board** | **Map** | **List** (timeline); day filter on Map/List.
- Stop detail drawer: hours, rating, price, cost, notes, lock, remove, AI/search swap alternatives.

### Places & costs

- Ratings and Google-style **$$** price levels on cards and detail.
- Estimated stop/day spend in **GBP**, with **INR** via `/api/forex` (Frankfurter/ECB; no key).
- Photo-backed stop cards with soft gradient overlay and category accent icon.
- Hours status (e.g. closed) and unverified rings when data is weak.
- Mode-aware travel (walk / transit / drive) between stops; meal-aware generation when AI/Places are available.

### Party & budget

- Trip-wide and per-day party counters.
- Day budget slider (£20–£600): lowering can auto-swap cheaper unlocked stops to fit.
- Estimated spend scales with adults (full) and children (~60%); pets do not inflate venue spend.
- **Day budget limit does not change** when party size changes.
- Info (**i**) popover: pets, children, notes, hours, and related considerations; toast when party change flags many stops.

### Design / theme

- Glass panels/cards, brand accent, Fraunces + Geist.
- Non-sticky header; app canvas background (not flat single-color only).
- Slim bottom footer for weather or optimization hints.

### Share / export

- IndexedDB auto-save for guests.
- Optional Clerk cloud sync + merge after sign-in.
- Share link (read-only public page).
- Export JSON and download `.ics` calendar.

---

## User guide

### 1. Create a trip

1. Open the app → **Plan a trip** (or **My trips** → same).
2. Complete the wizard (below) → generate → land on the board.

### 2. Wizard

1. **Cities** — Add each city (search), landing date/time, days to stay. For multi-city, set transit to the next city (flexible or booked). Set who’s going and exploring hours.
2. **Style** — Pace, budget tier, default spend/day, travel styles, getting around.
3. **Interests** — Categories, optional must-includes and avoids; expand notes if needed.
4. **Review** — Confirm summary → generate itinerary.

### 3. Board (Calendar)

- Scroll horizontally across days; vertical axis is time.
- Drag a stop to reorder or move to another day; travel times recalculate.
- Use **Optimize** on a day (or all) to reduce backtracking.
- Click a stop for the detail panel; lock important stops before budget/AI swaps.

### 4. Preferences

- Use the preferences text field + send control to apply natural-language tweaks (e.g. “more parks, fewer museums”).
- Locked stops are respected where possible; unlock to allow replacements.

### 5. Budget

- Per day: read estimated spend (GBP · INR) vs the slider limit.
- Drag the **day budget** slider to set the cap; if over budget, the app may swap unlocked cheaper alternatives.
- Change adults/children/pets to update *estimated* spend only — the limit stays put until you move the slider.

### 6. Swap stops

- Open a stop → search or AI alternatives → pick a replacement.
- Or tighten the day budget to trigger automatic swaps of unlocked stops.
- Prefer locking must-see places first.

### 7. Map & List

- **Map** — Leaflet/OSM: pan, zoom, markers; filter by day; click for details.
- **List** — Full-trip timeline of stops.
- Return to **Board** for scheduling edits.

### 8. Share & export

- Menu: share link (clipboard), download `.ics`, export JSON.
- Sign in (if Clerk configured) to sync; guests keep working offline in IndexedDB.

---

## Tips & gotchas

| Topic | Detail |
| --- | --- |
| **Env keys** | Copy `.env.example` → `.env.local`. Useful: `OPENROUTER_API_KEY`, `GOOGLE_PLACES_API_KEY`, optional Clerk + `OPENWEATHER_API_KEY`. Map view does **not** need a Maps JS key. Forex needs none. |
| **Regenerate old trips** | Trips made before multi-city / party / photo-card / calendar layout may lack fields. Prefer regenerating or re-planning for full behaviour. |
| **Budget slider vs party** | Slider = fixed day **limit**. Party = scales **estimated spend** (and may show over-budget). Pets don’t add spend but can light the **i** guidelines. |
| **Pet / kids info icons** | Glowing **i** opens a popover with considerations — read it before visiting; guidelines are heuristic, not venue policy. |
| **Footer weather** | Slim bar at the **bottom** when rain/conditions suggest swapping outdoor stops; dismissible. Optimization hints can use the same footer slot. |
| **Mock mode** | Without AI/Places keys the app still runs with mock places — good for UI, not for real bookings. |
| **Places key restriction** | Use a **server-side** key (not website-restricted browser key) for Places/Routes proxies. |

---

*Voyage — plan in control, stay feasible.*
