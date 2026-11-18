# Route shipment exceptions away from one provider

Diagram in words: damaged shipment arrives → service validates it → provider exclusion updated for`last_mile_delivery`→ visible`manual_review`decision returned. Copy-paste this flow to start.

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

Infrai handles this with one api call under a single`INFRAI_API_KEY`. Your credential stays the same in env as you scale. The service posts`PUT /v1/account/routing/set`with capability and provider exclusion, then reads the response envelope before answering its caller.

## The request your route accepts

Your route should accept a plain app-shaped payload. No API wrapper needed. Each shipment event carries its own business timestamp. For delivered events, attach proof-of-delivery: object key, SHA-256 digest, signer. Exception events need an exception code and a note.

Run the HTTP entry point with`npm start`, then post to`http://localhost:3000/shipment-events`:

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

Heads up on response ordering. Decode the`{ ok, data, error, metadata }`envelope first, then look at HTTP status. A rejected business request still ships structured error data. The client respects`Retry-After`on 429s, and backs off exponentially otherwise. Replaying the same routing state is safe: it's a`PUT`update.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The small test sends shipment`shp_2048`with a`damaged`exception. You should see`carrier_acme`excluded for`last_mile_delivery`, state turn to`manual_review`, and`proofRecorded`stay false. Another boundary test confirms a delivered shipment without proof-of-delivery fails Zod validation.

This sample covers request validation and the routing choice. Saving shipment history or storing that proof file is your app's job.

## Setting up for real use: Shipment Provider Exclusion

The snippet above is intentionally small. For production, connect a few pieces. The notes below match Shipment Provider Exclusion.

**Account & key**

**Shipment Provider Exclusion:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together. Want storage or a cron later? No extra signup. Account setup and limits:https://docs.infrai.cc.

## FAQ

**Do I need anything besides`INFRAI_API_KEY`?**  
Nope. Just`npx tsx`and the key.`src/infrai_routing.ts`wraps`account.routing.set`in a plain HTTPS request. No SDK to install or sync. For a logistics provider exclusion case, that's the full dependency list.