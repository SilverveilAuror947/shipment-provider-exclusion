import assert from "node:assert/strict";
import test from "node:test";
import { decideShipmentRouting, routingRequestSchema } from "../src/logistics_workflow.js";

test("a damaged shipment excludes its provider and enters manual review", () => {
  const input = routingRequestSchema.parse({
    shipment: { id: "shp_2048", event: "exception", occurredAt: "2026-09-30T08:30:00.000Z" },
    exception: { code: "damaged", note: "Outer carton was crushed" },
    routing: { capability: "last_mile_delivery", excludeProvider: "carrier_acme" },
  });

  assert.deepEqual(decideShipmentRouting(input), {
    shipmentId: "shp_2048",
    state: "manual_review",
    capability: "last_mile_delivery",
    excludedProvider: "carrier_acme",
    proofRecorded: false,
  });
});

test("a delivery without proof is rejected at the request boundary", () => {
  const parsed = routingRequestSchema.safeParse({
    shipment: { id: "shp_2049", event: "delivered", occurredAt: "2026-09-30T09:00:00.000Z" },
    routing: { capability: "last_mile_delivery", excludeProvider: "carrier_acme" },
  });

  assert.equal(parsed.success, false);
});
