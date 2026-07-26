"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { mergeTripsAfterSignIn } from "@/components/auth/merge-trips-dialog";

export default function ClerkMergeInner() {
  const { isSignedIn, user } = useUser();
  const merged = useRef(false);

  useEffect(() => {
    if (isSignedIn && user?.id && !merged.current) {
      merged.current = true;
      mergeTripsAfterSignIn(user.id).catch(console.error);
    }
  }, [isSignedIn, user?.id]);

  return null;
}
