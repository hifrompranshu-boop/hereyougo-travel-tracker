# Voyage — AI Itinerary Planner

AI-powered trip planner: guided wizard → calendar-style day board → real places, travel times, budget, and optional cloud sync.

For the full product overview, feature list, and step-by-step usage, see **[PRODUCT_GUIDE.md](./PRODUCT_GUIDE.md)**.

## Features

- **4-step wizard** — multi-city, pace, budget, party, interests
- **Calendar board** — timed day columns, drag-and-drop, travel legs
- **Places & costs** — Google Places enrichment, ratings/$$, GBP + INR estimates
- **Party & budget** — adults/children/pets, day budget slider, info guidelines
- **Map & List** — Leaflet/OpenStreetMap map; timeline list view
- **Guest + optional Clerk** — IndexedDB locally; cloud sync when signed in
- **Share & export** — public share links, `.ics`, JSON

## Getting started

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Fill in keys in `.env.local` as needed. Without AI/Places keys the app still runs with mock data.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Recommended | AI generation (mock fallback) |
| `GOOGLE_PLACES_API_KEY` | Recommended | Server-side Places + Routes (not website-restricted) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional | Auth & cloud sync |
| `CLERK_SECRET_KEY` | Optional | Clerk backend |
| `OPENWEATHER_API_KEY` | Optional | Weather footer hints |
| `NEXT_PUBLIC_APP_URL` | Optional | App URL / OpenRouter referrer |

Interactive **Map** uses OpenStreetMap + Leaflet — no Maps JS key required. GBP→INR forex needs no key.

**Never commit `.env.local`** — only `.env.example` belongs in git.

## Tech stack

Next.js 16 · React 19 · Tailwind CSS v4 · @dnd-kit · Framer Motion · Dexie · Leaflet · OpenRouter · Google Places · Clerk (optional)
