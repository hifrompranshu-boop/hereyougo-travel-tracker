"use client";

import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function HeaderAuth() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="h-8 w-24 animate-pulse rounded-xl bg-stone-200/60 dark:bg-stone-700/50" />
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
