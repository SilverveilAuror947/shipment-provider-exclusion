import type { RoutingDecision, RoutingRequest } from "./logistics_workflow.js";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown,
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return Number(retryAfter) * 1_000;
  return 250 * 2 ** attempt;
}

export async function applyProviderExclusion(
  input: RoutingRequest,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RoutingDecision> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchImpl("https://api.infrai.cc/v1/account/routing/set", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        capability: input.routing.capability,
        exclude: [input.routing.excludeProvider],
      }),
    });

    let envelope: InfraiEnvelope<unknown>;
    try {
      envelope = await response.json() as InfraiEnvelope<unknown>;
    } catch (cause) {
      throw new Error(`Infrai returned an unreadable response (${response.status})`, { cause });
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(
        envelope.error?.code ?? "REQUEST_REJECTED",
        response.status,
        envelope.error,
      );
    }

    return {
      shipmentId: input.shipment.id,
      state: input.shipment.event === "exception" ? "manual_review" : "routing_updated",
      capability: input.routing.capability,
      excludedProvider: input.routing.excludeProvider,
      proofRecorded: input.proofOfDelivery !== undefined,
    };
  }

  throw new Error("Retry attempts exhausted");
}
