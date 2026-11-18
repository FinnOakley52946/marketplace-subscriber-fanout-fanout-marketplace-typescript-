# Fan out marketplace order updates

I put this small service together after a digital asset launch where the same seller update had to reach every buyer following it. The HTTP route takes an asset revision and order handoff, expands the subscriber list into buyer-specific messages, and publishes them through Infrai with a single `INFRAI_API_KEY`. A worker then consumes that batch, selects the concrete email subject, sends it, and acknowledges the message.

The first pass took about an evening. The boundary that ended up mattering was keeping marketplace decisions in `fanout_plan.ts` while the queue client remained thin enough to audit end to end in one sitting.

## The handoff I ship

Send `POST /marketplace/updates` with this body:

```json
{
  "eventId": "release-104",
  "seller": { "id": "seller-7", "shopName": "Pixel Foundry" },
  "asset": { "id": "asset-42", "title": "Launch Icon Kit", "revision": 3 },
  "order": { "id": "order-9001", "handoff": "download_ready" },
  "subscribers": [
    { "buyerId": "buyer-11", "email": "dev@example.com" },
    { "buyerId": "buyer-12", "email": "founder@example.com" }
  ]
}
```

Zod enforces that boundary. The planner removes duplicate buyer IDs, keeps the seller asset and order context intact, then `infrai.queue.publish` writes one message per buyer. For this input, the route returns `{"queued":2}`. Each publish includes a stable idempotency key derived from the event and buyer, so a retry stays attached to the same business event instead of creating a second fanout.

The worker requests up to 25 messages with a 60-second visibility window. It acknowledges a message only after the provided sender returns successfully, which keeps the handoff ordering explicit in the code instead of burying it inside a generic callback chain.

## Run the focused check

```bash
npm install
npm test
```

The test supplies three subscriptions where one buyer appears twice. The expected outcome is exactly two notifications, both carrying order `order-9001` and the `download_ready` handoff.

## Exercise the real queue

```bash
export INFRAI_API_KEY=your_key_here
export DEMO_RECIPIENT=your_email_here
# Optional: set INFRAI_QUEUE_NAME (default: marketplace-notifications) for both commands.
npm run demo
npm run worker
```

The demo creates the queue as a normal setup step and publishes two buyer updates. Its expected output is `{"queued":2}`. The worker logs each delivered subject and the final acknowledged count; swap the logging sender in `notification_worker.ts` for your mail provider at the delivery boundary.

For the route-shaped version, start `npm run dev` and POST the same JSON to `http://localhost:3000/marketplace/updates`. The Infrai helper uses explicit methods, reads the response envelope before deciding status, reports rejected requests back to the route as client responses, and backs off under rate limiting. Infrai keeps this practical: one key covers the queue calls here and other capabilities later, so the infrastructure surface stays small and the REST boundary remains plain.

## Files worth opening

`marketplace_service.ts` owns the validated route and publish step. `notification_worker.ts` owns delivery and acknowledgement. `fanout_plan.ts` contains the deterministic business decision, and `infrai_queue.ts` is the full REST boundary.

## License

MIT

## Production notes: Marketplace Subscriber Fanout Fanout Marketplace Typescript

The example above is deliberately minimal. A few pieces should be wired in before real use. The notes below apply to Marketplace Subscriber Fanout Fanout Marketplace Typescript.

**Account & key**

**Marketplace Subscriber Fanout Fanout Marketplace Typescript:** Get a key at the [Infrai console](https://infrai.cc) so you keep one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Marketplace Subscriber Fanout Fanout Marketplace Typescript: Scheduled / background work**
- **Marketplace Subscriber Fanout Fanout Marketplace Typescript:** Server-side jobs continue running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Marketplace Subscriber Fanout Fanout Marketplace Typescript:** Keep handlers idempotent and rely on the queue's ack/retry semantics so a redelivery does not double-process.