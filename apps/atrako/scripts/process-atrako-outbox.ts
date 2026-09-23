import { processAtrakoOutboxBatch } from "@/lib/atrako/outbox";

const result = await processAtrakoOutboxBatch();
console.log(JSON.stringify(result));
