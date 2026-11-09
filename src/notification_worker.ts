import { z } from "zod";
import { infrai } from "./infrai_queue.js";

const queuedMessageSchema = z.object({
  message_id: z.string().min(1),
  payload: z.object({
    eventId: z.string(),
    buyerId: z.string(),
    email: z.string().email(),
    assetTitle: z.string(),
    orderId: z.string(),
    handoff: z.enum(["download_ready", "seller_review"])
  }).passthrough()
});

const consumeSchema = z.union([
  z.array(queuedMessageSchema),
  z.object({ messages: z.array(queuedMessageSchema) }).transform((value) => value.messages)
]);

export async function deliverBatch(
  send: (email: string, subject: string) => Promise<void>
): Promise<number> {
  const messages = consumeSchema.parse(await infrai.queue.consume(25, 60));

  for (const message of messages) {
    const subject = message.payload.handoff === "download_ready"
      ? `${message.payload.assetTitle} is ready for order ${message.payload.orderId}`
      : `${message.payload.assetTitle} needs seller review`;
    await send(message.payload.email, subject);
    await infrai.queue.ack(
      message.message_id,
      `ack:${message.payload.eventId}:${message.payload.buyerId}`
    );
  }
  return messages.length;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  deliverBatch(async (email, subject) => {
    console.log(`sent to ${email}: ${subject}`);
  }).then((count) => console.log(`acknowledged ${count} notifications`));
}
