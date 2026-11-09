import { z } from "zod";

export const marketplaceUpdateSchema = z.object({
  eventId: z.string().min(1),
  seller: z.object({
    id: z.string().min(1),
    shopName: z.string().min(1)
  }),
  asset: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    revision: z.number().int().positive()
  }),
  order: z.object({
    id: z.string().min(1),
    handoff: z.enum(["download_ready", "seller_review"])
  }),
  subscribers: z.array(z.object({
    buyerId: z.string().min(1),
    email: z.string().email()
  })).min(1).max(500)
});

export type MarketplaceUpdate = z.infer<typeof marketplaceUpdateSchema>;

export type BuyerNotification = {
  eventId: string;
  buyerId: string;
  email: string;
  sellerId: string;
  shopName: string;
  assetId: string;
  assetTitle: string;
  revision: number;
  orderId: string;
  handoff: MarketplaceUpdate["order"]["handoff"];
};

export function planFanout(update: MarketplaceUpdate): BuyerNotification[] {
  const recipients = new Map(
    update.subscribers.map((subscriber) => [subscriber.buyerId, subscriber])
  );

  return Array.from(recipients.values(), (subscriber) => ({
    eventId: update.eventId,
    buyerId: subscriber.buyerId,
    email: subscriber.email,
    sellerId: update.seller.id,
    shopName: update.seller.shopName,
    assetId: update.asset.id,
    assetTitle: update.asset.title,
    revision: update.asset.revision,
    orderId: update.order.id,
    handoff: update.order.handoff
  }));
}
