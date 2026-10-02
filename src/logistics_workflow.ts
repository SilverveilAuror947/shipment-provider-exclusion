import { z } from "zod";

export const routingRequestSchema = z.object({
  shipment: z.object({
    id: z.string().min(1),
    event: z.enum(["picked_up", "in_transit", "delivered", "exception"]),
    occurredAt: z.iso.datetime(),
  }),
  proofOfDelivery: z.object({
    objectKey: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    signedBy: z.string().min(1),
  }).optional(),
  exception: z.object({
    code: z.enum(["damaged", "address_issue", "missed_delivery"]),
    note: z.string().min(1),
  }).optional(),
  routing: z.object({
    capability: z.string().min(1),
    excludeProvider: z.string().min(1),
  }),
}).superRefine((value, context) => {
  if (value.shipment.event === "delivered" && !value.proofOfDelivery) {
    context.addIssue({ code: "custom", path: ["proofOfDelivery"], message: "Delivered shipments require proof of delivery" });
  }
  if (value.shipment.event === "exception" && !value.exception) {
    context.addIssue({ code: "custom", path: ["exception"], message: "Exception events require exception details" });
  }
});

export type RoutingRequest = z.infer<typeof routingRequestSchema>;

export type RoutingDecision = {
  shipmentId: string;
  state: "routing_updated" | "manual_review";
  capability: string;
  excludedProvider: string;
  proofRecorded: boolean;
};

export function decideShipmentRouting(input: RoutingRequest): RoutingDecision {
  return {
    shipmentId: input.shipment.id,
    state: input.shipment.event === "exception" ? "manual_review" : "routing_updated",
    capability: input.routing.capability,
    excludedProvider: input.routing.excludeProvider,
    proofRecorded: input.proofOfDelivery !== undefined,
  };
}
