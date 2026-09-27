"use client";

import { useEffect, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

/** If Clerk JS never loads (e.g. missing clerk.* DNS), stop spinning and stay usable as guest. */
const LOAD_TIMEOUT_MS = 5000;

export function HeaderAuth() {
  const { isSignedIn, isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  if (!isLoaded && !timedOut) {
    return (
      <div
        className="h-8 w-24 animate-pulse rounded-xl bg-stone-200/60 dark:bg-stone-700/50"
        aria-hidden
      />
    );
  }

  // Clerk failed to initialize — do not mount SignInButton (it will throw). Guest UX stays up.
  if (!isLoaded && timedOut) {
    return (
      <span
        className="text-xs text-muted"
        title="Sign-in unavailable (Clerk did not load). Check DNS for clerk.hereyougo.me."
      >
        Guest
      </span>
    );
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted sm:inline">Signed in</span>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SignInButton mode="modal">
        <Button variant="ghost" size="sm">
          Log in
        </Button>
      </SignInButton>
      <SignUpButton mode="modal">
        <Button size="sm">Sign up</Button>
      </SignUpButton>
    </div>
  );
}