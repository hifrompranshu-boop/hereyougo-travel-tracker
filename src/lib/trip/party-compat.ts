import type { Stop } from "@/lib/types/trip";
import type { HoursStatus } from "@/lib/time/hours";

export type ConsiderationKind =
  | "pets"
  | "children"
  | "notes"
  | "hours"
  | "verify"
  | "access";

export type StopConsideration = {
  kind: ConsiderationKind;
  title: string;
  message: string;
};

const PET_UNFRIENDLY =
  /museum|gallery|theatre|theater|cinema|mosque|temple|cathedral|church|synagogue|orthodox|fine dining|nightlife|club|bar|lounge|opera|aquarium|indoor market|shopping mall|landmark/i;

const PET_UNFRIENDLY_CATEGORY =
  /museum|nightlife|culture|theater|theatre|shopping|landmark/i;

const CHILD_UNFRIENDLY =
  /nightlife|nightclub|strip|cocktail bar|wine bar|speakeasy|adults?\s*only|18\+|21\+/i;

const CHILD_UNFRIENDLY_CATEGORY = /nightlife/i;

/**
 * Guidelines only when party includes pets/children and the stop is a likely mismatch.
 */
export function getStopPartyGuidelines(
  stop: Stop,
  party: { adults: number; children: number; pets: number }
): Array<Pick<StopConsideration, "kind" | "message"> & { kind: "pets" | "children" }> {
  return getStopConsiderations(stop, party, "unknown").filter(
    (c): c is StopConsideration & { kind: "pets" | "children" } =>
      c.kind === "pets" || c.kind === "children"
  );
}

/** Full list of considerations for the info popover */
export function getStopConsiderations(
  stop: Stop,
  party: { adults: number; children: number; pets: number } | undefined,
  hoursStatus: HoursStatus = "unknown"
): StopConsideration[] {
  const items: StopConsideration[] = [];
  const hay = `${stop.name} ${stop.category} ${stop.notes ?? ""} ${stop.metadata?.description ?? ""}`;

  if (party && party.pets > 0) {
    if (
      PET_UNFRIENDLY_CATEGORY.test(stop.category) ||
      PET_UNFRIENDLY.test(hay)
    ) {
      items.push({
        kind: "pets",
        title: "Pets",
        message:
          "Pets are often not allowed at this type of place (worship sites, museums, many indoor venues). Call ahead or check the venue’s pet policy before visiting.",
      });
    }
  }

  if (party && party.children > 0) {
    if (
      CHILD_UNFRIENDLY_CATEGORY.test(stop.category) ||
      CHILD_UNFRIENDLY.test(hay)
    ) {
      items.push({
        kind: "children",
        title: "Children",
        message:
          "This stop may not suit children (age limits, late hours, or adult-oriented venue). Confirm family rules or swap for a kid-friendly option.",
      });
    }
  }

  if (stop.notes?.trim()) {
    items.push({
      kind: "notes",
      title: "Notes",
      message: stop.notes.trim(),
    });
  }

  if (hoursStatus === "closed") {
    items.push({
      kind: "hours",
      title: "Opening hours",
      message:
        "This place looks closed at the scheduled time — consider moving it or swapping for somewhere open.",
    });
  } else if (hoursStatus === "opens-later") {
    items.push({
      kind: "hours",
      title: "Opening hours",
      message:
        "This place opens later than your current slot — you may need to visit later in the day.",
    });
  }

  if (stop.metadata?.verified === false) {
    items.push({
      kind: "verify",
      title: "Verify location",
      message:
        "This stop wasn’t fully verified on the map. Double-check the address before you go.",
    });
  }

  // Only show the info button when we have something useful
  return items;
}

export function shouldShowInfoButton(
  stop: Stop,
  party: { adults: number; children: number; pets: number } | undefined,
  hoursStatus: HoursStatus
): boolean {
  return getStopConsiderations(stop, party, hoursStatus).length > 0;
}
