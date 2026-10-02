import { applyProviderExclusion } from "../src/infrai_routing.js";
import { routingRequestSchema } from "../src/logistics_workflow.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const event = routingRequestSchema.parse({
  shipment: {
    id: "shp_2048",
    event: "exception",
    occurredAt: "2026-09-30T08:30:00.000Z",
  },
  exception: {
    code: "damaged",
    note: "Outer carton was crushed at the destination depot",
  },
  routing: {
    capability: "last_mile_delivery",
    excludeProvider: "carrier_acme",
  },
});

console.log(JSON.stringify(await applyProviderExclusion(event, apiKey), null, 2));
