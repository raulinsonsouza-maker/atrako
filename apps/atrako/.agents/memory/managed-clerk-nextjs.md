---
name: Managed Clerk with Next.js
description: Environment-specific setup needed when using Replit-managed Clerk in this Next.js app.
---

Replit-managed Clerk provisions `CLERK_PUBLISHABLE_KEY`, but the Next.js SDK otherwise looks for `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Pass the managed key explicitly to both Clerk middleware and the client provider through the server layout.

**Why:** Without explicit wiring, the app compiles but every request fails at runtime with Clerk's “Missing publishableKey” error.

**How to apply:** Keep the key server-read in the root layout, pass it as a prop to the client provider, and configure the middleware with the same value. Do not duplicate or expose the key through a manually managed public environment variable.