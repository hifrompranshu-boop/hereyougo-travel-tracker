"use client";

import dynamic from "next/dynamic";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const ClerkMergeEffectInner = clerkKey
  ? dynamic(() => import("@/components/auth/clerk-merge-inner"), { ssr: false })
  : null;

export function ClerkMergeEffect() {
  if (!ClerkMergeEffectInner) return null;
  return <ClerkMergeEffectInner />;
}
