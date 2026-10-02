import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, applyProviderExclusion } from "./infrai_routing.js";
import { routingRequestSchema } from "./logistics_workflow.js";

const port = Number(process.env.PORT ?? 3000);
const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/shipment-events") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = routingRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const decision = await applyProviderExclusion(input, apiKey);
    send(response, 200, decision);
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "Invalid shipment event", issues: error.issues });
      return;
    }
    if (error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must be valid JSON" });
      return;
    }
    if (error instanceof InfraiError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        details: error.details,
      });
      return;
    }
    send(response, 500, { error: "Shipment event could not be processed" });
  }
});

server.listen(port, () => console.log(`Shipment router listening on http://localhost:${port}`));
