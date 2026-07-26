/** Quick sanity check for stop info considerations */
import { createRequire } from "module";

// Inline the logic mirror so we don't need TS transpile in CI-less env
const PET_UNFRIENDLY =
  /museum|gallery|theatre|theater|cinema|mosque|temple|cathedral|church|synagogue|orthodox|fine dining|nightlife|club|bar|lounge|opera|aquarium|indoor market|shopping mall|landmark/i;

function check(name, category, party, notes = "") {
  const hay = `${name} ${category} ${notes}`;
  const items = [];
  if (party.pets > 0 && (PET_UNFRIENDLY.test(category) || PET_UNFRIENDLY.test(hay))) {
    items.push("pets");
  }
  if (notes.trim()) items.push("notes");
  return items;
}

const cathedral = check(
  "St. Thomas Orthodox Cathedral, Dubai",
  "landmark",
  { adults: 2, children: 0, pets: 1 },
  "Dress modestly"
);
const cafe = check("Artisan Coffee", "cafe", { adults: 2, children: 0, pets: 1 });
const CHILD_UNFRIENDLY_CATEGORY = /nightlife/i;
function checkFull(name, category, party, notes = "") {
  const items = check(name, category, party, notes);
  if (party.children > 0 && CHILD_UNFRIENDLY_CATEGORY.test(category)) items.push("children");
  return items;
}

const night = checkFull("Sky Lounge", "nightlife", { adults: 2, children: 1, pets: 0 });

const ok =
  cathedral.includes("pets") &&
  cathedral.includes("notes") &&
  cafe.length === 0 &&
  night.includes("children") &&
  !night.includes("pets");

console.log({ cathedral, cafe, night, ok });
if (!ok) process.exit(1);
console.log("party-compat sanity OK");
