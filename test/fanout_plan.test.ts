import assert from "node:assert/strict";
import test from "node:test";
import { marketplaceUpdateSchema, planFanout } from "../src/fanout_plan.js";

test("creates one order handoff per unique buyer", () => {
  const update = marketplaceUpdateSchema.parse({
    eventId: "release-104",
    seller: { id: "seller-7", shopName: "Pixel Foundry" },
    asset: { id: "asset-42", title: "Launch Icon Kit", revision: 3 },
    order: { id: "order-9001", handoff: "download_ready" },
    subscribers: [
      { buyerId: "buyer-11", email: "first@example.com" },
      { buyerId: "buyer-11", email: "latest@example.com" },
      { buyerId: "buyer-12", email: "other@example.com" }
    ]
  });

  const notifications = planFanout(update);

  assert.equal(notifications.length, 2);
  assert.deepEqual(
    notifications.map((item) => [item.buyerId, item.orderId, item.handoff]),
    [
      ["buyer-11", "order-9001", "download_ready"],
      ["buyer-12", "order-9001", "download_ready"]
    ]
  );
});
