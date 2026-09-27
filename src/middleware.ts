import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
);

/**
 * When Clerk keys are set: session cookies work with auth().
 * Guest mode stays open — routes are not force-protected.
 * authorizedParties locks session auth to known Voyage origins.
 */
export default clerkConfigured
  ? clerkMiddleware({
      authorizedParties: [
        "https://hereyougo.me",
        "https://www.hereyougo.me",
        "http://localhost:3000",
      ],
    })
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};