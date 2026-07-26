"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function HeaderAuth() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <UserButton />;
  }

  return (
    <SignInButton mode="modal">
      <Button variant="secondary" size="sm">
        Sign in
      </Button>
    </SignInButton>
  );
}
