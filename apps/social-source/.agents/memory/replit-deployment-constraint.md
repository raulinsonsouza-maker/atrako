---
name: Replit deployment count constraint
description: Why scheduled jobs can't be auto-configured alongside a web app on Replit
---

The `deployConfig` callback only edits the single `[deployment]` block in `.replit`
(one deployment per repl from the agent's side). There is no callback to create a
SECOND, separate deployment (e.g. a Scheduled Deployment) programmatically.

**Why:** A web app that must stay online (autoscale/VM) and a daily cron job are
DIFFERENT Replit deployment types. You cannot have both via code — flipping
`.replit` to `scheduled` would convert the publish into a cron and take the website
offline.

**How to apply:** If a project needs both a live site AND a scheduled job and the
user can't/won't create the second deployment in the UI, the realistic options are:
(A) Reserved VM (always-on) + in-process scheduler — single publish, higher 24/7
cost; or (B) viewer-triggered on-demand work instead of a cron (see
viewer-triggered-sync.md). Vercel Cron (`vercel.json`) does NOT run on Replit.
