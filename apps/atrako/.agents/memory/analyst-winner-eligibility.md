---
name: Analyst winner eligibility
description: Rules for declaring a best campaign or creative without substituting intermediate metrics for business outcomes.
---

Do not declare a campaign or creative the overall “best” when the configured business objective has no positive result. Intermediate metrics such as CPC and CTR may describe traffic efficiency, but they do not establish success in leads, purchases, revenue, or messaging outcomes.

**Why:** A real analysis called a zero-lead creative the best because it had the lowest CPC. A related edge case allowed a stopped creative to reuse previous-period outcomes and become a current-period winner.

**How to apply:** Resolve configured campaign/account objectives before click or impression fallbacks. Compute winner eligibility in the backend from current-period primary outcomes, keep stopped-item outcomes at zero, and expose an explicit insufficient-evidence status to the model. Allow CPC as the winning criterion only when CPC or traffic is explicitly requested.