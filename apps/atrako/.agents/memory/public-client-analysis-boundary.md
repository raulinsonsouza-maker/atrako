---
name: Public client analysis boundary
description: Product and security boundary for anonymous client dashboards and server-side provider access.
---

Anonymous visitors may open a direct client dashboard and use Meta, Google, Social Media, and creative analysis. The cross-client directory, CRM, LinkedIn, Gestão, configuration, AI analyst, synchronization, and other operational controls require an internal session.

Public analysis may call a provider server-side when no persisted equivalent exists, but credentials must never be serialized. Any resource identifier supplied by the browser must first be proven to belong to the requested active client.

**Why:** Public analytical sharing is a product requirement, while cross-client visibility, writes, configuration, AI usage, and arbitrary provider-resource access would expose operational data or consume privileged capabilities.

**How to apply:** New dashboard reads must opt into public access explicitly and only when they belong to the four public analysis areas. Keep writes and operational reads authenticated; validate client ownership before resolving integration credentials.