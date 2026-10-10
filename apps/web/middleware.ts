import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Exported so the public paths this site serves can be asserted directly. The
 * `config.matcher` below does **not** exclude `.json` — `js(?!on)` matches
 * `.js` only when it is not followed by `on` — so `/.well-known/assetlinks.json`
 * runs through this middleware. What keeps it, `/.well-known/apple-app-site-association`,
 * `/convite/*` and `/baixar` reachable without a session is `isProtectedRoute`
 * naming only the manager account area, and that is worth a test rather than a
 * comment.
 */
export const isPublicRoute = createRouteMatcher(["/conta/login(.*)"]);
export const isProtectedRoute = createRouteMatcher(["/conta(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req) && !isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
