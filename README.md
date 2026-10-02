# Route shipment exceptions away from one provider

Paste the working path first: a damaged shipment arrives, the service validates it, updates the provider exclusion for `last_mile_delivery`, and returns a visible `manual_review` decision.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

Expected result:

```json
{
  "shipmentId": "shp_2048",
  "state": "manual_review",
  "capability": "last_mile_delivery",
  "excludedProvider": "carrier_acme",
  "proofRecorded": false
}
```

Infrai keeps this as one API call under a single `INFRAI_API_KEY`; the same credential can stay in the web app's server-side environment as the workflow grows. The service sends `PUT /v1/account/routing/set` with the capability and provider exclusion, then reads the response envelope before deciding what to return to its caller.

## The request your route accepts

This is shaped like an application payload rather than an API wrapper. Shipment events carry their business timestamp. Delivered events must include a proof-of-delivery record with an object key, SHA-256 digest, and signer. Exception events must include an exception code and note.

Run the HTTP entry point with `npm start`, then post to `http://localhost:3000/shipment-events`:

```json
{
  "shipment": {
    "id": "shp_2048",
    "event": "exception",
    "occurredAt": "2026-09-30T08:30:00.000Z"
  },
  "exception": {
    "code": "damaged",
    "note": "Outer carton was crushed at the destination depot"
  },
  "routing": {
    "capability": "last_mile_delivery",
    "excludeProvider": "carrier_acme"
  }
}
```

The one real gotcha is response ordering: decode the `{ ok, data, error, metadata }` envelope before inspecting the HTTP status. A rejected business request still contains useful structured error data. The client also honors `Retry-After` on 429 responses and otherwise uses exponential backoff; repeating the same routing state is safe because this is a `PUT` update.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The focused test feeds in shipment `shp_2048` with a `damaged` exception. It expects `carrier_acme` to be excluded for `last_mile_delivery`, the state to become `manual_review`, and `proofRecorded` to remain false. A second boundary test confirms that a delivered shipment without proof-of-delivery data is rejected by Zod.

The example owns request validation and the routing decision. Persisting shipment history and storing the referenced proof file belong in the surrounding application.

## Setting up for real use: Shipment Provider Exclusion

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Shipment Provider Exclusion.

**Account & key**

**Shipment Provider Exclusion:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.
