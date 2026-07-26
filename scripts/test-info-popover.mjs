/**
 * Smoke-test: seed a trip with pets + cathedral, open board, click glowing "i".
 * Run with: node scripts/test-info-popover.mjs
 * Requires: next dev on localhost:3000, playwright installed.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const TRIP_ID = "e2e-info-popover";

const trip = {
  id: TRIP_ID,
  title: "E2E Info Popover",
  destinationPlaceId: "dest-1",
  destinationName: "Rome",
  startDate: "2026-08-01",
  numDays: 1,
  status: "generated",
  preferences: {
    pace: "moderate",
    budget: "moderate",
    defaultBudgetPerDay: 100,
    travelStyles: [],
    interests: [],
    mustInclude: [],
    avoid: [],
    dayStartTime: "09:00",
    dayEndTime: "21:00",
    mobility: "walk",
    adults: 2,
    children: 0,
    pets: 1,
  },
  days: [
    {
      id: "day-1",
      tripId: TRIP_ID,
      dayIndex: 0,
      date: "2026-08-01",
      label: "Day 1",
      adults: 2,
      children: 0,
      pets: 1,
      budgetGbp: 100,
      stops: [
        {
          id: "stop-1",
          tripDayId: "day-1",
          sortOrder: 0,
          placeId: "place-cathedral",
          name: "St Peter's Cathedral",
          category: "landmark",
          scheduledStart: "10:00",
          scheduledEnd: "11:30",
          durationMinutes: 90,
          notes: "Dress modestly",
          metadata: {
            rating: 4.8,
            verified: true,
            formattedAddress: "Vatican City",
            lat: 41.9022,
            lng: 12.4539,
          },
        },
      ],
      travelLegs: [],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });

  await page.evaluate(async (t) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("VoyageDB");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("trips", "readwrite");
        tx.objectStore("trips").put(t);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("trips")) {
          db.createObjectStore("trips", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("syncQueue")) {
          db.createObjectStore("syncQueue", { keyPath: "id" });
        }
      };
    });
  }, trip);

  await page.goto(`${BASE}/trip/${TRIP_ID}`, {
    waitUntil: "networkidle",
    timeout: 45000,
  });

  const infoBtn = page.getByRole("button", {
    name: /Info about St Peter's Cathedral/i,
  });
  await infoBtn.waitFor({ state: "visible", timeout: 20000 });
  await infoBtn.click();

  const pets = page.getByText("Pets", { exact: true });
  const notes = page.getByText("Notes", { exact: true });
  const petsMsg = page.getByText(/Pets are often not allowed/i);
  const notesMsg = page.getByText("Dress modestly");

  await pets.waitFor({ state: "visible", timeout: 5000 });
  await notes.waitFor({ state: "visible", timeout: 5000 });
  await petsMsg.waitFor({ state: "visible", timeout: 5000 });
  await notesMsg.waitFor({ state: "visible", timeout: 5000 });

  console.log(
    JSON.stringify(
      {
        ok: true,
        saw: ["Pets", "Notes", "pet policy message", "Dress modestly"],
      },
      null,
      2
    )
  );

  await browser.close();
}

main().catch(async (err) => {
  console.error("INFO_POPOVER_TEST_FAILED", err);
  process.exit(1);
});
