import { infrai } from "../src/infrai_queue.js";
import { publishMarketplaceUpdate } from "../src/marketplace_service.js";

const recipient = process.env.DEMO_RECIPIENT;
if (!recipient) throw new Error("Set DEMO_RECIPIENT before running the demo");

await infrai.queue.create("marketplace-notifications-setup-v1");

const result = await publishMarketplaceUpdate({
  eventId: "release-104",
  seller: { id: "seller-7", shopName: "Pixel Foundry" },
  asset: { id: "asset-42", title: "Launch Icon Kit", revision: 3 },
  order: { id: "order-9001", handoff: "download_ready" },
  subscribers: [
    { buyerId: "buyer-11", email: recipient },
    { buyerId: "buyer-12", email: recipient }
  ]
});

console.log(JSON.stringify(result));
