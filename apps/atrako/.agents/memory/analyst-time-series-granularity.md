---
name: Analyst time-series granularity
description: Why requested monthly or daily detail must remain explicit through the full analyst pipeline.
---

When a user asks for “mês a mês”, “por mês”, “dia a dia” or equivalent wording, preserve that granularity from intent planning through data aggregation and final response formatting. An accumulated period total does not answer a time-series request.

**Why:** A real conversation requested monthly detail but received a year-to-date total because the planner stored only the date interval. A later payload-size check could also discard the requested series, leaving the model without evidence and encouraging fabrication.

**How to apply:** Treat granularity as a closed structured field, aggregate the requested buckets in the data layer, require one output row per available bucket, and make payload compaction discard secondary context before requested series evidence.